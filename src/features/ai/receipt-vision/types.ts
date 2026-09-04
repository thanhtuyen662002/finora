/**
 * Finora AI Receipt Vision — Types
 * Phase 12B — Multimodal Receipt Image Pipeline
 *
 * Client-safe type definitions.
 */

export type ReceiptDocumentKind =
  | 'PURCHASE_RECEIPT'
  | 'INVOICE'
  | 'CREDIT_NOTE'
  | 'OTHER';

export type ReceiptOccurredOnState =
  | 'PRESENT'
  | 'MISSING'
  | 'AMBIGUOUS'
  | 'INVALID';

export type ReceiptAmountState =
  | 'PRESENT'
  | 'MISSING'
  | 'AMBIGUOUS';

export type ReceiptCurrencyCode =
  | 'VND'
  | 'USD'
  | 'EUR'
  | 'JPY'
  | 'CNY'
  | 'KRW';

export type ReceiptCurrencyState =
  | 'PRESENT'
  | 'MISSING'
  | 'AMBIGUOUS'
  | 'UNSUPPORTED';

export type ReceiptImageQuality =
  | 'OK'
  | 'LOW';

export type ReceiptWarningCode =
  | 'DOCUMENT_UNSUPPORTED'
  | 'TOTAL_MISSING'
  | 'TOTAL_AMBIGUOUS'
  | 'CURRENCY_MISSING'
  | 'CURRENCY_AMBIGUOUS'
  | 'CURRENCY_UNSUPPORTED'
  | 'DATE_MISSING'
  | 'DATE_AMBIGUOUS'
  | 'DATE_INVALID'
  | 'MERCHANT_MISSING'
  | 'CATEGORY_UNRESOLVED'
  | 'CATEGORY_STALE'
  | 'ACCOUNT_REQUIRED'
  | 'IMAGE_QUALITY_LOW';

export interface ReceiptCategoryCandidate {
  readonly id: string;
  readonly token: `CAT_${number}`;
  readonly label: string;
}

export interface ReceiptTransactionDraft {
  readonly type: 'EXPENSE';
  readonly amount: string | null;
  readonly currency_code: ReceiptCurrencyCode | null;
  readonly merchant: string | null;
  readonly occurred_on: string | null;
  readonly category_id: string | null;
  readonly account_id: null;
  readonly note: string | null;
  readonly document_kind: ReceiptDocumentKind;
  readonly can_apply: boolean;
  readonly warnings: readonly ReceiptWarningCode[];
}

/**
 * Exact 11-key structured output returned by provider schema.
 */
export interface ReceiptVisionParseOutput {
  readonly document_kind: ReceiptDocumentKind;
  readonly merchant: string | null;
  readonly occurred_on: string | null;
  readonly occurred_on_state: ReceiptOccurredOnState;
  readonly amount: string | null;
  readonly amount_state: ReceiptAmountState;
  readonly currency_code: ReceiptCurrencyCode | null;
  readonly currency_state: ReceiptCurrencyState;
  readonly category_token: string | null;
  readonly note: string | null;
  readonly image_quality: ReceiptImageQuality;
}

export type ReceiptVisionErrorCode =
  | 'AUTH_REQUIRED'
  | 'RECEIPT_FILE_REQUIRED'
  | 'RECEIPT_FILE_TOO_LARGE'
  | 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  | 'RECEIPT_FILE_INVALID'
  | 'RECEIPT_IMAGE_TOO_LARGE'
  | 'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED'
  | 'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE'
  | 'RECEIPT_IMAGE_DECODE_FAILED'
  | 'CONTEXT_LOAD_FAILED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_AUTH_FAILED'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_ABORTED'
  | 'AI_INVALID_REQUEST'
  | 'AI_INVALID_RESPONSE'
  | 'AI_STRUCTURED_OUTPUT_INVALID'
  | 'AI_PROVIDER_ERROR'
  | 'AI_CREDENTIAL_CORRUPTED'
  | 'AI_CREDENTIAL_KEY_UNAVAILABLE'
  | 'AI_CREDENTIAL_RESOLUTION_FAILED';

export interface ReceiptVisionExtractionResult {
  readonly document_kind: ReceiptDocumentKind;
  readonly merchant: string | null;
  readonly occurred_on: string | null;
  readonly occurred_on_state: ReceiptOccurredOnState;
  readonly amount: string | null;
  readonly canonical_amount: string | null;
  readonly amount_state: ReceiptAmountState;
  readonly currency_code: ReceiptCurrencyCode | null;
  readonly currency_state: ReceiptCurrencyState;
  readonly category_token: string | null;
  readonly note: string | null;
  readonly image_quality: ReceiptImageQuality;
}

export interface ReceiptVisionActionResultData extends ReceiptVisionExtractionResult {
  readonly draft: ReceiptTransactionDraft;
}

export type ReceiptVisionActionResult =
  | {
      readonly ok: true;
      readonly data: ReceiptVisionActionResultData;
      readonly provider: string;
      readonly model: string;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ReceiptVisionErrorCode;
        readonly message: string;
      };
    };
