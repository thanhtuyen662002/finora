import { createClient } from '@/lib/supabase/client';
import { compareExactDecimals, toExactDecimal } from '@/lib/money';
import { convertExactAmount, toExactRate } from '@/lib/exchange-rate/fx-math';
import type { TransferDetailRow, TransferRow } from '@/types/database';

/**
 * Canonical FX Contract:
 * exchange_rate = destination currency units received per 1 source currency unit
 * destination_amount = convertExactAmount(source_amount, exchange_rate)
 */

export type ExtendedTransfer = TransferRow & {
  fromAccountName?: string;
  fromAccountType?: string;
  fromAccountColor?: string;
  fromAccountCurrency?: string;
  toAccountName?: string;
  toAccountType?: string;
  toAccountColor?: string;
  toAccountCurrency?: string;
};

export type TransferInsertInput = {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  exchange_rate?: string;
  note?: string | null;
  occurred_on?: string;
  // Optional caller fields ignored in favor of DB account truth
  currency_code?: string;
  source_currency_code?: string;
  destination_currency_code?: string;
  destination_amount?: string;
};

export type TransferUpdateInput = Partial<{
  from_account_id: string;
  to_account_id: string;
  amount: string;
  exchange_rate: string;
  note: string | null;
  occurred_on: string;
  // Optional caller fields ignored in favor of DB account truth
  currency_code: string;
  source_currency_code: string;
  destination_currency_code: string;
  destination_amount: string;
}>;

function validateAndNormalizeTransferAmount(amount: string): string {
  if (typeof amount !== 'string' || !amount.trim()) {
    throw new Error('Transfer amount must be a non-empty string');
  }
  const normalized = toExactDecimal(amount);
  if (compareExactDecimals(normalized, '0.0000') <= 0) {
    throw new Error('Transfer amount must be strictly greater than zero');
  }
  return normalized;
}

function mapDetailRow(row: TransferDetailRow): ExtendedTransfer {
  const sourceCurrency = row.source_currency_code || row.currency_code;
  const destCurrency = row.destination_currency_code || row.currency_code;
  const destAmount = row.destination_amount || row.amount;
  const exRate = row.exchange_rate || '1.000000000000';

  return {
    id: row.id,
    user_id: row.user_id,
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    amount: row.amount,
    currency_code: sourceCurrency,
    source_currency_code: sourceCurrency,
    destination_currency_code: destCurrency,
    destination_amount: destAmount,
    exchange_rate: exRate,
    note: row.note,
    occurred_on: row.occurred_on,
    is_voided: row.is_voided,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fromAccountName: row.from_account_name,
    fromAccountType: row.from_account_type,
    fromAccountColor: row.from_account_color,
    fromAccountCurrency: row.from_account_currency || sourceCurrency,
    toAccountName: row.to_account_name,
    toAccountType: row.to_account_type,
    toAccountColor: row.to_account_color,
    toAccountCurrency: row.to_account_currency || destCurrency,
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

  if (!transfer.from_account_id || !transfer.to_account_id) {
    throw new Error('Source and destination accounts are required');
  }

  if (transfer.from_account_id === transfer.to_account_id) {
    throw new Error('Source and destination accounts must be different');
  }

  // Load accounts under authenticated user's RLS scope
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('id, currency_code, is_archived, user_id')
    .in('id', [transfer.from_account_id, transfer.to_account_id]);

  if (accError || !accounts || accounts.length < 2) {
    throw new Error('Source or destination account not found or access denied');
  }

  const fromAccount = accounts.find((a) => a.id === transfer.from_account_id);
  const toAccount = accounts.find((a) => a.id === transfer.to_account_id);

  if (!fromAccount || !toAccount) {
    throw new Error('Source or destination account not found or access denied');
  }

  if (fromAccount.is_archived) {
    throw new Error('Cannot create transfer from an archived account');
  }

  if (toAccount.is_archived) {
    throw new Error('Cannot create transfer to an archived account');
  }

  const normalizedAmount = validateAndNormalizeTransferAmount(transfer.amount);
  const sourceCurrency = fromAccount.currency_code.toUpperCase().trim();
  const destCurrency = toAccount.currency_code.toUpperCase().trim();

  let destAmount: string;
  let exRate: string;

  if (sourceCurrency === destCurrency) {
    destAmount = normalizedAmount;
    exRate = '1.000000000000';
  } else {
    if (!transfer.exchange_rate) {
      throw new Error('Cross-currency transfer requires an explicit exchange rate');
    }
    exRate = toExactRate(transfer.exchange_rate);
    destAmount = convertExactAmount(normalizedAmount, exRate);
  }

  const insertPayload = {
    user_id: userData.user.id,
    from_account_id: transfer.from_account_id,
    to_account_id: transfer.to_account_id,
    amount: normalizedAmount,
    currency_code: sourceCurrency,
    source_currency_code: sourceCurrency,
    destination_currency_code: destCurrency,
    destination_amount: destAmount,
    exchange_rate: exRate,
    note: transfer.note ?? null,
    occurred_on: transfer.occurred_on,
  };

  const { data, error } = await supabase
    .from('transfers')
    .insert(insertPayload)
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

  const existing = await getTransferExact(id);

  const fromAccountId = updates.from_account_id || existing.from_account_id;
  const toAccountId = updates.to_account_id || existing.to_account_id;

  if (fromAccountId === toAccountId) {
    throw new Error('Source and destination accounts must be different');
  }

  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('id, currency_code, is_archived, user_id')
    .in('id', [fromAccountId, toAccountId]);

  if (accError || !accounts || accounts.length < 2) {
    throw new Error('Source or destination account not found or access denied');
  }

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  if (!fromAccount || !toAccount) {
    throw new Error('Source or destination account not found or access denied');
  }

  if (updates.from_account_id && updates.from_account_id !== existing.from_account_id && fromAccount.is_archived) {
    throw new Error('Cannot update transfer to an archived source account');
  }

  if (updates.to_account_id && updates.to_account_id !== existing.to_account_id && toAccount.is_archived) {
    throw new Error('Cannot update transfer to an archived destination account');
  }

  const amount = updates.amount !== undefined ? validateAndNormalizeTransferAmount(updates.amount) : existing.amount;
  const sourceCurrency = fromAccount.currency_code.toUpperCase().trim();
  const destCurrency = toAccount.currency_code.toUpperCase().trim();

  let destAmount: string;
  let exRate: string;

  if (sourceCurrency === destCurrency) {
    destAmount = amount;
    exRate = '1.000000000000';
  } else {
    const rawRate = updates.exchange_rate !== undefined ? updates.exchange_rate : existing.exchange_rate;
    if (!rawRate) {
      throw new Error('Cross-currency transfer requires an explicit exchange rate');
    }
    exRate = toExactRate(rawRate);
    destAmount = convertExactAmount(amount, exRate);
  }

  const payload = {
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    amount,
    currency_code: sourceCurrency,
    source_currency_code: sourceCurrency,
    destination_currency_code: destCurrency,
    destination_amount: destAmount,
    exchange_rate: exRate,
    ...(updates.note !== undefined && { note: updates.note }),
    ...(updates.occurred_on !== undefined && { occurred_on: updates.occurred_on }),
  };

  const { data, error } = await supabase
    .from('transfers')
    .update(payload)
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
