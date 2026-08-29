/**
 * Finora Pure Deterministic Financial Report Engine
 *
 * All monetary calculations use exact decimal strings and BigInt arithmetic.
 * No native floating-point math, lossy conversions, or fake cross-currency aggregations.
 */

import {
  addExactDecimals,
  subExactDecimals,
  toExactDecimal,
  computeBasisPoints,
  computeSavingRatePercent,
} from '@/lib/money';
import type { AccountRow, TransactionDetailRow } from '@/types/database';
import type { ExtendedTransaction } from '@/features/transactions';
import type {
  ReportPeriod,
  CurrencySummary,
  MonthlyCashFlowPoint,
  CategoryExpenseBreakdown,
  AccountBalanceSnapshot,
  CurrencyAccountGroup,
} from './types';

export function getTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthPrefix(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  return `Th${parts[1]}`;
}

export function formatFullMonthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  return `Tháng ${parts[1]}/${parts[0]}`;
}

/**
 * Computes calendar range and chronological month keys for the selected period.
 */
export function getDateRangeForPeriod(
  period: ReportPeriod,
  now: Date = new Date()
): {
  startDate: string | null;
  endDate: string;
  label: string;
  monthKeys: string[];
} {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const endDate = getTodayDateString(now);

  const generateMonthKeys = (numMonths: number): { keys: string[]; startMonth: number; startYear: number } => {
    const keys: string[] = [];
    let startYear = currentYear;
    let startMonth = currentMonth + 1; // 1-indexed

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      if (i === numMonths - 1) {
        startYear = y;
        startMonth = d.getMonth() + 1;
      }
      keys.push(`${y}-${m}`);
    }
    return { keys, startMonth, startYear };
  };

  switch (period) {
    case '1M': {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const monthKey = `${currentYear}-${monthStr}`;
      return {
        startDate: `${monthKey}-01`,
        endDate,
        label: `Tháng ${monthStr}/${currentYear}`,
        monthKeys: [monthKey],
      };
    }
    case '3M': {
      const { keys, startMonth, startYear } = generateMonthKeys(3);
      const startMonthStr = String(startMonth).padStart(2, '0');
      const curMonthStr = String(currentMonth + 1).padStart(2, '0');
      return {
        startDate: `${keys[0]}-01`,
        endDate,
        label: `3 tháng (Th${startMonthStr}/${startYear} – Th${curMonthStr}/${currentYear})`,
        monthKeys: keys,
      };
    }
    case '6M': {
      const { keys, startMonth, startYear } = generateMonthKeys(6);
      const startMonthStr = String(startMonth).padStart(2, '0');
      const curMonthStr = String(currentMonth + 1).padStart(2, '0');
      return {
        startDate: `${keys[0]}-01`,
        endDate,
        label: `6 tháng (Th${startMonthStr}/${startYear} – Th${curMonthStr}/${currentYear})`,
        monthKeys: keys,
      };
    }
    case '1Y': {
      const { keys, startMonth, startYear } = generateMonthKeys(12);
      const startMonthStr = String(startMonth).padStart(2, '0');
      const curMonthStr = String(currentMonth + 1).padStart(2, '0');
      return {
        startDate: `${keys[0]}-01`,
        endDate,
        label: `12 tháng (Th${startMonthStr}/${startYear} – Th${curMonthStr}/${currentYear})`,
        monthKeys: keys,
      };
    }
    case 'ALL': {
      // Default to 12 months for the chart buckets if no range bound
      const { keys } = generateMonthKeys(12);
      return {
        startDate: null,
        endDate,
        label: 'Toàn bộ thời gian',
        monthKeys: keys,
      };
    }
  }
}

/**
 * Aggregates active transactions into currency summaries.
 * Never combines different currencies.
 */
