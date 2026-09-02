import { addExactDecimals, compareExactDecimals, toExactDecimal } from '@/lib/money';
import type {
  IncomeAttributionReport,
  IncomeAttributionSourceAggregate,
  IncomeAttributionStreamAggregate,
  IncomeSourceType,
} from './types';

export const SUPPORTED_INCOME_SOURCE_TYPES: readonly IncomeSourceType[] = [
  'SALARY',
  'YOUTUBE',
  'FREELANCE',
  'INVESTMENT',
  'OTHER',
] as const;

export function isValidIncomeSourceType(type: unknown): type is IncomeSourceType {
  return typeof type === 'string' && (SUPPORTED_INCOME_SOURCE_TYPES as readonly string[]).includes(type);
}

export function validateIncomeSourceName(name: unknown): { valid: boolean; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Income source name must be a string' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Income source name cannot be empty' };
  }
  if (trimmed.length > 200) {
    return { valid: false, error: 'Income source name cannot exceed 200 characters' };
  }
  return { valid: true };
}

export function validateIncomeSourceStreamName(name: unknown): { valid: boolean; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Stream name must be a string' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Stream name cannot be empty' };
  }
  if (trimmed.length > 200) {
    return { valid: false, error: 'Stream name cannot exceed 200 characters' };
  }
  return { valid: true };
}

export function validateTransactionAttribution(input: {
  type: 'INCOME' | 'EXPENSE';
  income_source_id?: string | null;
  income_source_stream_id?: string | null;
}): { valid: boolean; error?: string } {
  const hasSource = Boolean(input.income_source_id && input.income_source_id.trim().length > 0);
  const hasStream = Boolean(
    input.income_source_stream_id && input.income_source_stream_id.trim().length > 0
  );

  if (input.type === 'EXPENSE') {
    if (hasSource || hasStream) {
      return {
        valid: false,
        error: 'Expense transactions cannot have income source or stream attribution',
      };
    }
  }

  if (hasStream && !hasSource) {
    return {
      valid: false,
      error: 'Income stream attribution requires a parent income source',
    };
  }

  return { valid: true };
}

export type RealizedTransactionForAttribution = {
  type: 'INCOME' | 'EXPENSE';
  is_voided: boolean;
  amount: string;
  currency_code: string;
  income_source_id?: string | null;
  income_source_stream_id?: string | null;
  income_source_name?: string | null;
  income_source_type?: IncomeSourceType | null;
  income_source_stream_name?: string | null;
};

export function validateAttributionCurrencyCode(code: unknown): string {
  if (typeof code !== 'string') {
    throw new Error('Invalid or missing currency_code: currency must be a non-empty string');
  }
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(trimmed)) {
    throw new Error(`Invalid currency_code "${code}": expected 3-letter uppercase ISO code`);
  }
  return trimmed;
}

/**
 * Deterministic, exact-decimal revenue attribution aggregator.
 * Excludes voided transactions and non-income transactions.
 * Never uses floating-point math.
 */
export function aggregateRealizedIncomeAttribution(
  transactions: RealizedTransactionForAttribution[]
): IncomeAttributionReport[] {
  // 1. Filter to active realized income only
  const realizedIncome = transactions.filter(
    (tx) => tx.type === 'INCOME' && tx.is_voided !== true
  );

  // 2. Group by currency (fail-closed on invalid currency)
  const byCurrency = new Map<string, RealizedTransactionForAttribution[]>();
  for (const tx of realizedIncome) {
    const curr = validateAttributionCurrencyCode(tx.currency_code);
    const list = byCurrency.get(curr) || [];
    list.push(tx);
    byCurrency.set(curr, list);
  }

  const reports: IncomeAttributionReport[] = [];

  for (const [currencyCode, txList] of byCurrency.entries()) {
    let totalIncome = '0.0000';

    // Map: sourceKey -> { aggregate, streamMap }
    const sourceMap = new Map<
      string,
      {
        aggregate: IncomeAttributionSourceAggregate;
        streamMap: Map<string, IncomeAttributionStreamAggregate>;
      }
    >();

    for (const tx of txList) {
      const exactAmount = toExactDecimal(tx.amount);
      totalIncome = addExactDecimals(totalIncome, exactAmount);

      const sourceId = tx.income_source_id || null;
      const sourceKey = sourceId || '__UNATTRIBUTED__';

      let sourceEntry = sourceMap.get(sourceKey);
      if (!sourceEntry) {
        sourceEntry = {
          aggregate: {
            sourceId,
            sourceName: tx.income_source_name || (sourceId ? 'Unknown Source' : 'Unattributed'),
            sourceType: tx.income_source_type || (sourceId ? 'OTHER' : 'UNATTRIBUTED'),
            currencyCode,
            totalAmount: '0.0000',
            transactionCount: 0,
            streams: [],
          },
          streamMap: new Map<string, IncomeAttributionStreamAggregate>(),
        };
        sourceMap.set(sourceKey, sourceEntry);
      }

      sourceEntry.aggregate.totalAmount = addExactDecimals(
        sourceEntry.aggregate.totalAmount,
        exactAmount
      );
      sourceEntry.aggregate.transactionCount += 1;

      // Stream aggregation
      const streamId = tx.income_source_stream_id || null;
      const streamKey = streamId || '__DIRECT__';

      let streamEntry = sourceEntry.streamMap.get(streamKey);
      if (!streamEntry) {
        streamEntry = {
          streamId,
          streamName: tx.income_source_stream_name || (streamId ? 'Unknown Stream' : 'Direct / Main'),
          currencyCode,
          totalAmount: '0.0000',
          transactionCount: 0,
        };
        sourceEntry.streamMap.set(streamKey, streamEntry);
      }

      streamEntry.totalAmount = addExactDecimals(streamEntry.totalAmount, exactAmount);
      streamEntry.transactionCount += 1;
    }

    const sources: IncomeAttributionSourceAggregate[] = [];
    for (const entry of sourceMap.values()) {
      const streams = Array.from(entry.streamMap.values());
      streams.sort((a, b) => {
        const cmp = compareExactDecimals(b.totalAmount, a.totalAmount);
        if (cmp !== 0) return cmp;
        return (a.streamName || '').localeCompare(b.streamName || '');
      });
      entry.aggregate.streams = streams;
      sources.push(entry.aggregate);
    }

    // Sort sources deterministically: highest totalAmount first, using exact decimal comparison
    sources.sort((a, b) => {
      const cmp = compareExactDecimals(b.totalAmount, a.totalAmount);
      if (cmp !== 0) return cmp;
      return (a.sourceName || '').localeCompare(b.sourceName || '');
    });

    reports.push({
      currencyCode,
      totalIncome,
      sources,
    });
  }

  // Sort reports by currency code
  reports.sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
  return reports;
}
