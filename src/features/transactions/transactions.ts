import { createClient } from '@/lib/supabase/client';
import type { IncomeSourceType, TransactionDetailRow, TransactionRow } from '@/types/database';
import { validateTransactionAttribution } from '@/features/income-sources/domain';

export type ExtendedTransaction = TransactionRow & {
  accountName?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  incomeSourceName?: string | null;
  incomeSourceType?: IncomeSourceType | null;
  incomeSourceStreamName?: string | null;
};

export type TransactionInsertInput = {
  account_id: string;
  category_id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  currency_code: string;
  merchant: string;
  note?: string | null;
  occurred_on?: string;
  income_source_id?: string | null;
  income_source_stream_id?: string | null;
};

export type TransactionUpdateInput = Partial<{
  account_id: string;
  category_id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  currency_code: string;
  merchant: string;
  note: string | null;
  occurred_on: string;
  income_source_id: string | null;
  income_source_stream_id: string | null;
}>;

function mapDetailRow(row: TransactionDetailRow): ExtendedTransaction {
  return {
    id: row.id,
    user_id: row.user_id,
    account_id: row.account_id,
    category_id: row.category_id,
    type: row.type,
    amount: row.amount,
    currency_code: row.currency_code,
    merchant: row.merchant,
    note: row.note,
    occurred_on: row.occurred_on,
    is_voided: row.is_voided,
    income_source_id: row.income_source_id,
    income_source_stream_id: row.income_source_stream_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    accountName: row.account_name,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    incomeSourceName: row.income_source_name,
    incomeSourceType: row.income_source_type,
    incomeSourceStreamName: row.income_source_stream_name,
  };
}

async function getTransactionExact(id: string): Promise<ExtendedTransaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transaction_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapDetailRow(data as TransactionDetailRow);
}

export async function getTransactions(): Promise<ExtendedTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transaction_details')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => mapDetailRow(row as TransactionDetailRow));
}

export async function getTransactionsInDateRange(
  startDate?: string | null,
  endDate?: string | null,
  options?: { accountId?: string; limit?: number }
): Promise<ExtendedTransaction[]> {
  const supabase = createClient();
  let query = supabase.from('transaction_details').select('*');

  if (startDate) {
    query = query.gte('occurred_on', startDate);
  }
  if (endDate) {
    query = query.lte('occurred_on', endDate);
  }
  if (options?.accountId) {
    query = query.eq('account_id', options.accountId);
  }

  query = query
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => mapDetailRow(row as TransactionDetailRow));
}

export async function getRecentTransactions(limit = 6): Promise<ExtendedTransaction[]> {
  return getTransactionsInDateRange(undefined, undefined, { limit });
}

export async function createTransaction(
  transaction: TransactionInsertInput
): Promise<ExtendedTransaction> {
  const attributionCheck = validateTransactionAttribution({
    type: transaction.type,
    income_source_id: transaction.income_source_id,
    income_source_stream_id: transaction.income_source_stream_id,
  });
  if (!attributionCheck.valid) {
    throw new Error(attributionCheck.error);
  }

  const payload = {
    ...transaction,
    income_source_id: transaction.type === 'EXPENSE' ? null : (transaction.income_source_id || null),
    income_source_stream_id: transaction.type === 'EXPENSE' ? null : (transaction.income_source_stream_id || null),
  };

  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userData.user.id })
    .select('id')
    .single();

  if (error) throw error;
  return getTransactionExact(data.id);
}

export async function updateTransaction(
  id: string,
  updates: TransactionUpdateInput
): Promise<ExtendedTransaction> {
  if (updates.type === 'EXPENSE') {
    const attributionCheck = validateTransactionAttribution({
      type: 'EXPENSE',
      income_source_id: updates.income_source_id,
      income_source_stream_id: updates.income_source_stream_id,
    });
    if (!attributionCheck.valid) {
      throw new Error(attributionCheck.error);
    }
  }

  const payload = { ...updates };
  if (updates.type === 'EXPENSE') {
    payload.income_source_id = null;
    payload.income_source_stream_id = null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return getTransactionExact(data.id);
}

async function setTransactionVoided(
  id: string,
  isVoided: boolean
): Promise<ExtendedTransaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({ is_voided: isVoided })
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return getTransactionExact(data.id);
}

export async function voidTransaction(id: string): Promise<ExtendedTransaction> {
  return setTransactionVoided(id, true);
}

export async function restoreTransaction(id: string): Promise<ExtendedTransaction> {
  return setTransactionVoided(id, false);
}
