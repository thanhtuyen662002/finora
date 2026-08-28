import { createClient } from '@/lib/supabase/client';
import type { TransactionRow, TransactionInsert, TransactionUpdate } from '@/types/database';

export async function getTransactions(): Promise<TransactionRow[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTransaction(transaction: Omit<TransactionInsert, 'user_id'>): Promise<TransactionRow> {
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

export async function updateTransaction(id: string, updates: TransactionUpdate): Promise<TransactionRow> {
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

export type ActualTransactionUpdate = TransactionUpdate & { is_voided?: boolean };

export async function voidTransaction(id: string): Promise<TransactionRow> {
  return updateTransaction(id, { is_voided: true } as any);
}

export async function restoreTransaction(id: string): Promise<TransactionRow> {
  return updateTransaction(id, { is_voided: false } as any);
}


export type ExtendedTransaction = TransactionRow & {
  accountName?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
};
