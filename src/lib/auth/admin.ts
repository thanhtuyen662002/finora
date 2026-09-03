/**
 * Finora Auth — Admin Authority Core
 * Phase 11 — Security Core
 *
 * Implements server-only admin authorization based strictly on FINORA_ADMIN_USER_IDS.
 * Authorizes strictly by comparing authenticated auth.users.id against the allowlist.
 * Email, profile fields, user_metadata, and client-supplied flags are NEVER used as authority.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ENV_ADMIN_USER_IDS = 'FINORA_ADMIN_USER_IDS';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parses and returns the list of authorized admin UUIDs from environment configuration.
 * Ignores malformed entries and trims whitespace.
 */
export function getAuthorizedAdminUserIds(customEnv?: string): readonly string[] {
  const raw = customEnv ?? process.env[ENV_ADMIN_USER_IDS];
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }

  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  // Validate each entry is a valid UUID
  return entries.filter((uuid) => UUID_REGEX.test(uuid));
}

/**
 * Checks whether a given user ID is in the admin allowlist.
 */
export function isAdminUserId(userId: string | null | undefined, customEnv?: string): boolean {
  if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId.trim())) {
    return false;
  }

  const allowlist = getAuthorizedAdminUserIds(customEnv);
  return allowlist.includes(userId.trim());
}

/**
 * Verifies the authenticated actor using the user's Supabase session client.
 * Strictly calls supabase.auth.getUser() and verifies the resulting user.id against the allowlist.
 */
export async function verifyAdminActor(
  supabase: SupabaseClient,
  customEnv?: string
): Promise<{ isAdmin: boolean; userId: string | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user || !user.id) {
      return { isAdmin: false, userId: null };
    }

    const isAdmin = isAdminUserId(user.id, customEnv);
    return {
      isAdmin,
      userId: user.id,
    };
  } catch {
    return { isAdmin: false, userId: null };
  }
}

/**
 * Resolves an email address to an immutable auth.users.id using a trusted admin client.
 * Email serves purely as a lookup locator; it NEVER acts as authorization authority.
 */
export async function findTargetUserIdByEmail(
  adminSupabase: SupabaseClient,
  email: string
): Promise<string | null> {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return null;
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Look up user via admin auth API
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    });

    if (error || !data || !Array.isArray(data.users)) {
      return null;
    }

    const targetUser = data.users.find(
      (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
    );

    return targetUser ? targetUser.id : null;
  } catch {
    return null;
  }
}
