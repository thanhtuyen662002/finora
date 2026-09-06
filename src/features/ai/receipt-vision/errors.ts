/**
 * Finora Phase 12B Receipt Vision - Local Error Taxonomy
 * Strict feature-local error types without expanding Phase 10 AiErrorCode contract.
 */

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

export class ReceiptVisionError extends Error {
  readonly code: ReceiptVisionErrorCode;

  constructor(code: ReceiptVisionErrorCode, message: string) {
    super(message);
    this.name = 'ReceiptVisionError';
    this.code = code;
    // Security Invariant: Never attach decoder errors, image buffers, base64, filenames,
    // provider payloads, or raw causes to client-visible errors.
    Object.setPrototypeOf(this, ReceiptVisionError.prototype);
  }
}
