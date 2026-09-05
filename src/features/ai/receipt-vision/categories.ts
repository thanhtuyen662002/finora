import { createAdminClient } from '@/lib/supabase/admin';
import { PHASE_12B_MAX_CATEGORY_CANDIDATES, PHASE_12B_MAX_CATEGORY_LABEL_LENGTH } from './constants';

export interface CategoryCandidate {
  readonly id: string;
  readonly token: string;
  readonly label: string;
}

export async function fetchCategoryCandidates(userId: string): Promise<CategoryCandidate[]> {
  try {
    const supabase = await createAdminClient();
    
    // Fetch expense categories
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .order('name')
      .limit(PHASE_12B_MAX_CATEGORY_CANDIDATES);

    if (error || !data) {
      return [];
    }

    return data.map((cat, index) => ({
      id: cat.id,
      token: `CAT_${index}`,
      label: cat.name.slice(0, PHASE_12B_MAX_CATEGORY_LABEL_LENGTH),
    }));
  } catch (error) {
    return [];
  }
}

export function buildCategoryPromptSection(candidates: readonly CategoryCandidate[]): string {
  if (candidates.length === 0) {
    return 'No predefined categories available. Return null for category_token.';
  }
  
  let section = 'Available expense categories:\n';
  for (const candidate of candidates) {
    section += `- ${candidate.token}: "${candidate.label}"\n`;
  }
  return section;
}
