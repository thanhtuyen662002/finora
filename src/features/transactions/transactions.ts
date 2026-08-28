import { createClient } from '@/lib/supabase/client';
import type {
  TransactionRow,
  TransactionInsert,
  TransactionUpdate,
  TransactionDetailRow,
} from '@/types/database';

export type ExtendedTransaction = TransactionRow & {
  accountName?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
};

export type TransactionInsertInput = Omit<TransactionInsert, 'user_id'>;
export type TransactionUpdateInput = TransactionUpdate;

export async function getTransactions(): Promise<ExtendedTransaction[]> {
  const supabase = createClient();
  
  // Try reading from transaction_details exact-read view
  const { data, error } = await supabase
    .from('transaction_details')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    // If transaction_details view is not yet applied, fallback to direct transactions table
    const { data: directData, error: directError } = await supabase
      .from('transactions')
      .select('*')
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (directError) throw directError;
    return (directData || []).map((row: TransactionRow) => ({
      ...row,
      amount: String(row.amount),
    }));
  }

  return (data || []).map((row: TransactionDetailRow) => ({
    id: row.id,
    user_id: row.user_id,
    account_id: row.account_id,
    category_id: row.category_id,
    type: row.type,
    amount: String(row.amount),
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
  }));
}

export async function createTransaction(transaction: TransactionInsertInput): Promise<TransactionRow> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...transaction, user_id: userData.user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id: string, updates: TransactionUpdateInput): Promise<TransactionRow> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function voidTransaction(id: string): Promise<TransactionRow> {
  return updateTransaction(id, { is_voided: true });
}

export async function restoreTransaction(id: string): Promise<TransactionRow> {
  return updateTransaction(id, { is_voided: false });
}
