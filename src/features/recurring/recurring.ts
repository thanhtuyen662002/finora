import { createClient } from '@/lib/supabase/client';
import type { RecurringDetailRow } from '@/types/database';
import {
  addExactDecimals,
  subExactDecimals,
  toExactDecimal,
  isPositiveExactDecimal,
} from '@/lib/money';
import {
  calculateNextDueDate,
  diffCalendarDays,
  getTodayISODate,
  isValidISODateString,
  computeMonthlyProjectedAmount,
} from './engine';
export { computeMonthlyProjectedAmount };
import type {
  ExtendedRecurringItem,
  RecurringItemInsertInput,
  RecurringItemUpdateInput,
  RecurringSummary,
  RecurringFrequency,
} from './types';

export function mapRecurringDetailRow(
  row: RecurringDetailRow,
  asOfDateStr: string = getTodayISODate()
): ExtendedRecurringItem {
  const amount = toExactDecimal(row.amount);
  const nextDueDate = calculateNextDueDate(
    {
      anchor_date: row.anchor_date,
      frequency: row.frequency,
      end_date: row.end_date,
      is_paused: row.is_paused,
      is_archived: row.is_archived,
    },
    asOfDateStr
  );

  let daysUntilDue: number | null = null;
  let isOverdue = false;

  if (nextDueDate) {
    daysUntilDue = diffCalendarDays(nextDueDate, asOfDateStr);
    isOverdue = daysUntilDue < 0;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    account_id: row.account_id,
    accountName: row.account_name,
    accountColor: row.account_color,
    category_id: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    transaction_type: row.transaction_type,
    name: row.name,
    amount,
    currency_code: row.currency_code,
    frequency: row.frequency,
    anchor_date: row.anchor_date,
    end_date: row.end_date,
    note: row.note,
    is_paused: row.is_paused,
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    nextDueDate,
    daysUntilDue,
    isOverdue,
  };
}

export function computeRecurringSummary(
  items: ExtendedRecurringItem[],
  currencyCode: string
): RecurringSummary {
  let monthlyIncome = '0.0000';
  let monthlyExpense = '0.0000';
  let activeCount = 0;
  let pausedCount = 0;

  for (const item of items) {
    if (item.is_archived) continue;
    if (item.currency_code !== currencyCode) continue;

    if (item.is_paused) {
      pausedCount += 1;
      continue;
    }

    activeCount += 1;
    const projectedMonthly = computeMonthlyProjectedAmount(item.amount, item.frequency);
    if (item.transaction_type === 'INCOME') {
      monthlyIncome = addExactDecimals(monthlyIncome, projectedMonthly);
    } else {
      monthlyExpense = addExactDecimals(monthlyExpense, projectedMonthly);
    }
  }

  const netMonthly = subExactDecimals(monthlyIncome, monthlyExpense);

  return {
    currency_code: currencyCode,
    monthlyIncomeProjected: monthlyIncome,
    monthlyExpenseProjected: monthlyExpense,
    netMonthlyProjected: netMonthly,
    activeCount,
    pausedCount,
  };
}

