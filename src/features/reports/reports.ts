import { resolveAutoFxCapability } from '@/lib/exchange-rate/capability';

import { createClient } from '@/lib/supabase/client';
import {
  getTransactions,
  getTransactionsInDateRange,
  getRecentTransactions,
  type ExtendedTransaction,
} from '@/features/transactions';
import { getAccounts, getAccountBalances } from '@/features/accounts';
import type { AccountRow } from '@/types/database';
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
  AccountBalanceSnapshot,
  BaseValuationProvenance,
  BaseHistoricalProvenance,
  BaseConvertedTransaction,
  FxQuote
} from './types';
import { convertExactAmount } from '@/lib/exchange-rate/fx-math';
import { addExactDecimals } from '@/lib/money';

async function fetchSnapshots(targetCurrency: string, txIds: string[]) {
  if (txIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < txIds.length; i += 200) {
    chunks.push(txIds.slice(i, i + 200));
  }

  const allSnapshots: any[] = [];
  const MAX_CONCURRENT_CHUNKS = 4;
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        const res = await fetch('/api/fx/transaction-snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetCurrency, transactionIds: chunk })
        });
        if (!res.ok) throw new Error('Failed to fetch historical snapshots');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return (data.snapshots || []) as any[];
      })
    );
    batchResults.forEach((snaps) => allSnapshots.push(...snaps));
  }
  return allSnapshots;
}

