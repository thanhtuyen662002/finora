import { createClient } from '@/lib/supabase/client';
import {
  addExactDecimals,
  isNonNegativeExactDecimal,
  isPositiveExactDecimal,
  toExactDecimal,
} from '@/lib/money';
import type { DebtDetailRow, DebtPaymentDetailRow } from '@/types/database';
import type { DebtCreateInput, DebtPaymentInput, DebtUpdateInput } from './types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireText(value: string | null | undefined, field: string, maxLength: number): string {
  const normalized = (value || '').trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(field + ' không được để trống và tối đa ' + maxLength + ' ký tự.');
  }
  return normalized;
}

function optionalText(value: string | null | undefined, maxLength: number): string | null {
  const normalized = (value || '').trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error('Nội dung vượt quá ' + maxLength + ' ký tự.');
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
  const date = value.trim();
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error(field + ' không hợp lệ.');
  }
  return date;
}

function normalizePositive(value: string | number, field: string): string {
  const normalized = toExactDecimal(value);
  if (!isPositiveExactDecimal(normalized)) {
    throw new Error(field + ' phải lớn hơn 0.');
  }
  return normalized;
}

function normalizeNonNegative(value: string | number, field: string): string {
  const normalized = toExactDecimal(value);
  if (!isNonNegativeExactDecimal(normalized)) {
    throw new Error(field + ' không được âm.');
  }
  return normalized;
}

function validateCommonFields(input: DebtCreateInput | DebtUpdateInput) {
  if (input.name !== undefined) requireText(input.name, 'Tên khoản nợ', 200);
  if (input.lender_name !== undefined && input.lender_name !== null) {
    optionalText(input.lender_name, 200);
  }
  if (input.currency_code !== undefined) normalizeCurrency(input.currency_code);
  if (input.interest_rate !== undefined) normalizeNonNegative(input.interest_rate, 'Lãi suất');
  if (input.minimum_payment !== undefined && input.minimum_payment !== null) {
    normalizeNonNegative(input.minimum_payment, 'Khoản trả tối thiểu');
  }
  if (input.first_due_date !== undefined) normalizeDate(input.first_due_date, 'Ngày đến hạn');
  if (input.due_day !== undefined && input.due_day !== null) {
    if (!Number.isInteger(input.due_day) || input.due_day < 1 || input.due_day > 31) {
      throw new Error('Ngày đến hạn trong tháng phải từ 1 đến 31.');
    }
  }
  if (input.note !== undefined && input.note !== null) optionalText(input.note, 1000);
}

async function getDebtExact(id: string): Promise<DebtDetailRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('debt_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as DebtDetailRow;
}

export async function getDebts(options?: {
  includeArchived?: boolean;
}): Promise<DebtDetailRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('debt_details')
    .select('*')
    .order('is_archived', { ascending: true })
    .order('outstanding_amount', { ascending: false })
    .order('name', { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DebtDetailRow[];
}

export async function createDebt(input: DebtCreateInput): Promise<DebtDetailRow> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Bạn cần đăng nhập để tạo khoản nợ.');

  const name = requireText(input.name, 'Tên khoản nợ', 200);
  const lenderName = optionalText(input.lender_name, 200);
  const principal = normalizePositive(input.principal_amount, 'Số tiền gốc');
  const currency = normalizeCurrency(input.currency_code);
  const interestRate = input.interest_rate === undefined
    ? '0.0000'
    : normalizeNonNegative(input.interest_rate, 'Lãi suất');
  const minimumPayment = input.minimum_payment
    ? normalizeNonNegative(input.minimum_payment, 'Khoản trả tối thiểu')
    : null;
  const firstDueDate = normalizeDate(input.first_due_date, 'Ngày đến hạn');

  validateCommonFields(input);

  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userData.user.id,
      name,
      lender_name: lenderName,
      debt_type: input.debt_type,
      principal_amount: principal,
      outstanding_amount: principal,
      currency_code: currency,
      interest_rate: interestRate,
      minimum_payment: minimumPayment,
      payment_frequency: input.payment_frequency,
      first_due_date: firstDueDate,
      due_day: input.due_day ?? null,
      note: optionalText(input.note, 1000),
    })
    .select('id')
    .single();

  if (error) throw error;
  return getDebtExact(data.id);
}

export async function updateDebt(
  id: string,
  input: DebtUpdateInput
): Promise<DebtDetailRow> {
  validateCommonFields(input);
  const updatePayload: Record<string, unknown> = {};

  if (input.name !== undefined) updatePayload.name = requireText(input.name, 'Tên khoản nợ', 200);
  if (input.lender_name !== undefined) updatePayload.lender_name = optionalText(input.lender_name, 200);
  if (input.debt_type !== undefined) updatePayload.debt_type = input.debt_type;
  if (input.currency_code !== undefined) updatePayload.currency_code = normalizeCurrency(input.currency_code);
  if (input.interest_rate !== undefined) updatePayload.interest_rate = normalizeNonNegative(input.interest_rate, 'Lãi suất');
  if (input.minimum_payment !== undefined) {
    updatePayload.minimum_payment = input.minimum_payment === null
      ? null
      : normalizeNonNegative(input.minimum_payment, 'Khoản trả tối thiểu');
  }
  if (input.payment_frequency !== undefined) updatePayload.payment_frequency = input.payment_frequency;
  if (input.first_due_date !== undefined) updatePayload.first_due_date = normalizeDate(input.first_due_date, 'Ngày đến hạn');
  if (input.due_day !== undefined) updatePayload.due_day = input.due_day;
  if (input.note !== undefined) updatePayload.note = optionalText(input.note, 1000);
  if (input.is_archived !== undefined) updatePayload.is_archived = input.is_archived;

  if (Object.keys(updatePayload).length === 0) return getDebtExact(id);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('debts')
    .update(updatePayload)
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return getDebtExact(data.id);
}

export async function archiveDebt(id: string, archived = true): Promise<DebtDetailRow> {
  return updateDebt(id, { is_archived: archived });
}

export async function getDebtPayments(debtId: string): Promise<DebtPaymentDetailRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('debt_payment_details')
    .select('*')
    .eq('debt_id', debtId)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DebtPaymentDetailRow[];
}

export async function recordDebtPayment(input: DebtPaymentInput): Promise<DebtDetailRow> {
  const amount = normalizePositive(input.amount, 'Tổng thanh toán');
  const principal = normalizeNonNegative(input.principal_amount, 'Tiền gốc');
  const interest = normalizeNonNegative(input.interest_amount, 'Tiền lãi');
  const exactSum = addExactDecimals(principal, interest);

  if (amount !== exactSum) {
    throw new Error('Tổng thanh toán phải bằng tiền gốc cộng tiền lãi.');
  }

  const paidOn = normalizeDate(input.paid_on, 'Ngày thanh toán');
  if (!paidOn) throw new Error('Ngày thanh toán là bắt buộc.');

  const supabase = createClient();
  const { error } = await supabase.rpc('record_debt_payment', {
    p_debt_id: input.debt_id,
    p_account_id: input.account_id,
    p_category_id: input.category_id,
    p_amount: amount,
    p_principal_amount: principal,
    p_interest_amount: interest,
    p_paid_on: paidOn,
    p_note: optionalText(input.note, 1000),
  });

  if (error) throw error;
  return getDebtExact(input.debt_id);
}