async function getRecurringItemExact(
  id: string,
  asOfDateStr: string = getTodayISODate()
): Promise<ExtendedRecurringItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Recurring item with id ${id} not found in recurring_details view`);
  return mapRecurringDetailRow(data as RecurringDetailRow, asOfDateStr);
}

export async function getRecurringItems(options?: {
  currencyCode?: string;
  asOfDate?: string;
  includeArchived?: boolean;
  includePaused?: boolean;
}): Promise<ExtendedRecurringItem[]> {
  const supabase = createClient();
  let query = supabase.from('recurring_details').select('*');

  if (options?.currencyCode) {
    query = query.eq('currency_code', options.currencyCode.toUpperCase());
  }

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  if (options?.includePaused === false) {
    query = query.eq('is_paused', false);
  }

  query = query.order('name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  const asOfDateStr = options?.asOfDate || getTodayISODate();
  return (data || []).map((row) => mapRecurringDetailRow(row as RecurringDetailRow, asOfDateStr));
}

export async function createRecurringItem(
  input: RecurringItemInsertInput
): Promise<ExtendedRecurringItem> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const trimmedName = input.name.trim();
  if (!trimmedName || trimmedName.length > 200) {
    throw new Error('Recurring item name must be between 1 and 200 characters');
  }

  const normalizedAmount = toExactDecimal(input.amount);
  if (!isPositiveExactDecimal(normalizedAmount)) {
    throw new Error('Recurring item amount must be greater than 0');
  }

  const normalizedCurrency = input.currency_code.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(normalizedCurrency)) {
    throw new Error('Invalid currency code format');
  }

  if (!['INCOME', 'EXPENSE'].includes(input.transaction_type)) {
    throw new Error('transaction_type must be either INCOME or EXPENSE');
  }

  if (!['WEEKLY', 'MONTHLY', 'YEARLY'].includes(input.frequency)) {
    throw new Error('frequency must be WEEKLY, MONTHLY, or YEARLY');
  }

  if (!isValidISODateString(input.anchor_date)) {
    throw new Error('anchor_date must be a valid calendar date YYYY-MM-DD');
  }

  if (input.end_date) {
    if (!isValidISODateString(input.end_date)) {
      throw new Error('end_date must be a valid calendar date YYYY-MM-DD');
    }
    if (input.end_date < input.anchor_date) {
      throw new Error('end_date cannot be earlier than anchor_date');
    }
  }

  const { data, error } = await supabase
    .from('recurring_items')
    .insert({
      user_id: userData.user.id,
      account_id: input.account_id,
      category_id: input.category_id,
      transaction_type: input.transaction_type,
      name: trimmedName,
      amount: normalizedAmount,
      currency_code: normalizedCurrency,
      frequency: input.frequency,
      anchor_date: input.anchor_date,
      end_date: input.end_date || null,
      note: input.note?.trim() || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return getRecurringItemExact(data.id);
}

export async function updateRecurringItem(
  id: string,
  input: RecurringItemUpdateInput
): Promise<ExtendedRecurringItem> {
  const supabase = createClient();
  const updatePayload: {
    account_id?: string;
    category_id?: string;
    transaction_type?: 'INCOME' | 'EXPENSE';
    name?: string;
    amount?: string;
    currency_code?: string;
    frequency?: RecurringFrequency;
    anchor_date?: string;
    end_date?: string | null;
    note?: string | null;
    is_paused?: boolean;
    is_archived?: boolean;
  } = {};

  if (input.account_id !== undefined) updatePayload.account_id = input.account_id;
  if (input.category_id !== undefined) updatePayload.category_id = input.category_id;
  if (input.transaction_type !== undefined) updatePayload.transaction_type = input.transaction_type;

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed || trimmed.length > 200) {
      throw new Error('Recurring item name must be between 1 and 200 characters');
    }
    updatePayload.name = trimmed;
  }

  if (input.amount !== undefined) {
    const normalized = toExactDecimal(input.amount);
    if (!isPositiveExactDecimal(normalized)) {
      throw new Error('Recurring item amount must be greater than 0');
    }
    updatePayload.amount = normalized;
  }

  if (input.currency_code !== undefined) {
    const normalized = input.currency_code.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(normalized)) {
      throw new Error('Invalid currency code format');
    }
    updatePayload.currency_code = normalized;
  }

  if (input.frequency !== undefined) {
    updatePayload.frequency = input.frequency;
  }

  if (input.anchor_date !== undefined) {
    if (!isValidISODateString(input.anchor_date)) {
      throw new Error('anchor_date must be a valid calendar date YYYY-MM-DD');
    }
    updatePayload.anchor_date = input.anchor_date;
  }

  if (input.end_date !== undefined) {
    if (input.end_date !== null && !isValidISODateString(input.end_date)) {
      throw new Error('end_date must be a valid calendar date YYYY-MM-DD');
    }
    updatePayload.end_date = input.end_date;
  }

  if (input.note !== undefined) {
    updatePayload.note = input.note ? input.note.trim() : null;
  }

  if (input.is_paused !== undefined) {
    updatePayload.is_paused = input.is_paused;
  }

  if (input.is_archived !== undefined) {
    updatePayload.is_archived = input.is_archived;
  }

  const { error } = await supabase
    .from('recurring_items')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw error;
  return getRecurringItemExact(id);
}

export async function pauseRecurringItem(id: string): Promise<ExtendedRecurringItem> {
  return updateRecurringItem(id, { is_paused: true });
}

export async function resumeRecurringItem(id: string): Promise<ExtendedRecurringItem> {
  return updateRecurringItem(id, { is_paused: false });
}

export async function archiveRecurringItem(id: string): Promise<ExtendedRecurringItem> {
  return updateRecurringItem(id, { is_archived: true });
}

export async function unarchiveRecurringItem(id: string): Promise<ExtendedRecurringItem> {
  return updateRecurringItem(id, { is_archived: false });
}
