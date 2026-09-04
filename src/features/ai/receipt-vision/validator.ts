import 'server-only';

/**
 * Finora AI Receipt Vision — Provider Output Schema & Validation
 * Phase 12B — Exact 11-Key Output Schema & State Provenance Validator
 */

import type { AiOutputValidator } from '@/lib/ai/types';
import { isValidReceiptLexicalAmount } from './money';
import type {
  ReceiptAmountState,
  ReceiptCurrencyCode,
  ReceiptCurrencyState,
  ReceiptDocumentKind,
  ReceiptImageQuality,
  ReceiptOccurredOnState,
  ReceiptVisionParseOutput,
} from './types';

export const SUPPORTED_RECEIPT_CURRENCIES: readonly ReceiptCurrencyCode[] = [
  'VND',
  'USD',
  'EUR',
  'JPY',
  'CNY',
  'KRW',
] as const;

export const EXPECTED_RECEIPT_VISION_OUTPUT_KEYS = [
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

/**
 * Validates strict calendar date: YYYY-MM-DD, leap years, days per month.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day >= 1 && day <= daysInMonth[month - 1];
}

/**
 * Validates structured output from the receipt vision provider.
 * Enforces exact 11 keys, type safety, state consistency, and Pass 12B-1 category invariant.
 *
 * @throws Error if validation fails.
 */
export function validateReceiptVisionOutput(value: unknown): ReceiptVisionParseOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Receipt vision output must be a non-null object.');
  }

  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record);

  // Exact 11 keys check
  if (actualKeys.length !== EXPECTED_RECEIPT_VISION_OUTPUT_KEYS.length) {
    throw new Error(
      `Receipt vision output must contain exactly ${EXPECTED_RECEIPT_VISION_OUTPUT_KEYS.length} keys, but found ${actualKeys.length}.`
    );
  }

  for (const key of EXPECTED_RECEIPT_VISION_OUTPUT_KEYS) {
    if (!(key in record)) {
      throw new Error(`Receipt vision output is missing required key '${key}'.`);
    }
  }

  // 1. document_kind
  const allowedKinds: readonly ReceiptDocumentKind[] = [
    'PURCHASE_RECEIPT',
    'INVOICE',
    'CREDIT_NOTE',
    'OTHER',
  ];
  const document_kind = record.document_kind as ReceiptDocumentKind;
  if (!allowedKinds.includes(document_kind)) {
    throw new Error(`Invalid document_kind '${String(record.document_kind)}'.`);
  }

  // 2. merchant
  let merchant: string | null = null;
  if (record.merchant !== null) {
    if (typeof record.merchant !== 'string') {
      throw new Error('Merchant must be a string or null.');
    }
    const trimmed = record.merchant.trim();
    if (trimmed.length > 100) {
      throw new Error('Merchant must not exceed 100 characters.');
    }
    merchant = trimmed === '' ? null : trimmed;
  }

  // 3. note
  let note: string | null = null;
  if (record.note !== null) {
    if (typeof record.note !== 'string') {
      throw new Error('Note must be a string or null.');
    }
    const trimmed = record.note.trim();
    if (trimmed.length > 200) {
      throw new Error('Note must not exceed 200 characters.');
    }
    note = trimmed === '' ? null : trimmed;
  }

  // 4. image_quality
  const allowedQuality: readonly ReceiptImageQuality[] = ['OK', 'LOW'];
  const image_quality = record.image_quality as ReceiptImageQuality;
  if (!allowedQuality.includes(image_quality)) {
    throw new Error(`Invalid image_quality '${String(record.image_quality)}'.`);
  }

  // 5. amount & amount_state consistency
  const allowedAmountStates: readonly ReceiptAmountState[] = ['PRESENT', 'MISSING', 'AMBIGUOUS'];
  const amount_state = record.amount_state as ReceiptAmountState;
  if (!allowedAmountStates.includes(amount_state)) {
    throw new Error(`Invalid amount_state '${String(record.amount_state)}'.`);
  }

  let amount: string | null = null;
  if (amount_state === 'PRESENT') {
    if (record.amount === null || typeof record.amount !== 'string' || !isValidReceiptLexicalAmount(record.amount)) {
      throw new Error(
        `amount_state is 'PRESENT' but amount is invalid or null: '${String(record.amount)}'.`
      );
    }
    amount = record.amount;
  } else {
    // MISSING or AMBIGUOUS -> amount must be null
    if (record.amount !== null) {
      throw new Error(
        `amount_state is '${amount_state}' but amount is not null: '${String(record.amount)}'.`
      );
    }
  }

  // 6. occurred_on & occurred_on_state consistency
  const allowedOccurredOnStates: readonly ReceiptOccurredOnState[] = [
    'PRESENT',
    'MISSING',
    'AMBIGUOUS',
    'INVALID',
  ];
  const occurred_on_state = record.occurred_on_state as ReceiptOccurredOnState;
  if (!allowedOccurredOnStates.includes(occurred_on_state)) {
    throw new Error(`Invalid occurred_on_state '${String(record.occurred_on_state)}'.`);
  }

  let occurred_on: string | null = null;
  if (occurred_on_state === 'PRESENT') {
    if (record.occurred_on === null || typeof record.occurred_on !== 'string' || !isValidCalendarDate(record.occurred_on)) {
      throw new Error(
        `occurred_on_state is 'PRESENT' but occurred_on is not a valid YYYY-MM-DD calendar date: '${String(record.occurred_on)}'.`
      );
    }
    occurred_on = record.occurred_on;
  } else {
    // MISSING, AMBIGUOUS, or INVALID -> occurred_on must be null
    if (record.occurred_on !== null) {
      throw new Error(
        `occurred_on_state is '${occurred_on_state}' but occurred_on is not null: '${String(record.occurred_on)}'.`
      );
    }
  }

  // 7. currency_code & currency_state consistency
  const allowedCurrencyStates: readonly ReceiptCurrencyState[] = [
    'PRESENT',
    'MISSING',
    'AMBIGUOUS',
    'UNSUPPORTED',
  ];
  const currency_state = record.currency_state as ReceiptCurrencyState;
  if (!allowedCurrencyStates.includes(currency_state)) {
    throw new Error(`Invalid currency_state '${String(record.currency_state)}'.`);
  }

  let currency_code: ReceiptCurrencyCode | null = null;
  if (currency_state === 'PRESENT') {
    if (
      record.currency_code === null ||
      typeof record.currency_code !== 'string' ||
      !SUPPORTED_RECEIPT_CURRENCIES.includes(record.currency_code as ReceiptCurrencyCode)
    ) {
      throw new Error(
        `currency_state is 'PRESENT' but currency_code is not supported or null: '${String(record.currency_code)}'.`
      );
    }
    currency_code = record.currency_code as ReceiptCurrencyCode;
  } else {
    // MISSING, AMBIGUOUS, or UNSUPPORTED -> currency_code must be null
    if (record.currency_code !== null) {
      throw new Error(
        `currency_state is '${currency_state}' but currency_code is not null: '${String(record.currency_code)}'.`
      );
    }
  }

  // 8. category_token: string | null matching /^CAT_[1-9][0-9]*$/
  let category_token: string | null = null;
  if (record.category_token !== null) {
    if (
      typeof record.category_token !== 'string' ||
      !/^CAT_[1-9][0-9]*$/.test(record.category_token)
    ) {
      throw new Error(
        `category_token must be null or match format 'CAT_n' (e.g. 'CAT_1'), but got '${String(record.category_token)}'.`
      );
    }
    category_token = record.category_token;
  }

  return {
    document_kind,
    merchant,
    occurred_on,
    occurred_on_state,
    amount,
    amount_state,
    currency_code,
    currency_state,
    category_token,
    note,
    image_quality,
  };
}

export const RECEIPT_VISION_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: [...EXPECTED_RECEIPT_VISION_OUTPUT_KEYS],
  properties: {
    document_kind: {
      type: 'string',
      enum: ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'OTHER'],
    },
    merchant: {
      type: ['string', 'null'],
    },
    occurred_on: {
      type: ['string', 'null'],
    },
    occurred_on_state: {
      type: 'string',
      enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'INVALID'],
    },
    amount: {
      type: ['string', 'null'],
    },
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
    category_token: {
      type: ['string', 'null'],
    },
    note: {
      type: ['string', 'null'],
    },
    image_quality: {
      type: 'string',
      enum: ['OK', 'LOW'],
    },
  },
};

export const ReceiptVisionOutputValidator: AiOutputValidator<ReceiptVisionParseOutput> = {
  name: 'ReceiptVisionOutputValidator',
  jsonSchema: RECEIPT_VISION_JSON_SCHEMA,
  validate: validateReceiptVisionOutput,
};
