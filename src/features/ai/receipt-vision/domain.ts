import type {
  ReceiptVisionParseOutput,
  ReceiptTransactionDraft,
  ReceiptWarningCode,
  ReceiptSupportedCurrency,
} from './types';
import { RECEIPT_WARNING_ORDER } from './types';
import type { CategoryResolutionResult } from './categories';

function canonicalizeMoney(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Accept only positive plain decimal strings with max scale 4 and max 16 integer digits
  if (!/^(0|[1-9]\d{0,15})(\.\d{1,4})?$/.test(trimmed) || !/[1-9]/.test(trimmed)) {
    return null;
  }

  // Format to numeric(20,4)
  const parts = trimmed.split('.');
  const integerPart = parts[0];
  const decimalPart = (parts[1] || '').padEnd(4, '0');

  return `${integerPart}.${decimalPart}`;
}

function isValidCalendarDate(dateStr: string | null): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (year < 1000 || year > 9999 || month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function deriveReceiptDraft(
  output: ReceiptVisionParseOutput,
  categoryResolution: CategoryResolutionResult
): ReceiptTransactionDraft {
  const activeWarnings = new Set<ReceiptWarningCode>();

  // 1. Document Kind
  if (output.document_kind !== 'PURCHASE_RECEIPT') {
    activeWarnings.add('DOCUMENT_UNSUPPORTED');
  }

  // 2. Image Quality
  if (output.image_quality === 'LOW') {
    activeWarnings.add('IMAGE_QUALITY_LOW');
  }

  // 3. Amount
  let canonicalAmount: string | null = null;
  if (output.amount_state === 'MISSING') {
    activeWarnings.add('TOTAL_MISSING');
  } else if (output.amount_state === 'AMBIGUOUS') {
    activeWarnings.add('TOTAL_AMBIGUOUS');
  } else if (output.amount_state === 'PRESENT') {
    canonicalAmount = canonicalizeMoney(output.amount);
    if (!canonicalAmount) {
      activeWarnings.add('TOTAL_AMBIGUOUS');
    }
  }

  // 4. Currency
  let resolvedCurrency: ReceiptSupportedCurrency | null = null;
  if (output.currency_state === 'MISSING') {
    activeWarnings.add('CURRENCY_MISSING');
  } else if (output.currency_state === 'AMBIGUOUS') {
    activeWarnings.add('CURRENCY_AMBIGUOUS');
  } else if (output.currency_state === 'UNSUPPORTED') {
    activeWarnings.add('CURRENCY_UNSUPPORTED');
  } else if (output.currency_state === 'PRESENT') {
    if (output.currency_code) {
      resolvedCurrency = output.currency_code;
    } else {
      activeWarnings.add('CURRENCY_MISSING');
    }
  }

  // 5. Date
  let validDate: string | null = null;
  if (output.occurred_on_state === 'MISSING') {
    activeWarnings.add('DATE_MISSING');
  } else if (output.occurred_on_state === 'AMBIGUOUS') {
    activeWarnings.add('DATE_AMBIGUOUS');
  } else if (output.occurred_on_state === 'INVALID') {
    activeWarnings.add('DATE_INVALID');
  } else if (output.occurred_on_state === 'PRESENT') {
    if (output.occurred_on && isValidCalendarDate(output.occurred_on)) {
      validDate = output.occurred_on;
    } else {
      activeWarnings.add('DATE_INVALID');
    }
  }

  // 6. Merchant
  let merchant: string | null = null;
  if (!output.merchant || output.merchant.trim().length === 0) {
    activeWarnings.add('MERCHANT_MISSING');
  } else {
    merchant = output.merchant.trim().slice(0, 100);
  }

  // 7. Category
  let categoryId: string | null = null;
  if (categoryResolution.status === 'RESOLVED') {
    categoryId = categoryResolution.categoryId;
  } else if (categoryResolution.status === 'STALE') {
    activeWarnings.add('CATEGORY_STALE');
  } else {
    activeWarnings.add('CATEGORY_UNRESOLVED');
  }

  // 8. Account: Account is always required in V1
  activeWarnings.add('ACCOUNT_REQUIRED');

  // can_apply rule
  const can_apply =
    output.document_kind === 'PURCHASE_RECEIPT' &&
    canonicalAmount !== null &&
    resolvedCurrency !== null &&
    validDate !== null;

  // Order warnings deterministically according to RECEIPT_WARNING_ORDER
  const orderedWarnings: ReceiptWarningCode[] = RECEIPT_WARNING_ORDER.filter((w) =>
    activeWarnings.has(w)
  );

  return {
    type: 'EXPENSE',
    amount: canonicalAmount,
    currency_code: resolvedCurrency,
    merchant,
    occurred_on: validDate,
    category_id: categoryId,
    account_id: null,
    note: output.note ? output.note.trim().slice(0, 200) : null,
    document_kind: output.document_kind,
    can_apply,
    warnings: orderedWarnings,
  };
}
