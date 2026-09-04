/**
 * Finora AI Receipt Vision — Constants
 * Phase 12B — Client-Safe Configuration & Boundaries
 *
 * Client-safe constants. Free of server runtime dependencies and image decoders.
 */

/** Maximum raw receipt file size in bytes (4 MiB) */
export const PHASE_12B_MAX_RECEIPT_FILE_BYTES = 4_194_304;

/** Maximum decoded pixel count (20 Megapixels) for bounded Sharp processing */
export const PHASE_12B_MAX_DECODED_PIXELS = 20_000_000;

/** Maximum dimension (width/height) for decoded input raster in pixels */
export const PHASE_12B_MAX_DIMENSION = 8192;

/** Maximum long-edge size in pixels for normalized images sent to provider */
export const PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX = 2048;

/** Maximum byte size for normalized output image buffer (4 MiB) */
export const PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES = 4_194_304;

/** Maximum category candidates sent to AI model context */
export const PHASE_12B_MAX_CATEGORY_CANDIDATES = 50;

/** Maximum length for category candidate label in prompt */
export const PHASE_12B_MAX_CATEGORY_LABEL_LENGTH = 50;

/** Supported runtime image MIME types */
export const PHASE_12B_SUPPORTED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
