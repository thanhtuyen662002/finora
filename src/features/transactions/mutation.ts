import type { TransactionUpdateInput } from './transactions';
import { compareExactDecimals, toExactDecimal, isPositiveExactDecimal } from '@/lib/money';

export interface TransactionFormState {
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  currency_code: string;
  account_id: string;
  category_id: string;
  merchant: string;
  note?: string | null;
  occurred_on: string;
  income_source_id?: string | null;
  income_source_stream_id?: string | null;
}

export interface InitialTransactionState {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  currency_code: string;
  account_id: string;
  category_id: string;
  merchant: string;
  note?: string | null;
  occurred_on: string;
  income_source_id?: string | null;
  income_source_stream_id?: string | null;
}

/**
 * Pure helper to build a differential update payload for transactions.
 * Crucially, if trigger-sensitive columns (type, income_source_id, income_source_stream_id)
 * are unchanged, they are strictly OMITTED from the payload.
 * This prevents triggering active-metadata checks on historical transactions with archived sources.
 */
export function buildTransactionUpdatePayload(
  initial: InitialTransactionState,
  current: TransactionFormState
): TransactionUpdateInput {
  const payload: TransactionUpdateInput = {};

  // Validate amount if present
  if (current.amount) {
    if (!isPositiveExactDecimal(current.amount)) {
      throw new Error('Số tiền phải là số dương hợp lệ với tối đa 4 chữ số thập phân.');
    }
  }

  // 1. Unrelated non-trigger fields
  const initialMerchant = (initial.merchant || '').trim();
  const currentMerchant = (current.merchant || '').trim();
  if (initialMerchant !== currentMerchant) {
    payload.merchant = currentMerchant;
  }

  const initialNote = (initial.note ?? '').trim() || null;
  const currentNote = (current.note ?? '').trim() || null;
  if (initialNote !== currentNote) {
    payload.note = currentNote;
  }

  const initialOccurredOn = (initial.occurred_on || '').substring(0, 10);
  const currentOccurredOn = (current.occurred_on || '').substring(0, 10);
  if (initialOccurredOn !== currentOccurredOn) {
    payload.occurred_on = currentOccurredOn;
  }

  if (initial.account_id !== current.account_id) {
    payload.account_id = current.account_id;
  }

  if (initial.category_id !== current.category_id) {
    payload.category_id = current.category_id;
  }

  if (initial.currency_code !== current.currency_code) {
    payload.currency_code = current.currency_code;
  }

  // Exact amount comparison using decimal math
  const initialAmt = initial.amount ? toExactDecimal(initial.amount) : '0.0000';
  const currentAmt = current.amount ? toExactDecimal(current.amount) : '0.0000';
  if (compareExactDecimals(initialAmt, currentAmt) !== 0) {
    payload.amount = currentAmt;
  }

  // 2. Trigger-sensitive fields: type, income_source_id, income_source_stream_id
  const initialType = initial.type;
  const currentType = current.type;

  const initialSource = initial.income_source_id || null;
  const initialStream = initial.income_source_stream_id || null;

  const currentSource = currentType === 'INCOME' ? (current.income_source_id || null) : null;
  const currentStream = currentType === 'INCOME' && currentSource ? (current.income_source_stream_id || null) : null;

  if (initialType !== currentType) {
    // Type transition
    payload.type = currentType;
    if (currentType === 'EXPENSE') {
      payload.income_source_id = null;
      payload.income_source_stream_id = null;
    } else {
      payload.income_source_id = currentSource;
      payload.income_source_stream_id = currentStream;
    }
  } else {
    // Type is unchanged - NEVER syntactically include `type`
    if (currentType === 'INCOME') {
      const sourceChanged = initialSource !== currentSource;
      const streamChanged = initialStream !== currentStream;

      if (sourceChanged) {
        payload.income_source_id = currentSource;
        // If source changed, stream must also be explicitly set (cleared to null or new stream)
        payload.income_source_stream_id = currentStream;
      } else if (streamChanged) {
        // Source unchanged, but child stream changed
        payload.income_source_stream_id = currentStream;
      }
      // If neither source nor stream changed, BOTH are strictly omitted
    }
    // For EXPENSE -> EXPENSE, both attribution values were null and remain null, so omitted.
  }

  return payload;
}
