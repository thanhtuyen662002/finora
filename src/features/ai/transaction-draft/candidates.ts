import 'server-only';

/**
 * Finora AI Feature Module — Ephemeral Candidate Reader & Opaque Token Builder
 * Phase 12A — Data Minimization & Bounded Candidate Strategy
 *
 * Invariants:
 * 1. Reads candidate context strictly via authenticated RLS client.
 * 2. Assigns ephemeral request-scoped tokens (ACC_1, CAT_1, SRC_1, STR_1).
 *    Zero real UUIDs exposed to prompts or external models.
 * 3. Candidate Overflow Failsafe (PHASE_12A_CANDIDATE_OVERFLOW_FAILSAFE=true):
 *    Queries are bounded to CAP + 1 with server-side is_archived=false filters.
 *    If active items in a dimension exceed the cap, the dimension is completely
 *    omitted from the prompt (accountsOmitted = true, etc.) and marked for explicit
 *    warning emission, preventing false-confidence subset matching.
 * 4. Context read errors fail closed immediately (CONTEXT_LOAD_FAILED).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { CurrencyCode } from '@/types/finance';
import {
  isSupportedCurrencyCode,
  type CandidateAccount,
  type CandidateCategory,
  type CandidateIncomeSource,
  type CandidateIncomeStream,
  type OpaqueCandidateContext,
} from './types';

export const CANDIDATE_LIMITS = {
  MAX_ACCOUNTS: 30,
  MAX_CATEGORIES: 50,
  MAX_INCOME_SOURCES: 20,
  MAX_INCOME_STREAMS: 30,
  MAX_LABEL_LENGTH: 50,
} as const;

/**
 * Sanitizes candidate labels before injection into prompts:
 * 1. Replaces newlines and tabs with single spaces
 * 2. Strips non-printable and control characters
 * 3. Trims whitespace
 * 4. Bounds length to MAX_LABEL_LENGTH (50 chars)
 */
export function sanitizeCandidateLabel(label: string): string {
  if (typeof label !== 'string') return '';
  let sanitized = label.replace(/[\r\n\t]+/g, ' ');
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  sanitized = sanitized.trim();
  if (sanitized.length > CANDIDATE_LIMITS.MAX_LABEL_LENGTH) {
    sanitized = sanitized.slice(0, CANDIDATE_LIMITS.MAX_LABEL_LENGTH).trim();
  }
  return sanitized;
}

export class ContextLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContextLoadError';
  }
}

/**
 * Reads user domain entities via authenticated RLS and maps them to ephemeral opaque candidate tokens.
 * Fails closed if any query encounters an error.
 */
export async function readCandidateContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OpaqueCandidateContext> {
  // 1. Query Accounts (bounded: CAP + 1, active only)
  const accountsRes = await supabase
    .from('accounts')
    .select('id, name, currency_code, is_archived')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
    .limit(CANDIDATE_LIMITS.MAX_ACCOUNTS + 1);

  if (accountsRes.error) {
    throw new ContextLoadError(`Failed to load accounts: ${accountsRes.error.message}`, accountsRes.error);
  }

  const rawAccounts = accountsRes.data ?? [];
  const accountsOmitted = rawAccounts.length > CANDIDATE_LIMITS.MAX_ACCOUNTS;
  const accounts: CandidateAccount[] = accountsOmitted
    ? []
    : rawAccounts
        .filter((acc) => isSupportedCurrencyCode(acc.currency_code))
        .map((acc, index) => ({
          id: acc.id,
          token: `ACC_${index + 1}`,
          label: sanitizeCandidateLabel(acc.name),
          currency_code: acc.currency_code as CurrencyCode,
          is_archived: Boolean(acc.is_archived),
        }));

  // 2. Query Categories (bounded: CAP + 1, active only)
  const categoriesRes = await supabase
    .from('categories')
    .select('id, name, type, is_archived')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
    .limit(CANDIDATE_LIMITS.MAX_CATEGORIES + 1);

  if (categoriesRes.error) {
    throw new ContextLoadError(`Failed to load categories: ${categoriesRes.error.message}`, categoriesRes.error);
  }

  const rawCategories = categoriesRes.data ?? [];
  const categoriesOmitted = rawCategories.length > CANDIDATE_LIMITS.MAX_CATEGORIES;
  const categories: CandidateCategory[] = categoriesOmitted
    ? []
    : rawCategories.map((cat, index) => ({
        id: cat.id,
        token: `CAT_${index + 1}`,
        label: sanitizeCandidateLabel(cat.name),
        type: cat.type as 'INCOME' | 'EXPENSE',
        is_archived: Boolean(cat.is_archived),
      }));

  // 3. Query Income Sources (bounded: CAP + 1, active only)
  const sourcesRes = await supabase
    .from('income_sources')
    .select('id, name, is_archived')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
    .limit(CANDIDATE_LIMITS.MAX_INCOME_SOURCES + 1);

  if (sourcesRes.error) {
    throw new ContextLoadError(`Failed to load income sources: ${sourcesRes.error.message}`, sourcesRes.error);
  }

  const rawSources = sourcesRes.data ?? [];
  const incomeSourcesOmitted = rawSources.length > CANDIDATE_LIMITS.MAX_INCOME_SOURCES;
  const incomeSources: CandidateIncomeSource[] = incomeSourcesOmitted
    ? []
    : rawSources.map((src, index) => ({
        id: src.id,
        token: `SRC_${index + 1}`,
        label: sanitizeCandidateLabel(src.name),
        is_archived: Boolean(src.is_archived),
      }));

  // 4. Query Income Streams (bounded: CAP + 1, active only, belonging to active sources)
  let incomeStreams: CandidateIncomeStream[] = [];
  let incomeStreamsOmitted = false;

  if (!incomeSourcesOmitted && rawSources.length > 0) {
    const activeSourceIds = rawSources.map((s) => s.id);
    const streamsRes = await supabase
      .from('income_source_streams')
      .select('id, income_source_id, name, is_archived')
      .in('income_source_id', activeSourceIds)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(CANDIDATE_LIMITS.MAX_INCOME_STREAMS + 1);

    if (streamsRes.error) {
      throw new ContextLoadError(`Failed to load income streams: ${streamsRes.error.message}`, streamsRes.error);
    }

    const rawStreams = streamsRes.data ?? [];
    incomeStreamsOmitted = rawStreams.length > CANDIDATE_LIMITS.MAX_INCOME_STREAMS;

    incomeStreams = incomeStreamsOmitted
      ? []
      : rawStreams.map((str, index) => ({
          id: str.id,
          income_source_id: str.income_source_id,
          token: `STR_${index + 1}`,
          label: sanitizeCandidateLabel(str.name),
          is_archived: Boolean(str.is_archived),
        }));
  } else {
    // If sources were omitted or empty, streams must also be omitted
    incomeStreamsOmitted = incomeSourcesOmitted;
  }

  return {
    accounts,
    categories,
    incomeSources,
    incomeStreams,
    accountsOmitted,
    categoriesOmitted,
    incomeSourcesOmitted,
    incomeStreamsOmitted,
  };
}
