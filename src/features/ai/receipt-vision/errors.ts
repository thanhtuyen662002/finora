/**
 * Finora Phase 12B Receipt Vision - Local Error Taxonomy
 * Strict feature-local error types without expanding Phase 10 AiErrorCode contract.
 */

import type { AiErrorCode } from '@/lib/ai/errors';

export type ReceiptVisionErrorCode =
  | 'AUTH_REQUIRED'
  | 'RECEIPT_FILE_REQUIRED'
  | 'RECEIPT_FILE_TOO_LARGE'
  | 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  | 'RECEIPT_FILE_INVALID'
  | 'RECEIPT_IMAGE_TOO_LARGE'
  | 'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED'
  | 'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE'
  | 'RECEIPT_IMAGE_DECODE_FAILED';

export const RECEIPT_VISION_ERROR_CODES = [
  'AUTH_REQUIRED',
  'RECEIPT_FILE_REQUIRED',
  'RECEIPT_FILE_TOO_LARGE',
  'RECEIPT_FILE_TYPE_UNSUPPORTED',
  'RECEIPT_FILE_INVALID',
  'RECEIPT_IMAGE_TOO_LARGE',
  'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED',
  'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE',
  'RECEIPT_IMAGE_DECODE_FAILED',
] as const satisfies readonly ReceiptVisionErrorCode[];

export const RECEIPT_VISION_PUBLIC_MESSAGES: Readonly<
  Record<ReceiptVisionErrorCode, string>
> = Object.freeze({
  AUTH_REQUIRED: 'Authentication is required.',
  RECEIPT_FILE_REQUIRED: 'Receipt file is required.',
  RECEIPT_FILE_TOO_LARGE: 'Receipt file exceeds the maximum allowed size.',
  RECEIPT_FILE_TYPE_UNSUPPORTED: 'Only JPEG, PNG, and WebP receipt images are supported.',
  RECEIPT_FILE_INVALID: 'Invalid receipt file payload.',
  RECEIPT_IMAGE_TOO_LARGE: 'Receipt image dimensions exceed the allowed limit.',
  RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED: 'Animated or multi-frame receipt images are not supported.',
  RECEIPT_IMAGE_NORMALIZED_TOO_LARGE: 'Normalized receipt image exceeds the allowed size.',
  RECEIPT_IMAGE_DECODE_FAILED: 'Receipt image could not be processed.',
});

export const RECEIPT_VISION_AI_PUBLIC_MESSAGES: Readonly<Record<AiErrorCode, string>> =
  Object.freeze({
    AI_NOT_CONFIGURED: 'AI receipt analysis is not configured.',
    AI_PROVIDER_UNAVAILABLE: 'AI receipt analysis is temporarily unavailable.',
    AI_AUTH_FAILED: 'AI receipt analysis authentication failed.',
    AI_RATE_LIMITED: 'AI receipt analysis is temporarily rate limited.',
    AI_TIMEOUT: 'AI receipt analysis timed out.',
    AI_ABORTED: 'AI receipt analysis was interrupted.',
    AI_INVALID_REQUEST: 'The receipt analysis request was invalid.',
    AI_INVALID_RESPONSE: 'AI receipt analysis returned an invalid response.',
    AI_STRUCTURED_OUTPUT_INVALID: 'AI receipt analysis returned an unsupported result.',
    AI_PROVIDER_ERROR: 'AI receipt analysis failed.',
    AI_CREDENTIAL_CORRUPTED: 'The configured AI credential failed an integrity check.',
    AI_CREDENTIAL_KEY_UNAVAILABLE: 'AI credential encryption is not configured.',
    AI_CREDENTIAL_RESOLUTION_FAILED: 'AI credentials could not be resolved.',
  });

export class ReceiptVisionError extends Error {
  readonly code: ReceiptVisionErrorCode;

  constructor(code: ReceiptVisionErrorCode) {
    super(RECEIPT_VISION_PUBLIC_MESSAGES[code]);
    this.name = 'ReceiptVisionError';
    this.code = code;
    // Security Invariant: Never attach decoder errors, image buffers, base64, filenames,
    // provider payloads, or raw causes to client-visible errors.
    Object.setPrototypeOf(this, ReceiptVisionError.prototype);
  }
}
