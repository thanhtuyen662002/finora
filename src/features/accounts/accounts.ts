import { createClient } from '@/lib/supabase/client';
import type { AccountInsert, AccountRow, AccountUpdate } from '@/types/database';

export async function getAccounts(): Promise<AccountRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

export async function createAccount(account: Omit<AccountInsert, 'user_id'>): Promise<AccountRow> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('User must be authenticated to create an account');
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      ...account,
      user_id: authData.user.id,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateAccount(id: string, updates: AccountUpdate): Promise<AccountRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}
