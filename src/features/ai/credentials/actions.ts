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
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import type { ActionResult, AdminTargetUserDTO } from './types';
import {
  getMyAiCredentialMetadataCore,
  saveMyPersonalAiCredentialCore,
  revokeMyPersonalAiCredentialCore,
  checkIsAdminCore,
  getAdminAiCredentialTargetCore,
  saveAdminAssignedCredentialCore,
  revokeAdminAssignedCredentialCore,
} from './action-core';

/**
 * Retrieves safe credential metadata for the authenticated user.
 */
export async function getMyAiCredentialMetadata(): Promise<ActionResult> {
  const supabase = await createClient();
  const repo = createAiCredentialRepository();
  const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());

  return getMyAiCredentialMetadataCore({
    getUser: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      return { user, error };
    },
    repo,
    hasSystemKey,
  });
}

/**
 * Saves a personal Google Gemini API key for the authenticated user.
 */
export async function saveMyPersonalAiCredential(plaintext: string): Promise<ActionResult> {
  const supabase = await createClient();
  const repo = createAiCredentialRepository();
  const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());

  return saveMyPersonalAiCredentialCore(plaintext, {
    getUser: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      return { user, error };
    },
    repo,
    hasSystemKey,
  });
}

/**
 * Revokes the personal Google Gemini API key for the authenticated user.
 */
export async function revokeMyPersonalAiCredential(): Promise<ActionResult> {
  const supabase = await createClient();
  const repo = createAiCredentialRepository();
  const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());

  return revokeMyPersonalAiCredentialCore({
    getUser: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      return { user, error };
    },
    repo,
    hasSystemKey,
  });
}

/**
 * Checks if the current authenticated session has verified administrator authority.
 */
export async function checkIsAdmin(): Promise<{ isAdmin: boolean }> {
  const supabase = await createClient();
  return checkIsAdminCore({
    verifyAdmin: () => verifyAdminActor(supabase),
  });
}

/**
 * Admin operation: Look up a target user by email and retrieve their safe credential metadata.
 */
export async function getAdminAiCredentialTarget(
  targetEmail: string
): Promise<ActionResult<AdminTargetUserDTO>> {
  const supabase = await createClient();
  const repo = createAiCredentialRepository();
  const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());

  return getAdminAiCredentialTargetCore(targetEmail, {
    verifyAdmin: () => verifyAdminActor(supabase),
    adminClientFactory: () => createAdminClient(),
    repo,
    hasSystemKey,
  });
}

/**
 * Admin operation: Assign a Gemini API credential to a target user.
 */
export async function saveAdminAssignedCredential(params: {
  targetEmail: string;
  plaintext: string;
}): Promise<ActionResult<AdminTargetUserDTO>> {
  const supabase = await createClient();
  const repo = createAiCredentialRepository();
  const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());

  return saveAdminAssignedCredentialCore(params, {
    verifyAdmin: () => verifyAdminActor(supabase),
    adminClientFactory: () => createAdminClient(),
    repo,
    hasSystemKey,
  });
}

/**
 * Admin operation: Revoke an assigned Gemini API credential from a target user.
 */
export async function revokeAdminAssignedCredential(params: {
  targetEmail: string;
}): Promise<ActionResult<AdminTargetUserDTO>> {
  const supabase = await createClient();
  const repo = createAiCredentialRepository();
  const hasSystemKey = Boolean(process.env.FINORA_SYSTEM_GEMINI_API_KEY?.trim());

  return revokeAdminAssignedCredentialCore(params, {
    verifyAdmin: () => verifyAdminActor(supabase),
    adminClientFactory: () => createAdminClient(),
    repo,
    hasSystemKey,
  });
}
