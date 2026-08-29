/**
 * Finora Pure Deterministic Financial Report Engine
 *
 * All monetary calculations use exact decimal strings and BigInt arithmetic.
 * No native floating-point math, lossy conversions, or fake cross-currency aggregations.
 */

import {
  addExactDecimals,
  subExactDecimals,
  compareExactDecimals,
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

export interface CalendarDateInfo {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dateString: string; // "YYYY-MM-DD"
  monthPrefix: string; // "YYYY-MM"
}

/**
 * Validates and resolves an IANA timezone string.
 * - If timezone is undefined, null, or empty/whitespace, returns the established fallback 'Asia/Ho_Chi_Minh'.
 * - If timezone is provided and valid, returns the trimmed timezone string.
 * - If timezone is provided but invalid according to ECMAScript Intl, throws an Error (fail-closed).
 */
export function validateAndResolveTimezone(timezone?: string | null): string {
  if (timezone === undefined || timezone === null || timezone.trim() === '') {
    return 'Asia/Ho_Chi_Minh';
  }
  const cleanTz = timezone.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: cleanTz });
    return cleanTz;
  } catch (err: any) {
    throw new Error(`Múi giờ cấu hình không hợp lệ: "${timezone}". Vui lòng kiểm tra cài đặt người dùng.`);
  }
}

/**
 * Resolves the calendar date and month in a specific IANA timezone (e.g. 'Asia/Ho_Chi_Minh').
 * Uses standard ECMAScript Intl.DateTimeFormat without heavy date libraries.
 * Fails closed if a non-empty invalid timezone is provided.
 */
export function getCalendarDateInTimezone(
  timezone: string = 'Asia/Ho_Chi_Minh',
  now: Date = new Date()
): CalendarDateInfo {
  const validTz = validateAndResolveTimezone(timezone);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const formatted = formatter.format(now); // "YYYY-MM-DD"
  const [yyyy, mm, dd] = formatted.split('-');
  const year = parseInt(yyyy, 10);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);

  return {
    year,
    month,
    day,
    dateString: `${yyyy}-${mm}-${dd}`,
    monthPrefix: `${yyyy}-${mm}`,
  };
}

export function getTodayDateString(
  timezone: string = 'Asia/Ho_Chi_Minh',
  now: Date = new Date()
): string {
  return getCalendarDateInTimezone(timezone, now).dateString;
}

