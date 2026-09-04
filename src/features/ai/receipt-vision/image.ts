import 'server-only';

/**
 * Finora AI Receipt Vision — Image Pipeline
 * Phase 12B — Bounded In-Memory Normalization & Security Boundary
 *
 * All image operations occur strictly in memory.
 * Filesystem writes, temp files, and cloud storage uploads are strictly forbidden.
 */

import sharp, { type Sharp, type Metadata } from 'sharp';
import type { AiInlineMediaMimeType } from '@/lib/ai/types';
import type { ReceiptVisionErrorCode } from './types';

export const PHASE_12B_MAX_RECEIPT_FILE_BYTES = 4194304; // 4 MiB
export const PHASE_12B_MAX_DECODED_PIXELS = 20000000; // 20 MP
export const PHASE_12B_MAX_DIMENSION = 8192; // 8192px max width/height
export const PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX = 2048;
export const PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES = 4194304;

export class ReceiptImageError extends Error {
  readonly code: ReceiptVisionErrorCode;

  constructor(code: ReceiptVisionErrorCode, message: string) {
    super(message);
    this.name = 'ReceiptImageError';
    this.code = code;
    Object.setPrototypeOf(this, ReceiptImageError.prototype);
  }
}

/**
 * Detects binary image format using strict magic bytes.
 */
