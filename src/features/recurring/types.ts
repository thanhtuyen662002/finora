import type {
  RecurringDetailRow,
  RecurringFrequency,
  RecurringItemRow,
} from '@/types/database';

export type { RecurringFrequency };

export type ExtendedRecurringItem = RecurringItemRow & {
  accountName: string;
  accountColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  nextDueDate: string | null; // YYYY-MM-DD or null if expired/paused
  daysUntilDue: number | null;
  isOverdue: boolean;
};

export type RecurringItemInsertInput = {
  account_id: string;
  category_id: string;
  transaction_type: 'INCOME' | 'EXPENSE';
  name: string;
  amount: string;
  currency_code: string;
  frequency: RecurringFrequency;
  anchor_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  note?: string | null;
};

export type RecurringItemUpdateInput = Partial<{
  account_id: string;
  category_id: string;
  transaction_type: 'INCOME' | 'EXPENSE';
  name: string;
  amount: string;
  currency_code: string;
  frequency: RecurringFrequency;
  anchor_date: string;
  end_date: string | null;
  note: string | null;
  is_paused: boolean;
  is_archived: boolean;
}>;

export type RecurringSummary = {
  currency_code: string;
  monthlyIncomeProjected: string;
  monthlyExpenseProjected: string;
  netMonthlyProjected: string;
  activeCount: number;
  pausedCount: number;
};
