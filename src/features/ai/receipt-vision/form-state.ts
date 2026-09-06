import type { ReceiptTransactionDraft } from './types';

// Matching AddTransactionModal's TransactionFormState (loosely, or precisely if imported, but we don't need strict coupling here, just the returned fields)
export interface TransactionFormState {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  accountId: string;
  amount: string;
  currency: string;
  occurredOn: string;
  merchant: string;
  categoryId: string;
  note: string;
  incomeSourceId?: string | null;
  incomeSourceStreamId?: string | null;
}

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
    amount: draft.amount,
    currency: draft.currency_code ?? '', // Missing currency -> ''
    occurredOn: draft.occurred_on ?? '', // Missing date -> ''
    merchant: draft.merchant ?? '',      // Null -> clear
    categoryId: draft.category_id ?? '', // Null -> clear
    note: draft.note ?? '',              // Null -> clear
    incomeSourceId: null,                // Always clear
    incomeSourceStreamId: null,          // Always clear
  };
}
