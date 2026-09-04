/**
 * Finora AI Receipt Vision — Domain Logic & Warning Provenance
 * Phase 12B — Deterministic Warning Derivation, can_apply & Draft Construction
 *
 * Client-safe pure domain engine. Does not use server-only packages.
 */

import type {
  ReceiptCategoryCandidate,
  ReceiptDocumentKind,
  ReceiptTransactionDraft,
  ReceiptVisionExtractionResult,
  ReceiptWarningCode,
} from './types';

/**
 * Ordered list of warning codes for stable deterministic output ordering.
 */
export const RECEIPT_WARNING_ORDER: readonly ReceiptWarningCode[] = [
  'DOCUMENT_UNSUPPORTED',
  'TOTAL_MISSING',
  'TOTAL_AMBIGUOUS',
  'CURRENCY_MISSING',
  'CURRENCY_AMBIGUOUS',
  'CURRENCY_UNSUPPORTED',
  'DATE_MISSING',
  'DATE_AMBIGUOUS',
  'DATE_INVALID',
  'MERCHANT_MISSING',
  'CATEGORY_UNRESOLVED',
  'CATEGORY_STALE',
  'ACCOUNT_REQUIRED',
  'IMAGE_QUALITY_LOW',
] as const;

export type CategoryResolutionStatus = 'RESOLVED' | 'UNRESOLVED' | 'STALE';

/**
 * Derives deterministic receipt warnings strictly from extraction state fields.
 * Deduplicates and sorts warnings according to the canonical stable order.
 */
export function deriveReceiptWarnings(params: {
  extraction: ReceiptVisionExtractionResult;
  categoryStatus: CategoryResolutionStatus;
}): readonly ReceiptWarningCode[] {
  const { extraction, categoryStatus } = params;
  const warnings = new Set<ReceiptWarningCode>();

  // 1. Document kind
  if (extraction.document_kind !== 'PURCHASE_RECEIPT') {
    warnings.add('DOCUMENT_UNSUPPORTED');
  }

  // 2. Amount state
  if (extraction.amount_state === 'MISSING') {
    warnings.add('TOTAL_MISSING');
  } else if (extraction.amount_state === 'AMBIGUOUS') {
    warnings.add('TOTAL_AMBIGUOUS');
  }

  // 3. Currency state
  if (extraction.currency_state === 'MISSING') {
    warnings.add('CURRENCY_MISSING');
  } else if (extraction.currency_state === 'AMBIGUOUS') {
    warnings.add('CURRENCY_AMBIGUOUS');
  } else if (extraction.currency_state === 'UNSUPPORTED') {
    warnings.add('CURRENCY_UNSUPPORTED');
  }

  // 4. Date state
  if (extraction.occurred_on_state === 'MISSING') {
    warnings.add('DATE_MISSING');
  } else if (extraction.occurred_on_state === 'AMBIGUOUS') {
    warnings.add('DATE_AMBIGUOUS');
  } else if (extraction.occurred_on_state === 'INVALID') {
    warnings.add('DATE_INVALID');
  }

  // 5. Merchant
  if (extraction.merchant === null) {
    warnings.add('MERCHANT_MISSING');
  }

  // 6. Category status (mutually exclusive: UNRESOLVED vs STALE)
  if (categoryStatus === 'UNRESOLVED') {
    warnings.add('CATEGORY_UNRESOLVED');
  } else if (categoryStatus === 'STALE') {
    warnings.add('CATEGORY_STALE');
  }

  // 7. Account (always required in V1 because Receipt Vision never infers account)
  warnings.add('ACCOUNT_REQUIRED');

  // 8. Image quality
  if (extraction.image_quality === 'LOW') {
    warnings.add('IMAGE_QUALITY_LOW');
  }

  // Sort according to canonical RECEIPT_WARNING_ORDER
  return RECEIPT_WARNING_ORDER.filter((code) => warnings.has(code));
}

/**
 * Computes whether a receipt draft can be applied to the transaction form.
 * can_apply = true IFF:
 * 1. document_kind === 'PURCHASE_RECEIPT'
 * 2. amount is canonical non-null string
 * 3. currency_code is supported non-null
 * 4. occurred_on is valid non-null YYYY-MM-DD calendar date
 */
export function computeReceiptCanApply(params: {
  document_kind: ReceiptDocumentKind;
  canonical_amount: string | null;
  currency_code: string | null;
  occurred_on: string | null;
}): boolean {
  if (params.document_kind !== 'PURCHASE_RECEIPT') return false;
  if (!params.canonical_amount || typeof params.canonical_amount !== 'string') return false;
  if (!params.currency_code || typeof params.currency_code !== 'string') return false;
  if (!params.occurred_on || typeof params.occurred_on !== 'string') return false;
  return true;
}

/**
 * Builds the authoritative ReceiptTransactionDraft DTO.
 */
export function buildReceiptTransactionDraft(params: {
  extraction: ReceiptVisionExtractionResult;
  resolvedCategoryId: string | null;
  categoryStatus: CategoryResolutionStatus;
}): ReceiptTransactionDraft {
  const { extraction, resolvedCategoryId, categoryStatus } = params;

  const can_apply = computeReceiptCanApply({
    document_kind: extraction.document_kind,
    canonical_amount: extraction.canonical_amount,
    currency_code: extraction.currency_code,
    occurred_on: extraction.occurred_on,
  });

  const warnings = deriveReceiptWarnings({
    extraction,
    categoryStatus,
  });

  return {
    type: 'EXPENSE',
    amount: extraction.canonical_amount,
    currency_code: extraction.currency_code,
    merchant: extraction.merchant,
    occurred_on: extraction.occurred_on,
    category_id: resolvedCategoryId,
    account_id: null,
    note: extraction.note,
    document_kind: extraction.document_kind,
    can_apply,
    warnings,
  };
}
