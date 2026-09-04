import 'server-only';

/**
 * Finora AI Receipt Vision — Category Context & RLS Candidate Subsystem
 * Phase 12B — Server-Only Category Scoping, Sanitization & Revalidation
 *
 * Enforces:
 * - Read-only RLS scoping using caller's authenticated Supabase client
 * - EXPENSE type only, active (non-archived) only
 * - Bounded candidate limit of 50 (query limit 51 for overflow detection)
 * - Complete candidate omission failsafe if > 50 active categories exist
 * - Opaque token generation (CAT_1, CAT_2...) with zero UUID leakage
 * - Post-provider RLS revalidation for strict CATEGORY_STALE vs CATEGORY_UNRESOLVED provenance
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PHASE_12B_MAX_CATEGORY_CANDIDATES,
  PHASE_12B_MAX_CATEGORY_LABEL_LENGTH,
} from './constants';
import type { ReceiptCategoryCandidate } from './types';

/**
 * Sanitizes a category label before prompt construction.
 * Replaces newlines/tabs with spaces, strips non-printable/control characters,
 * trims leading/trailing whitespace, and caps length at 50 chars.
 */
export function sanitizeCategoryLabel(rawName: unknown): string {
  if (typeof rawName !== 'string') return '';
  const normalized = rawName
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
  if (normalized.length === 0) return '';
  return normalized.slice(0, PHASE_12B_MAX_CATEGORY_LABEL_LENGTH).trim();
}

export interface BuildCategoryCandidatesResult {
  readonly candidates: readonly ReceiptCategoryCandidate[];
  readonly candidateMap: ReadonlyMap<string, string>; // CAT_n -> id (UUID)
  readonly categoriesOmitted: boolean;
}

/**
 * Pure helper to build opaque CAT_n candidates and token-to-UUID map from raw category rows.
 * Implements the overflow failsafe: if rows exceed 50, all candidates are omitted.
 */
export function buildCategoryCandidates(
  rawCategories: readonly { id: string; name: string }[]
): BuildCategoryCandidatesResult {
  if (rawCategories.length > PHASE_12B_MAX_CATEGORY_CANDIDATES) {
    return {
      candidates: [],
      candidateMap: new Map<string, string>(),
      categoriesOmitted: true,
    };
  }

  const candidates: ReceiptCategoryCandidate[] = [];
  const candidateMap = new Map<string, string>();

  let counter = 1;
  for (const cat of rawCategories) {
    if (!cat.id || typeof cat.id !== 'string') continue;
    const sanitized = sanitizeCategoryLabel(cat.name);
    if (!sanitized) continue;

    const token = `CAT_${counter}` as `CAT_${number}`;
    candidates.push({
      id: cat.id,
      token,
      label: sanitized,
    });
    candidateMap.set(token, cat.id);
    counter++;
  }

  return {
    candidates,
    candidateMap,
    categoriesOmitted: false,
  };
}

/**
 * Fetches active expense categories under caller RLS and builds candidates.
 */
export async function fetchReceiptCategoryCandidates(
  supabase: SupabaseClient,
  userId: string
): Promise<BuildCategoryCandidatesResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .eq('is_archived', false)
    .order('name', { ascending: true })
    .limit(PHASE_12B_MAX_CATEGORY_CANDIDATES + 1);

  if (error) {
    throw new Error(`Failed to load category candidates: ${error.message}`);
  }

  const rows = (data || []) as { id: string; name: string }[];
  return buildCategoryCandidates(rows);
}

/**
 * Revalidates a provisionally matched category ID under caller RLS.
 * Verifies category still exists, belongs to user, is active (is_archived=false), and is EXPENSE type.
 */
export async function revalidateReceiptCategory(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .eq('is_archived', false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to revalidate category: ${error.message}`);
  }

  return Boolean(data && data.id === categoryId);
}
