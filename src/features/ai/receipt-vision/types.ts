export type ReceiptDocumentKind =
  | 'PURCHASE_RECEIPT'
  | 'INVOICE'
  | 'CREDIT_NOTE'
  | 'OTHER';

export interface ReceiptVisionParseOutput {
  readonly document_kind: ReceiptDocumentKind;
  readonly merchant: string | null;
  readonly occurred_on: string | null;
  readonly occurred_on_state: 'PRESENT' | 'MISSING' | 'AMBIGUOUS' | 'INVALID';
  readonly amount: string | null;
  readonly amount_state: 'PRESENT' | 'MISSING' | 'AMBIGUOUS';
  readonly currency_code: 'VND' | 'USD' | 'EUR' | 'JPY' | 'CNY' | 'KRW' | null;
  readonly currency_state: 'PRESENT' | 'MISSING' | 'AMBIGUOUS' | 'UNSUPPORTED';
  readonly category_token: string | null;
  readonly note: string | null;
  readonly image_quality: 'OK' | 'LOW';
}

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

export interface ReceiptTransactionDraft {
  readonly type: 'EXPENSE';
  readonly amount: string | null;
  readonly currency_code: 'VND' | 'USD' | 'EUR' | 'JPY' | 'CNY' | 'KRW' | null;
  readonly merchant: string | null;
  readonly occurred_on: string | null;
  readonly category_id: string | null;
  readonly account_id: null;
  readonly note: string | null;
  readonly document_kind: ReceiptDocumentKind;
  readonly can_apply: boolean;
  readonly warnings: readonly ReceiptWarningCode[];
}
