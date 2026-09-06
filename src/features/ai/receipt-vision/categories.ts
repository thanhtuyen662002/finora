import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PHASE_12B_MAX_CATEGORY_CANDIDATES,
  PHASE_12B_MAX_CATEGORY_LABEL_LENGTH,
} from './constants';

export interface CategoryCandidate {
  readonly id: string;
  readonly name: string;
}

export type CategoryResolutionResult =
  | { readonly status: 'RESOLVED'; readonly categoryId: string }
  | { readonly status: 'UNRESOLVED' }
  | { readonly status: 'STALE' };

function sanitizeCategoryName(name: string): string {
  return name
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PHASE_12B_MAX_CATEGORY_LABEL_LENGTH);
}

export async function getCategoryCandidates(
  supabase: SupabaseClient
): Promise<readonly CategoryCandidate[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .eq('type', 'EXPENSE')
      .eq('is_archived', false)
      .limit(PHASE_12B_MAX_CATEGORY_CANDIDATES + 1);

    if (error || !data) {
      return []; // Fail closed
    }

    if (data.length > PHASE_12B_MAX_CATEGORY_CANDIDATES) {
      return []; // Overflow (> 50 candidates), fail closed with zero candidates
    }

    return data.map((cat) => ({
      id: cat.id,
      name: sanitizeCategoryName(cat.name),
    }));
  } catch {
    return [];
  }
}

export async function revalidateCategoryToken(
  supabase: SupabaseClient,
  token: string | null,
  candidates: readonly CategoryCandidate[]
): Promise<CategoryResolutionResult> {
  if (!token) {
    return { status: 'UNRESOLVED' };
  }

  const match = token.match(/^CAT_([1-9]\d*)$/);
  if (!match) {
    return { status: 'UNRESOLVED' };
  }

  const index = parseInt(match[1], 10) - 1;
  if (index < 0 || index >= candidates.length) {
    return { status: 'UNRESOLVED' };
  }

  const candidateId = candidates[index].id;

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('id', candidateId)
      .eq('type', 'EXPENSE')
      .eq('is_archived', false)
      .maybeSingle();

    if (error || !data) {
      return { status: 'STALE' };
    }

    return { status: 'RESOLVED', categoryId: data.id };
  } catch {
    return { status: 'STALE' };
  }
}
