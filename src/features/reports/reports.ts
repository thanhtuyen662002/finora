import { createClient } from '@/lib/supabase/client';
import { getTransactions, type ExtendedTransaction } from '@/features/transactions';
import { getAccounts, getAccountBalances } from '@/features/accounts';
import {
  getDateRangeForPeriod,
  getCurrentMonthPrefix,
  formatFullMonthLabel,
  getAvailableCurrenciesAndDefault,
  validateAndResolveTimezone,
  aggregateCurrencySummaries,
  aggregateAccountBalancesByCurrency,
  aggregateCashFlow,
  aggregateCategoryExpenses,
} from './engine';
import type {
  ReportPeriod,
  DashboardReportData,
  DetailedReportData,
  CurrencySummary,
} from './types';

/**
 * Loads real Supabase data and derives the dashboard state.
 * Fails closed on any data load or balance retrieval failure.
 */
export async function getDashboardReportData(): Promise<DashboardReportData> {
  const supabase = createClient();

  const [transactions, accounts, balances, userSettingsResult] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('base_currency, timezone').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  const currentMonthPrefix = getCurrentMonthPrefix(timezone);
  const currentMonthSummaries = aggregateCurrencySummaries(transactions, currentMonthPrefix);

  // Guarantee every available currency has an exact summary object
  for (const c of availableCurrencies) {
    if (!currentMonthSummaries[c]) {
      currentMonthSummaries[c] = {
        currency: c,
        totalIncome: '0.0000',
        totalExpense: '0.0000',
        netSavings: '0.0000',
        savingRateBasisPoints: null,
        savingRatePercent: null,
        transactionCount: 0,
      };
    }
  }

  const accountBalancesByCurrency = aggregateAccountBalancesByCurrency(accounts, balances);
  for (const c of availableCurrencies) {
    if (!accountBalancesByCurrency[c]) {
      accountBalancesByCurrency[c] = {
        currency: c,
        totalBalance: '0.0000',
        accounts: [],
      };
    }
  }

  // 6-month cash flow per currency respecting configured timezone
  const dateRange6M = getDateRangeForPeriod('6M', timezone);
  const sixMonthCashFlowByCurrency: Record<string, ReturnType<typeof aggregateCashFlow>> = {};
  for (const c of availableCurrencies) {
    sixMonthCashFlowByCurrency[c] = aggregateCashFlow(transactions, c, dateRange6M.monthKeys);
  }

  const recentTransactions = transactions.slice(0, 6);
  const currentMonthLabel = formatFullMonthLabel(currentMonthPrefix);

  return {
    baseCurrency,
    defaultCurrency,
    timezone,
    availableCurrencies,
    currentMonthSummaries,
    accountBalancesByCurrency,
    sixMonthCashFlowByCurrency,
    recentTransactions,
    currentMonthLabel,
  };
}

/**
 * Loads real Supabase data and derives detailed financial report state for the selected period & currency.
 * Fails closed on any data load or balance retrieval failure.
 */
export async function getDetailedReportData(
  period: ReportPeriod,
  preferredCurrency?: string
): Promise<DetailedReportData> {
  const supabase = createClient();

  const [transactions, accounts, balances, userSettingsResult] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('base_currency, timezone').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  const selectedCurrency =
    preferredCurrency && availableCurrencies.includes(preferredCurrency.toUpperCase())
      ? preferredCurrency.toUpperCase()
      : defaultCurrency;

  const dateRange = getDateRangeForPeriod(
    period,
    timezone,
    new Date(),
    transactions,
    selectedCurrency
  );

  const currencySummaries = aggregateCurrencySummaries(
    transactions,
    undefined,
    dateRange.startDate,
    dateRange.endDate
  );

  const summary: CurrencySummary = currencySummaries[selectedCurrency] || {
    currency: selectedCurrency,
    totalIncome: '0.0000',
    totalExpense: '0.0000',
    netSavings: '0.0000',
    savingRateBasisPoints: null,
    savingRatePercent: null,
    transactionCount: 0,
  };

  const cashFlow = aggregateCashFlow(transactions, selectedCurrency, dateRange.monthKeys);
  const categoryBreakdown = aggregateCategoryExpenses(
    transactions,
    selectedCurrency,
    dateRange.startDate,
    dateRange.endDate
  );

  const accountGroups = aggregateAccountBalancesByCurrency(accounts, balances);
  const accountsInCurrency = accountGroups[selectedCurrency]?.accounts || [];
  const totalAccountBalance = accountGroups[selectedCurrency]?.totalBalance || '0.0000';

  // Filter transactions in scope for table / CSV
  const transactionsInScope: ExtendedTransaction[] = transactions.filter((tx: ExtendedTransaction) => {
    if (tx.is_voided) return false;
    if ((tx.currency_code || '').toUpperCase() !== selectedCurrency) return false;
    if (dateRange.startDate && tx.occurred_on < dateRange.startDate) return false;
    if (dateRange.endDate && tx.occurred_on > dateRange.endDate) return false;
    return true;
  });

  return {
    period,
    selectedCurrency,
    availableCurrencies,
    timezone,
    dateRangeLabel: dateRange.label,
    summary,
    cashFlow,
    categoryBreakdown,
    accountsInCurrency,
    totalAccountBalance,
    transactions: transactionsInScope,
  };
}
