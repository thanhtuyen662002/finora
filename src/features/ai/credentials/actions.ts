'use server';

/**
 * Finora AI Feature Module — Credential Server Actions
 * Phase 11 — Authenticated Personal & Admin Credential Management
 *
 * Security Invariants:
 * 1. Actor identity strictly derived from server-side authenticated session via auth.getUser().
 * 2. Admin authority verified via verifyAdminActor() using immutable environment admin user IDs.
 * 3. Browser-safe metadata DTO only; zero plaintext, ciphertext, nonce, auth tag, or key ID returned.
 * 4. Target user email used strictly as a locator; resolved server-side to immutable auth UUID.
 * 5. Fail-closed error handling with sanitized user-facing messages.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdminActor } from '@/lib/auth/admin';
import {
  createAiCredentialRepository,
  validatePlaintextApiKey,
} from '@/lib/ai/credentials/repository';
import { AiError } from '@/lib/ai/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActionResult,
  AdminTargetUserDTO,
} from './types';

// RFC 4122 v4 UUID validator
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Safely sanitizes internal or cryptographic errors into browser-safe error contracts.
 */
function sanitizeActionError(err: unknown, fallbackMessage: string): ActionResult<never> {
  if (err instanceof AiError) {
    if (err.code === 'AI_CREDENTIAL_KEY_UNAVAILABLE') {
      return {
        ok: false,
        code: 'AI_CREDENTIAL_CONFIG_MISSING',
        message: 'Credential encryption is not currently configured on the server.',
      };
    }
    if (err.code === 'AI_CREDENTIAL_CORRUPTED') {
      return {
        ok: false,
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Stored credential integrity check failed.',
      };
    }
    if (err.code === 'AI_INVALID_REQUEST') {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: err.message,
      };
    }
  }

  const message = err instanceof Error ? err.message : '';
  if (message.includes('Key ring must contain') || message.includes('Active key') || message.includes('FINORA_AI_CREDENTIAL')) {
    return {
      ok: false,
      code: 'AI_CREDENTIAL_CONFIG_MISSING',
      message: 'Credential encryption is not currently configured on the server.',
    };
  }

  return {
    ok: false,
    code: 'OPERATION_FAILED',
    message: fallbackMessage,
  };
}

/**
 * Bounded pagination to resolve a target auth user UUID from an exact case-normalized email.
 * Never searches only a single page; bounds search to prevent infinite loops.
 * Fails closed on zero matches (NOT_FOUND) or ambiguous matches (AMBIGUOUS_MATCH).
 */
export async function lookupUserByExactEmail(
  adminClient: SupabaseClient,
  rawEmail: string
): Promise<{ id: string; email: string } | null> {
  const normalized = rawEmail.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return null;
  }

  const perPage = 100;
  const maxPages = 50;
  const matchedUsers: Array<{ id: string; email: string }> = [];

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error || !data || !Array.isArray(data.users)) {
      throw new Error(`User lookup failed: ${error?.message || 'Unknown admin query failure'}`);
    }

    for (const u of data.users) {
      if (u.email && u.email.trim().toLowerCase() === normalized && isValidUuid(u.id)) {
        matchedUsers.push({ id: u.id, email: u.email });
      }
    }

    if (data.users.length < perPage || !('nextPage' in data && data.nextPage)) {
      break;
    }
  }

  if (matchedUsers.length === 0) {
    return null;
  }

  if (matchedUsers.length === 1) {
    return matchedUsers[0];
  }

  throw new Error('Ambiguous user email match detected');
}

/**
 * Retrieves safe credential metadata for the authenticated user.
 * Caller identity is derived exclusively from server-side auth.getUser().
 */
export async function getMyAiCredentialMetadata(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isValidUuid(user.id)) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required to access credential settings.',
      };
    }

    const repo = createAiCredentialRepository();
    const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());
    const metadata = await repo.getSafeMetadata(user.id, hasSystemKey);

    return {
      ok: true,
      metadata,
    };
  } catch (err) {
    return sanitizeActionError(err, 'Unable to load credential settings at this time.');
  }
}

/**
 * Saves a personal Google Gemini API key for the authenticated user.
 * Encrypted using AES-256-GCM via service-role RPC.
 * Never allows client-supplied ownerUserId or non-PERSONAL source.
 */
export async function saveMyPersonalAiCredential(plaintext: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isValidUuid(user.id)) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required to save credentials.',
      };
    }

    try {
      validatePlaintextApiKey(plaintext);
    } catch {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid API key. The key must be a non-empty string without control characters.',
      };
    }

    const repo = createAiCredentialRepository();
    await repo.saveCredential({
      ownerUserId: user.id,
      source: 'PERSONAL',
      provider: 'GEMINI',
      plaintext,
      assignedByUserId: null,
    });

    const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());
    const metadata = await repo.getSafeMetadata(user.id, hasSystemKey);

    return {
      ok: true,
      metadata,
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to save personal credential.');
  }
}

