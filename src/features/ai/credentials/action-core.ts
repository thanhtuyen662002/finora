import 'server-only';

/**
 * Finora AI Feature Module — Credential Action Core Logic
 * Phase 11 — Testable Server Action Core & Administrative Security Engine
 *
 * Security & Architectural Guarantees:
 * 1. Actor identity strictly derived from server-side authenticated session.
 * 2. Admin operations strictly verify admin actor BEFORE calling service-role or listing users.
 * 3. Exact email resolution with case-normalization, complete pagination, and safety bounds.
 * 4. Error sanitization ensuring zero internal database or cryptographic leaks.
 * 5. Dependency-injected core allows 100% real unit testing without mutating production context.
 */

import { validatePlaintextApiKey, type AiCredentialRepository } from '../../../lib/ai/credentials/repository';
import { AiError } from '../../../lib/ai/errors';
import type { ActionResult, AdminTargetUserDTO } from './types';

// RFC 4122 v4 UUID validator
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Minimal interface for admin user listing client
 */
export interface AdminUserListingClient {
  auth: {
    admin: {
      listUsers: (params: { page: number; perPage: number }) => Promise<{
        data: {
          users: Array<{ id: string; email?: string }>;
          nextPage?: number | null;
          lastPage?: number;
          total?: number;
        } | null;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Safely sanitizes internal or cryptographic errors into browser-safe error contracts.
 */
export function sanitizeActionError(err: unknown, fallbackMessage: string): ActionResult<never> {
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
      // Whitelist safe validation messages
      if (err.message.includes('API key') || err.message.includes('ASCII') || err.message.includes('printable')) {
        return {
          ok: false,
          code: 'INVALID_INPUT',
          message: err.message,
        };
      }
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid request parameters.',
      };
    }
  }

  const message = err instanceof Error ? err.message : '';
  if (
    message.includes('Key ring must contain') ||
    message.includes('Active key') ||
    message.includes('FINORA_AI_CREDENTIAL')
  ) {
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
 * Bounded complete pagination to resolve a target auth user UUID from an exact case-normalized email.
 * - Iterates through all pages until `nextPage == null` or search is exhausted.
 * - If max safety page limit is reached with `nextPage` remaining, fails closed with an error (NEVER false NOT_FOUND).
 * - Only an exhausted complete search returning 0 matches yields null (NOT_FOUND).
 * - >1 matches fails closed (AMBIGUOUS_MATCH).
 */
export async function lookupUserByExactEmail(
  adminClient: AdminUserListingClient,
  rawEmail: string,
  options?: { maxPages?: number; perPage?: number }
): Promise<{ id: string; email: string } | null> {
  const normalized = rawEmail.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return null;
  }

  const perPage = options?.perPage ?? 100;
  const maxPages = options?.maxPages ?? 50;
  const matchedUsers: Array<{ id: string; email: string }> = [];

  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages && currentPage <= maxPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: currentPage,
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

    // Determine if there are more pages
    const hasNextPageFlag = typeof data.nextPage === 'number' && data.nextPage > currentPage;
    const isFullBatch = data.users.length === perPage;
    hasMorePages = hasNextPageFlag || (data.nextPage === undefined && isFullBatch);

    if (hasMorePages && currentPage === maxPages) {
      // Safety cap reached with pages still remaining -> FAIL CLOSED (not NOT_FOUND)
      throw new Error('User lookup incomplete: pagination limit reached with remaining pages');
    }

    currentPage++;
  }

  if (matchedUsers.length === 0) {
    return null;
  }

  if (matchedUsers.length === 1) {
    return matchedUsers[0];
  }

  throw new Error('Ambiguous user email match detected');
}

export interface AuthUserGetterResult {
  user: { id: string } | null;
  error: unknown | null;
}

export interface PersonalActionDeps {
  getUser: () => Promise<AuthUserGetterResult>;
  repoFactory: () => AiCredentialRepository | Promise<AiCredentialRepository>;
  hasSystemKey: boolean;
}

export interface AdminVerifyResult {
  isAdmin: boolean;
  userId: string | null;
}

export interface AdminActionDeps {
  verifyAdmin: () => Promise<AdminVerifyResult>;
  adminClientFactory: () => AdminUserListingClient | Promise<AdminUserListingClient>;
  repoFactory: () => AiCredentialRepository | Promise<AiCredentialRepository>;
  hasSystemKey: boolean;
  maxLookupPages?: number;
}

/**
 * Core logic: Retrieves safe credential metadata for the authenticated user.
 */
export async function getMyAiCredentialMetadataCore(deps: PersonalActionDeps): Promise<ActionResult> {
  try {
    const { user, error: authError } = await deps.getUser();

    if (authError || !user || !isValidUuid(user.id)) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required to access credential settings.',
      };
    }

