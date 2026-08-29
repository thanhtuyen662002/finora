import { createClient } from '@/lib/supabase/client';
import { getTransactions, type ExtendedTransaction } from '@/features/transactions';
import { getAccounts, getAccountBalances } from '@/features/accounts';
import type { AccountRow } from '@/types/database';
import {
  getDateRangeForPeriod,
  getCurrentMonthPrefix,
  formatFullMonthLabel,
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
 */
export async function getDashboardReportData(): Promise<DashboardReportData> {
  const supabase = createClient();

  const [transactions, accounts, balances, userSettingsResult] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('base_currency').maybeSingle(),
  ]);

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();

  // Discover all currencies in accounts or transactions
  const currencySet = new Set<string>();
  if (baseCurrency) currencySet.add(baseCurrency);
  accounts.forEach((a: AccountRow) => currencySet.add((a.currency_code || 'VND').toUpperCase()));
  transactions.forEach((t: ExtendedTransaction) => currencySet.add((t.currency_code || 'VND').toUpperCase()));
  if (currencySet.size === 0) currencySet.add('VND');

  const availableCurrencies = Array.from(currencySet);
  // Ensure baseCurrency is first
  if (availableCurrencies.includes(baseCurrency)) {
    const idx = availableCurrencies.indexOf(baseCurrency);
    if (idx > 0) {
      availableCurrencies.splice(idx, 1);
      availableCurrencies.unshift(baseCurrency);
    }
  }

  const currentMonthPrefix = getCurrentMonthPrefix();
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

  // 6-month cash flow per currency
  const dateRange6M = getDateRangeForPeriod('6M');
  const sixMonthCashFlowByCurrency: Record<string, ReturnType<typeof aggregateCashFlow>> = {};
  for (const c of availableCurrencies) {
    sixMonthCashFlowByCurrency[c] = aggregateCashFlow(transactions, c, dateRange6M.monthKeys);
  }

  const recentTransactions = transactions.slice(0, 6);
  const currentMonthLabel = formatFullMonthLabel(currentMonthPrefix);

  return {
    baseCurrency,
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
    supabase.from('user_settings').select('base_currency').maybeSingle(),
  ]);

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();

  const currencySet = new Set<string>();
  if (baseCurrency) currencySet.add(baseCurrency);
  accounts.forEach((a: AccountRow) => currencySet.add((a.currency_code || 'VND').toUpperCase()));
  transactions.forEach((t: ExtendedTransaction) => currencySet.add((t.currency_code || 'VND').toUpperCase()));
  if (currencySet.size === 0) currencySet.add('VND');

  const availableCurrencies = Array.from(currencySet);
  if (availableCurrencies.includes(baseCurrency)) {
    const idx = availableCurrencies.indexOf(baseCurrency);
    if (idx > 0) {
      availableCurrencies.splice(idx, 1);
      availableCurrencies.unshift(baseCurrency);
    }
  }

  const selectedCurrency = (preferredCurrency && availableCurrencies.includes(preferredCurrency.toUpperCase()))
    ? preferredCurrency.toUpperCase()
    : availableCurrencies[0] || 'VND';

  const dateRange = getDateRangeForPeriod(period);

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
    dateRangeLabel: dateRange.label,
    summary,
    cashFlow,
    categoryBreakdown,
    accountsInCurrency,
    totalAccountBalance,
    transactions: transactionsInScope,
  };
}