export async function getDashboardReportData(
  preferredCurrency?: string
): Promise<DashboardReportData> {
  const supabase = createClient();

  const [accounts, balances, userSettingsResult] = await Promise.all([
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('*').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const { schemaAvailable: schemaHasAutoFx, enabled: autoFxEnabled } = resolveAutoFxCapability(userSettingsResult.data);
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);

  const dateRange6M = getDateRangeForPeriod('6M', timezone, new Date(), undefined, undefined);

  const [periodTxList, recentTxList] = await Promise.all([
    getTransactionsInDateRange(dateRange6M.startDate, dateRange6M.endDate),
    getRecentTransactions(6),
  ]);

  // Combine and deduplicate for recent transactions display
  const txMap = new Map<string, ExtendedTransaction>();
  for (const t of periodTxList) txMap.set(t.id, t);
  for (const t of recentTxList) txMap.set(t.id, t);
  const transactions = Array.from(txMap.values()).sort((a, b) => {
    if (b.occurred_on !== a.occurred_on) return b.occurred_on.localeCompare(a.occurred_on);
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  const currentMonthPrefix = getCurrentMonthPrefix(timezone);
  const currentMonthSummaries = aggregateCurrencySummaries(transactions, currentMonthPrefix);
  const accountBalancesByCurrency = aggregateAccountBalancesByCurrency(accounts, balances);

  const sixMonthCashFlowByCurrency: Record<string, any> = {};
  for (const c of availableCurrencies) {
    sixMonthCashFlowByCurrency[c] = aggregateCashFlow(transactions, c, dateRange6M.monthKeys);
  }

  const baseValuation: BaseValuationProvenance = {
    status: autoFxEnabled ? 'UNAVAILABLE' : 'DISABLED',
    error: null,
    quotes: {}
  };

  const baseHistorical: BaseHistoricalProvenance = {
    status: autoFxEnabled ? 'UNAVAILABLE' : 'DISABLED',
    error: null
  };

  const recentTransactions = transactions.slice(0, 6);
  const currentMonthLabel = formatFullMonthLabel(currentMonthPrefix);

  const nativeData: DashboardReportData & {
    _periodTxList?: ExtendedTransaction[];
    _accounts?: AccountRow[];
    _balances?: Record<string, string>;
    _dateRange6M?: any;
    _currentMonthPrefix?: string;
  } = {
    baseCurrency,
    autoFxEnabled,
    defaultCurrency,
    timezone,
    availableCurrencies,
    baseValuation,
    baseHistorical,
    currentMonthSummaries,
    accountBalancesByCurrency,
    sixMonthCashFlowByCurrency,
    recentTransactions,
    currentMonthLabel,
    _periodTxList: periodTxList,
    _accounts: accounts,
    _balances: balances,
    _dateRange6M: dateRange6M,
    _currentMonthPrefix: currentMonthPrefix,
  };

  return nativeData;
}

export async function enrichDashboardBaseFx(
  data: DashboardReportData
): Promise<DashboardReportData> {
  if (!data.autoFxEnabled) return data;

  const periodTxList: ExtendedTransaction[] = (data as any)._periodTxList || [];
  const accounts: AccountRow[] = (data as any)._accounts || [];
  const balances: Record<string, string> = (data as any)._balances || {};
  const dateRange6M = (data as any)._dateRange6M || getDateRangeForPeriod('6M', data.timezone, new Date(), undefined, undefined);
  const currentMonthPrefix = (data as any)._currentMonthPrefix || getCurrentMonthPrefix(data.timezone);

  const enriched = { ...data };

  const valuationTask = (async () => {
    const activeAccounts = accounts.filter((a) => !a.is_archived);
    const uniqueAccCurrencies = Array.from(new Set(activeAccounts.map((a) => (a.currency_code || 'VND').toUpperCase())));
    const rateRes = await fetch('/api/fx/current-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCurrency: data.baseCurrency, sourceCurrencies: uniqueAccCurrencies })
    });
    if (!rateRes.ok) throw new Error('Failed to load current rates');
    const rateData = await rateRes.json();
    if (rateData.error) throw new Error(rateData.error);

    const rates = rateData.rates as Record<string, FxQuote>;
    enriched.baseValuation = {
      status: 'AVAILABLE',
      error: null,
      quotes: rates,
    };

    let baseTotalBalance = '0.0000';
    const baseAccounts: AccountBalanceSnapshot[] = [];

    const activeAccountGroups = Object.values(data.accountBalancesByCurrency).filter(
      (group) => group.accounts.length > 0
    );

    for (const group of activeAccountGroups) {
      const c = group.currency;
      if (c === 'BASE') continue;

      const rateObj = rates[c];
      if (!rateObj && c !== data.baseCurrency) {
        throw new Error(`Missing required rate for ${c}`);
      }
      const rate = rateObj ? rateObj.rate : '1.000000000000';

      for (const acc of group.accounts) {
        if (acc.isArchived) continue;
        const converted = convertExactAmount(acc.currentBalance, rate);
        baseAccounts.push({
          ...acc,
          currency: 'BASE',
          currentBalance: converted
        });
        baseTotalBalance = addExactDecimals(baseTotalBalance, converted);
      }
    }

    enriched.accountBalancesByCurrency = {
      ...enriched.accountBalancesByCurrency,
      BASE: {
        currency: 'BASE',
        totalBalance: baseTotalBalance,
        accounts: baseAccounts
      }
    };
  })();

  const historicalTask = (async () => {
    // Snapshot scope is STRICTLY the 6M periodTxList, excluding out-of-scope recent transactions
    const periodTxIds = periodTxList.map((t) => t.id);
    const snapshots = await fetchSnapshots(data.baseCurrency, periodTxIds);
    const snapMap = new Map(snapshots.map((s) => [s.transaction_id, s]));

    const baseTransactions: BaseConvertedTransaction[] = periodTxList.map((tx) => {
      const snap = snapMap.get(tx.id);
      if (!snap) throw new Error('Missing snapshot for transaction ' + tx.id);
      return {
        ...tx,
        currency_code: 'BASE',
        amount: snap.converted_amount,
        fx_rate: snap.rate,
        fx_provider: snap.provider,
        fx_effective_date: snap.effective_date,
        fx_original_amount: tx.amount,
        fx_original_currency: tx.currency_code,
        fx_target_currency: data.baseCurrency
      } as BaseConvertedTransaction;
    });

    const baseSummaries = aggregateCurrencySummaries(baseTransactions, currentMonthPrefix);
    enriched.currentMonthSummaries = {
      ...enriched.currentMonthSummaries,
      BASE: baseSummaries['BASE'] || {
        currency: 'BASE',
        totalIncome: '0.0000',
        totalExpense: '0.0000',
        netSavings: '0.0000',
        savingRateBasisPoints: null,
        savingRatePercent: null,
        transactionCount: 0,
      }
    };

    enriched.sixMonthCashFlowByCurrency = {
      ...enriched.sixMonthCashFlowByCurrency,
      BASE: aggregateCashFlow(baseTransactions, 'BASE', dateRange6M.monthKeys)
    };

    enriched.baseHistorical = {
      status: 'AVAILABLE',
      error: null
    };
  })();

  const [valResult, histResult] = await Promise.allSettled([valuationTask, historicalTask]);
  if (valResult.status === 'rejected') {
    console.error('Base valuation failed:', valResult.reason);
    enriched.baseValuation = {
      status: 'UNAVAILABLE',
      error: valResult.reason?.message || String(valResult.reason),
      quotes: {}
    };
  }
  if (histResult.status === 'rejected') {
    console.error('Base historical failed:', histResult.reason);
    enriched.baseHistorical = {
      status: 'UNAVAILABLE',
      error: histResult.reason?.message || String(histResult.reason)
    };
  }

  if (enriched.baseValuation.status === 'AVAILABLE' || enriched.baseHistorical.status === 'AVAILABLE') {
    const newAvail = [...enriched.availableCurrencies];
    if (!newAvail.includes('BASE')) {
      newAvail.unshift('BASE');
    }
    enriched.availableCurrencies = newAvail;
    enriched.defaultCurrency = 'BASE';
  }

  return enriched;
}

export async function getDetailedReportData(
  period: ReportPeriod,
  preferredCurrency?: string
): Promise<DetailedReportData> {
  const supabase = createClient();

  const [accounts, balances, userSettingsResult] = await Promise.all([
    getAccounts(),
    getAccountBalances(),
    supabase.from('user_settings').select('*').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const { schemaAvailable: schemaHasAutoFx, enabled: autoFxEnabled } = resolveAutoFxCapability(userSettingsResult.data);
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);

  const dateRangeTemp = getDateRangeForPeriod(period, timezone, new Date(), undefined, preferredCurrency || undefined);

  const transactions = period === 'ALL'
    ? await getTransactions()
    : await getTransactionsInDateRange(dateRangeTemp.startDate, dateRangeTemp.endDate);

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  const activeAccountsHasForeign = accounts.some(
    (a) => !a.is_archived && (a.currency_code || 'VND').toUpperCase() !== baseCurrency
  );
  const inScopeTxHasForeign = transactions.some(
    (t) => !t.is_voided && (t.currency_code || 'VND').toUpperCase() !== baseCurrency
  );
  const hasMeaningfulForeignScope = activeAccountsHasForeign || inScopeTxHasForeign;

  if (autoFxEnabled && hasMeaningfulForeignScope) {
    if (!availableCurrencies.includes('BASE')) {
      availableCurrencies.unshift('BASE');
    }
  }

  let baseTransactions: BaseConvertedTransaction[] = [];
  let baseAccountGroup: any = null;

  const baseValuation: BaseValuationProvenance = {
    status: autoFxEnabled ? 'UNAVAILABLE' : 'DISABLED',
    error: null,
    quotes: {}
  };

  const baseHistorical: BaseHistoricalProvenance = {
    status: autoFxEnabled ? 'UNAVAILABLE' : 'DISABLED',
    error: null
  };

  const isBaseSelected = preferredCurrency
    ? preferredCurrency.toUpperCase() === 'BASE'
    : false;

  const isNativeMode = preferredCurrency && preferredCurrency.toUpperCase() !== 'BASE';

  if (autoFxEnabled && isBaseSelected && !isNativeMode) {
    const valuationTask = (async () => {
      const activeAccounts = accounts.filter((a) => !a.is_archived);
      const uniqueAccCurrencies = Array.from(new Set(activeAccounts.map((a) => (a.currency_code || 'VND').toUpperCase())));
      const rateRes = await fetch('/api/fx/current-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCurrency: baseCurrency, sourceCurrencies: uniqueAccCurrencies })
      });
      if (!rateRes.ok) throw new Error('Failed to load current rates');
      const rateData = await rateRes.json();
      if (rateData.error) throw new Error(rateData.error);

      const rates = rateData.rates as Record<string, FxQuote>;
      baseValuation.quotes = rates;

      let baseTotalBalance = '0.0000';
      const baseAccounts: AccountBalanceSnapshot[] = [];
      const accountGroups = aggregateAccountBalancesByCurrency(accounts, balances);
      const activeAccountGroups = Object.values(accountGroups).filter(
        (group) => group.accounts.length > 0
      );

      for (const group of activeAccountGroups) {
        const c = group.currency;
        if (c === 'BASE') continue;

        const rateObj = rates[c];
        if (!rateObj && c !== baseCurrency) {
          throw new Error(`Missing required rate for ${c}`);
        }
        const rate = rateObj ? rateObj.rate : '1.000000000000';

        for (const acc of group.accounts) {
          if (acc.isArchived) continue;
          const converted = convertExactAmount(acc.currentBalance, rate);
          baseAccounts.push({
            ...acc,
            currency: 'BASE',
            currentBalance: converted
          });
          baseTotalBalance = addExactDecimals(baseTotalBalance, converted);
        }
      }

      baseAccountGroup = {
        currency: 'BASE',
        totalBalance: baseTotalBalance,
        accounts: baseAccounts
      };
      baseValuation.status = 'AVAILABLE';
    })();

    const historicalTask = (async () => {
      const txIds = transactions.map((t) => t.id);
      const snapshots = await fetchSnapshots(baseCurrency, txIds);
      const snapMap = new Map(snapshots.map((s) => [s.transaction_id, s]));

      baseTransactions = transactions.map((tx) => {
        const snap = snapMap.get(tx.id);
        if (!snap) throw new Error('Missing snapshot for transaction ' + tx.id);
        return {
          ...tx,
          currency_code: 'BASE',
          amount: snap.converted_amount,
          fx_rate: snap.rate,
          fx_provider: snap.provider,
          fx_effective_date: snap.effective_date,
          fx_original_amount: tx.amount,
          fx_original_currency: tx.currency_code,
          fx_target_currency: baseCurrency
        } as BaseConvertedTransaction;
      });

      baseHistorical.status = 'AVAILABLE';
    })();

    const [valResult, histResult] = await Promise.allSettled([valuationTask, historicalTask]);
    if (valResult.status === 'rejected') {
      console.error('Base valuation failed:', valResult.reason);
      baseValuation.error = valResult.reason?.message || String(valResult.reason);
    }
    if (histResult.status === 'rejected') {
      console.error('Base historical failed:', histResult.reason);
      baseHistorical.error = histResult.reason?.message || String(histResult.reason);
    }

    if (baseValuation.status === 'AVAILABLE' || baseHistorical.status === 'AVAILABLE') {
      if (!availableCurrencies.includes('BASE')) {
        availableCurrencies.unshift('BASE');
      }
    }
  }

  const selectedCurrency =
    preferredCurrency && availableCurrencies.includes(preferredCurrency.toUpperCase())
      ? preferredCurrency.toUpperCase()
      : (baseHistorical.status === 'AVAILABLE' ? 'BASE' : defaultCurrency);

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

  let accountsInCurrency: AccountBalanceSnapshot[] | null = [];
  let totalAccountBalance: string | null = '0.0000';

  const accountGroups = aggregateAccountBalancesByCurrency(accounts, balances);

  if (selectedCurrency === 'BASE') {
    if (baseValuation.status === 'AVAILABLE' && baseAccountGroup) {
      accountsInCurrency = baseAccountGroup.accounts;
      totalAccountBalance = baseAccountGroup.totalBalance;
    } else {
      accountsInCurrency = null;
      totalAccountBalance = null;
    }
  } else {
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
    baseValuation,
    baseHistorical,
    summary,
    cashFlow,
    categoryBreakdown,
    accountsInCurrency,
    totalAccountBalance,
    transactions: transactionsInScope,
  };
}