export function aggregateCurrencySummaries(
  transactions: (TransactionDetailRow | ExtendedTransaction)[],
  filterMonthPrefix?: string,
  startDate?: string | null,
  endDate?: string | null
): Record<string, CurrencySummary> {
  const summaries: Record<string, CurrencySummary> = {};

  for (const tx of transactions) {
    if (tx.is_voided) continue;

    // Optional month prefix filter
    if (filterMonthPrefix && !tx.occurred_on.startsWith(filterMonthPrefix)) {
      continue;
    }
    // Optional date range filter
    if (startDate && tx.occurred_on < startDate) continue;
    if (endDate && tx.occurred_on > endDate) continue;

    const currency = (tx.currency_code || 'VND').toUpperCase();
    if (!summaries[currency]) {
      summaries[currency] = {
        currency,
        totalIncome: '0.0000',
        totalExpense: '0.0000',
        netSavings: '0.0000',
        savingRateBasisPoints: null,
        savingRatePercent: null,
        transactionCount: 0,
      };
    }

    if (tx.type === 'INCOME') {
      summaries[currency].totalIncome = addExactDecimals(
        summaries[currency].totalIncome,
        toExactDecimal(tx.amount)
      );
      summaries[currency].transactionCount += 1;
    } else if (tx.type === 'EXPENSE') {
      summaries[currency].totalExpense = addExactDecimals(
        summaries[currency].totalExpense,
        toExactDecimal(tx.amount)
      );
      summaries[currency].transactionCount += 1;
    }
  }

  // Derive net savings and saving rate within each currency
  for (const currency of Object.keys(summaries)) {
    const s = summaries[currency];
    s.netSavings = subExactDecimals(s.totalIncome, s.totalExpense);
    const rate = computeSavingRatePercent(s.totalIncome, s.totalExpense);
    s.savingRateBasisPoints = rate?.basisPoints ?? null;
    s.savingRatePercent = rate?.percentStr ?? null;
  }

  return summaries;
}

/**
 * Groups accounts and exact balances by currency code.
 */
export function aggregateAccountBalancesByCurrency(
  accounts: AccountRow[],
  balances: Record<string, string>
): Record<string, CurrencyAccountGroup> {
  const groups: Record<string, CurrencyAccountGroup> = {};

  for (const account of accounts) {
    const currency = (account.currency_code || 'VND').toUpperCase();
    if (!groups[currency]) {
      groups[currency] = {
        currency,
        totalBalance: '0.0000',
        accounts: [],
      };
    }

    const currentBalance = balances[account.id] !== undefined
      ? toExactDecimal(balances[account.id])
      : toExactDecimal(account.opening_balance);

    const snapshot: AccountBalanceSnapshot = {
      accountId: account.id,
      name: account.name,
      type: account.type,
      currency,
      currentBalance,
      color: account.color,
      institution: account.institution,
      isArchived: account.is_archived,
    };

    groups[currency].accounts.push(snapshot);

    // Active accounts participate in total balance
    if (!account.is_archived) {
      groups[currency].totalBalance = addExactDecimals(
        groups[currency].totalBalance,
        currentBalance
      );
    }
  }

  return groups;
}

/**
 * Generates monthly cash flow series for a target currency and month keys.
 */
export function aggregateCashFlow(
  transactions: (TransactionDetailRow | ExtendedTransaction)[],
  targetCurrency: string,
  monthKeys: string[]
): MonthlyCashFlowPoint[] {
  const normCurrency = (targetCurrency || 'VND').toUpperCase();
  const bucketMap = new Map<string, { income: string; expense: string }>();

  for (const key of monthKeys) {
    bucketMap.set(key, { income: '0.0000', expense: '0.0000' });
  }

  for (const tx of transactions) {
    if (tx.is_voided) continue;
    if ((tx.currency_code || '').toUpperCase() !== normCurrency) continue;

    const txMonth = tx.occurred_on.slice(0, 7); // "YYYY-MM"
    const bucket = bucketMap.get(txMonth);
    if (bucket) {
      if (tx.type === 'INCOME') {
        bucket.income = addExactDecimals(bucket.income, toExactDecimal(tx.amount));
      } else if (tx.type === 'EXPENSE') {
        bucket.expense = addExactDecimals(bucket.expense, toExactDecimal(tx.amount));
      }
    }
  }

  // Find max value in series for presentation geometry scaling
  let maxSeriesDecimal = '0.0000';
  const intermediatePoints: {
    monthKey: string;
    income: string;
    expense: string;
    savings: string;
  }[] = [];

  for (const key of monthKeys) {
    const bucket = bucketMap.get(key) || { income: '0.0000', expense: '0.0000' };
    const savings = subExactDecimals(bucket.income, bucket.expense);
    intermediatePoints.push({
      monthKey: key,
      income: bucket.income,
      expense: bucket.expense,
      savings,
    });

    if (bucket.income > maxSeriesDecimal) maxSeriesDecimal = bucket.income;
    if (bucket.expense > maxSeriesDecimal) maxSeriesDecimal = bucket.expense;
  }

  return intermediatePoints.map((p) => {
    const incomeBps = computeBasisPoints(p.income, maxSeriesDecimal);
    const expenseBps = computeBasisPoints(p.expense, maxSeriesDecimal);

    return {
      monthKey: p.monthKey,
      monthLabel: formatMonthLabel(p.monthKey),
      fullLabel: formatFullMonthLabel(p.monthKey),
      income: p.income,
      expense: p.expense,
      savings: p.savings,
      incomeBasisPoints: incomeBps,
      expenseBasisPoints: expenseBps,
    };
  });
}

