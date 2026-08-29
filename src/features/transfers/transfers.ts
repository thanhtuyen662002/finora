import { createClient } from '@/lib/supabase/client';
import type { TransferDetailRow, TransferRow } from '@/types/database';

export type ExtendedTransfer = TransferRow & {
  fromAccountName?: string;
  fromAccountType?: string;
  fromAccountColor?: string;
  toAccountName?: string;
  toAccountType?: string;
  toAccountColor?: string;
};

export type TransferInsertInput = {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  currency_code: string;
  note?: string | null;
  occurred_on?: string;
};

export type TransferUpdateInput = Partial<{
  from_account_id: string;
  to_account_id: string;
  amount: string;
  currency_code: string;
  note: string | null;
  occurred_on: string;
}>;

function mapDetailRow(row: TransferDetailRow): ExtendedTransfer {
  return {
    id: row.id,
    user_id: row.user_id,
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    amount: row.amount,
    currency_code: row.currency_code,
    note: row.note,
    occurred_on: row.occurred_on,
    is_voided: row.is_voided,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fromAccountName: row.from_account_name,
    fromAccountType: row.from_account_type,
    fromAccountColor: row.from_account_color,
    toAccountName: row.to_account_name,
    toAccountType: row.to_account_type,
    toAccountColor: row.to_account_color,
  };
}

export async function getTransferExact(id: string): Promise<ExtendedTransfer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transfer_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapDetailRow(data as TransferDetailRow);
}

export async function getTransfers(): Promise<ExtendedTransfer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transfer_details')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => mapDetailRow(row as TransferDetailRow));
}

export async function createTransfer(
  transfer: TransferInsertInput
): Promise<ExtendedTransfer> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('transfers')
    .insert({ ...transfer, user_id: userData.user.id })
    .select('id')
    .single();

  if (error) throw error;
  return getTransferExact(data.id);
}

export async function updateTransfer(
  id: string,
  updates: TransferUpdateInput
): Promise<ExtendedTransfer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transfers')
    .update(updates)
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return getTransferExact(data.id);
}

async function setTransferVoided(
  id: string,
  isVoided: boolean
): Promise<ExtendedTransfer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transfers')
    .update({ is_voided: isVoided })
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return getTransferExact(data.id);
}

export async function voidTransfer(id: string): Promise<ExtendedTransfer> {
  return setTransferVoided(id, true);
}

export async function restoreTransfer(id: string): Promise<ExtendedTransfer> {
  return setTransferVoided(id, false);
}
