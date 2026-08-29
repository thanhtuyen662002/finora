import type { ExtendedTransaction } from '@/features/transactions';

export type ReportPeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface CurrencySummary {
  currency: string;
  totalIncome: string; // Exact decimal string e.g. "25000000.0000"
  totalExpense: string; // Exact decimal string
  netSavings: string; // Exact decimal string (income - expense)
  savingRateBasisPoints: number | null; // e.g. 5500 = 55.00%, null if income <= 0
  savingRatePercent: string | null; // e.g. "55.0", null if income <= 0
  transactionCount: number;
}

export interface MonthlyCashFlowPoint {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "Th08"
  fullLabel: string; // "Tháng 08/2026"
  income: string; // Exact decimal string
  expense: string; // Exact decimal string
  savings: string; // Exact decimal string
  // Presentation-only non-monetary bounded ratios [0..10000] basis points of max series value
  incomeBasisPoints: number;
  expenseBasisPoints: number;
}

export interface CategoryExpenseBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: string; // Exact decimal string
  basisPoints: number; // [0..10000] fraction of total category expenses in this period
  percentage: number; // e.g. 35
  percentageStr: string; // e.g. "35.2%"
  transactionCount: number;
}

export interface AccountBalanceSnapshot {
  accountId: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: string; // Exact decimal string from account_balances view
  color: string;
  institution: string | null;
  isArchived: boolean;
}

export interface CurrencyAccountGroup {
  currency: string;
  totalBalance: string; // Exact decimal sum
  accounts: AccountBalanceSnapshot[];
}

export interface DashboardReportData {
  baseCurrency: string;
  availableCurrencies: string[];
  // Current month active summaries grouped by currency
  currentMonthSummaries: Record<string, CurrencySummary>;
  // Account balances grouped by currency
  accountBalancesByCurrency: Record<string, CurrencyAccountGroup>;
  // 6-month cash flow series per currency
  sixMonthCashFlowByCurrency: Record<string, MonthlyCashFlowPoint[]>;
  // Real recent transactions (limit 5-10)
  recentTransactions: ExtendedTransaction[];
  // Current month label e.g. "Tháng 08/2026"
  currentMonthLabel: string;
}

export interface DetailedReportData {
  period: ReportPeriod;
  selectedCurrency: string;
  availableCurrencies: string[];
  dateRangeLabel: string;
  summary: CurrencySummary;
  cashFlow: MonthlyCashFlowPoint[];
  categoryBreakdown: CategoryExpenseBreakdown[];
  accountsInCurrency: AccountBalanceSnapshot[];
  totalAccountBalance: string; // Exact decimal sum of accounts in selected currency
  transactions: ExtendedTransaction[];
}
