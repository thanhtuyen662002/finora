/**
 * Finora AI Receipt Vision — Types
 * Phase 12B — Multimodal Receipt Image Pipeline
 *
 * Client-safe type definitions. Must NOT import 'server-only'.
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
  | 'RECEIPT_IMAGE_REQUIRED'
  | 'RECEIPT_IMAGE_TOO_LARGE'
  | 'RECEIPT_IMAGE_INVALID_TYPE'
  | 'RECEIPT_IMAGE_CORRUPTED'
  | 'RECEIPT_IMAGE_DIMENSIONS_EXCEEDED'
  | 'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED'
  | 'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE'
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

export type ReceiptVisionActionResult =
  | {
      readonly ok: true;
      readonly data: ReceiptVisionExtractionResult;
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
