import { createClient } from '@/lib/supabase/client';
import type { TransactionDetailRow, TransactionRow } from '@/types/database';

export type ExtendedTransaction = TransactionRow & {
  accountName?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
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
    created_at: row.created_at,
    updated_at: row.updated_at,
    accountName: row.account_name,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
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

export async function createTransaction(
  transaction: TransactionInsertInput
): Promise<ExtendedTransaction> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...transaction, user_id: userData.user.id })
    .select('id')
    .single();

  if (error) throw error;
  return getTransactionExact(data.id);
}

export async function updateTransaction(
  id: string,
  updates: TransactionUpdateInput
): Promise<ExtendedTransaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
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
