import { createBrowserClient } from '@supabase/ssr';
import { getClientEnv } from '@/config/env';
import {
  addExactDecimals,
  compareExactDecimals,
  isNonNegativeExactDecimal,
  isPositiveExactDecimal,
  toExactDecimal,
} from '@/lib/money';
import type {
  Receivable,
  ReceivableCreateInput,
  ReceivablePayment,
  ReceivablePaymentInput,
  ReceivableUpdateInput,
} from './types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createReceivablesClient() {
  const { supabaseUrl, supabasePublishableKey, isConfigured } = getClientEnv();
  if (!isConfigured) {
    throw new Error(
      'Supabase client credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

function requireText(value: string | null | undefined, field: string, maxLength: number): string {
  const normalized = (value || '').trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} không được để trống và tối đa ${maxLength} ký tự.`);
  }
  return normalized;
}

function optionalText(value: string | null | undefined, maxLength: number): string | null {
  const normalized = (value || '').trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`Nội dung vượt quá ${maxLength} ký tự.`);
  }
  return normalized;
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(currency)) {
    throw new Error('Mã tiền tệ không hợp lệ.');
  }
  return currency;
}

function normalizeDate(value: string | null | undefined, field: string): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error(`${field} không hợp lệ.`);
  }
  return normalized;
}

function normalizePositive(value: string | number, field: string): string {
  const normalized = toExactDecimal(value);
  if (!isPositiveExactDecimal(normalized)) {
    throw new Error(`${field} phải lớn hơn 0.`);
  }
  return normalized;
}

function normalizeNonNegative(value: string | number, field: string): string {
  const normalized = toExactDecimal(value);
  if (!isNonNegativeExactDecimal(normalized)) {
    throw new Error(`${field} không được âm.`);
  }
  return normalized;
}

function validateDueDay(value: number | null | undefined) {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error('Ngày đến hạn trong tháng phải từ 1 đến 31.');
  }
}

async function getReceivableExact(id: string): Promise<Receivable> {
  const supabase = createReceivablesClient();
  const { data, error } = await supabase
    .from('receivable_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Receivable;
}

export async function getReceivables(options?: {
  includeArchived?: boolean;
}): Promise<Receivable[]> {
  const supabase = createReceivablesClient();
  let query = supabase
    .from('receivable_details')
    .select('*')
    .order('is_archived', { ascending: true })
    .order('borrower_name', { ascending: true })
    .order('name', { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Receivable[];
}

export async function createReceivable(input: ReceivableCreateInput): Promise<Receivable> {
  if (!input.funding_account_id) {
    throw new Error('Bạn cần chọn tài khoản hoặc ví dùng để cho vay.');
  }

  const name = requireText(input.name, 'Tên khoản phải thu', 200);
  const borrowerName = requireText(input.borrower_name, 'Người vay', 200);
  const principal = normalizePositive(input.principal_amount, 'Số tiền gốc');
  const currency = normalizeCurrency(input.currency_code);
  const interestRate = input.interest_rate === undefined
    ? '0.0000'
    : normalizeNonNegative(input.interest_rate, 'Lãi suất');
  const expectedPayment = input.expected_payment
    ? normalizeNonNegative(input.expected_payment, 'Khoản dự kiến thu')
    : null;
  const firstDueDate = normalizeDate(input.first_due_date, 'Ngày đến hạn');
  validateDueDay(input.due_day);

  const supabase = createReceivablesClient();
  const { data, error } = await supabase.rpc('create_receivable_v2', {
    p_name: name,
    p_borrower_name: borrowerName,
    p_principal_amount: principal,
    p_currency_code: currency,
    p_funding_account_id: input.funding_account_id,
    p_interest_rate: interestRate,
    p_expected_payment: expectedPayment,
    p_payment_frequency: input.payment_frequency,
    p_first_due_date: firstDueDate,
    p_due_day: input.due_day ?? null,
    p_note: optionalText(input.note, 1000),
  });

  if (error) throw error;
  return getReceivableExact(data as string);
}

export async function updateReceivable(
  id: string,
  input: ReceivableUpdateInput
): Promise<Receivable> {
  const payload: Record<string, string | number | boolean | null> = {};

  if (input.name !== undefined) payload.name = requireText(input.name, 'Tên khoản phải thu', 200);
  if (input.borrower_name !== undefined) {
    payload.borrower_name = requireText(input.borrower_name, 'Người vay', 200);
  }
  if (input.interest_rate !== undefined) {
    payload.interest_rate = normalizeNonNegative(input.interest_rate, 'Lãi suất');
  }
  if (input.expected_payment !== undefined) {
    payload.expected_payment = input.expected_payment === null || input.expected_payment === ''
      ? null
      : normalizeNonNegative(input.expected_payment, 'Khoản dự kiến thu');
  }
  if (input.payment_frequency !== undefined) payload.payment_frequency = input.payment_frequency;
  if (input.first_due_date !== undefined) {
    payload.first_due_date = normalizeDate(input.first_due_date, 'Ngày đến hạn');
  }
  if (input.due_day !== undefined) {
    validateDueDay(input.due_day);
    payload.due_day = input.due_day;
  }
  if (input.note !== undefined) payload.note = optionalText(input.note, 1000);
  if (input.is_archived !== undefined) payload.is_archived = input.is_archived;

  const supabase = createReceivablesClient();

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from('receivables')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  }

  if (input.funding_account_id) {
    const current = await getReceivableExact(id);
    if (!current.funding_account_id) {
      const { error } = await supabase.rpc('link_receivable_funding_account', {
        p_receivable_id: id,
        p_funding_account_id: input.funding_account_id,
      });
      if (error) throw error;
    } else if (current.funding_account_id !== input.funding_account_id) {
      throw new Error('Tài khoản nguồn đã gắn với khoản phải thu và không thể đổi để bảo toàn lịch sử.');
    }
  }

  return getReceivableExact(id);
}

export async function archiveReceivable(
  id: string,
  archived = true
): Promise<Receivable> {
  return updateReceivable(id, { is_archived: archived });
}

export async function getReceivablePayments(receivableId: string): Promise<ReceivablePayment[]> {
  const supabase = createReceivablesClient();
  const { data, error } = await supabase
    .from('receivable_payment_details')
    .select('*')
    .eq('receivable_id', receivableId)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ReceivablePayment[];
}

export async function recordReceivablePayment(
  input: ReceivablePaymentInput
): Promise<Receivable> {
  if (!input.receiving_account_id) {
    throw new Error('Bạn cần chọn tài khoản nhận tiền.');
  }

  const amount = normalizePositive(input.amount, 'Số tiền nhận');
  const principal = normalizeNonNegative(input.principal_amount, 'Tiền gốc');
  const interest = normalizeNonNegative(input.interest_amount, 'Tiền lãi');
  const paidOn = normalizeDate(input.paid_on, 'Ngày nhận tiền');
  if (!paidOn) throw new Error('Ngày nhận tiền không được để trống.');

  if (compareExactDecimals(addExactDecimals(principal, interest), amount) !== 0) {
    throw new Error('Tổng tiền nhận phải bằng tiền gốc cộng tiền lãi.');
  }

  const current = await getReceivableExact(input.receivable_id);
  if (compareExactDecimals(principal, current.outstanding_amount) > 0) {
    throw new Error('Tiền gốc nhận vượt quá dư còn phải thu.');
  }

  const supabase = createReceivablesClient();
  const { error } = await supabase.rpc('record_receivable_payment_v2', {
    p_receivable_id: input.receivable_id,
    p_receiving_account_id: input.receiving_account_id,
    p_amount: amount,
    p_principal_amount: principal,
    p_interest_amount: interest,
    p_paid_on: paidOn,
    p_note: optionalText(input.note, 1000),
  });

  if (error) throw error;
  return getReceivableExact(input.receivable_id);
}
