/**
 * Finora AI Feature Module — Pure Form State Transformer
 * Phase 12A — Corrective Pass 1 (Correctives 10 & 14)
 *
 * Invariants:
 * 1. AI Ambiguity Gate (AI_AMBIGUITY_DEFAULT_MASKING=false):
 *    When AI returns account_id=null or category_id=null, form defaults MUST NOT
 *    mask the missing AI match. Unmatched fields are cleared to empty strings with
 *    explicit provenance tracking and user review notices.
 * 2. Zero Financial Mutation:
 *    Pure functional transformation with ZERO side-effects or mutations.
 */

import type { ParsedTransactionDraft } from './types';

export interface TransactionFormState {
  type: 'EXPENSE' | 'INCOME';
  amount: string;
  currency: string;
  accountId: string;
  categoryId: string;
  incomeSourceId: string;
  incomeSourceStreamId: string;
  merchant: string;
  note: string;
  occurredOn: string;
}

export interface DraftProvenance {
  readonly typeMatchedByAi: boolean;
  readonly amountMatchedByAi: boolean;
  readonly currencyMatchedByAi: boolean;
  readonly accountMatchedByAi: boolean;
  readonly categoryMatchedByAi: boolean;
  readonly incomeSourceMatchedByAi: boolean;
  readonly incomeStreamMatchedByAi: boolean;
  readonly unmatchedAiFields: readonly ('account' | 'category' | 'income_source' | 'income_stream')[];
  readonly requiresManualReview: boolean;
  readonly reviewNotice: string | null;
}

export interface DraftApplicationResult {
  readonly nextState: TransactionFormState;
  readonly provenance: DraftProvenance;
}

export interface ApplyDraftToFormStateParams {
  readonly currentState: TransactionFormState;
  readonly draft: ParsedTransactionDraft;
  readonly accounts?: readonly { id: string; currency_code: string; is_archived?: boolean }[];
  readonly categories?: readonly { id: string; type: string; is_archived?: boolean }[];
}

/**
 * Pure state transformer that applies a validated AI transaction draft to manual form state.
 * Guarantees that AI null values are never disguised as form defaults.
 */
export function applyDraftToFormState(
  params: ApplyDraftToFormStateParams
): DraftApplicationResult {
  const { currentState, draft, accounts = [] } = params;

  // 1. Type
  const targetType = draft.type !== null ? draft.type : currentState.type;
  const typeMatchedByAi = draft.type !== null;

  // 2. Amount
  const nextAmount = draft.amount !== null ? draft.amount : currentState.amount;
  const amountMatchedByAi = draft.amount !== null;

  // 3. Account & Ambiguity Gate
  let nextAccountId: string;
  let accountMatchedByAi: boolean;
  if (draft.account_id !== null) {
    nextAccountId = draft.account_id;
    accountMatchedByAi = true;
  } else {
    // CORRECTIVE 10: Clear account so existing form default is not mistaken for AI match
    nextAccountId = '';
    accountMatchedByAi = false;
  }

  // 4. Currency
  let nextCurrency: string;
  let currencyMatchedByAi: boolean;
  if (draft.currency_code !== null) {
    nextCurrency = draft.currency_code;
    currencyMatchedByAi = true;
  } else if (draft.account_id !== null) {
    const acc = accounts.find((a) => a.id === draft.account_id);
    nextCurrency = acc ? acc.currency_code : currentState.currency;
    currencyMatchedByAi = false;
  } else {
    nextCurrency = currentState.currency;
    currencyMatchedByAi = false;
  }

  // 5. Category & Ambiguity Gate
  let nextCategoryId: string;
  let categoryMatchedByAi: boolean;
  if (draft.category_id !== null) {
    nextCategoryId = draft.category_id;
    categoryMatchedByAi = true;
  } else {
    // CORRECTIVE 10: Clear category so automatic first-category or default is not represented as AI match
    nextCategoryId = '';
    categoryMatchedByAi = false;
  }

  // 6. Income Source & Stream (Income only)
  let nextIncomeSourceId = '';
  let incomeSourceMatchedByAi = false;
  let nextIncomeSourceStreamId = '';
  let incomeStreamMatchedByAi = false;

  if (targetType === 'INCOME') {
    if (draft.income_source_id !== null) {
      nextIncomeSourceId = draft.income_source_id;
      incomeSourceMatchedByAi = true;
    }
    if (draft.income_source_stream_id !== null) {
      nextIncomeSourceStreamId = draft.income_source_stream_id;
      incomeStreamMatchedByAi = true;
    }
  }

  // 7. Text fields
  const nextMerchant = draft.merchant !== null ? draft.merchant : currentState.merchant;
  const nextNote = draft.note !== null ? draft.note : currentState.note;
  const nextOccurredOn = draft.occurred_on !== null ? draft.occurred_on : currentState.occurredOn;

  // 8. Provenance & Unmatched Fields
  const unmatchedAiFields: ('account' | 'category' | 'income_source' | 'income_stream')[] = [];
  if (!accountMatchedByAi) unmatchedAiFields.push('account');
  if (!categoryMatchedByAi) unmatchedAiFields.push('category');
  if (targetType === 'INCOME') {
    if (!incomeSourceMatchedByAi) unmatchedAiFields.push('income_source');
    if (!incomeStreamMatchedByAi && draft.income_source_id !== null) unmatchedAiFields.push('income_stream');
  }

  const requiresManualReview = unmatchedAiFields.length > 0;
  let reviewNotice: string | null = null;
  if (requiresManualReview) {
    const labels: string[] = [];
    if (!accountMatchedByAi) labels.push('Tài khoản');
    if (!categoryMatchedByAi) labels.push('Danh mục');
    if (targetType === 'INCOME') {
      if (!incomeSourceMatchedByAi) {
        labels.push('Nguồn thu');
      } else if (!incomeStreamMatchedByAi && draft.income_source_id !== null) {
        labels.push('Kênh thu');
      }
    }
    if (labels.length > 0) {
      reviewNotice = `Bản nháp AI đã được áp dụng. Lưu ý: ${labels.join(' và ')} chưa được AI nhận diện, vui lòng chọn thủ công.`;
    }
  }

  return {
    nextState: {
      type: targetType,
      amount: nextAmount,
      currency: nextCurrency,
      accountId: nextAccountId,
      categoryId: nextCategoryId,
      incomeSourceId: nextIncomeSourceId,
      incomeSourceStreamId: nextIncomeSourceStreamId,
      merchant: nextMerchant,
      note: nextNote,
      occurredOn: nextOccurredOn,
    },
    provenance: {
      typeMatchedByAi,
      amountMatchedByAi,
      currencyMatchedByAi,
      accountMatchedByAi,
      categoryMatchedByAi,
      incomeSourceMatchedByAi,
      incomeStreamMatchedByAi,
      unmatchedAiFields,
      requiresManualReview,
      reviewNotice,
    },
  };
}
