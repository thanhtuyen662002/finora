import type { ReceiptVisionParseOutput, ReceiptTransactionDraft } from './types';

function canonicalizeMoney(value: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  // Accept only positive plain decimal strings with max scale 4 and max 16 integer digits
  if (!/^(0|[1-9]\d{0,15})(\.\d{1,4})?$/.test(trimmed)) {
    return '';
  }
  
  // Format to numeric(20,4)
  const parts = trimmed.split('.');
  const integerPart = parts[0];
  const decimalPart = (parts[1] || '').padEnd(4, '0');
  
  return `${integerPart}.${decimalPart}`;
}

function validateDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;

  return true;
}

export function deriveReceiptDraft(
  output: ReceiptVisionParseOutput,
  resolvedCategoryId: string | null
): ReceiptTransactionDraft {
  const warnings: string[] = [];
  let can_apply = true;

  if (output.image_quality === 'LOW') {
    warnings.push('IMAGE_QUALITY_LOW');
  }

  if (output.document_kind !== 'PURCHASE_RECEIPT') {
    can_apply = false;
    warnings.push('NOT_A_PURCHASE_RECEIPT');
  }

  // Amount
  const canonicalAmount = canonicalizeMoney(output.amount);
  if (output.amount_state === 'MISSING') {
    can_apply = false;
    warnings.push('AMOUNT_MISSING');
  } else if (output.amount_state === 'AMBIGUOUS' || canonicalAmount === '') {
    can_apply = false;
    warnings.push('AMOUNT_AMBIGUOUS');
  }

  // Currency
  if (output.currency_state === 'MISSING') {
    can_apply = false;
    warnings.push('CURRENCY_MISSING');
  } else if (output.currency_state === 'AMBIGUOUS') {
    can_apply = false;
    warnings.push('CURRENCY_AMBIGUOUS');
  } else if (output.currency_state === 'UNSUPPORTED') {
    can_apply = false;
    warnings.push('CURRENCY_UNSUPPORTED');
  }

  // Date
  if (output.occurred_on_state === 'MISSING') {
    can_apply = false;
    warnings.push('DATE_MISSING');
  } else if (output.occurred_on_state === 'AMBIGUOUS') {
    can_apply = false;
    warnings.push('DATE_AMBIGUOUS');
  } else if (output.occurred_on_state === 'INVALID' || !validateDate(output.occurred_on)) {
    can_apply = false;
    warnings.push('DATE_INVALID');
  }

  // Category
  if (output.category_token !== null && resolvedCategoryId === null) {
    warnings.push('CATEGORY_STALE');
  }

  return {
    type: 'EXPENSE',
    amount: canonicalAmount,
    currency_code: output.currency_state === 'PRESENT' && output.currency_code ? output.currency_code.toUpperCase() : null,
    occurred_on: (output.occurred_on_state === 'PRESENT' && validateDate(output.occurred_on)) ? output.occurred_on : null,
    merchant: output.merchant ? output.merchant.slice(0, 100) : null,
    category_id: resolvedCategoryId,
    note: output.note ? output.note.slice(0, 200) : null,
    can_apply,
    warnings,
  };
}
