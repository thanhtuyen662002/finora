import type { ReceiptTransactionDraft } from './types';
import type { TransactionFormState } from '@/features/ai/transaction-draft/form-state';

export type { TransactionFormState };

export function applyReceiptDraftToForm(
  draft: ReceiptTransactionDraft,
  currentState: TransactionFormState
): TransactionFormState {
  if (!draft.can_apply) {
    return currentState;
  }

  return {
    ...currentState,
    type: draft.type,
    accountId: '', // Always reset account to avoid silent currency relabeling
    amount: draft.amount ?? '',
    currency: draft.currency_code ?? '', // Missing currency -> ''
    occurredOn: draft.occurred_on ?? '', // Missing date -> ''
    merchant: draft.merchant ?? '',      // Null -> clear
    categoryId: draft.category_id ?? '', // Null -> clear
    note: draft.note ?? '',              // Null -> clear
    incomeSourceId: '',                  // Authoritative empty string representation
    incomeSourceStreamId: '',            // Authoritative empty string representation
  };
}
