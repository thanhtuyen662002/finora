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
  AccountBalanceSnapshot
} from './types';
import { convertExactAmount } from '@/lib/exchange-rate/fx-math';
import { addExactDecimals } from '@/lib/money';

async function fetchSnapshots(targetCurrency: string, txIds: string[]) {
  const snapshots: any[] = [];
  for (let i = 0; i < txIds.length; i += 200) {
    const chunk = txIds.slice(i, i + 200);
    const res = await fetch('/api/fx/transaction-snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCurrency, transactionIds: chunk })
    });
    if (!res.ok) throw new Error('Failed to fetch FX snapshots');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    snapshots.push(...data.snapshots);
  }
  return snapshots;
}

export async function getDashboardReportData(): Promise<DashboardReportData> {
  const supabase = createClient();

  const [transactions, accounts, balances, userSettingsResult] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('base_currency, timezone, auto_fx_enabled').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const autoFxEnabled = userSettingsResult.data?.auto_fx_enabled ?? true;
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  const currentMonthPrefix = getCurrentMonthPrefix(timezone);
  const currentMonthSummaries = aggregateCurrencySummaries(transactions, currentMonthPrefix);

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

  const dateRange6M = getDateRangeForPeriod('6M', timezone);
  const sixMonthCashFlowByCurrency: Record<string, ReturnType<typeof aggregateCashFlow>> = {};

  for (const c of availableCurrencies) {
    sixMonthCashFlowByCurrency[c] = aggregateCashFlow(transactions, c, dateRange6M.monthKeys);
  }

  // BASE CURRENCY MODE
  if (autoFxEnabled) {
    try {
      // 1. Current rates for accounts
      const uniqueAccCurrencies = Array.from(new Set(accounts.map(a => a.currency_code || 'VND')));
      const rateRes = await fetch('/api/fx/current-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCurrency: baseCurrency, sourceCurrencies: uniqueAccCurrencies })
      });
      if (!rateRes.ok) throw new Error('Failed to load current rates');
      const rateData = await rateRes.json();
      if (rateData.error) throw new Error(rateData.error);
      const rates = rateData.rates;

      let baseTotalBalance = '0.0000';
      const baseAccounts: AccountBalanceSnapshot[] = [];
      for (const c of availableCurrencies) {
        const group = accountBalancesByCurrency[c];
        if (!group) continue;
        const rate = rates[c]?.rate || '1.000000000000';
        for (const acc of group.accounts) {
           const converted = convertExactAmount(acc.currentBalance, rate);
           baseAccounts.push({
             ...acc,
             currency: 'BASE',
             currentBalance: converted
           });
           if (!acc.isArchived) {
             baseTotalBalance = addExactDecimals(baseTotalBalance, converted);
           }
        }
      }
      accountBalancesByCurrency['BASE'] = {
        currency: 'BASE',
        totalBalance: baseTotalBalance,
        accounts: baseAccounts
      };

      // 2. Historical snapshots for transactions
      const txIds = transactions.map(t => t.id);
      const snapshots = await fetchSnapshots(baseCurrency, txIds);
      const snapMap = new Map(snapshots.map(s => [s.transaction_id, s]));

      const baseTransactions = transactions.map(tx => {
        const snap = snapMap.get(tx.id);
        if (!snap) throw new Error('Missing snapshot for transaction ' + tx.id);
        return {
          ...tx,
          currency_code: 'BASE',
          amount: snap.converted_amount
        };
      });

      const baseSummaries = aggregateCurrencySummaries(baseTransactions, currentMonthPrefix);
      currentMonthSummaries['BASE'] = baseSummaries['BASE'] || {
        currency: 'BASE',
        totalIncome: '0.0000',
        totalExpense: '0.0000',
        netSavings: '0.0000',
        savingRateBasisPoints: null,
        savingRatePercent: null,
        transactionCount: 0,
      };

      sixMonthCashFlowByCurrency['BASE'] = aggregateCashFlow(baseTransactions, 'BASE', dateRange6M.monthKeys);

      availableCurrencies.unshift('BASE');

    } catch (e) {
      console.error('Base currency mode failed:', e);
      // fail closed for base mode, native mode remains
    }
  }

  const recentTransactions = transactions.slice(0, 6);
  const currentMonthLabel = formatFullMonthLabel(currentMonthPrefix);

  return {
    baseCurrency,
    autoFxEnabled,
    defaultCurrency: autoFxEnabled && availableCurrencies.includes('BASE') ? 'BASE' : defaultCurrency,
    timezone,
    availableCurrencies,
    currentMonthSummaries,
    accountBalancesByCurrency,
    sixMonthCashFlowByCurrency,
    recentTransactions,
    currentMonthLabel,
  };
}

