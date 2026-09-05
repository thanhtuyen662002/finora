import type { ReceiptTransactionDraft } from './types';
import type { TransactionFormState } from '@/features/ai/transaction-draft/form-state';

export function applyReceiptDraftToForm(
  draft: ReceiptTransactionDraft, 
  currentData: TransactionFormState
): TransactionFormState {
  return {
    ...currentData,
    type: draft.type,
    amount: draft.amount ?? '',
    currency: draft.currency_code ?? currentData.currency,
    merchant: draft.merchant ?? '',
    occurredOn: draft.occurred_on ?? currentData.occurredOn,
    categoryId: draft.category_id ?? '',
    note: draft.note ?? '',
    // Leave accountId unchanged to ensure ACCOUNT_REQUIRED resolves
  };
}