export function getCurrentMonthPrefix(
  timezone: string = 'Asia/Ho_Chi_Minh',
  now: Date = new Date()
): string {
  return getCalendarDateInTimezone(timezone, now).monthPrefix;
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
 * Discovers real financial currencies from accounts and transactions.
 * Follows strict Phase 6 rule:
 * - base_currency is prioritized if present in real financial data.
 * - If base_currency is absent from real financial data, it is NOT injected; the first deterministic currency is used.
 * - base_currency is only used as a fallback if no financial currencies exist at all.
 */
export function getAvailableCurrenciesAndDefault(
  accounts: AccountRow[],
  transactions: (TransactionDetailRow | ExtendedTransaction)[],
  baseCurrency: string
): { availableCurrencies: string[]; defaultCurrency: string } {
  const realCurrencySet = new Set<string>();
  for (const a of accounts) {
    if (a.currency_code) realCurrencySet.add(a.currency_code.toUpperCase());
  }
  for (const t of transactions) {
    if (t.currency_code) realCurrencySet.add(t.currency_code.toUpperCase());
  }

  const normalizedBase = (baseCurrency || '').toUpperCase();

  if (realCurrencySet.size === 0) {
    const fallback = normalizedBase || 'VND';
    return {
      availableCurrencies: [fallback],
      defaultCurrency: fallback,
    };
  }

  const sorted = Array.from(realCurrencySet).sort();
  if (normalizedBase && sorted.includes(normalizedBase)) {
    const available = [normalizedBase, ...sorted.filter((c) => c !== normalizedBase)];
    return {
      availableCurrencies: available,
      defaultCurrency: normalizedBase,
    };
  }

  return {
    availableCurrencies: sorted,
    defaultCurrency: sorted[0],
  };
}

/**
 * Computes calendar range and chronological month keys for the selected period.
 * Respects user timezone and generates all-history months from earliest transaction to current month.
 */
export function getDateRangeForPeriod(
  period: ReportPeriod,
  timezone: string = 'Asia/Ho_Chi_Minh',
  now: Date = new Date(),
  allTransactions?: (TransactionDetailRow | ExtendedTransaction)[],
  targetCurrency?: string
): {
  startDate: string | null;
  endDate: string;
  label: string;
  monthKeys: string[];
} {
  const cal = getCalendarDateInTimezone(timezone, now);
  const currentYear = cal.year;
  const currentMonth = cal.month; // 1-indexed (1..12)
  const endDate = cal.dateString;
  const currentMonthKey = cal.monthPrefix;

  const generateNRecentMonthKeys = (numMonths: number): string[] => {
    const keys: string[] = [];
    let curY = currentYear;
    let curM = currentMonth;
    for (let i = numMonths - 1; i >= 0; i--) {
      let targetM = curM - i;
      let targetY = curY;
      while (targetM <= 0) {
        targetM += 12;
        targetY -= 1;
      }
      keys.push(`${targetY}-${String(targetM).padStart(2, '0')}`);
    }
    return keys;
  };

  switch (period) {
    case '1M': {
      const monthStr = String(currentMonth).padStart(2, '0');
      return {
        startDate: `${currentMonthKey}-01`,
        endDate,
        label: `Tháng ${monthStr}/${currentYear}`,
        monthKeys: [currentMonthKey],
      };
    }
    case '3M': {
      const keys = generateNRecentMonthKeys(3);
      const startParts = keys[0].split('-');
      return {
        startDate: `${keys[0]}-01`,
        endDate,
        label: `3 tháng (Th${startParts[1]}/${startParts[0]} – Th${String(currentMonth).padStart(2, '0')}/${currentYear})`,
        monthKeys: keys,
      };
    }
    case '6M': {
      const keys = generateNRecentMonthKeys(6);
      const startParts = keys[0].split('-');
      return {
        startDate: `${keys[0]}-01`,
        endDate,
        label: `6 tháng (Th${startParts[1]}/${startParts[0]} – Th${String(currentMonth).padStart(2, '0')}/${currentYear})`,
        monthKeys: keys,
      };
    }
    case '1Y': {
      const keys = generateNRecentMonthKeys(12);
      const startParts = keys[0].split('-');
      return {
        startDate: `${keys[0]}-01`,
        endDate,
        label: `12 tháng (Th${startParts[1]}/${startParts[0]} – Th${String(currentMonth).padStart(2, '0')}/${currentYear})`,
        monthKeys: keys,
      };
    }
    case 'ALL': {
      // Find earliest matching transaction in targetCurrency
      let earliestMonthKey = currentMonthKey;
      if (allTransactions && targetCurrency) {
        const normCurrency = targetCurrency.toUpperCase();
        for (const tx of allTransactions) {
          if (tx.is_voided) continue;
          if ((tx.currency_code || '').toUpperCase() !== normCurrency) continue;
          const txMonth = tx.occurred_on.slice(0, 7);
          if (txMonth < earliestMonthKey) {
            earliestMonthKey = txMonth;
          }
        }
      }

      // Generate all chronological month keys from earliestMonthKey to currentMonthKey
      const [eYearStr, eMonthStr] = earliestMonthKey.split('-');
      const eYear = parseInt(eYearStr, 10);
      const eMonth = parseInt(eMonthStr, 10);

      const keys: string[] = [];
      let y = eYear;
      let m = eMonth;
      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        keys.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }

      return {
        startDate: null,
        endDate,
        label: 'Toàn bộ thời gian',
        monthKeys: keys.length > 0 ? keys : [currentMonthKey],
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
 * Fails closed if any account balance is missing from account_balances (never substitutes opening balance).
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

    if (balances[account.id] === undefined) {
      throw new Error(
        `Không tìm thấy số dư cho tài khoản "${account.name}" (${account.id}) trong account_balances`
      );
    }

    const currentBalance = toExactDecimal(balances[account.id]);

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
 * Uses exact decimal comparison (compareExactDecimals) for scale determination.
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

  // Find max value in series for presentation geometry scaling using exact decimal comparisons
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

    if (compareExactDecimals(bucket.income, maxSeriesDecimal) > 0) {
      maxSeriesDecimal = bucket.income;
    }
    if (compareExactDecimals(bucket.expense, maxSeriesDecimal) > 0) {
      maxSeriesDecimal = bucket.expense;
    }
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

  // Sort descending by basis points
  return result.sort((a, b) => b.basisPoints - a.basisPoints);
}

/**
 * Generates an RFC 4180 UTF-8 CSV export for transactions of the selected currency and period.
 */
export function exportTransactionsToCSV(
  transactions: (TransactionDetailRow | ExtendedTransaction)[],
  currency: string,
  periodLabel: string,
  timezone: string = 'Asia/Ho_Chi_Minh'
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
  if (normCurrency === 'BASE') {
    headers.push('Số tiền gốc', 'Tiền tệ gốc', 'Tỷ giá', 'Nguồn FX', 'Ngày tỷ giá');
  }

  const rows = transactions
    .filter((tx) => (tx.currency_code || '').toUpperCase() === normCurrency)
    .map((tx) => {
      const txAny = tx as any;
      const typeLabel = tx.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu';
      const catName = ('category_name' in tx ? tx.category_name : tx.categoryName) || '';
      const accName = ('account_name' in tx ? tx.account_name : tx.accountName) || '';
      const status = tx.is_voided ? 'Đã vô hiệu hóa' : 'Hợp lệ';

      const baseRow = [
        escapeCell(tx.occurred_on),
        escapeCell(typeLabel),
        escapeCell(catName),
        escapeCell(accName),
        escapeCell(tx.merchant),
        escapeCell(toExactDecimal(tx.amount)),
        escapeCell(tx.currency_code),
        escapeCell(status),
        escapeCell(tx.note),
      ];
      if (normCurrency === 'BASE') {
        baseRow.push(escapeCell(txAny.fx_original_amount ? toExactDecimal(txAny.fx_original_amount) : ''), escapeCell(txAny.fx_original_currency), escapeCell(txAny.fx_rate), escapeCell(txAny.fx_provider), escapeCell(txAny.fx_effective_date));
      }
      return baseRow.join(',');
    });

  // Prepend UTF-8 BOM for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const safePeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  const today = getTodayDateString(timezone);
  const filename = `finora_bao_cao_${normCurrency}_${safePeriod}_${today}.csv`;

  return { filename, csvContent };
}
