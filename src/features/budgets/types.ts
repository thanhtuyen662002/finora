import type { BudgetProgressRow, BudgetRow } from '@/types/database';

export type ExtendedBudget = BudgetRow & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  spent_amount: string;
  remaining_amount: string;
  basisPoints: number;
  isOverBudget: boolean;
};

export type BudgetInsertInput = {
  category_id: string;
  category_type?: 'EXPENSE';
  limit_amount: string;
  currency_code: string;
  period_month: string; // YYYY-MM-01
};

export type BudgetUpdateInput = Partial<{
  category_id: string;
  limit_amount: string;
  currency_code: string;
  period_month: string;
  is_archived: boolean;
}>;

export type BudgetSummary = {
  currency_code: string;
  totalLimit: string;
  totalSpent: string;
  remaining: string;
  basisPoints: number;
  percentStr: string;
  overBudgetCount: number;
  activeCount: number;
};
