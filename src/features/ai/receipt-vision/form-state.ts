/**
 * Finora AI Receipt Vision — Pure Form Application Engine
 * Phase 12B — Client-Safe Zero-Default Form Population
 *
 * Client-safe pure form engine. Zero database writes, zero Supabase dependencies.
 */

import type { ReceiptTransactionDraft } from './types';

export interface TransactionFormStateLike {
  type: string;
  amount: string;
  currency: string;
  accountId: string;
  categoryId: string;
  occurredOn: string;
  merchant: string;
  note: string;
  incomeSourceId: string;
  incomeSourceStreamId: string;
}

export interface ApplyReceiptDraftResult<T extends TransactionFormStateLike = TransactionFormStateLike> {
  readonly applied: boolean;
  readonly state: T;
  readonly reason?: 'CANNOT_APPLY';
}

/**
 * Pure function to apply a ReceiptTransactionDraft to form state.
 * Refuses application if draft.can_apply is false.
 * Overwrites with zero default leakage:
 * - type forced to 'EXPENSE'
 * - accountId cleared to '' (user must explicitly select account)
 * - categoryId set to draft.category_id or cleared to ''
 * - merchant set to draft.merchant or cleared to ''
 * - note set to draft.note or cleared to ''
 * - income attribution fields cleared to ''
 * - amount, currency, occurredOn set strictly from non-null draft values
 */
export function applyReceiptDraftToFormState<T extends TransactionFormStateLike>(
  currentState: T,
  draft: ReceiptTransactionDraft
): ApplyReceiptDraftResult<T> {
  if (!draft.can_apply || draft.amount === null || draft.currency_code === null || draft.occurred_on === null) {
    return {
      applied: false,
      state: currentState,
      reason: 'CANNOT_APPLY',
    };
  }

  const updatedState: T = {
    ...currentState,
    type: 'EXPENSE',
    amount: draft.amount,
    currency: draft.currency_code,
    occurredOn: draft.occurred_on,
    accountId: '',
    categoryId: draft.category_id ?? '',
    merchant: draft.merchant ?? '',
    note: draft.note ?? '',
    incomeSourceId: '',
    incomeSourceStreamId: '',
  };

  return {
    applied: true,
    state: updatedState,
  };
}
