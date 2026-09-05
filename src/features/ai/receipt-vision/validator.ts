import type { AiOutputValidator } from '@/lib/ai/types';
import type { ReceiptVisionParseOutput, ReceiptDocumentKind } from './types';
import { AiError } from '@/lib/ai/errors';

export const receiptVisionOutputValidator: AiOutputValidator<ReceiptVisionParseOutput> = {
  name: 'ReceiptVisionParseOutput',
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
    if (!value || typeof value !== 'object') {
      throw new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'Expected an object.',
      });
    }

    const obj = value as Record<string, unknown>;

    // Type checks
    if (!['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'OTHER'].includes(obj.document_kind as string)) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Invalid document_kind.' });
    }
    if (obj.merchant !== null && typeof obj.merchant !== 'string') {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'merchant must be string or null.' });
    }
    if (obj.occurred_on !== null && typeof obj.occurred_on !== 'string') {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'occurred_on must be string or null.' });
    }
    if (!['PRESENT', 'MISSING', 'AMBIGUOUS', 'INVALID'].includes(obj.occurred_on_state as string)) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Invalid occurred_on_state.' });
    }
    if (obj.amount !== null && typeof obj.amount !== 'string') {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'amount must be string or null. No floats allowed.' });
    }
    if (!['PRESENT', 'MISSING', 'AMBIGUOUS'].includes(obj.amount_state as string)) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Invalid amount_state.' });
    }
    if (obj.currency_code !== null && !['VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW'].includes(obj.currency_code as string)) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Invalid currency_code.' });
    }
    if (!['PRESENT', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED'].includes(obj.currency_state as string)) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Invalid currency_state.' });
    }
    if (obj.category_token !== null && typeof obj.category_token !== 'string') {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'category_token must be string or null.' });
    }
    if (obj.note !== null && typeof obj.note !== 'string') {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'note must be string or null.' });
    }
    if (!['OK', 'LOW'].includes(obj.image_quality as string)) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Invalid image_quality.' });
    }

    // Money format
    if (obj.amount !== null) {
      if (!/^\d{1,16}(\.\d{1,4})?$/.test(obj.amount as string)) {
        throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Amount violates money format.' });
      }
      if (Number(obj.amount) <= 0) {
        throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'Amount must be positive.' });
      }
    }

    // Consistency Checks
    if (obj.amount_state === 'PRESENT' && obj.amount === null) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'amount_state is PRESENT but amount is null.' });
    }
    if (obj.amount_state !== 'PRESENT' && obj.amount !== null) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'amount_state is not PRESENT but amount is not null.' });
    }

    if (obj.occurred_on_state === 'PRESENT' && obj.occurred_on === null) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'occurred_on_state is PRESENT but occurred_on is null.' });
    }
    if (obj.occurred_on_state !== 'PRESENT' && obj.occurred_on !== null) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'occurred_on_state is not PRESENT but occurred_on is not null.' });
    }

    if (obj.currency_state === 'PRESENT' && obj.currency_code === null) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'currency_state is PRESENT but currency_code is null.' });
    }
    if (obj.currency_state !== 'PRESENT' && obj.currency_code !== null) {
      throw new AiError({ code: 'AI_STRUCTURED_OUTPUT_INVALID', message: 'currency_state is not PRESENT but currency_code is not null.' });
    }

    return obj as unknown as ReceiptVisionParseOutput;
  }
};