/**
 * Aggregates expense breakdown by category for a selected currency and period.
 */
export function aggregateCategoryExpenses(
  transactions: (TransactionDetailRow | ExtendedTransaction)[],
  targetCurrency: string,
  startDate?: string | null,
  endDate?: string | null
): CategoryExpenseBreakdown[] {
  const normCurrency = (targetCurrency || 'VND').toUpperCase();
  const categoryMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      categoryColor: string;
      amount: string;
      transactionCount: number;
    }
  >();

  let totalExpense = '0.0000';

  for (const tx of transactions) {
    if (tx.is_voided) continue;
    if (tx.type !== 'EXPENSE') continue;
    if ((tx.currency_code || '').toUpperCase() !== normCurrency) continue;
    if (startDate && tx.occurred_on < startDate) continue;
    if (endDate && tx.occurred_on > endDate) continue;

    const catId = tx.category_id || 'uncategorized';
    const catName = ('category_name' in tx ? tx.category_name : tx.categoryName) || 'Chưa phân loại';
    const catIcon = ('category_icon' in tx ? tx.category_icon : tx.categoryIcon) || 'Tag';
    const catColor = ('category_color' in tx ? tx.category_color : tx.categoryColor) || '#94a3b8';

    const existing = categoryMap.get(catId) || {
      categoryId: catId,
      categoryName: catName,
      categoryIcon: catIcon,
      categoryColor: catColor,
      amount: '0.0000',
      transactionCount: 0,
    };

    existing.amount = addExactDecimals(existing.amount, toExactDecimal(tx.amount));
    existing.transactionCount += 1;
    categoryMap.set(catId, existing);

    totalExpense = addExactDecimals(totalExpense, toExactDecimal(tx.amount));
  }

  const result: CategoryExpenseBreakdown[] = [];

  for (const item of categoryMap.values()) {
    const bps = computeBasisPoints(item.amount, totalExpense);
    const percentage = Math.round(bps / 100);
    const percentageStr = `${(bps / 100).toFixed(1)}%`;

    result.push({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryIcon: item.categoryIcon,
      categoryColor: item.categoryColor,
      amount: item.amount,
      basisPoints: bps,
      percentage,
      percentageStr,
      transactionCount: item.transactionCount,
    });
  }

  // Sort descending by amount
  return result.sort((a, b) => b.basisPoints - a.basisPoints);
}

/**
 * Generates an RFC 4180 UTF-8 CSV export for transactions of the selected currency and period.
 */
export function exportTransactionsToCSV(
  transactions: (TransactionDetailRow | ExtendedTransaction)[],
  currency: string,
  periodLabel: string
): { filename: string; csvContent: string } {
  const normCurrency = (currency || 'VND').toUpperCase();
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Ngày',
    'Loại',
    'Danh mục',
    'Tài khoản',
    'Đối tác/Cửa hàng',
    'Số tiền',
    'Đơn vị tiền tệ',
    'Trạng thái',
    'Ghi chú',
  ];

  const rows = transactions
    .filter((tx) => (tx.currency_code || '').toUpperCase() === normCurrency)
    .map((tx) => {
      const typeLabel = tx.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu';
      const catName = ('category_name' in tx ? tx.category_name : tx.categoryName) || '';
      const accName = ('account_name' in tx ? tx.account_name : tx.accountName) || '';
      const status = tx.is_voided ? 'Đã vô hiệu hóa' : 'Hợp lệ';

      return [
        escapeCell(tx.occurred_on),
        escapeCell(typeLabel),
        escapeCell(catName),
        escapeCell(accName),
        escapeCell(tx.merchant),
        escapeCell(toExactDecimal(tx.amount)),
        escapeCell(tx.currency_code),
        escapeCell(status),
        escapeCell(tx.note),
      ].join(',');
    });

  // Prepend UTF-8 BOM for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const safePeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  const today = getTodayDateString();
  const filename = `finora_bao_cao_${normCurrency}_${safePeriod}_${today}.csv`;

  return { filename, csvContent };
}
