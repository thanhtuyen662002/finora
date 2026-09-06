import type { AiOutputValidator } from '@/lib/ai/types';
import type { ReceiptVisionParseOutput, ReceiptDocumentKind, ReceiptSupportedCurrency } from './types';
import { AiError } from '@/lib/ai/errors';

export const EXPECTED_RECEIPT_VISION_KEYS = [
  'document_kind',
  'merchant',
  'occurred_on',
  'occurred_on_state',
  'amount',
  'amount_state',
  'currency_code',
  'currency_state',
  'category_token',
  'note',
  'image_quality',
] as const;

export const ALLOWED_DOCUMENT_KINDS: readonly ReceiptDocumentKind[] = [
  'PURCHASE_RECEIPT',
  'INVOICE',
  'CREDIT_NOTE',
  'OTHER',
] as const;

export const ALLOWED_OCCURRED_ON_STATES = [
  'PRESENT',
  'MISSING',
  'AMBIGUOUS',
  'INVALID',
] as const;

export const ALLOWED_AMOUNT_STATES = [
  'PRESENT',
  'MISSING',
  'AMBIGUOUS',
] as const;

export const ALLOWED_CURRENCY_STATES = [
  'PRESENT',
  'MISSING',
  'AMBIGUOUS',
  'UNSUPPORTED',
] as const;

export const ALLOWED_CURRENCIES: readonly ReceiptSupportedCurrency[] = [
  'VND',
  'USD',
  'EUR',
  'JPY',
  'CNY',
  'KRW',
] as const;

export const ALLOWED_IMAGE_QUALITIES = [
  'OK',
  'LOW',
] as const;

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
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

function isValidAmountString(amountStr: string): boolean {
  if (!/^(0|[1-9]\d{0,15})(\.\d{1,4})?$/.test(amountStr)) {
    return false;
  }
  if (!/[1-9]/.test(amountStr)) {
    return false;
  }
  return true;
}