export async function getDetailedReportData(
  period: ReportPeriod,
  preferredCurrency?: string
): Promise<DetailedReportData> {
  const supabase = createClient();

  const [transactions, accounts, balances, userSettingsResult] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('base_currency, timezone, auto_fx_enabled').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const autoFxEnabled = userSettingsResult.data?.auto_fx_enabled ?? true;
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  let isBaseModeSuccess = false;
  let baseTransactions: ExtendedTransaction[] = [];
  let baseAccountGroup: any = null;

  if (autoFxEnabled) {
    try {
      const uniqueAccCurrencies = Array.from(new Set(accounts.map(a => a.currency_code || 'VND')));
      const rateRes = await fetch('/api/fx/current-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCurrency: baseCurrency, sourceCurrencies: uniqueAccCurrencies })
      });
      if (!rateRes.ok) throw new Error('Failed to load current rates');
      const rateData = await rateRes.json();
      if (rateData.error) throw new Error(rateData.error);
      const rates = rateData.rates;

      let baseTotalBalance = '0.0000';
      const baseAccounts: AccountBalanceSnapshot[] = [];
      const accountGroups = aggregateAccountBalancesByCurrency(accounts, balances);
      for (const c of availableCurrencies) {
        const group = accountGroups[c];
        if (!group) continue;
        const rate = rates[c]?.rate || '1.000000000000';
        for (const acc of group.accounts) {
           const converted = convertExactAmount(acc.currentBalance, rate);
           baseAccounts.push({
             ...acc,
             currency: 'BASE',
             currentBalance: converted
           });
           if (!acc.isArchived) {
             baseTotalBalance = addExactDecimals(baseTotalBalance, converted);
           }
        }
      }
      baseAccountGroup = {
        currency: 'BASE',
        totalBalance: baseTotalBalance,
        accounts: baseAccounts
      };

      const txIds = transactions.map(t => t.id);
      const snapshots = await fetchSnapshots(baseCurrency, txIds);
      const snapMap = new Map(snapshots.map(s => [s.transaction_id, s]));

      baseTransactions = transactions.map(tx => {
        const snap = snapMap.get(tx.id);
        if (!snap) throw new Error('Missing snapshot for transaction ' + tx.id);
        return {
          ...tx,
          currency_code: 'BASE',
          amount: snap.converted_amount,
          _fx_rate: snap.rate,
          _fx_provider: snap.provider,
          _fx_effective_date: snap.effective_date,
          _fx_original_amount: tx.amount,
          _fx_original_currency: tx.currency_code
        } as ExtendedTransaction & any;
      });

      availableCurrencies.unshift('BASE');
      isBaseModeSuccess = true;
    } catch (e) {
      console.error('Base currency mode failed:', e);
    }
  }

  const selectedCurrency =
    preferredCurrency && availableCurrencies.includes(preferredCurrency.toUpperCase())
      ? preferredCurrency.toUpperCase()
      : (isBaseModeSuccess ? 'BASE' : defaultCurrency);

  const activeTransactions = selectedCurrency === 'BASE' ? baseTransactions : transactions;

  const dateRange = getDateRangeForPeriod(
    period,
    timezone,
    new Date(),
    activeTransactions,
    selectedCurrency
  );

  const currencySummaries = aggregateCurrencySummaries(
    activeTransactions,
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

  const cashFlow = aggregateCashFlow(activeTransactions, selectedCurrency, dateRange.monthKeys);

  const categoryBreakdown = aggregateCategoryExpenses(
    activeTransactions,
    selectedCurrency,
    dateRange.startDate,
    dateRange.endDate
  );

  let accountsInCurrency: AccountBalanceSnapshot[] = [];
  let totalAccountBalance = '0.0000';

  if (selectedCurrency === 'BASE') {
    accountsInCurrency = baseAccountGroup.accounts;
    totalAccountBalance = baseAccountGroup.totalBalance;
  } else {
    const accountGroups = aggregateAccountBalancesByCurrency(accounts, balances);
    accountsInCurrency = accountGroups[selectedCurrency]?.accounts || [];
    totalAccountBalance = accountGroups[selectedCurrency]?.totalBalance || '0.0000';
  }

  const transactionsInScope: ExtendedTransaction[] = activeTransactions.filter((tx: ExtendedTransaction) => {
    if (tx.is_voided) return false;
    if ((tx.currency_code || '').toUpperCase() !== selectedCurrency) return false;
    if (dateRange.startDate && tx.occurred_on < dateRange.startDate) return false;
    if (dateRange.endDate && tx.occurred_on > dateRange.endDate) return false;
    return true;
  });

  return {
    period,
    selectedCurrency,
    autoFxEnabled,
    baseCurrency,
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
