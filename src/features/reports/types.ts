import type { ExtendedTransaction } from '@/features/transactions';

export type ReportPeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type FxStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'DISABLED';

export interface FxQuote {
  sourceCurrency: string;
  targetCurrency: string;
  rate: string;
  requestedDate: string | null;
  effectiveDate: string;
  provider: string;
}

export interface BaseValuationProvenance {
  status: FxStatus;
  error: string | null;
  quotes: Record<string, FxQuote>; // keyed by source currency
}

export interface BaseHistoricalProvenance {
  status: FxStatus;
  error: string | null;
}

export interface ConvertedTransactionProvenance {
  fx_rate: string;
  fx_provider: string;
  fx_effective_date: string;
  fx_original_amount: string;
  fx_original_currency: string;
  fx_target_currency: string;
}

export type BaseConvertedTransaction = ExtendedTransaction & ConvertedTransactionProvenance;

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

export interface IncomeStreamBreakdown {
  streamId: string | null;
  streamName: string;
  amount: string; // Exact decimal string
  basisPoints: number; // [0..10000] fraction of total income in this period
  percentage: number; // e.g. 20
  percentageStr: string; // e.g. "20.0%"
  transactionCount: number;
}

export interface IncomeSourceBreakdown {
  sourceId: string | null;
  sourceName: string;
  sourceType: string | null;
  amount: string; // Exact decimal string
  basisPoints: number; // [0..10000] fraction of total income in this period
  percentage: number; // e.g. 45
  percentageStr: string; // e.g. "45.0%"
  transactionCount: number;
  streams: IncomeStreamBreakdown[];
}

export interface DashboardReportData {
  baseCurrency: string;
  autoFxEnabled: boolean;
  defaultCurrency: string;
  timezone: string;
  availableCurrencies: string[];
  
  // Provenance
  baseValuation: BaseValuationProvenance;
  baseHistorical: BaseHistoricalProvenance;
  
  // Current month active summaries grouped by currency
  currentMonthSummaries: Record<string, CurrencySummary>;
  
  // Account balances grouped by currency
  accountBalancesByCurrency: Record<string, CurrencyAccountGroup>;
  
  // 6-month cash flow series per currency
  sixMonthCashFlowByCurrency: Record<string, MonthlyCashFlowPoint[]>;

  // Income sources breakdown per currency
  incomeBreakdownByCurrency: Record<string, IncomeSourceBreakdown[]>;
  
  // Real recent transactions (limit 5-10)
  recentTransactions: ExtendedTransaction[]; // could contain BaseConvertedTransaction
  
  // Current month label e.g. "Tháng 08/2026"
  currentMonthLabel: string;
}

export interface DetailedReportData {
  period: ReportPeriod;
  selectedCurrency: string;
  autoFxEnabled: boolean;
  baseCurrency: string;
  availableCurrencies: string[];
  timezone: string;
  dateRangeLabel: string;
  
  // Provenance
  baseValuation: BaseValuationProvenance;
  baseHistorical: BaseHistoricalProvenance;
  
  summary: CurrencySummary;
  cashFlow: MonthlyCashFlowPoint[];
  categoryBreakdown: CategoryExpenseBreakdown[];
  incomeBreakdown: IncomeSourceBreakdown[];
  accountsInCurrency: AccountBalanceSnapshot[] | null;
  totalAccountBalance: string | null; // Exact decimal sum of accounts in selected currency
  transactions: ExtendedTransaction[]; // could contain BaseConvertedTransaction
}