export function validateReceiptVisionOutput(value: unknown): ReceiptVisionParseOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'Expected a non-null object for receipt vision output.',
      providerId: 'gemini',
    });
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Exact 11-key keyset enforcement
  if (keys.length !== EXPECTED_RECEIPT_VISION_KEYS.length) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'Receipt vision output must contain exactly 11 keys.',
      providerId: 'gemini',
    });
  }

  for (const k of EXPECTED_RECEIPT_VISION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'Missing required key in receipt vision output.',
        providerId: 'gemini',
      });
    }
  }

  // 1. document_kind
  if (
    typeof obj.document_kind !== 'string' ||
    !ALLOWED_DOCUMENT_KINDS.includes(obj.document_kind as ReceiptDocumentKind)
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'document_kind must be one of PURCHASE_RECEIPT, INVOICE, CREDIT_NOTE, OTHER.',
      providerId: 'gemini',
    });
  }

  // 2. merchant: non-empty trimmed string with maximum 100 characters, or null
  if (obj.merchant !== null) {
    if (typeof obj.merchant !== 'string') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'merchant must be a string or null.',
        providerId: 'gemini',
      });
    }
    const trimmedMerchant = obj.merchant.trim();
    if (trimmedMerchant.length === 0 || trimmedMerchant.length > 100) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'merchant must be a non-empty trimmed string of at most 100 characters, or null.',
        providerId: 'gemini',
      });
    }
  }

  // 3. occurred_on_state
  if (
    typeof obj.occurred_on_state !== 'string' ||
    !ALLOWED_OCCURRED_ON_STATES.includes(obj.occurred_on_state as (typeof ALLOWED_OCCURRED_ON_STATES)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'occurred_on_state must be one of PRESENT, MISSING, AMBIGUOUS, INVALID.',
      providerId: 'gemini',
    });
  }

  // 4. occurred_on & state relationship
  if (obj.occurred_on_state === 'PRESENT') {
    if (
      typeof obj.occurred_on !== 'string' ||
      !isValidCalendarDate(obj.occurred_on)
    ) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'occurred_on must be a valid calendar date in YYYY-MM-DD format when state is PRESENT.',
        providerId: 'gemini',
      });
    }
  } else {
    if (obj.occurred_on !== null) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'occurred_on must be null when occurred_on_state is not PRESENT.',
        providerId: 'gemini',
      });
    }
  }

  // 5. amount_state
  if (
    typeof obj.amount_state !== 'string' ||
    !ALLOWED_AMOUNT_STATES.includes(obj.amount_state as (typeof ALLOWED_AMOUNT_STATES)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'amount_state must be one of PRESENT, MISSING, AMBIGUOUS.',
      providerId: 'gemini',
    });
  }

  // 6. amount (Zero coercion: numbers are strictly forbidden)
  if (typeof obj.amount === 'number') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'amount must be a string or null, numeric values are strictly prohibited.',
      providerId: 'gemini',
    });
  }

  if (obj.amount_state === 'PRESENT') {
    if (
      typeof obj.amount !== 'string' ||
      obj.amount.trim() !== obj.amount ||
      !isValidAmountString(obj.amount)
    ) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'amount must be a strictly positive plain decimal string with max 16 integer digits and max scale 4.',
        providerId: 'gemini',
      });
    }
  } else {
    if (obj.amount !== null) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'amount must be null when amount_state is not PRESENT.',
        providerId: 'gemini',
      });
    }
  }

  // 7. currency_state
  if (
    typeof obj.currency_state !== 'string' ||
    !ALLOWED_CURRENCY_STATES.includes(obj.currency_state as (typeof ALLOWED_CURRENCY_STATES)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'currency_state must be one of PRESENT, MISSING, AMBIGUOUS, UNSUPPORTED.',
      providerId: 'gemini',
    });
  }

  // 8. currency_code & state relationship
  if (obj.currency_state === 'PRESENT') {
    if (
      typeof obj.currency_code !== 'string' ||
      !ALLOWED_CURRENCIES.includes(obj.currency_code as ReceiptSupportedCurrency)
    ) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'currency_code must be one of VND, USD, EUR, JPY, CNY, KRW when state is PRESENT.',
        providerId: 'gemini',
      });
    }
  } else {
    if (obj.currency_code !== null) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'currency_code must be null when currency_state is not PRESENT.',
        providerId: 'gemini',
      });
    }
  }

  // 9. category_token: must match /^CAT_[1-9]\d*$/ or be null
  if (obj.category_token !== null) {
    if (
      typeof obj.category_token !== 'string' ||
      !/^CAT_[1-9]\d*$/.test(obj.category_token)
    ) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'category_token must match pattern /^CAT_[1-9]\\d*$/ or be null.',
        providerId: 'gemini',
      });
    }
  }

  // 10. note: non-empty trimmed string with maximum 200 characters, or null
  if (obj.note !== null) {
    if (typeof obj.note !== 'string') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'note must be a string or null.',
        providerId: 'gemini',
      });
    }
    const trimmedNote = obj.note.trim();
    if (trimmedNote.length === 0 || trimmedNote.length > 200) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'note must be a non-empty trimmed string of at most 200 characters, or null.',
        providerId: 'gemini',
      });
    }
  }

  // 11. image_quality
  if (
    typeof obj.image_quality !== 'string' ||
    !ALLOWED_IMAGE_QUALITIES.includes(obj.image_quality as (typeof ALLOWED_IMAGE_QUALITIES)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'image_quality must be one of OK, LOW.',
      providerId: 'gemini',
    });
  }

  return obj as unknown as ReceiptVisionParseOutput;
}

export const receiptVisionOutputValidator: AiOutputValidator<ReceiptVisionParseOutput> = {
  name: 'ReceiptVisionOutputValidator',
  jsonSchema: {
    type: 'object',
    properties: {
      document_kind: {
        type: 'string',
        enum: ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'OTHER'],
      },
      merchant: { type: ['string', 'null'] },
      occurred_on: { type: ['string', 'null'] },
      occurred_on_state: {
        type: 'string',
        enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'INVALID'],
      },
      amount: { type: ['string', 'null'] },
      amount_state: {
        type: 'string',
        enum: ['PRESENT', 'MISSING', 'AMBIGUOUS'],
      },
      currency_code: {
        type: ['string', 'null'],
        enum: ['VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW', null],
      },
      currency_state: {
        type: 'string',
        enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED'],
      },
      category_token: { type: ['string', 'null'] },
      note: { type: ['string', 'null'] },
      image_quality: {
        type: 'string',
        enum: ['OK', 'LOW'],
      },
    },
    required: [
      'document_kind',
      'merchant',
      'occurred_on',
      'occurred_on_state',
      'amount',
      'amount_state',
      'currency_code',
      'currency_state',
      'category_token',
      'note',
      'image_quality',
    ],
    additionalProperties: false,
  },
  validate(value: unknown): ReceiptVisionParseOutput {
    return validateReceiptVisionOutput(value);
  },
};
