import type { AiInlineMediaPart } from '@/lib/ai/types';

export interface ReceiptVisionParseOutput {
  readonly document_kind: 'PURCHASE_RECEIPT' | 'INVOICE' | 'CREDIT_NOTE' | 'UNKNOWN';
  readonly merchant: string | null;
  readonly occurred_on: string | null;
  readonly occurred_on_state: 'PRESENT' | 'MISSING' | 'AMBIGUOUS' | 'INVALID';
  readonly amount: string | null;
  readonly amount_state: 'PRESENT' | 'MISSING' | 'AMBIGUOUS';
  readonly currency_code: string | null;
  readonly currency_state: 'PRESENT' | 'MISSING' | 'AMBIGUOUS' | 'UNSUPPORTED';
  readonly category_token: string | null;
  readonly note: string | null;
  readonly image_quality: 'OK' | 'LOW';
}

export interface ReceiptTransactionDraft {
  readonly type: 'EXPENSE';
  readonly amount: string;
  readonly currency_code: string | null;
  readonly occurred_on: string | null;
  readonly merchant: string | null;
  readonly category_id: string | null;
  readonly note: string | null;
  readonly can_apply: boolean;
  readonly warnings: readonly string[];
}
