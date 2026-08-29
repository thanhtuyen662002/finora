import type { GoalDetailRow, GoalRow } from '@/types/database';

export type ExtendedGoal = GoalRow & {
  remaining_amount: string;
  basisPoints: number;
  isCompleted: boolean;
};

export type GoalInsertInput = {
  name: string;
  target_amount: string;
  current_amount?: string;
  monthly_contribution?: string;
  currency_code: string;
  target_date?: string | null;
  category?: string;
  icon?: string;
  color?: string;
};

export type GoalUpdateInput = Partial<{
  name: string;
  target_amount: string;
  current_amount: string;
  monthly_contribution: string;
  currency_code: string;
  target_date: string | null;
  category: string;
  icon: string;
  color: string;
  is_archived: boolean;
}>;

export type GoalSummary = {
  currency_code: string;
  totalTarget: string;
  totalCurrent: string;
  remaining: string;
  totalRemaining: string;
  totalMonthlyContribution: string;
  basisPoints: number;
  percentStr: string;
  completedCount: number;
  activeCount: number;
};
