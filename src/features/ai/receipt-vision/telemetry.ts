import type { ReceiptDocumentKind } from './types';

/**
 * Finora Phase 12B Receipt Vision - Privacy-Safe Telemetry
 * Runtime-validated, request-scoped, and restricted to Contract Section 17.3.
 */

export const TELEMETRY_ALLOWED_KEYS = new Set([
  'operation',
  'success',
  'input_format',
  'input_bytes_bucket',
  'image_width_bucket',
  'image_height_bucket',
  'preprocess_ms',
  'context_ms',
  'ai_provider_ms',
  'revalidation_ms',
  'total_ms',
  'warning_count',
  'document_kind',
] as const);

const INPUT_FORMATS = ['jpeg', 'png', 'webp'] as const;
const INPUT_BYTES_BUCKETS = [
  '<=256KB',
  '<=512KB',
  '<=1MB',
  '<=2MB',
  '<=4MB',
  '>4MB',
] as const;
const IMAGE_DIMENSION_BUCKETS = [
  '<=512',
  '<=1024',
  '<=2048',
  '<=4096',
  '<=8192',
  '>8192',
] as const;
const DOCUMENT_KINDS = [
  'PURCHASE_RECEIPT',
  'INVOICE',
  'CREDIT_NOTE',
  'OTHER',
] as const satisfies readonly ReceiptDocumentKind[];

export type ReceiptInputFormat = (typeof INPUT_FORMATS)[number];
export type ReceiptInputBytesBucket = (typeof INPUT_BYTES_BUCKETS)[number];
export type ReceiptImageDimensionBucket = (typeof IMAGE_DIMENSION_BUCKETS)[number];

export interface ReceiptVisionTelemetryEvent {
  readonly operation: 'receipt_vision';
  readonly success: boolean;
  readonly input_format?: ReceiptInputFormat;
  readonly input_bytes_bucket?: ReceiptInputBytesBucket;
  readonly image_width_bucket?: ReceiptImageDimensionBucket;
  readonly image_height_bucket?: ReceiptImageDimensionBucket;
  readonly preprocess_ms: number;
  readonly context_ms: number;
  readonly ai_provider_ms: number;
  readonly revalidation_ms: number;
  readonly total_ms: number;
  readonly warning_count?: number;
  readonly document_kind?: ReceiptDocumentKind;
}

export type ReceiptVisionTelemetrySink = (
  event: ReceiptVisionTelemetryEvent
) => void | Promise<void>;

function isEnumValue<const T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function getInputBytesBucket(bytes: number): ReceiptInputBytesBucket {
  if (bytes <= 256 * 1024) return '<=256KB';
  if (bytes <= 512 * 1024) return '<=512KB';
  if (bytes <= 1024 * 1024) return '<=1MB';
  if (bytes <= 2 * 1024 * 1024) return '<=2MB';
  if (bytes <= 4 * 1024 * 1024) return '<=4MB';
  return '>4MB';
}

export function getImageDimensionBucket(dim: number): ReceiptImageDimensionBucket {
  if (dim <= 512) return '<=512';
  if (dim <= 1024) return '<=1024';
  if (dim <= 2048) return '<=2048';
  if (dim <= 4096) return '<=4096';
  if (dim <= 8192) return '<=8192';
  return '>8192';
}

export function sanitizeTelemetryEvent(
  rawEvent: Readonly<Record<string, unknown>>
): ReceiptVisionTelemetryEvent | null {
  if (rawEvent.operation !== 'receipt_vision' || typeof rawEvent.success !== 'boolean') {
    return null;
  }

  const preprocessMs = rawEvent.preprocess_ms;
  const contextMs = rawEvent.context_ms;
  const aiProviderMs = rawEvent.ai_provider_ms;
  const revalidationMs = rawEvent.revalidation_ms;
  const totalMs = rawEvent.total_ms;
  if (
    !isFiniteNonNegativeInteger(preprocessMs) ||
    !isFiniteNonNegativeInteger(contextMs) ||
    !isFiniteNonNegativeInteger(aiProviderMs) ||
    !isFiniteNonNegativeInteger(revalidationMs) ||
    !isFiniteNonNegativeInteger(totalMs)
  ) {
    return null;
  }

  const hasFormat = rawEvent.input_format !== undefined;
  const hasWidth = rawEvent.image_width_bucket !== undefined;
  const hasHeight = rawEvent.image_height_bucket !== undefined;
  if (hasFormat !== hasWidth || hasFormat !== hasHeight) {
    return null;
  }
  if (
    hasFormat &&
    (!isEnumValue(INPUT_FORMATS, rawEvent.input_format) ||
      !isEnumValue(IMAGE_DIMENSION_BUCKETS, rawEvent.image_width_bucket) ||
      !isEnumValue(IMAGE_DIMENSION_BUCKETS, rawEvent.image_height_bucket))
  ) {
    return null;
  }

  if (
    rawEvent.input_bytes_bucket !== undefined &&
    !isEnumValue(INPUT_BYTES_BUCKETS, rawEvent.input_bytes_bucket)
  ) {
    return null;
  }

  if (rawEvent.success) {
    if (
      !isFiniteNonNegativeInteger(rawEvent.warning_count) ||
      !isEnumValue(DOCUMENT_KINDS, rawEvent.document_kind)
    ) {
      return null;
    }
  } else if (rawEvent.warning_count !== undefined || rawEvent.document_kind !== undefined) {
    return null;
  }

  const sanitized: ReceiptVisionTelemetryEvent = {
    operation: 'receipt_vision',
    success: rawEvent.success,
    preprocess_ms: preprocessMs,
    context_ms: contextMs,
    ai_provider_ms: aiProviderMs,
    revalidation_ms: revalidationMs,
    total_ms: totalMs,
    ...(isEnumValue(INPUT_BYTES_BUCKETS, rawEvent.input_bytes_bucket)
      ? { input_bytes_bucket: rawEvent.input_bytes_bucket }
      : {}),
    ...(isEnumValue(INPUT_FORMATS, rawEvent.input_format) &&
    isEnumValue(IMAGE_DIMENSION_BUCKETS, rawEvent.image_width_bucket) &&
    isEnumValue(IMAGE_DIMENSION_BUCKETS, rawEvent.image_height_bucket)
      ? {
          input_format: rawEvent.input_format,
          image_width_bucket: rawEvent.image_width_bucket,
          image_height_bucket: rawEvent.image_height_bucket,
        }
      : {}),
    ...(rawEvent.success &&
    isFiniteNonNegativeInteger(rawEvent.warning_count) &&
    isEnumValue(DOCUMENT_KINDS, rawEvent.document_kind)
      ? {
          warning_count: rawEvent.warning_count,
          document_kind: rawEvent.document_kind,
        }
      : {}),
  };

  return Object.freeze(sanitized);
}

export async function emitReceiptVisionTelemetry(
  event: ReceiptVisionTelemetryEvent | Readonly<Record<string, unknown>>,
  sink?: ReceiptVisionTelemetrySink
): Promise<void> {
  const cleanEvent = sanitizeTelemetryEvent({ ...event });
  if (!cleanEvent) return;

  try {
    if (sink) {
      await sink(cleanEvent);
      return;
    }

    if (
      typeof process !== 'undefined' &&
      process.env &&
      (process.env.FINORA_RECEIPT_VISION_TIMING === 'true' ||
        process.env.FINORA_RECEIPT_VISION_TIMING === '1')
    ) {
      console.info('[FINORA_RECEIPT_VISION_TIMING]', JSON.stringify(cleanEvent));
    }
  } catch {
    // Telemetry is optional and must never alter the receipt-analysis result.
  }
}
