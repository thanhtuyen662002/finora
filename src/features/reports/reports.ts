import { resolveAutoFxCapability } from '@/lib/exchange-rate/capability';

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
  AccountBalanceSnapshot,
  BaseValuationProvenance,
  BaseHistoricalProvenance,
  BaseConvertedTransaction,
  FxQuote
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
    if (!res.ok) throw new Error('Failed to fetch historical snapshots');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    snapshots.push(...(data.snapshots || []));
  }
  return snapshots;
}

export async function getDashboardReportData(
  preferredCurrency?: string
): Promise<DashboardReportData> {
  const supabase = createClient();
  const [transactions, accounts, balances, userSettingsResult] = await Promise.all([
    getTransactions(),
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
  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

  const currentMonthPrefix = getCurrentMonthPrefix(timezone);
  const currentMonthSummaries = aggregateCurrencySummaries(transactions, currentMonthPrefix);
  const accountBalancesByCurrency = aggregateAccountBalancesByCurrency(accounts, balances);
  
  // Date range for 6M cash flow
  const dateRange6M = getDateRangeForPeriod('6M', timezone, new Date(), transactions, undefined);
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
      
      const rates = rateData.rates as Record<string, FxQuote>;
      baseValuation.quotes = rates;
      
      let baseTotalBalance = '0.0000';
      const baseAccounts: AccountBalanceSnapshot[] = [];
      
      for (const c of availableCurrencies) {
        if (c === 'BASE') continue;
        const group = accountBalancesByCurrency[c];
        if (!group) continue;
        
        const rateObj = rates[c];
        if (!rateObj && c !== baseCurrency) {
          throw new Error(`Missing required rate for ${c}`);
        }
        const rate = rateObj ? rateObj.rate : '1.000000000000';
        
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
      baseValuation.status = 'AVAILABLE';
      
    } catch (e: any) {
      console.error('Base valuation failed:', e);
      baseValuation.error = e.message;
    }
    
    try {
      // 2. Historical snapshots for transactions
      const txIds = transactions.map(t => t.id);
      const snapshots = await fetchSnapshots(baseCurrency, txIds);
      const snapMap = new Map(snapshots.map(s => [s.transaction_id, s]));
      
      const baseTransactions: BaseConvertedTransaction[] = transactions.map(tx => {
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
      baseHistorical.status = 'AVAILABLE';
    } catch (e: any) {
      console.error('Base historical failed:', e);
      baseHistorical.error = e.message;
    }
    
    if (baseValuation.status === 'AVAILABLE' || baseHistorical.status === 'AVAILABLE') {
       availableCurrencies.unshift('BASE');
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
    baseValuation,
    baseHistorical,
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
    supabase.from('user_settings').select('*').maybeSingle(),
  ]);

  if (userSettingsResult.error) {
    throw new Error(`Lỗi tải cấu hình người dùng: ${userSettingsResult.error.message}`);
  }

  const baseCurrency = (userSettingsResult.data?.base_currency || 'VND').toUpperCase();
  const { schemaAvailable: schemaHasAutoFx, enabled: autoFxEnabled } = resolveAutoFxCapability(userSettingsResult.data);
  const timezone = validateAndResolveTimezone(userSettingsResult.data?.timezone);
  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    accounts,
    transactions,
    baseCurrency
  );

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
      
      const rates = rateData.rates as Record<string, FxQuote>;
      baseValuation.quotes = rates;
      
      let baseTotalBalance = '0.0000';
      const baseAccounts: AccountBalanceSnapshot[] = [];
      const accountGroups = aggregateAccountBalancesByCurrency(accounts, balances);
      
      for (const c of availableCurrencies) {
        if (c === 'BASE') continue;
        const group = accountGroups[c];
        if (!group) continue;
        
        const rateObj = rates[c];
        if (!rateObj && c !== baseCurrency) {
          throw new Error(`Missing required rate for ${c}`);
        }
        const rate = rateObj ? rateObj.rate : '1.000000000000';
        
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
      
      baseValuation.status = 'AVAILABLE';
    } catch (e: any) {
      console.error('Base valuation failed:', e);
      baseValuation.error = e.message;
    }
    
    try {
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
          fx_rate: snap.rate,
          fx_provider: snap.provider,
          fx_effective_date: snap.effective_date,
          fx_original_amount: tx.amount,
          fx_original_currency: tx.currency_code,
          fx_target_currency: baseCurrency
        } as BaseConvertedTransaction;
      });
      
      baseHistorical.status = 'AVAILABLE';
    } catch (e: any) {
      console.error('Base historical failed:', e);
      baseHistorical.error = e.message;
    }
    
    if (baseValuation.status === 'AVAILABLE' || baseHistorical.status === 'AVAILABLE') {
       availableCurrencies.unshift('BASE');
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
