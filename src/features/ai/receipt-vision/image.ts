import sharp, { type Sharp, type Metadata } from 'sharp';
import {
  PHASE_12B_MAX_RECEIPT_FILE_BYTES,
  PHASE_12B_MAX_DECODED_PIXELS,
  PHASE_12B_MAX_DIMENSION_PX,
  PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES,
} from './constants';
import { ReceiptVisionError } from './errors';
import type { AiInlineMediaPart } from '@/lib/ai/types';

export interface ProcessedReceiptImage {
  readonly mediaPart: AiInlineMediaPart;
  readonly format: 'jpeg' | 'png' | 'webp';
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly originalBytes: number;
}

export async function processReceiptImage(file: File): Promise<ProcessedReceiptImage> {
  // 1. File size check
  if (file.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
    throw new ReceiptVisionError('RECEIPT_FILE_TOO_LARGE');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 12) {
    throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
  }

  // 2. Binary signatures
  // JPEG signature: FF D8 FF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // WebP signature: RIFF at 0..3 and WEBP at 8..11
  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
  }

  const detectedFormat: 'jpeg' | 'png' | 'webp' = isJpeg ? 'jpeg' : isPng ? 'png' : 'webp';

  // 3. MIME validation and alias rejection
  if (file.type && file.type.trim() !== '') {
    const rawMime = file.type.trim().toLowerCase();

    if (rawMime === 'image/jpg') {
      throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
    }

    if (rawMime !== 'image/jpeg' && rawMime !== 'image/png' && rawMime !== 'image/webp') {
      throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
    }

    if (isJpeg && rawMime !== 'image/jpeg') {
      throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
    }
    if (isPng && rawMime !== 'image/png') {
      throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
    }
    if (isWebp && rawMime !== 'image/webp') {
      throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
    }
  }

  // 4. Sharp decoding and security limits
  let image: Sharp;
  try {
    image = sharp(buffer, {
      limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS,
      failOn: 'warning',
    });
  } catch {
    throw new ReceiptVisionError('RECEIPT_IMAGE_DECODE_FAILED');
  }

  let metadata: Metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new ReceiptVisionError('RECEIPT_IMAGE_DECODE_FAILED');
  }

  // Require Sharp metadata.format to agree with signature
  if (metadata.format !== detectedFormat) {
    throw new ReceiptVisionError('RECEIPT_FILE_TYPE_UNSUPPORTED');
  }

  // Reject multi-frame and animated inputs
  if ((metadata.pages && metadata.pages > 1) || metadata.pageHeight) {
    throw new ReceiptVisionError('RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED');
  }

  // Reject missing or excessive dimensions
  if (!metadata.width || !metadata.height) {
    throw new ReceiptVisionError('RECEIPT_IMAGE_DECODE_FAILED');
  }

  if (
    metadata.width > PHASE_12B_MAX_DIMENSION_PX ||
    metadata.height > PHASE_12B_MAX_DIMENSION_PX ||
    metadata.width * metadata.height > PHASE_12B_MAX_DECODED_PIXELS
  ) {
    throw new ReceiptVisionError('RECEIPT_IMAGE_TOO_LARGE');
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  const originalBytes = buffer.length;

  // 5. Normalize image
  // Auto-orient, scale down inside 2048x2048 without enlargement, convert to sRGB, output standard JPEG (quality 80).
  // Exif and ICC profile metadata are stripped by default because metadata retention options are omitted.
  let outputBuffer: Buffer;
  try {
    outputBuffer = await image
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColorspace('srgb')
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch {
    throw new ReceiptVisionError('RECEIPT_IMAGE_DECODE_FAILED');
  }

  if (outputBuffer.length > PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES) {
    throw new ReceiptVisionError('RECEIPT_IMAGE_NORMALIZED_TOO_LARGE');
  }

  return {
    mediaPart: {
      kind: 'inline_image',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array(outputBuffer),
    },
    format: detectedFormat,
    originalWidth,
    originalHeight,
    originalBytes,
  };
}
