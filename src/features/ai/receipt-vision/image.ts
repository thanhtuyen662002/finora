import sharp from 'sharp';
import type { AiInlineMediaPart } from '@/lib/ai/types';
import { AiError } from '@/lib/ai/errors';
import { 
  PHASE_12B_MAX_RECEIPT_FILE_BYTES, 
  PHASE_12B_MAX_DECODED_PIXELS, 
  PHASE_12B_MAX_DIMENSION_PX, 
  PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX,
  PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES,
  RECEIPT_VISION_ERRORS
} from './constants';

export async function processReceiptImage(file: File): Promise<AiInlineMediaPart> {
  if (file.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
    throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'File too large' });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const metadata = await sharp(buffer, { limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'Failed to read image dimensions' });
    }

    if (metadata.width > PHASE_12B_MAX_DIMENSION_PX || metadata.height > PHASE_12B_MAX_DIMENSION_PX) {
      throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'Image dimensions too large' });
    }

    if (metadata.pages !== undefined && metadata.pages > 1) {
      throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'Multiframe images not supported' });
    }

    let pipeline = sharp(buffer, { limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS });

    const isOversized = Math.max(metadata.width, metadata.height) > PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX;

    if (isOversized) {
      pipeline = pipeline.resize({
        width: metadata.width >= metadata.height ? PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX : undefined,
        height: metadata.height > metadata.width ? PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const { data: outputBuffer, info } = await pipeline
      .toColorspace('srgb')
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    if (info.size > PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES) {
       throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'Normalized image too large' });
    }

    return {
      kind: 'inline_image',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array(outputBuffer.buffer, outputBuffer.byteOffset, outputBuffer.byteLength),
    };
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'Image decoding failed', cause: error });
  }
}
