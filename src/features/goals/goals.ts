import { createClient } from '@/lib/supabase/client';
import type { GoalDetailRow } from '@/types/database';
import {
  addExactDecimals,
  subExactDecimals,
  compareExactDecimals,
  computeBasisPoints,
  toExactDecimal,
  isPositiveExactDecimal,
  isNonNegativeExactDecimal,
} from '@/lib/money';
import { isValidISODateString } from '@/features/recurring/engine';
import type {
  ExtendedGoal,
  GoalInsertInput,
  GoalUpdateInput,
  GoalSummary,
} from './types';

export function mapGoalDetailRow(row: GoalDetailRow): ExtendedGoal {
  const target = toExactDecimal(row.target_amount);
  const current = toExactDecimal(row.current_amount);
  const monthly = toExactDecimal(row.monthly_contribution);
  
  // remaining: target - current, capped at 0 if current > target
  const rawRemaining = subExactDecimals(target, current);
  const remaining = compareExactDecimals(rawRemaining, '0.0000') < 0 ? '0.0000' : rawRemaining;
  const basisPoints = computeBasisPoints(current, target);
  const isCompleted = compareExactDecimals(current, target) >= 0;

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    target_amount: target,
    current_amount: current,
    monthly_contribution: monthly,
    currency_code: row.currency_code,
    target_date: row.target_date,
    category: row.category,
    icon: row.icon,
    color: row.color,
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    remaining_amount: remaining,
    basisPoints,
    isCompleted,
  };
}

export function computeGoalSummary(
  goals: ExtendedGoal[],
  currencyCode: string
): GoalSummary {
  let totalTarget = '0.0000';
  let totalCurrent = '0.0000';
  let totalMonthlyContribution = '0.0000';
  let completedCount = 0;
  let activeCount = 0;

  for (const g of goals) {
    if (g.is_archived) continue;
    if (g.currency_code !== currencyCode) continue;

    totalTarget = addExactDecimals(totalTarget, g.target_amount);
    totalCurrent = addExactDecimals(totalCurrent, g.current_amount);
    totalMonthlyContribution = addExactDecimals(totalMonthlyContribution, g.monthly_contribution);
    activeCount += 1;
    if (g.isCompleted) {
      completedCount += 1;
    }
  }

  const rawRemaining = subExactDecimals(totalTarget, totalCurrent);
  const remaining = compareExactDecimals(rawRemaining, '0.0000') < 0 ? '0.0000' : rawRemaining;
  const basisPoints = computeBasisPoints(totalCurrent, totalTarget);
  const integerPart = Math.floor(basisPoints / 100);
  const fractionalPart = basisPoints % 100;
  const percentStr = `${integerPart}.${Math.floor(fractionalPart / 10)}`;

  return {
    currency_code: currencyCode,
    totalTarget,
    totalCurrent,
    remaining,
    totalRemaining: remaining,
    totalMonthlyContribution,
    basisPoints,
    percentStr,
    completedCount,
    activeCount,
  };
}

async function getGoalExact(id: string): Promise<ExtendedGoal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('goal_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Goal with id ${id} not found in goal_details view`);
  return mapGoalDetailRow(data as GoalDetailRow);
}

export async function getGoals(options?: {
  currencyCode?: string;
  includeArchived?: boolean;
}): Promise<ExtendedGoal[]> {
  const supabase = createClient();
  let query = supabase.from('goal_details').select('*');

  if (options?.currencyCode) {
    query = query.eq('currency_code', options.currencyCode.toUpperCase());
  }

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => mapGoalDetailRow(row as GoalDetailRow));
}

export async function createGoal(input: GoalInsertInput): Promise<ExtendedGoal> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const trimmedName = input.name.trim();
  if (!trimmedName || trimmedName.length > 200) {
    throw new Error('Goal name must be between 1 and 200 characters');
  }

  const normalizedTarget = toExactDecimal(input.target_amount);
  if (!isPositiveExactDecimal(normalizedTarget)) {
    throw new Error('Goal target_amount must be greater than 0');
  }

  const normalizedCurrent = input.current_amount !== undefined
    ? toExactDecimal(input.current_amount)
    : '0.0000';
  if (!isNonNegativeExactDecimal(normalizedCurrent)) {
    throw new Error('Goal current_amount must be non-negative');
  }

  const normalizedMonthly = input.monthly_contribution !== undefined
    ? toExactDecimal(input.monthly_contribution)
    : '0.0000';
  if (!isNonNegativeExactDecimal(normalizedMonthly)) {
    throw new Error('Goal monthly_contribution must be non-negative');
  }

  const normalizedCurrency = input.currency_code.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(normalizedCurrency)) {
    throw new Error('Invalid currency code format');
  }

  let validTargetDate: string | null = null;
  if (input.target_date !== undefined && input.target_date !== null && input.target_date.trim() !== '') {
    const trimmedDate = input.target_date.trim();
    if (!isValidISODateString(trimmedDate)) {
      throw new Error(`Invalid goal target_date: "${trimmedDate}" is not a valid calendar ISO date`);
    }
    validTargetDate = trimmedDate;
  }

  const category = input.category !== undefined && input.category.trim() !== ''
    ? input.category.trim()
    : 'OTHER';
  if (category.length < 1 || category.length > 100) {
    throw new Error('Goal category must be between 1 and 100 characters');
  }

  const icon = input.icon !== undefined && input.icon.trim() !== ''
    ? input.icon.trim()
    : 'Target';
  if (icon.length < 1 || icon.length > 100) {
    throw new Error('Goal icon must be between 1 and 100 characters');
  }

  const color = input.color !== undefined && input.color.trim() !== ''
    ? input.color.trim()
    : '#10b981';
  if (color.length < 1 || color.length > 32) {
    throw new Error('Goal color must be between 1 and 32 characters');
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userData.user.id,
      name: trimmedName,
      target_amount: normalizedTarget,
      current_amount: normalizedCurrent,
      monthly_contribution: normalizedMonthly,
      currency_code: normalizedCurrency,
      target_date: validTargetDate,
      category,
      icon,
      color,
    })
    .select('id')
    .single();

  if (error) throw error;
  return getGoalExact(data.id);
}

