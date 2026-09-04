import 'server-only';

/**
 * Finora AI Feature Module — Output Validator
 * Phase 12A — Exact Runtime Boundary & Zero Coercion
 *
 * Implements Phase 10 AiOutputValidator for transaction_parser.
 * Invariants:
 * 1. Exact Keyset (PHASE_12A_OUTPUT_VALIDATOR_EXACT_KEYSET=true):
 *    All 11 schema keys must be present. Extra keys or missing keys fail closed immediately.
 * 2. Zero Coercion (PHASE_12A_OUTPUT_VALIDATOR_COERCION=false):
 *    No automatic stringification of numbers (e.g. amount: 85000 is rejected, not coerced).
 * 3. Opaque Tokens Only:
 *    Zero database UUIDs accepted. Candidate tokens must match ^(ACC|CAT|SRC|STR)_[0-9]+$.
 */

import { AiError } from '@/lib/ai/errors';
import type { AiOutputValidator } from '@/lib/ai/types';
import type { AiTransactionParseOutput } from './types';

export const REQUIRED_PARSE_OUTPUT_KEYS = [
  'type',
  'amount',
  'currency_code',
  'account_token',
  'category_token',
  'income_source_token',
  'income_source_stream_token',
  'merchant',
  'note',
  'occurred_on',
  'unmatched_text',
] as const;

export const TOKEN_PATTERNS = {
  account: /^ACC_[0-9]+$/,
  category: /^CAT_[0-9]+$/,
  income_source: /^SRC_[0-9]+$/,
  income_source_stream: /^STR_[0-9]+$/,
} as const;

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;

