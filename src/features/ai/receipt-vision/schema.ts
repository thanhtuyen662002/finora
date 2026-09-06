import { z } from 'zod';
import type { AiOutputValidator } from '@/lib/ai/types';
import type { ReceiptVisionParseOutput } from './types';
import { AiError } from '@/lib/ai/errors';

export const receiptVisionSchema = z.object({
  document_kind: z.enum(['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'UNKNOWN']),
  merchant: z.string().nullable(),
  occurred_on: z.string().nullable(),
  occurred_on_state: z.enum(['PRESENT', 'MISSING', 'AMBIGUOUS', 'INVALID']),
  amount: z.string().nullable(),
  amount_state: z.enum(['PRESENT', 'MISSING', 'AMBIGUOUS']),
  currency_code: z.string().nullable(),
  currency_state: z.enum(['PRESENT', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED']),
  category_token: z.string().nullable(),
  note: z.string().nullable(),
  image_quality: z.enum(['OK', 'LOW']),
}).strict(); // Enforce exactly 11 keys

export const receiptVisionOutputValidator: AiOutputValidator<ReceiptVisionParseOutput> = {
  name: 'ReceiptVisionOutputValidator',
  jsonSchema: {
    type: 'object',
    properties: {
      document_kind: { type: 'string', enum: ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'UNKNOWN'] },
      merchant: { type: 'string', nullable: true },
      occurred_on: { type: 'string', nullable: true },
      occurred_on_state: { type: 'string', enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'INVALID'] },
      amount: { type: 'string', nullable: true },
      amount_state: { type: 'string', enum: ['PRESENT', 'MISSING', 'AMBIGUOUS'] },
      currency_code: { type: 'string', nullable: true },
      currency_state: { type: 'string', enum: ['PRESENT', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED'] },
      category_token: { type: 'string', nullable: true },
      note: { type: 'string', nullable: true },
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
    try {
      return receiptVisionSchema.parse(value) as ReceiptVisionParseOutput;
    } catch (err) {
      throw new AiError({
        code: 'AI_PROVIDER_ERROR',
        message: 'Invalid output schema from provider.',
        providerId: 'gemini',
        cause: err,
      });
    }
  },
};