export async function updateGoal(
  id: string,
  input: GoalUpdateInput
): Promise<ExtendedGoal> {
  const supabase = createClient();
  const updatePayload: {
    name?: string;
    target_amount?: string;
    current_amount?: string;
    monthly_contribution?: string;
    currency_code?: string;
    target_date?: string | null;
    category?: string;
    icon?: string;
    color?: string;
    is_archived?: boolean;
  } = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed || trimmed.length > 200) {
      throw new Error('Goal name must be between 1 and 200 characters');
    }
    updatePayload.name = trimmed;
  }

  if (input.target_amount !== undefined) {
    const normalized = toExactDecimal(input.target_amount);
    if (!isPositiveExactDecimal(normalized)) {
      throw new Error('Goal target_amount must be greater than 0');
    }
    updatePayload.target_amount = normalized;
  }

  if (input.current_amount !== undefined) {
    const normalized = toExactDecimal(input.current_amount);
    if (!isNonNegativeExactDecimal(normalized)) {
      throw new Error('Goal current_amount must be non-negative');
    }
    updatePayload.current_amount = normalized;
  }

  if (input.monthly_contribution !== undefined) {
    const normalized = toExactDecimal(input.monthly_contribution);
    if (!isNonNegativeExactDecimal(normalized)) {
      throw new Error('Goal monthly_contribution must be non-negative');
    }
    updatePayload.monthly_contribution = normalized;
  }

  if (input.currency_code !== undefined) {
    const normalized = input.currency_code.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(normalized)) {
      throw new Error('Invalid currency code format');
    }
    updatePayload.currency_code = normalized;
  }

  if (input.target_date !== undefined) {
    if (input.target_date === null || input.target_date.trim() === '') {
      updatePayload.target_date = null;
    } else {
      const trimmedDate = input.target_date.trim();
      if (!isValidISODateString(trimmedDate)) {
        throw new Error(`Invalid goal target_date: "${trimmedDate}" is not a valid calendar ISO date`);
      }
      updatePayload.target_date = trimmedDate;
    }
  }

  if (input.category !== undefined) {
    const trimmed = input.category.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new Error('Goal category must be between 1 and 100 characters');
    }
    updatePayload.category = trimmed;
  }

  if (input.icon !== undefined) {
    const trimmed = input.icon.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new Error('Goal icon must be between 1 and 100 characters');
    }
    updatePayload.icon = trimmed;
  }

  if (input.color !== undefined) {
    const trimmed = input.color.trim();
    if (trimmed.length < 1 || trimmed.length > 32) {
      throw new Error('Goal color must be between 1 and 32 characters');
    }
    updatePayload.color = trimmed;
  }

  if (input.is_archived !== undefined) {
    updatePayload.is_archived = input.is_archived;
  }

  const { error } = await supabase
    .from('goals')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw error;
  return getGoalExact(id);
}

export async function contributeToGoal(
  id: string,
  contributionAmount: string
): Promise<ExtendedGoal> {
  const normalizedContribution = toExactDecimal(contributionAmount);
  if (!isPositiveExactDecimal(normalizedContribution)) {
    throw new Error('Contribution amount must be greater than 0');
  }

  const currentGoal = await getGoalExact(id);
  const newCurrentAmount = addExactDecimals(currentGoal.current_amount, normalizedContribution);

  return updateGoal(id, { current_amount: newCurrentAmount });
}

export async function archiveGoal(id: string): Promise<ExtendedGoal> {
  return updateGoal(id, { is_archived: true });
}

export async function unarchiveGoal(id: string): Promise<ExtendedGoal> {
  return updateGoal(id, { is_archived: false });
}
