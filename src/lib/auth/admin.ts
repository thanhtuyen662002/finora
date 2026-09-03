/**
 * Finora Auth — Admin Authority Core
 * Phase 11 — Security Core
 *
 * Implements server-only admin authorization based strictly on FINORA_ADMIN_USER_IDS.
 * Authorizes strictly by comparing authenticated auth.users.id against the allowlist.
 * Email, profile fields, user_metadata, and client-supplied flags are NEVER used as authority.
 * Production authorization functions strictly reject caller-supplied environment overrides.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ENV_ADMIN_USER_IDS = 'FINORA_ADMIN_USER_IDS';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Pure, deterministic parser for comma-separated admin UUIDs.
 * Ignores malformed entries and trims whitespace.
 */
export function parseAdminUserIds(raw: string | undefined | null): Set<string> {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return new Set<string>();
  }

  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && UUID_REGEX.test(item));

  return new Set<string>(entries);
}

/**
 * Parses and returns authorized admin UUIDs strictly from server environment configuration.
 * Callers cannot override or substitute the environment source.
 */
export function getAuthorizedAdminUserIds(): Set<string> {
  return parseAdminUserIds(process.env[ENV_ADMIN_USER_IDS]);
}

/**
 * Checks whether a given user ID is in the admin allowlist strictly using server environment.
 * Rejects non-UUIDs and non-admin IDs.
 */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  const trimmed = userId.trim();
  if (!UUID_REGEX.test(trimmed)) {
    return false;
  }

  const allowlist = getAuthorizedAdminUserIds();
  return allowlist.has(trimmed);
}

/**
 * Verifies the authenticated actor using the user's Supabase session client.
 * Strictly calls supabase.auth.getUser() and verifies the resulting user.id against
 * server environment configuration.
 */
export async function verifyAdminActor(
  supabase: SupabaseClient
): Promise<{ isAdmin: boolean; userId: string | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user || !user.id) {
      return { isAdmin: false, userId: null };
    }

    const isAdmin = isAdminUserId(user.id);
    return {
      isAdmin,
      userId: user.id,
    };
  } catch {
    return { isAdmin: false, userId: null };
  }
}

