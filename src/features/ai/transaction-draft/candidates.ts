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
 *    If active items in a dimension exceed the cap, the dimension is completely
 *    omitted from the prompt (accountsOmitted = true, etc.) and marked for explicit
 *    warning emission, preventing false-confidence subset matching.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CandidateAccount,
  CandidateCategory,
  CandidateIncomeSource,
  CandidateIncomeStream,
  OpaqueCandidateContext,
} from './types';

export const CANDIDATE_LIMITS = {
  MAX_ACCOUNTS: 30,
  MAX_CATEGORIES: 50,
  MAX_INCOME_SOURCES: 20,
  MAX_INCOME_STREAMS: 30,
  MAX_LABEL_LENGTH: 50,
} as const;

export function truncateLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= CANDIDATE_LIMITS.MAX_LABEL_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, CANDIDATE_LIMITS.MAX_LABEL_LENGTH);
}

/**
 * Reads user domain entities via authenticated RLS and maps them to ephemeral opaque candidate tokens.
 */
export async function readCandidateContext(
  supabase: SupabaseClient,
  userId: string
): Promise<OpaqueCandidateContext> {
  // 1. Query Accounts (active only)
  const { data: accountsData } = await supabase
    .from('accounts')
    .select('id, name, currency_code, is_archived')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const activeAccounts = (accountsData || []).filter((a) => !a.is_archived);
  const accountsOmitted = activeAccounts.length > CANDIDATE_LIMITS.MAX_ACCOUNTS;

  const accounts: CandidateAccount[] = accountsOmitted
    ? []
    : activeAccounts.map((acc, index) => ({
        id: acc.id,
        token: `ACC_${index + 1}`,
        label: truncateLabel(acc.name),
        currency_code: acc.currency_code,
        is_archived: Boolean(acc.is_archived),
      }));

  // 2. Query Categories (active only)
  const { data: categoriesData } = await supabase
    .from('categories')
    .select('id, name, type, is_archived')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const activeCategories = (categoriesData || []).filter((c) => !c.is_archived);
  const categoriesOmitted = activeCategories.length > CANDIDATE_LIMITS.MAX_CATEGORIES;

  const categories: CandidateCategory[] = categoriesOmitted
    ? []
    : activeCategories.map((cat, index) => ({
        id: cat.id,
        token: `CAT_${index + 1}`,
        label: truncateLabel(cat.name),
        type: cat.type as 'INCOME' | 'EXPENSE',
        is_archived: Boolean(cat.is_archived),
      }));

  // 3. Query Income Sources (active only)
  const { data: sourcesData } = await supabase
    .from('income_sources')
    .select('id, name, is_archived')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const activeSources = (sourcesData || []).filter((s) => !s.is_archived);
  const incomeSourcesOmitted = activeSources.length > CANDIDATE_LIMITS.MAX_INCOME_SOURCES;

  const incomeSources: CandidateIncomeSource[] = incomeSourcesOmitted
    ? []
    : activeSources.map((src, index) => ({
        id: src.id,
        token: `SRC_${index + 1}`,
        label: truncateLabel(src.name),
        is_archived: Boolean(src.is_archived),
      }));

  // 4. Query Income Streams (active only, belonging to active sources)
  let incomeStreams: CandidateIncomeStream[] = [];
  let incomeStreamsOmitted = false;

  if (!incomeSourcesOmitted && activeSources.length > 0) {
    const activeSourceIds = new Set(activeSources.map((s) => s.id));
    const { data: streamsData } = await supabase
      .from('income_source_streams')
      .select('id, source_id, name, is_archived')
      .in('source_id', Array.from(activeSourceIds))
      .order('created_at', { ascending: true });

    const activeStreams = (streamsData || []).filter(
      (st) => !st.is_archived && activeSourceIds.has(st.source_id)
    );

    incomeStreamsOmitted = activeStreams.length > CANDIDATE_LIMITS.MAX_INCOME_STREAMS;

    incomeStreams = incomeStreamsOmitted
      ? []
      : activeStreams.map((str, index) => ({
          id: str.id,
          source_id: str.source_id,
          token: `STR_${index + 1}`,
          label: truncateLabel(str.name),
          is_archived: Boolean(str.is_archived),
        }));
  } else {
    // If sources were omitted or empty, streams are omitted
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
