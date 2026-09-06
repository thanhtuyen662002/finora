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

  // Magic bytes check
  const isJpeg = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp = buffer.length > 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'Unsupported image format. Only JPEG, PNG, and WebP are allowed.',
    });
  }

  try {
    const image = sharp(buffer, {
      limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS,
      failOn: 'warning',
    });

    const metadata = await image.metadata();

    if (metadata.pages && metadata.pages > 1) {
      throw new Error('Multi-frame or animated images are not allowed.');
    }
    if (metadata.width && metadata.width > PHASE_12B_MAX_DIMENSION_PX) {
      throw new Error('Image width exceeds maximum allowed dimension.');
    }
    if (metadata.height && metadata.height > PHASE_12B_MAX_DIMENSION_PX) {
      throw new Error('Image height exceeds maximum allowed dimension.');
    }

    const outputBuffer = await image
      .rotate() // auto-orient
      .resize({
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .keepIccProfile()
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
      mimeType: 'image/jpeg',
      data: outputBuffer,
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
