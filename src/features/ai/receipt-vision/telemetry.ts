/**
 * Finora Phase 12B Receipt Vision - Privacy-Safe Telemetry
 * Strictly allowlisted fields only. Zero PII, zero byte buffers, zero base64, zero IDs.
 */

export const TELEMETRY_ALLOWED_KEYS = new Set<string>([
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
  'error_code',
]);

export interface ReceiptVisionTelemetryEvent {
  readonly operation: 'receipt_vision';
  readonly success: boolean;
  readonly input_format: 'jpeg' | 'png' | 'webp';
  readonly input_bytes_bucket: string;
  readonly image_width_bucket: string;
  readonly image_height_bucket: string;
  readonly preprocess_ms: number;
  readonly context_ms: number;
  readonly ai_provider_ms: number;
  readonly revalidation_ms: number;
  readonly total_ms: number;
  readonly warning_count?: number;
  readonly error_code?: string;
}

export type ReceiptVisionTelemetrySink = (
  event: ReceiptVisionTelemetryEvent
) => void | Promise<void>;

export function getInputBytesBucket(bytes: number): string {
  if (bytes <= 256 * 1024) return '<=256KB';
  if (bytes <= 512 * 1024) return '<=512KB';
  if (bytes <= 1024 * 1024) return '<=1MB';
  if (bytes <= 2 * 1024 * 1024) return '<=2MB';
  if (bytes <= 4 * 1024 * 1024) return '<=4MB';
  return '>4MB';
}

export function getImageDimensionBucket(dim: number): string {
  if (dim <= 512) return '<=512';
  if (dim <= 1024) return '<=1024';
  if (dim <= 2048) return '<=2048';
  if (dim <= 4096) return '<=4096';
  if (dim <= 8192) return '<=8192';
  return '>8192';
}

let activeTelemetrySink: ReceiptVisionTelemetrySink | null = null;

export function setReceiptVisionTelemetrySink(
  sink: ReceiptVisionTelemetrySink | null
): void {
  activeTelemetrySink = sink;
}

export function sanitizeTelemetryEvent(
  rawEvent: Record<string, unknown>
): ReceiptVisionTelemetryEvent {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(rawEvent)) {
    if (TELEMETRY_ALLOWED_KEYS.has(key)) {
      sanitized[key] = rawEvent[key];
    }
  }
  return sanitized as unknown as ReceiptVisionTelemetryEvent;
}

export function emitReceiptVisionTelemetry(
  event: ReceiptVisionTelemetryEvent,
  overrideSink?: ReceiptVisionTelemetrySink
): void {
  const cleanEvent = sanitizeTelemetryEvent(
    event as unknown as Record<string, unknown>
  );

  if (overrideSink) {
    overrideSink(cleanEvent);
    return;
  }

  if (activeTelemetrySink) {
    activeTelemetrySink(cleanEvent);
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
}