    const repo = await deps.repoFactory();
    const metadata = await repo.getSafeMetadata(user.id, deps.hasSystemKey);

    return {
      ok: true,
      metadata,
    };
  } catch (err) {
    return sanitizeActionError(err, 'Unable to load credential settings at this time.');
  }
}

/**
 * Core logic: Saves personal Google Gemini API key for the authenticated user.
 */
export async function saveMyPersonalAiCredentialCore(
  plaintext: string,
  deps: PersonalActionDeps
): Promise<ActionResult> {
  try {
    const { user, error: authError } = await deps.getUser();

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

    const repo = await deps.repoFactory();

    await repo.saveCredential({
      ownerUserId: user.id,
      source: 'PERSONAL',
      provider: 'GEMINI',
      plaintext,
      assignedByUserId: null,
    });

    const metadata = await repo.getSafeMetadata(user.id, deps.hasSystemKey);

    return {
      ok: true,
      metadata,
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to save personal credential.');
  }
}

/**
 * Core logic: Revokes personal Google Gemini API key for the authenticated user.
 */
export async function revokeMyPersonalAiCredentialCore(deps: PersonalActionDeps): Promise<ActionResult> {
  try {
    const { user, error: authError } = await deps.getUser();

    if (authError || !user || !isValidUuid(user.id)) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required to revoke credentials.',
      };
    }

    const repo = await deps.repoFactory();

    await repo.revokeCredential({
      ownerUserId: user.id,
      source: 'PERSONAL',
      provider: 'GEMINI',
    });

    const metadata = await repo.getSafeMetadata(user.id, deps.hasSystemKey);

    return {
      ok: true,
      metadata,
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to revoke personal credential.');
  }
}

/**
 * Core logic: Checks administrator authority of session actor.
 */
export async function checkIsAdminCore(deps: {
  verifyAdmin: () => Promise<AdminVerifyResult>;
}): Promise<{ isAdmin: boolean }> {
  try {
    const { isAdmin } = await deps.verifyAdmin();
    return { isAdmin: Boolean(isAdmin) };
  } catch {
    return { isAdmin: false };
  }
}

/**
 * Core logic: Admin looks up target user by exact email and retrieves safe metadata.
 * Strict invariant: verifyAdmin is checked BEFORE adminClientFactory or repoFactory is touched.
 */
