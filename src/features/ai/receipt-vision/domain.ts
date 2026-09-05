import type { ReceiptVisionParseOutput, ReceiptTransactionDraft, ReceiptWarningCode } from './types';
import type { CategoryCandidate } from './categories';

export function deriveReceiptDraft(
  parsed: ReceiptVisionParseOutput,
  candidates: readonly CategoryCandidate[],
  revalidatedCategoryOk: boolean = true
): ReceiptTransactionDraft {
  const warnings: ReceiptWarningCode[] = [];

  // Basic validation flags
  let amountValid = parsed.amount_state === 'PRESENT' && parsed.amount !== null;
  let currencyValid = parsed.currency_state === 'PRESENT' && parsed.currency_code !== null;
  let dateValid = parsed.occurred_on_state === 'PRESENT' && parsed.occurred_on !== null;
  
  if (parsed.document_kind !== 'PURCHASE_RECEIPT') {
    warnings.push('DOCUMENT_UNSUPPORTED');
  }

  // Warnings derivations
  if (parsed.amount_state === 'MISSING') warnings.push('TOTAL_MISSING');
  if (parsed.amount_state === 'AMBIGUOUS') warnings.push('TOTAL_AMBIGUOUS');

  if (parsed.currency_state === 'MISSING') warnings.push('CURRENCY_MISSING');
  if (parsed.currency_state === 'AMBIGUOUS') warnings.push('CURRENCY_AMBIGUOUS');
  if (parsed.currency_state === 'UNSUPPORTED') warnings.push('CURRENCY_UNSUPPORTED');

  if (parsed.occurred_on_state === 'MISSING') warnings.push('DATE_MISSING');
  if (parsed.occurred_on_state === 'AMBIGUOUS') warnings.push('DATE_AMBIGUOUS');
  if (parsed.occurred_on_state === 'INVALID') {
    warnings.push('DATE_INVALID');
    dateValid = false;
  }

  if (parsed.merchant === null) warnings.push('MERCHANT_MISSING');
  if (parsed.image_quality === 'LOW') warnings.push('IMAGE_QUALITY_LOW');

  let categoryId: string | null = null;
  if (parsed.category_token) {
    const candidate = candidates.find(c => c.token === parsed.category_token);
    if (candidate) {
      if (revalidatedCategoryOk) {
        categoryId = candidate.id;
      } else {
        warnings.push('CATEGORY_STALE');
      }
    } else {
      warnings.push('CATEGORY_UNRESOLVED');
    }
  }

  warnings.push('ACCOUNT_REQUIRED');

  const canApply = parsed.document_kind === 'PURCHASE_RECEIPT' &&
    amountValid &&
    currencyValid &&
    dateValid;

  return {
    type: 'EXPENSE',
    amount: parsed.amount,
    currency_code: parsed.currency_code,
    merchant: parsed.merchant,
    occurred_on: parsed.occurred_on,
    category_id: categoryId,
    account_id: null,
    note: parsed.note,
    document_kind: parsed.document_kind,
    can_apply: canApply,
    warnings,
  };
}
