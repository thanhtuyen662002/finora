import type { AiOutputValidator } from '@/lib/ai/types';
import type { ReceiptVisionParseOutput } from './types';
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

export const ALLOWED_DOCUMENT_KINDS = [
  'PURCHASE_RECEIPT',
  'INVOICE',
  'CREDIT_NOTE',
  'UNKNOWN',
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

export const ALLOWED_IMAGE_QUALITIES = [
  'OK',
  'LOW',
] as const;

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
      message: `Receipt vision output must contain exactly 11 keys, received ${keys.length}.`,
      providerId: 'gemini',
    });
  }

  for (const k of EXPECTED_RECEIPT_VISION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `Missing required key '${k}' in receipt vision output.`,
        providerId: 'gemini',
      });
    }
  }

  // 1. document_kind
  if (
    typeof obj.document_kind !== 'string' ||
    !ALLOWED_DOCUMENT_KINDS.includes(obj.document_kind as (typeof ALLOWED_DOCUMENT_KINDS)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: `Invalid document_kind: ${String(obj.document_kind)}`,
      providerId: 'gemini',
    });
  }

  // 2. merchant
  if (obj.merchant !== null && typeof obj.merchant !== 'string') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'merchant must be a string or null',
      providerId: 'gemini',
    });
  }

  // 3. occurred_on_state
  if (
    typeof obj.occurred_on_state !== 'string' ||
    !ALLOWED_OCCURRED_ON_STATES.includes(obj.occurred_on_state as (typeof ALLOWED_OCCURRED_ON_STATES)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: `Invalid occurred_on_state: ${String(obj.occurred_on_state)}`,
      providerId: 'gemini',
    });
  }

  // 4. occurred_on
  if (obj.occurred_on !== null && typeof obj.occurred_on !== 'string') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'occurred_on must be a string or null',
      providerId: 'gemini',
    });
  }

  // Date state consistency
  if (obj.occurred_on_state === 'PRESENT') {
    if (obj.occurred_on === null || typeof obj.occurred_on !== 'string') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'occurred_on_state is PRESENT but occurred_on is null or not a string',
        providerId: 'gemini',
      });
    }
  } else {
    if (obj.occurred_on !== null) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `occurred_on_state is ${obj.occurred_on_state} but occurred_on is not null`,
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
      message: `Invalid amount_state: ${String(obj.amount_state)}`,
      providerId: 'gemini',
    });
  }

  // 6. amount (Zero coercion: numbers are strictly forbidden)
  if (typeof obj.amount === 'number') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'amount must be a string or null, numeric values are strictly prohibited',
      providerId: 'gemini',
    });
  }

  if (obj.amount !== null && typeof obj.amount !== 'string') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'amount must be a string or null',
      providerId: 'gemini',
    });
  }

  // Amount state consistency
  if (obj.amount_state === 'PRESENT') {
    if (obj.amount === null || typeof obj.amount !== 'string') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'amount_state is PRESENT but amount is null or not a string',
        providerId: 'gemini',
      });
    }
    const trimmed = obj.amount.trim();
    if (!/^(0|[1-9]\d{0,15})(\.\d{1,4})?$/.test(trimmed)) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `Invalid lexical amount format: '${obj.amount}'`,
        providerId: 'gemini',
      });
    }
  } else {
    if (obj.amount !== null) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `amount_state is ${obj.amount_state} but amount is not null`,
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
      message: `Invalid currency_state: ${String(obj.currency_state)}`,
      providerId: 'gemini',
    });
  }

  // 8. currency_code
  if (obj.currency_code !== null && typeof obj.currency_code !== 'string') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'currency_code must be a string or null',
      providerId: 'gemini',
    });
  }

  // Currency state consistency
  if (obj.currency_state === 'PRESENT') {
    if (obj.currency_code === null || typeof obj.currency_code !== 'string') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'currency_state is PRESENT but currency_code is null or not a string',
        providerId: 'gemini',
      });
    }
  } else {
    if (obj.currency_code !== null) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `currency_state is ${obj.currency_state} but currency_code is not null`,
        providerId: 'gemini',
      });
    }
  }

  // 9. category_token
  if (obj.category_token !== null && typeof obj.category_token !== 'string') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'category_token must be a string or null',
      providerId: 'gemini',
    });
  }

  // 10. note
  if (obj.note !== null && typeof obj.note !== 'string') {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'note must be a string or null',
      providerId: 'gemini',
    });
  }

  // 11. image_quality
  if (
    typeof obj.image_quality !== 'string' ||
    !ALLOWED_IMAGE_QUALITIES.includes(obj.image_quality as (typeof ALLOWED_IMAGE_QUALITIES)[number])
  ) {
    throw new AiError({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: `Invalid image_quality: ${String(obj.image_quality)}`,
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
      document_kind: { type: 'string', enum: ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'UNKNOWN', 'OTHER'] },
      merchant: { type: ['string', 'null'] },
      occurred_on: { type: ['string', 'null'] },
      occurred_on_state: { type: 'string', enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'INVALID'] },
      amount: { type: ['string', 'null'] },
      amount_state: { type: 'string', enum: ['PRESENT', 'MISSING', 'AMBIGUOUS'] },
      currency_code: { type: ['string', 'null'] },
      currency_state: { type: 'string', enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED'] },
      category_token: { type: ['string', 'null'] },
      note: { type: ['string', 'null'] },
      image_quality: { type: 'string', enum: ['OK', 'LOW'] },
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