export async function getAdminAiCredentialTargetCore(
  targetEmail: string,
  deps: AdminActionDeps
): Promise<ActionResult<AdminTargetUserDTO>> {
  try {
    // 1. Verify Admin Actor FIRST
    const { isAdmin } = await deps.verifyAdmin();
    if (!isAdmin) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin authorization required.',
      };
    }

    // 2. Only after admin verification: instantiate admin client and lookup target
    const adminClient = await deps.adminClientFactory();
    const targetUser = await lookupUserByExactEmail(adminClient, targetEmail, {
      maxPages: deps.maxLookupPages,
    });

    if (!targetUser) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No user found matching email "${targetEmail.trim()}".`,
      };
    }

    // 3. Only after target user resolution: instantiate repo and fetch safe metadata
    const repo = await deps.repoFactory();
    const metadata = await repo.getSafeMetadata(targetUser.id, deps.hasSystemKey);

    return {
      ok: true,
      metadata,
      data: {
        email: targetUser.email,
        metadata,
      },
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to lookup target user credential state.');
  }
}

/**
 * Core logic: Admin assigns a Gemini API credential to a target user.
 * Strict invariants:
 * - verifyAdmin is checked FIRST.
 * - validatePlaintextApiKey is checked before privileged operations.
 * - assignedByUserId is derived strictly from verified admin session.
 * - targetEmail is resolved server-side to target auth UUID.
 * - repoFactory is called ONLY after target resolution succeeds.
 */
export async function saveAdminAssignedCredentialCore(
  params: { targetEmail: string; plaintext: string },
  deps: AdminActionDeps
): Promise<ActionResult<AdminTargetUserDTO>> {
  try {
    // 1. Verify Admin Actor FIRST
    const { isAdmin, userId: adminUserId } = await deps.verifyAdmin();
    if (!isAdmin || !adminUserId || !isValidUuid(adminUserId)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin authorization required.',
      };
    }

    // 2. Validate plaintext input before creating admin client or repo
    try {
      validatePlaintextApiKey(params.plaintext);
    } catch {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid API key. The key must be a non-empty string without control characters.',
      };
    }

    // 3. Resolve target user UUID from email
    const adminClient = await deps.adminClientFactory();
    const targetUser = await lookupUserByExactEmail(adminClient, params.targetEmail, {
      maxPages: deps.maxLookupPages,
    });

    if (!targetUser) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No user found matching email "${params.targetEmail.trim()}".`,
      };
    }

    // 4. Instantiate repo only after target user resolved
    const repo = await deps.repoFactory();

    // 5. Save credential with ADMIN_ASSIGNED source and admin actor ID
    await repo.saveCredential({
      ownerUserId: targetUser.id,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
      plaintext: params.plaintext,
      assignedByUserId: adminUserId,
    });

    // 6. Fetch safe metadata
    const metadata = await repo.getSafeMetadata(targetUser.id, deps.hasSystemKey);

    return {
      ok: true,
      metadata,
      data: {
        email: targetUser.email,
        metadata,
      },
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to assign credential to target user.');
  }
}

/**
 * Core logic: Admin revokes an assigned Gemini API credential from a target user.
 * Strict invariants:
 * - verifyAdmin is checked FIRST.
 * - targetEmail is resolved server-side to target auth UUID.
 * - repoFactory is called ONLY after target resolution succeeds.
 * - Hardcoded to ADMIN_ASSIGNED source.
 */
export async function revokeAdminAssignedCredentialCore(
  params: { targetEmail: string },
  deps: AdminActionDeps
): Promise<ActionResult<AdminTargetUserDTO>> {
  try {
    // 1. Verify Admin Actor FIRST
    const { isAdmin } = await deps.verifyAdmin();
    if (!isAdmin) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin authorization required.',
      };
    }

    // 2. Resolve target user UUID from email
    const adminClient = await deps.adminClientFactory();
    const targetUser = await lookupUserByExactEmail(adminClient, params.targetEmail, {
      maxPages: deps.maxLookupPages,
    });

    if (!targetUser) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No user found matching email "${params.targetEmail.trim()}".`,
      };
    }

    // 3. Instantiate repo only after target user resolved
    const repo = await deps.repoFactory();

    // 4. Revoke ADMIN_ASSIGNED credential
    await repo.revokeCredential({
      ownerUserId: targetUser.id,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
    });

    // 5. Fetch safe metadata
    const metadata = await repo.getSafeMetadata(targetUser.id, deps.hasSystemKey);

    return {
      ok: true,
      metadata,
      data: {
        email: targetUser.email,
        metadata,
      },
    };
  } catch (err) {
    return sanitizeActionError(err, 'Failed to revoke assigned credential.');
  }
}
