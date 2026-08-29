import { createClient } from '@/lib/supabase/client';
import type { BudgetProgressRow } from '@/types/database';
import {
  addExactDecimals,
  subExactDecimals,
  compareExactDecimals,
  computeBasisPoints,
  toExactDecimal,
  isPositiveExactDecimal,
} from '@/lib/money';
import type {
  ExtendedBudget,
  BudgetInsertInput,
  BudgetUpdateInput,
  BudgetSummary,
} from './types';

export function normalizePeriodMonth(monthStr: string): string {
  const trimmed = monthStr.trim();
  // Expect YYYY-MM or YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid period_month format: expected YYYY-MM or YYYY-MM-DD, got "${monthStr}"`);
  }
  const year = match[1];
  const month = match[2];
  return `${year}-${month}-01`;
}

export function mapBudgetProgressRow(row: BudgetProgressRow): ExtendedBudget {
  const limit = toExactDecimal(row.limit_amount);
  const spent = toExactDecimal(row.spent_amount);
  const remaining = subExactDecimals(limit, spent);
  const basisPoints = computeBasisPoints(spent, limit);
  const isOverBudget = compareExactDecimals(spent, limit) > 0;

  return {
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id,
    category_type: 'EXPENSE',
    limit_amount: limit,
    currency_code: row.currency_code,
    period_month: row.period_month,
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    spent_amount: spent,
    remaining_amount: remaining,
    basisPoints,
    isOverBudget,
  };
}

export function computeBudgetSummary(
  budgets: ExtendedBudget[],
  currencyCode: string
): BudgetSummary {
  let totalLimit = '0.0000';
  let totalSpent = '0.0000';
  let overBudgetCount = 0;
  let activeCount = 0;

  for (const b of budgets) {
    if (b.is_archived) continue;
    if (b.currency_code !== currencyCode) continue;

    totalLimit = addExactDecimals(totalLimit, b.limit_amount);
    totalSpent = addExactDecimals(totalSpent, b.spent_amount);
    activeCount += 1;
    if (b.isOverBudget) {
      overBudgetCount += 1;
    }
  }

  const remaining = subExactDecimals(totalLimit, totalSpent);
  const basisPoints = computeBasisPoints(totalSpent, totalLimit);
  const integerPart = Math.floor(basisPoints / 100);
  const fractionalPart = basisPoints % 100;
  const percentStr = `${integerPart}.${Math.floor(fractionalPart / 10)}`;

  return {
    currency_code: currencyCode,
    totalLimit,
    totalSpent,
    remaining,
    basisPoints,
    percentStr,
    overBudgetCount,
    activeCount,
  };
}

async function getBudgetExact(id: string): Promise<ExtendedBudget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('budget_progress')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Budget with id ${id} not found in budget_progress view`);
  return mapBudgetProgressRow(data as BudgetProgressRow);
}

export async function getBudgets(options?: {
  periodMonth?: string;
  currencyCode?: string;
  includeArchived?: boolean;
}): Promise<ExtendedBudget[]> {
  const supabase = createClient();
  let query = supabase.from('budget_progress').select('*');

  if (options?.periodMonth) {
    const normalized = normalizePeriodMonth(options.periodMonth);
    query = query.eq('period_month', normalized);
  }

  if (options?.currencyCode) {
    query = query.eq('currency_code', options.currencyCode.toUpperCase());
  }

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  query = query.order('category_name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => mapBudgetProgressRow(row as BudgetProgressRow));
}

export async function createBudget(input: BudgetInsertInput): Promise<ExtendedBudget> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const normalizedLimit = toExactDecimal(input.limit_amount);
  if (!isPositiveExactDecimal(normalizedLimit)) {
    throw new Error('Budget limit_amount must be greater than 0');
  }

  const normalizedCurrency = input.currency_code.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(normalizedCurrency)) {
    throw new Error('Invalid currency code format');
  }

  const normalizedPeriod = normalizePeriodMonth(input.period_month);

  const { data, error } = await supabase
    .from('budgets')
    .insert({
      user_id: userData.user.id,
      category_id: input.category_id,
      category_type: 'EXPENSE',
      limit_amount: normalizedLimit,
      currency_code: normalizedCurrency,
      period_month: normalizedPeriod,
    })
    .select('id')
    .single();

  if (error) throw error;
  return getBudgetExact(data.id);
}

export async function updateBudget(
  id: string,
  input: BudgetUpdateInput
): Promise<ExtendedBudget> {
  const supabase = createClient();
  const updatePayload: {
    category_id?: string;
    category_type?: 'EXPENSE';
    limit_amount?: string;
    currency_code?: string;
    period_month?: string;
    is_archived?: boolean;
  } = {};

  if (input.category_id !== undefined) {
    updatePayload.category_id = input.category_id;
    updatePayload.category_type = 'EXPENSE';
  }

  if (input.limit_amount !== undefined) {
    const normalizedLimit = toExactDecimal(input.limit_amount);
    if (!isPositiveExactDecimal(normalizedLimit)) {
      throw new Error('Budget limit_amount must be greater than 0');
    }
    updatePayload.limit_amount = normalizedLimit;
  }

  if (input.currency_code !== undefined) {
    const normalizedCurrency = input.currency_code.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(normalizedCurrency)) {
      throw new Error('Invalid currency code format');
    }
    updatePayload.currency_code = normalizedCurrency;
  }

  if (input.period_month !== undefined) {
    updatePayload.period_month = normalizePeriodMonth(input.period_month);
  }

  if (input.is_archived !== undefined) {
    updatePayload.is_archived = input.is_archived;
  }

  const { error } = await supabase
    .from('budgets')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw error;
  return getBudgetExact(id);
}

export async function archiveBudget(id: string): Promise<ExtendedBudget> {
  return updateBudget(id, { is_archived: true });
}

export async function unarchiveBudget(id: string): Promise<ExtendedBudget> {
  return updateBudget(id, { is_archived: false });
}
