import { FinancialAssistantError } from './errors';
import type { FinancialReportSnapshot } from './types';

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,4})?$/;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const MAX_CONTEXT_BYTES = 24_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanLabel(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new FinancialAssistantError('INVALID_CONTEXT');
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > maxLength || UUID_PATTERN.test(cleaned)) {
    throw new FinancialAssistantError('INVALID_CONTEXT');
  }
  return cleaned;
}

function cleanMoney(value: unknown, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) {
    throw new FinancialAssistantError('INVALID_CONTEXT');
  }
  return value;
}

function cleanCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new FinancialAssistantError('INVALID_CONTEXT');
  }
  return value;
}

function cleanRows<T extends { label: string; amount: string; percentage: string; transactionCount: number }>(
  value: unknown,
  maxRows: number
): readonly T[] {
  if (!Array.isArray(value) || value.length > maxRows) {
    throw new FinancialAssistantError('INVALID_CONTEXT');
  }
  return value.map((row) => {
    if (!isRecord(row)) throw new FinancialAssistantError('INVALID_CONTEXT');
    return {
      label: cleanLabel(row.label, 80),
      amount: cleanMoney(row.amount),
      percentage: cleanLabel(row.percentage, 24),
      transactionCount: cleanCount(row.transactionCount),
    } as T;
  });
}

export function sanitizeFinancialReportSnapshot(value: unknown): FinancialReportSnapshot {
  if (!isRecord(value)) throw new FinancialAssistantError('INVALID_CONTEXT');

  if (!Array.isArray(value.cashFlow) || value.cashFlow.length > 24) {
    throw new FinancialAssistantError('INVALID_CONTEXT');
  }
  const cashFlow = value.cashFlow.map((row) => {
    if (!isRecord(row)) throw new FinancialAssistantError('INVALID_CONTEXT');
    return {
      label: cleanLabel(row.label, 40),
      income: cleanMoney(row.income) as string,
      expense: cleanMoney(row.expense) as string,
      savings: cleanMoney(row.savings) as string,
    };
  });

  const snapshot: FinancialReportSnapshot = {
    periodLabel: cleanLabel(value.periodLabel, 80),
    currency: cleanLabel(value.currency, 3),
    baseCurrency: cleanLabel(value.baseCurrency, 3),
    totalIncome: cleanMoney(value.totalIncome) as string,
    totalExpense: cleanMoney(value.totalExpense) as string,
    netSavings: cleanMoney(value.netSavings) as string,
    savingRatePercent:
      value.savingRatePercent === null ? null : cleanLabel(value.savingRatePercent, 24),
    transactionCount: cleanCount(value.transactionCount),
    totalAccountBalance: cleanMoney(value.totalAccountBalance, true),
    accountCount: cleanCount(value.accountCount),
    cashFlow,
    categories: cleanRows(value.categories, 20),
    incomeSources: cleanRows(value.incomeSources, 20),
  };

  const serialized = JSON.stringify(snapshot);
  if (new TextEncoder().encode(serialized).byteLength > MAX_CONTEXT_BYTES) {
    throw new FinancialAssistantError('INVALID_CONTEXT');
  }
  return snapshot;
}

export function serializeFinancialReportSnapshot(snapshot: FinancialReportSnapshot): string {
  return [
    '<BEGIN_FINANCIAL_REPORT_CONTEXT>',
    JSON.stringify(snapshot),
    '<END_FINANCIAL_REPORT_CONTEXT>',
  ].join('\n');
}