export function detectImageSignature(bytes: Uint8Array): AiInlineMediaMimeType | null {
  if (bytes.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP (bytes 0..3 === 'RIFF', bytes 8..11 === 'WEBP')
  if (
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46 && // 'F'
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x45 && // 'E'
    bytes[10] === 0x42 && // 'B'
    bytes[11] === 0x50 // 'P'
  ) {
    return 'image/webp';
  }

  return null;
}

export interface NormalizedReceiptImage {
  readonly bytes: Uint8Array;
  readonly mimeType: AiInlineMediaMimeType;
  readonly width: number;
  readonly height: number;
}

/**
 * Bounded, secure receipt image decode and normalization pipeline.
 *
 * 1. Checks byte bounds (<= 4 MiB).
 * 2. Checks magic bytes (JPEG/PNG/WebP only; rejects GIF, SVG, TIFF, PDF, etc.).
 * 3. Validates client MIME hint consistency if provided.
 * 4. Decodes with Sharp pixel limit (20,000,000 pixels).
 * 5. Validates dimension bounds (<= 8192px) and pixel limits.
 * 6. Validates single-frame (effectivePages === 1, no animated images).
 * 7. Normalizes: auto-orient, sRGB colorspace, resize inside 2048x2048 (without enlargement), strips all metadata.
 * 8. Re-encodes in memory and verifies normalized output buffer <= 4 MiB.
 *
 * @throws ReceiptImageError with appropriate error code if any step fails.
 */
export async function normalizeReceiptImage(
  fileBytes: Uint8Array | Buffer,
  fileMeta?: { name?: string; type?: string; size?: number }
): Promise<NormalizedReceiptImage> {
  const bytes = Buffer.isBuffer(fileBytes) ? fileBytes : Buffer.from(fileBytes);

  // 1. Check input byte size
  if (bytes.length === 0) {
    throw new ReceiptImageError('RECEIPT_IMAGE_REQUIRED', 'Tệp ảnh hóa đơn không được để trống.');
  }

  if (bytes.length > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_TOO_LARGE',
      `Kích thước ảnh vượt quá giới hạn cho phép (${(PHASE_12B_MAX_RECEIPT_FILE_BYTES / (1024 * 1024)).toFixed(0)}MB).`
    );
  }

  // 2. Binary magic byte detection
  const detectedMime = detectImageSignature(bytes);
  if (!detectedMime) {
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_INVALID_TYPE',
      'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG, PNG hoặc WebP.'
    );
  }

  // 3. Client MIME hint consistency check
  if (fileMeta?.type && fileMeta.type.trim() !== '') {
    const clientMime = fileMeta.type.trim().toLowerCase();
    const allowedClientMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedClientMimes.includes(clientMime)) {
      throw new ReceiptImageError(
        'RECEIPT_IMAGE_INVALID_TYPE',
        `MIME type '${fileMeta.type}' không hợp lệ.`
      );
    }
    // Cross-check detected binary signature with client MIME
    if (
      (detectedMime === 'image/jpeg' && clientMime !== 'image/jpeg' && clientMime !== 'image/jpg') ||
      (detectedMime === 'image/png' && clientMime !== 'image/png') ||
      (detectedMime === 'image/webp' && clientMime !== 'image/webp')
    ) {
      throw new ReceiptImageError(
        'RECEIPT_IMAGE_INVALID_TYPE',
        `Định dạng tệp không khớp với phần mở rộng hoặc MIME type được cung cấp.`
      );
    }
  }

  // 4. Construct bounded Sharp instance
  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    pipeline = sharp(bytes, {
      limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS,
    });
    metadata = await pipeline.metadata();
  } catch (err: unknown) {
    if (err instanceof ReceiptImageError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes('pixel limit') || message.toLowerCase().includes('input image exceeds')) {
      throw new ReceiptImageError(
        'RECEIPT_IMAGE_DIMENSIONS_EXCEEDED',
        'Kích thước điểm ảnh vượt quá giới hạn tối đa 20 megapixel.'
      );
    }
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_CORRUPTED',
      'Không thể đọc dữ liệu ảnh hoặc tệp ảnh bị lỗi.'
    );
  }

  // 5. Validate dimensions
  const width = metadata.width;
  const height = metadata.height;

  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new ReceiptImageError('RECEIPT_IMAGE_CORRUPTED', 'Không xác định được kích thước ảnh.');
  }

  if (width > PHASE_12B_MAX_DIMENSION || height > PHASE_12B_MAX_DIMENSION) {
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_DIMENSIONS_EXCEEDED',
      `Kích thước chiều rộng hoặc chiều cao ảnh (${width}x${height}) vượt quá giới hạn ${PHASE_12B_MAX_DIMENSION}px.`
    );
  }

  if (width * height > PHASE_12B_MAX_DECODED_PIXELS) {
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_DIMENSIONS_EXCEEDED',
      'Tổng số điểm ảnh vượt quá giới hạn tối đa 20 megapixel.'
    );
  }

  // 6. Single-frame enforcement (effectivePages === 1, no multi-frame animation)
  const effectivePages = metadata.pages ?? 1;
  const hasMultiplePages = effectivePages > 1 || (typeof metadata.pageHeight === 'number' && metadata.pageHeight < height);
  if (hasMultiplePages) {
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED',
      'Ảnh động hoặc tệp nhiều trang không được hỗ trợ.'
    );
  }

  // 7. Normalization pipeline (in-memory, auto-strips all metadata)
  try {
    let transform = sharp(bytes, {
      limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS,
    })
      .rotate() // Auto-orient based on EXIF
      .toColorspace('srgb')
      .resize({
        width: PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX,
        height: PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      });

    let serverDerivedMime: AiInlineMediaMimeType;
    if (detectedMime === 'image/jpeg') {
      transform = transform.jpeg({ quality: 85, progressive: false });
      serverDerivedMime = 'image/jpeg';
    } else if (detectedMime === 'image/png') {
      transform = transform.png({ compressionLevel: 8 });
      serverDerivedMime = 'image/png';
    } else {
      transform = transform.webp({ quality: 85 });
      serverDerivedMime = 'image/webp';
    }

    const normalizedBuffer = await transform.toBuffer({ resolveWithObject: true });

    // 8. Output buffer cap check (<= 4 MiB)
    if (normalizedBuffer.data.length > PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES) {
      throw new ReceiptImageError(
        'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE',
        'Ảnh sau khi chuẩn hóa vượt quá giới hạn kích thước tối đa.'
      );
    }

    return {
      bytes: new Uint8Array(normalizedBuffer.data.buffer, normalizedBuffer.data.byteOffset, normalizedBuffer.data.byteLength),
      mimeType: serverDerivedMime,
      width: normalizedBuffer.info.width,
      height: normalizedBuffer.info.height,
    };
  } catch (err: unknown) {
    if (err instanceof ReceiptImageError) {
      throw err;
    }
    throw new ReceiptImageError(
      'RECEIPT_IMAGE_CORRUPTED',
      'Lỗi trong quá trình chuẩn hóa ảnh hóa đơn.'
    );
  }
}
