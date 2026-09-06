import sharp from 'sharp';
import { AiError } from '@/lib/ai/errors';
import {
  PHASE_12B_MAX_RECEIPT_FILE_BYTES,
  PHASE_12B_MAX_DECODED_PIXELS,
  PHASE_12B_MAX_DIMENSION_PX,
  PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES,
} from './constants';
import type { AiInlineMediaPart } from '@/lib/ai/types';

export async function processReceiptImage(file: File): Promise<AiInlineMediaPart> {
  if (file.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'File size exceeds maximum allowed limit.',
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 12) {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'File buffer is too small to be a valid image.',
    });
  }

  // 1. JPEG signature requires FF D8 FF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // 2. PNG signature verifies all eight signature bytes: 89 50 4E 47 0D 0A 1A 0A
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

  // 3. WebP signature verifies RIFF at 0..3 and WEBP at 8..11
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
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'Unsupported image format. Only JPEG, PNG, and WebP are allowed.',
    });
  }

  const detectedFormat = isJpeg ? 'jpeg' : isPng ? 'png' : 'webp';

  // 4. Reject non-empty File.type conflicting with binary signature
  if (file.type && file.type.trim() !== '') {
    const rawMime = file.type.trim().toLowerCase();
    const isJpegMime = rawMime === 'image/jpeg' || rawMime === 'image/jpg';
    const isPngMime = rawMime === 'image/png';
    const isWebpMime = rawMime === 'image/webp';

    if (isJpeg && !isJpegMime) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'File type header conflicts with JPEG binary signature.',
      });
    }
    if (isPng && !isPngMime) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'File type header conflicts with PNG binary signature.',
      });
    }
    if (isWebp && !isWebpMime) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'File type header conflicts with WebP binary signature.',
      });
    }
  }

  try {
    const image = sharp(buffer, {
      limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS,
      failOn: 'warning',
    });

    const metadata = await image.metadata();

    // 5. Require Sharp metadata.format to agree with signature
    if (metadata.format !== detectedFormat) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'Decoded image format does not match binary signature.',
      });
    }

    // 6. Reject multi-frame and animated inputs
    if ((metadata.pages && metadata.pages > 1) || metadata.pageHeight) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'Multi-frame or animated images are not allowed.',
      });
    }

    // 7. Reject missing or excessive dimensions
    if (!metadata.width || !metadata.height) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'Unable to determine image dimensions.',
      });
    }
    if (metadata.width > PHASE_12B_MAX_DIMENSION_PX || metadata.height > PHASE_12B_MAX_DIMENSION_PX) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'Image dimensions exceed maximum allowed size.',
      });
    }

    // 8. Normalize image: rotate auto-orients, resize inside 2048x2048 without enlargement,
    // convert to srgb, output to standard JPEG (quality 80).
    // EXIF, GPS, timestamps, device metadata, and ICC profiles are stripped by default.
    const outputBuffer = await image
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

    if (outputBuffer.length > PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'Normalized image size exceeds maximum allowed limit.',
      });
    }

    return {
      kind: 'inline_image',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array(outputBuffer),
    };
  } catch (err: unknown) {
    if (err instanceof AiError) {
      throw err;
    }
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'Invalid image format or corrupted file.',
    });
  }
}
