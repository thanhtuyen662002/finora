import type { DetailedReportData } from '@/features/reports';

export type FinancialAssistantMode = 'QUESTION' | 'REPORT_SUMMARY';

/**
 * Deliberately smaller than DetailedReportData. This is the only context
 * shape allowed across the model boundary: no transaction rows, UUIDs,
 * account names, prompts, credentials, or raw database values are included.
 */
export interface FinancialReportSnapshot {
  readonly periodLabel: string;
  readonly currency: string;
  readonly baseCurrency: string;
  readonly totalIncome: string;
  readonly totalExpense: string;
  readonly netSavings: string;
  readonly savingRatePercent: string | null;
  readonly transactionCount: number;
  readonly totalAccountBalance: string | null;
  readonly accountCount: number;
  readonly cashFlow: readonly {
    readonly label: string;
    readonly income: string;
    readonly expense: string;
    readonly savings: string;
  }[];
  readonly categories: readonly {
    readonly label: string;
    readonly amount: string;
    readonly percentage: string;
    readonly transactionCount: number;
  }[];
  readonly incomeSources: readonly {
    readonly label: string;
    readonly amount: string;
    readonly percentage: string;
    readonly transactionCount: number;
  }[];
}

export interface FinancialAssistantRequest {
  readonly mode: FinancialAssistantMode;
  readonly question?: string;
  readonly snapshot: FinancialReportSnapshot;
}

export interface FinancialAssistantSuccess {
  readonly ok: true;
  readonly text: string;
  readonly mode: FinancialAssistantMode;
}

export interface FinancialAssistantFailure {
  readonly ok: false;
  readonly code: string;
  readonly error: string;
}

export type FinancialAssistantResult =
  | FinancialAssistantSuccess
  | FinancialAssistantFailure;

export function createFinancialReportSnapshot(data: DetailedReportData): FinancialReportSnapshot {
  const displayCurrency = data.selectedCurrency === 'BASE' ? data.baseCurrency : data.selectedCurrency;
  return {
    periodLabel: data.dateRangeLabel,
    currency: displayCurrency,
    baseCurrency: data.baseCurrency,
    totalIncome: data.summary.totalIncome,
    totalExpense: data.summary.totalExpense,
    netSavings: data.summary.netSavings,
    savingRatePercent: data.summary.savingRatePercent,
    transactionCount: data.summary.transactionCount,
    totalAccountBalance: data.totalAccountBalance,
    accountCount: data.accountsInCurrency?.filter((account) => !account.isArchived).length ?? 0,
    cashFlow: data.cashFlow.map((point) => ({
      label: point.fullLabel,
      income: point.income,
      expense: point.expense,
      savings: point.savings,
    })),
    categories: data.categoryBreakdown.map((category) => ({
      label: category.categoryName,
      amount: category.amount,
      percentage: category.percentageStr,
      transactionCount: category.transactionCount,
    })),
    incomeSources: data.incomeBreakdown.map((source) => ({
      label: source.sourceName,
      amount: source.amount,
      percentage: source.percentageStr,
      transactionCount: source.transactionCount,
    })),
  };
}