export class AiTransactionParseOutputValidator
  implements AiOutputValidator<AiTransactionParseOutput>
{
  readonly name = 'transaction_parser_output_validator';

  readonly jsonSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      type: {
        type: ['string', 'null'],
        enum: ['INCOME', 'EXPENSE', null],
        description: 'Transaction type or null if ambiguous',
      },
      amount: {
        type: ['string', 'null'],
        description: 'Exact monetary decimal string e.g. "85000", "4.50". NEVER a number.',
      },
      currency_code: {
        type: ['string', 'null'],
        description: '3-letter uppercase ISO currency code e.g. "VND", "USD", or null',
      },
      account_token: {
        type: ['string', 'null'],
        description: 'Matched account candidate token e.g. "ACC_1", or null',
      },
      category_token: {
        type: ['string', 'null'],
        description: 'Matched category candidate token e.g. "CAT_1", or null',
      },
      income_source_token: {
        type: ['string', 'null'],
        description: 'Matched income source token e.g. "SRC_1", or null',
      },
      income_source_stream_token: {
        type: ['string', 'null'],
        description: 'Matched income stream token e.g. "STR_1", or null',
      },
      merchant: {
        type: ['string', 'null'],
        description: 'Cleaned merchant or counterparty name, max 100 chars, or null',
      },
      note: {
        type: ['string', 'null'],
        description: 'Extracted description or note, max 255 chars, or null',
      },
      occurred_on: {
        type: ['string', 'null'],
        description: 'ISO date YYYY-MM-DD relative to server today, or null',
      },
      unmatched_text: {
        type: ['string', 'null'],
        description: 'Any leftover unparsed details, max 255 chars, or null',
      },
    },
    required: [...REQUIRED_PARSE_OUTPUT_KEYS],
    additionalProperties: false,
  };

  validate(value: unknown): AiTransactionParseOutput {
    // 1. Must be a non-null, non-array object
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'Transaction parser output must be a non-null, non-array object.',
      });
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);

    // 2. Exact Keyset check (PHASE_12A_OUTPUT_VALIDATOR_EXACT_KEYSET=true)
    if (keys.length !== REQUIRED_PARSE_OUTPUT_KEYS.length) {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `Output keyset mismatch. Expected exactly 11 keys, received ${keys.length}.`,
      });
    }

    for (const reqKey of REQUIRED_PARSE_OUTPUT_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, reqKey)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Missing required property '${reqKey}' in model output.`,
        });
      }
    }

    // 3. Field validations (PHASE_12A_OUTPUT_VALIDATOR_COERCION=false)

    // type: 'INCOME' | 'EXPENSE' | null
    const rawType = record.type;
    if (rawType !== null && rawType !== 'INCOME' && rawType !== 'EXPENSE') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `Invalid type '${String(rawType)}'. Expected 'INCOME', 'EXPENSE', or null.`,
      });
    }

    // amount: string | null (STRICTLY REJECT NUMBERS)
    const rawAmount = record.amount;
    if (typeof rawAmount === 'number') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'Amount must be a string decimal or null. JavaScript numbers are strictly rejected.',
      });
    }
    if (rawAmount !== null) {
      if (typeof rawAmount !== 'string') {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Amount must be a string decimal or null.',
        });
      }
      const trimmedAmount = rawAmount.trim();
      if (trimmedAmount.length === 0 || trimmedAmount.length > 50) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Amount string length is invalid.',
        });
      }
    }

    // currency_code: string | null (3 uppercase letters)
    const rawCurrency = record.currency_code;
    if (rawCurrency !== null) {
      if (typeof rawCurrency !== 'string' || !ISO_CURRENCY_REGEX.test(rawCurrency)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Invalid currency_code '${String(rawCurrency)}'. Expected 3 uppercase letters or null.`,
        });
      }
    }

    // account_token: string | null
    const rawAccountToken = record.account_token;
    if (rawAccountToken !== null) {
      if (typeof rawAccountToken !== 'string' || !TOKEN_PATTERNS.account.test(rawAccountToken)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Invalid account_token '${String(rawAccountToken)}'. Expected format ACC_<number> or null.`,
        });
      }
    }

    // category_token: string | null
    const rawCategoryToken = record.category_token;
    if (rawCategoryToken !== null) {
      if (typeof rawCategoryToken !== 'string' || !TOKEN_PATTERNS.category.test(rawCategoryToken)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Invalid category_token '${String(rawCategoryToken)}'. Expected format CAT_<number> or null.`,
        });
      }
    }

    // income_source_token: string | null
    const rawSourceToken = record.income_source_token;
    if (rawSourceToken !== null) {
      if (typeof rawSourceToken !== 'string' || !TOKEN_PATTERNS.income_source.test(rawSourceToken)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Invalid income_source_token '${String(rawSourceToken)}'. Expected format SRC_<number> or null.`,
        });
      }
    }

    // income_source_stream_token: string | null
    const rawStreamToken = record.income_source_stream_token;
    if (rawStreamToken !== null) {
      if (typeof rawStreamToken !== 'string' || !TOKEN_PATTERNS.income_source_stream.test(rawStreamToken)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Invalid income_source_stream_token '${String(rawStreamToken)}'. Expected format STR_<number> or null.`,
        });
      }
    }

    // merchant: string | null (max 100 chars)
    const rawMerchant = record.merchant;
    if (rawMerchant !== null) {
      if (typeof rawMerchant !== 'string') {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Merchant must be a string or null.',
        });
      }
      if (rawMerchant.length > 100) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Merchant exceeds maximum allowed length of 100 characters.',
        });
      }
    }

    // note: string | null (max 255 chars)
    const rawNote = record.note;
    if (rawNote !== null) {
      if (typeof rawNote !== 'string') {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Note must be a string or null.',
        });
      }
      if (rawNote.length > 255) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Note exceeds maximum allowed length of 255 characters.',
        });
      }
    }

    // occurred_on: string | null (ISO YYYY-MM-DD)
    const rawOccurredOn = record.occurred_on;
    if (rawOccurredOn !== null) {
      if (typeof rawOccurredOn !== 'string' || !ISO_DATE_REGEX.test(rawOccurredOn)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Invalid occurred_on '${String(rawOccurredOn)}'. Expected format YYYY-MM-DD or null.`,
        });
      }
      const parsedTime = Date.parse(rawOccurredOn);
      if (Number.isNaN(parsedTime)) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: `Date '${rawOccurredOn}' is not a valid calendar date.`,
        });
      }
    }

    // unmatched_text: string | null (max 255 chars)
    const rawUnmatched = record.unmatched_text;
    if (rawUnmatched !== null) {
      if (typeof rawUnmatched !== 'string') {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'unmatched_text must be a string or null.',
        });
      }
      if (rawUnmatched.length > 255) {
        throw new AiError({
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'unmatched_text exceeds maximum allowed length of 255 characters.',
        });
      }
    }

    return {
      type: rawType,
      amount: rawAmount !== null ? (rawAmount as string).trim() : null,
      currency_code: rawCurrency,
      account_token: rawAccountToken,
      category_token: rawCategoryToken,
      income_source_token: rawSourceToken,
      income_source_stream_token: rawStreamToken,
      merchant: rawMerchant,
      note: rawNote,
      occurred_on: rawOccurredOn,
      unmatched_text: rawUnmatched,
    };
  }
}

export const aiTransactionParseOutputValidator = new AiTransactionParseOutputValidator();