/**
 * Revokes the personal Google Gemini API key for the authenticated user.
 * Hard-coded to PERSONAL source; cannot revoke ADMIN_ASSIGNED credentials.
 */
export async function revokeMyPersonalAiCredential(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isValidUuid(user.id)) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required to revoke credentials.',
      };
    }

    const repo = createAiCredentialRepository();
    await repo.revokeCredential({
      ownerUserId: user.id,
      source: 'PERSONAL',
      provider: 'GEMINI',
    });

    const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());
    const metadata = await repo.getSafeMetadata(user.id, hasSystemKey);

    return {
      ok: true,
      metadata,
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to revoke personal credential.');
  }
}

/**
 * Admin operation: Look up a target user by email and retrieve their safe credential metadata.
 * Requires verified administrator authorization.
 */
export async function getAdminAiCredentialTarget(
  targetEmail: string
): Promise<ActionResult<AdminTargetUserDTO>> {
  try {
    const supabase = await createClient();
    const { isAdmin } = await verifyAdminActor(supabase);

    if (!isAdmin) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin authorization required.',
      };
    }

    const adminClient = createAdminClient();
    const targetUser = await lookupUserByExactEmail(adminClient, targetEmail);

    if (!targetUser) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No user found matching email "${targetEmail.trim()}".`,
      };
    }

    const repo = createAiCredentialRepository();
    const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());
    const metadata = await repo.getSafeMetadata(targetUser.id, hasSystemKey);

    return {
      ok: true,
      metadata,
      data: {
        email: targetUser.email,
        ownerUserId: targetUser.id,
        metadata,
      },
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to lookup target user credential state.');
  }
}

/**
 * Admin operation: Assign a Gemini API credential to a target user.
 * Requires verified administrator authorization.
 * assignedByUserId is derived strictly from the verified admin actor session.
 */
export async function saveAdminAssignedCredential(params: {
  targetEmail: string;
  plaintext: string;
}): Promise<ActionResult<AdminTargetUserDTO>> {
  try {
    const supabase = await createClient();
    const { isAdmin, userId: adminUserId } = await verifyAdminActor(supabase);

    if (!isAdmin || !adminUserId || !isValidUuid(adminUserId)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin authorization required.',
      };
    }

    try {
      validatePlaintextApiKey(params.plaintext);
    } catch {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid API key. The key must be a non-empty string without control characters.',
      };
    }

    const adminClient = createAdminClient();
    const targetUser = await lookupUserByExactEmail(adminClient, params.targetEmail);

    if (!targetUser) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No user found matching email "${params.targetEmail.trim()}".`,
      };
    }

    const repo = createAiCredentialRepository();
    await repo.saveCredential({
      ownerUserId: targetUser.id,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
      plaintext: params.plaintext,
      assignedByUserId: adminUserId,
    });

    const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());
    const metadata = await repo.getSafeMetadata(targetUser.id, hasSystemKey);

    return {
      ok: true,
      metadata,
      data: {
        email: targetUser.email,
        ownerUserId: targetUser.id,
        metadata,
      },
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to assign credential to target user.');
  }
}

/**
 * Admin operation: Revoke an assigned Gemini API credential from a target user.
 * Requires verified administrator authorization.
 * Hard-coded to ADMIN_ASSIGNED source; cannot revoke target user's PERSONAL credential.
 */
export async function revokeAdminAssignedCredential(params: {
  targetEmail: string;
}): Promise<ActionResult<AdminTargetUserDTO>> {
  try {
    const supabase = await createClient();
    const { isAdmin } = await verifyAdminActor(supabase);

    if (!isAdmin) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin authorization required.',
      };
    }

    const adminClient = createAdminClient();
    const targetUser = await lookupUserByExactEmail(adminClient, params.targetEmail);

    if (!targetUser) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No user found matching email "${params.targetEmail.trim()}".`,
      };
    }

    const repo = createAiCredentialRepository();
    await repo.revokeCredential({
      ownerUserId: targetUser.id,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
    });

    const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());
    const metadata = await repo.getSafeMetadata(targetUser.id, hasSystemKey);

    return {
      ok: true,
      metadata,
      data: {
        email: targetUser.email,
        ownerUserId: targetUser.id,
        metadata,
      },
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to revoke assigned credential.');
  }
}

/**
 * Checks if the current authenticated session has verified administrator authority.
 */
export async function checkIsAdmin(): Promise<{ isAdmin: boolean }> {
  try {
    const supabase = await createClient();
    const { isAdmin } = await verifyAdminActor(supabase);
    return { isAdmin: Boolean(isAdmin) };
  } catch {
    return { isAdmin: false };
  }
}
