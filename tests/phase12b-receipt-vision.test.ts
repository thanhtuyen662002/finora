/**
 * Finora Phase 12B-1 — Receipt Vision Deterministic Test Suite
 * Corrective Pass 2: Zero-Media AiError, Genuine Animated WebP, FormData Contract, Security & Orchestration Proofs
 *
 * Zero Network, Zero Supabase Remote DB, Zero Gemini Remote API Calls
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { AiError } from '../src/lib/ai/errors';
import {
  GeminiProviderCore,
  classifyGeminiErrorCode,
  normalizeGeminiError,
  RECEIPT_SAFE_ERROR_MESSAGES,
  type GeminiClientLike,
} from '../src/lib/ai/providers/gemini-core';
import { AiRouter } from '../src/lib/ai/router';
import type {
  AiCredentialProvider,
  AiInlineMediaPart,
} from '../src/lib/ai/types';
import {
  canonicalizeReceiptAmount,
  isValidReceiptLexicalAmount,
} from '../src/features/ai/receipt-vision/money';
import {
  EXPECTED_RECEIPT_VISION_OUTPUT_KEYS,
  isValidCalendarDate,
  ReceiptVisionOutputValidator,
  SUPPORTED_RECEIPT_CURRENCIES,
  validateReceiptVisionOutput,
} from '../src/features/ai/receipt-vision/validator';
import {
  PHASE_12B_MAX_RECEIPT_FILE_BYTES,
  PHASE_12B_MAX_DECODED_PIXELS,
  PHASE_12B_MAX_DIMENSION,
  PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX,
  PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES,
  PHASE_12B_SUPPORTED_IMAGE_MIMES,
} from '../src/features/ai/receipt-vision/constants';
import {
  assertNormalizedReceiptSize,
  detectImageSignature,
  normalizeReceiptImage,
  ReceiptImageError,
} from '../src/features/ai/receipt-vision/image';
import {
  RECEIPT_VISION_PROMPT,
  RECEIPT_VISION_SYSTEM_INSTRUCTION,
} from '../src/features/ai/receipt-vision/prompt';
import { executeReceiptVisionCore } from '../src/features/ai/receipt-vision/action-core';
import {
  validateReceiptFormData,
  executeAnalyzeReceiptAction,
} from '../src/features/ai/receipt-vision/actions';
import type { ReceiptVisionParseOutput } from '../src/features/ai/receipt-vision/types';

/**
 * Builds a genuine, valid multi-frame animated WebP buffer in memory using Sharp.
 * Generates 2 distinct lossless WebP frames and wraps them into RIFF/WEBP/VP8X/ANIM/ANMF chunks.
 */
async function createValidAnimatedWebp(): Promise<Buffer> {
  const frame1Webp = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .webp({ lossless: true })
    .toBuffer();

  const frame2Webp = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .webp({ lossless: true })
    .toBuffer();

  function extractVp8L(buf: Buffer): Buffer {
    let offset = 12;
    while (offset < buf.length) {
      const fourcc = buf.toString('ascii', offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      if (fourcc === 'VP8L' || fourcc === 'VP8 ') {
        const paddedSize = size + (size % 2);
        return buf.subarray(offset, offset + 8 + paddedSize);
      }
      offset += 8 + size + (size % 2);
    }
    throw new Error('VP8/VP8L chunk not found in frame WebP');
  }

  const vp8lChunk1 = extractVp8L(frame1Webp);
  const vp8lChunk2 = extractVp8L(frame2Webp);

  function createAnmfChunk(x: number, y: number, w: number, h: number, durationMs: number, subchunk: Buffer): Buffer {
    const header = Buffer.alloc(16);
    header[0] = x & 0xff;
    header[1] = (x >> 8) & 0xff;
    header[2] = (x >> 16) & 0xff;
    header[3] = y & 0xff;
    header[4] = (y >> 8) & 0xff;
    header[5] = (y >> 16) & 0xff;
    const w1 = w - 1;
    header[6] = w1 & 0xff;
    header[7] = (w1 >> 8) & 0xff;
    header[8] = (w1 >> 16) & 0xff;
    const h1 = h - 1;
    header[9] = h1 & 0xff;
    header[10] = (h1 >> 8) & 0xff;
    header[11] = (h1 >> 16) & 0xff;
    header[12] = durationMs & 0xff;
    header[13] = (durationMs >> 8) & 0xff;
    header[14] = (durationMs >> 16) & 0xff;
    header[15] = 0x00;

    const anmfPayload = Buffer.concat([header, subchunk]);
    const anmfChunkHeader = Buffer.alloc(8);
    anmfChunkHeader.write('ANMF', 0, 4, 'ascii');
    anmfChunkHeader.writeUInt32LE(anmfPayload.length, 4);

    const padding = anmfPayload.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
    return Buffer.concat([anmfChunkHeader, anmfPayload, padding]);
  }

  const anmf1 = createAnmfChunk(0, 0, 10, 10, 100, vp8lChunk1);
  const anmf2 = createAnmfChunk(0, 0, 10, 10, 100, vp8lChunk2);

  const vp8xPayload = Buffer.alloc(10);
  vp8xPayload[0] = 0x02; // animation flag
  vp8xPayload[4] = 9; // canvas width - 1
  vp8xPayload[7] = 9; // canvas height - 1

  const vp8xChunk = Buffer.concat([
    Buffer.from('VP8X', 'ascii'),
    (() => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(10, 0);
      return b;
    })(),
    vp8xPayload,
  ]);

  const animPayload = Buffer.alloc(6);
  const animChunk = Buffer.concat([
    Buffer.from('ANIM', 'ascii'),
    (() => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(6, 0);
      return b;
    })(),
    animPayload,
  ]);

  const webpBody = Buffer.concat([vp8xChunk, animChunk, anmf1, anmf2]);
  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 4, 'ascii');
  riffHeader.writeUInt32LE(4 + webpBody.length, 4);
  riffHeader.write('WEBP', 8, 4, 'ascii');

  return Buffer.concat([riffHeader, webpBody]);
}

async function runTests() {
  console.log('--- Running Phase 12B-1 Receipt Vision Test Suite (Corrective Pass 2) ---');
  let totalTestsPassed = 0;

  // Helper to generate minimal in-memory valid images using Sharp
  const sampleJpeg = await sharp({
    create: { width: 100, height: 80, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .jpeg()
    .toBuffer();

  const samplePng = await sharp({
    create: { width: 120, height: 90, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();

  const sampleWebp = await sharp({
    create: { width: 150, height: 100, channels: 3, background: { r: 100, g: 200, b: 100 } },
  })
    .webp()
    .toBuffer();

  const sampleGif = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .gif()
    .toBuffer();

  // ==========================================
  // 1. EXACT MONEY & LEXICAL AMOUNT TESTS
  // ==========================================
  console.log('1. Testing Exact Money Lexical Validation & Canonicalization...');

  // Valid amounts
  assert.strictEqual(isValidReceiptLexicalAmount('85000'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('4.5'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('4.50'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('4.5000'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('1234567890123456.9999'), true);
  totalTestsPassed += 5;

  // Invalid amounts
  assert.strictEqual(isValidReceiptLexicalAmount('0'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('0.0'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('0.00'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('0.0000'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('-4.50'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('NaN'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('Infinity'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('12.34567'), false); // max 4 decimal digits
  assert.strictEqual(isValidReceiptLexicalAmount('12,000'), false); // no thousand commas
  assert.strictEqual(isValidReceiptLexicalAmount('$50'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('1e5'), false);
  totalTestsPassed += 11;

  // Canonicalization to 4 decimal places
  assert.strictEqual(canonicalizeReceiptAmount('85000'), '85000.0000');
  assert.strictEqual(canonicalizeReceiptAmount('4.5'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('4.50'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('4.5000'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('0.05'), '0.0500');
  totalTestsPassed += 5;

  console.log('  ✓ 1. Exact Money lexical validation and canonicalization passed');

  // ==========================================
  // 2. STRUCTURED OUTPUT VALIDATOR & DATE VALIDATION
  // ==========================================
  console.log('2. Testing Structured Output Validator & Calendar Date Verification...');

  // Valid structured outputs
  const validSampleOutput: ReceiptVisionParseOutput = {
    document_kind: 'PURCHASE_RECEIPT',
    merchant: 'Starbucks Coffee',
    occurred_on: '2026-03-29',
    occurred_on_state: 'PRESENT',
    amount: '85000',
    amount_state: 'PRESENT',
    currency_code: 'VND',
    currency_state: 'PRESENT',
    category_token: null,
    note: 'Cà phê sáng tại Starbucks',
    image_quality: 'OK',
  };

  const validated = validateReceiptVisionOutput(validSampleOutput);
  assert.strictEqual(validated.merchant, 'Starbucks Coffee');
  assert.strictEqual(validated.amount, '85000');
  assert.strictEqual(validated.currency_code, 'VND');
  totalTestsPassed += 3;

  // Missing required keys rejected
  const missingKeyOutput = { ...validSampleOutput } as any;
  delete missingKeyOutput.currency_code;
  assert.throws(
    () => validateReceiptVisionOutput(missingKeyOutput),
    (err: Error) => err.message.includes('missing required key') || err.message.includes('must contain exactly 11 keys')
  );
  totalTestsPassed += 2;

  // Extra hallucinated keys rejected
  const extraKeyOutput = { ...validSampleOutput, extra_hallucinated_field: 'bad' } as any;
  assert.throws(
    () => validateReceiptVisionOutput(extraKeyOutput),
    (err: Error) => err.message.includes('must contain exactly 11 keys')
  );
  totalTestsPassed += 1;

  // Invalid calendar dates rejected
  assert.strictEqual(isValidCalendarDate('2026-02-29'), false); // 2026 is not a leap year
  assert.strictEqual(isValidCalendarDate('2024-02-29'), true); // 2024 is a leap year
  assert.strictEqual(isValidCalendarDate('2026-13-01'), false); // month 13
  assert.strictEqual(isValidCalendarDate('2026-04-31'), false); // April has 30 days
  assert.strictEqual(isValidCalendarDate('invalid-date'), false);
  totalTestsPassed += 5;

  // Output validator with invalid date rejected
  const invalidDateOutput = { ...validSampleOutput, occurred_on: '2026-02-29' };
  assert.throws(
    () => validateReceiptVisionOutput(invalidDateOutput),
    (err: Error) => err.message.includes('not a valid YYYY-MM-DD calendar date')
  );
  totalTestsPassed += 1;

  // Supported currencies check
  for (const c of ['VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW'] as const) {
    assert.ok(SUPPORTED_RECEIPT_CURRENCIES.includes(c));
  }
  assert.strictEqual((SUPPORTED_RECEIPT_CURRENCIES as readonly string[]).includes('XYZ'), false);
  totalTestsPassed += 7;

  console.log('  ✓ 2. Structured output validator and calendar date verification passed');

  // ==========================================
  // 3. IMAGE SECURITY MATRIX & BOUNDED NORMALIZATION
  // ==========================================
  console.log('3. Testing Image Security Matrix, Decoded Bounds, Dimensions & Metadata Stripping...');

  // Signature checks
  assert.strictEqual(detectImageSignature(new Uint8Array(sampleJpeg)), 'image/jpeg');
  assert.strictEqual(detectImageSignature(new Uint8Array(samplePng)), 'image/png');
  assert.strictEqual(detectImageSignature(new Uint8Array(sampleWebp)), 'image/webp');
  assert.strictEqual(detectImageSignature(new Uint8Array(sampleGif)), null);
  totalTestsPassed += 4;

  // GIF rejected
  await assert.rejects(
    async () => normalizeReceiptImage(sampleGif, { name: 'receipt.gif', type: 'image/gif' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // SVG rejected
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  await assert.rejects(
    async () => normalizeReceiptImage(svgBuffer, { name: 'receipt.svg', type: 'image/svg+xml' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // Genuine Multi-frame Animated WebP Proof (Finding 2 & 3)
  const genuineAnimatedWebp = await createValidAnimatedWebp();
  const animatedMeta = await sharp(genuineAnimatedWebp, { animated: true }).metadata();
  assert.strictEqual(animatedMeta.format, 'webp');
  assert.ok((animatedMeta.pages ?? 1) > 1, `Expected animated WebP pages > 1, got ${animatedMeta.pages}`);
  assert.strictEqual(animatedMeta.pages, 2);
  assert.strictEqual(animatedMeta.pageHeight, 10);
  totalTestsPassed += 4;

  await assert.rejects(
    async () => normalizeReceiptImage(genuineAnimatedWebp),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // Single-frame WebP accepted
  const normWebp = await normalizeReceiptImage(sampleWebp);
  assert.strictEqual(normWebp.mimeType, 'image/webp');
  assert.strictEqual(normWebp.width, 150);
  assert.strictEqual(normWebp.height, 100);
  totalTestsPassed += 3;

  // Malformed or corrupt bytes -> RECEIPT_IMAGE_DECODE_FAILED
  const corruptBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  await assert.rejects(
    async () => normalizeReceiptImage(corruptBytes),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_DECODE_FAILED'
  );
  totalTestsPassed += 1;

  // Small image is NOT upscaled
  const normJpeg = await normalizeReceiptImage(sampleJpeg);
  assert.strictEqual(normJpeg.width, 100);
  assert.strictEqual(normJpeg.height, 80);
  totalTestsPassed += 2;

  // Finding 5: Image width > 8192px rejected with RECEIPT_IMAGE_TOO_LARGE
  const wideRaster = await sharp({
    create: { width: 8193, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    async () => normalizeReceiptImage(wideRaster),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_TOO_LARGE'
  );
  totalTestsPassed += 1;

  // Finding 6: Image height > 8192px rejected with RECEIPT_IMAGE_TOO_LARGE
  const tallRaster = await sharp({
    create: { width: 10, height: 8193, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    async () => normalizeReceiptImage(tallRaster),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_TOO_LARGE'
  );
  totalTestsPassed += 1;

  // Finding 7: Decoded pixels > 20,000,000 rejected with RECEIPT_IMAGE_TOO_LARGE
  const hugePixelRaster = await sharp({
    create: { width: 5000, height: 5000, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    async () => normalizeReceiptImage(hugePixelRaster),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_TOO_LARGE'
  );
  totalTestsPassed += 1;

  // Finding 8: Output buffer cap check (4 MiB)
  assert.doesNotThrow(() => assertNormalizedReceiptSize(Buffer.alloc(PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES)));
  assert.throws(
    () => assertNormalizedReceiptSize(Buffer.alloc(PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES + 1)),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE'
  );
  totalTestsPassed += 2;

  // Large image resize within limits: 3000x1500 is scaled down inside 2048x2048 to 2048x1024
  const largePng = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: { r: 100, g: 100, b: 100 } },
  })
    .png()
    .toBuffer();
  const normLarge = await normalizeReceiptImage(largePng);
  assert.strictEqual(normLarge.width, 2048);
  assert.strictEqual(normLarge.height, 1024);
  assert.strictEqual(normLarge.mimeType, 'image/png');
  totalTestsPassed += 3;

  // Finding 9: EXIF Auto-orientation & Complete Metadata Stripping Proof (with verified input metadata)
  const exifJpeg = await sharp({
    create: { width: 120, height: 60, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .withMetadata({
      orientation: 6, // 90 deg clockwise
      icc: 'srgb',
      exif: {
        IFD0: {
          Make: 'FinoraSecureCamera',
          Model: 'FinoraPhone1',
          DateTime: '2026:01:01 12:00:00',
        },
      } as any,
    })
    .jpeg()
    .toBuffer();

  const inExifMeta = await sharp(exifJpeg).metadata();
  assert.strictEqual(inExifMeta.orientation, 6);
  assert.ok(inExifMeta.exif !== undefined && inExifMeta.exif.length > 0, 'Input fixture must have EXIF');
  assert.ok(inExifMeta.icc !== undefined && inExifMeta.icc.length > 0, 'Input fixture must have ICC profile');
  totalTestsPassed += 3;

  const normExif = await normalizeReceiptImage(exifJpeg);
  // Auto-oriented: 120x60 rotated 90 deg -> 60x120
  assert.strictEqual(normExif.width, 60);
  assert.strictEqual(normExif.height, 120);

  // Assert complete metadata stripping from output
  const normExifMeta = await sharp(normExif.bytes).metadata();
  assert.strictEqual(normExifMeta.orientation, undefined, 'Normalized output orientation must be undefined');
  assert.strictEqual(normExifMeta.exif, undefined, 'Normalized output EXIF must be undefined');
  assert.strictEqual(normExifMeta.icc, undefined, 'Normalized output ICC must be undefined');
  assert.strictEqual(normExifMeta.xmp, undefined, 'Normalized output XMP must be undefined');
  totalTestsPassed += 6;

  // Finding 6: EXIF Date Must Not Become Transaction Date Proof
  // 3.1: Source code isolation audit - verify no EXIF date extraction exists
  const imageSource = fs.readFileSync(path.resolve('src/features/ai/receipt-vision/image.ts'), 'utf-8');
  assert.ok(!imageSource.includes('DateTime'), 'image.ts must not extract DateTime');
  assert.ok(!imageSource.includes('getExif'), 'image.ts must not export exif metadata');
  
  const actionsSource = fs.readFileSync(path.resolve('src/features/ai/receipt-vision/actions.ts'), 'utf-8');
  assert.ok(!actionsSource.includes('exif') && !actionsSource.includes('DateTime'), 'actions.ts must not inspect EXIF');

  const actionCoreSource = fs.readFileSync(path.resolve('src/features/ai/receipt-vision/action-core.ts'), 'utf-8');
  assert.ok(!actionCoreSource.includes('exif') && !actionCoreSource.includes('DateTime'), 'action-core.ts must not inspect EXIF');

  const validatorSource = fs.readFileSync(path.resolve('src/features/ai/receipt-vision/validator.ts'), 'utf-8');
  assert.ok(!validatorSource.includes('exif') && !validatorSource.includes('DateTime'), 'validator.ts must not inspect EXIF');
  totalTestsPassed += 4;

  // 3.2: Runtime isolation test - EXIF DateTime ('2026:01:01') does NOT override provider output ('2026-03-29')
  const exifMockRouter = new AiRouter({
    providers: [
      new GeminiProviderCore({
        clientFactory: () => ({
          models: {
            async generateContent() {
              return {
                text: JSON.stringify({
                  ...validSampleOutput,
                  occurred_on: '2026-03-29',
                  occurred_on_state: 'PRESENT',
                }),
                usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
              };
            },
          },
        }),
      }),
    ],
  });

  const exifExtractionRes = await executeReceiptVisionCore(
    exifJpeg,
    { name: 'exif_receipt.jpg', type: 'image/jpeg', size: exifJpeg.length },
    { id: 'usr_test_123' },
    {
      router: exifMockRouter,
      credentialProvider: {
        async resolveCredential() {
          return { value: 'AIzaSyFakeTestKey123456789' };
        },
      },
      normalizeImage: normalizeReceiptImage,
    }
  );

  assert.strictEqual(exifExtractionRes.ok, true);
  if (exifExtractionRes.ok) {
    assert.strictEqual(exifExtractionRes.data.occurred_on, '2026-03-29');
    assert.notStrictEqual(exifExtractionRes.data.occurred_on, '2026-01-01');
  }
  totalTestsPassed += 3;

  console.log('  ✓ 3. Image security matrix, bounds, dimension limits, and metadata stripping passed');

  // ==========================================
  // 4. PROVIDER BOUNDARY & MEDIA CARDINALITY MATRIX
  // ==========================================
  console.log('4. Testing Multimodal Gemini Adapter & Media Cardinality Matrix...');

  let callCount = 0;
  let capturedParams: any = null;

  const mockClient: GeminiClientLike = {
    models: {
      async generateContent(params) {
        callCount++;
        capturedParams = params;
        return {
          text: JSON.stringify(validSampleOutput),
          usageMetadata: {
            promptTokenCount: 150,
            candidatesTokenCount: 80,
            totalTokenCount: 230,
          },
        };
      },
    },
  };

  const providerCore = new GeminiProviderCore({
    clientFactory: () => mockClient,
  });

  const sampleMediaPart: AiInlineMediaPart = {
    kind: 'inline_image',
    mimeType: 'image/jpeg',
    bytes: new Uint8Array(sampleJpeg),
  };

  // Case 4.1: Receipt + exactly 1 valid image -> exactly 1 generateContent invocation
  callCount = 0;
  capturedParams = null;
  const response = await providerCore.execute(
    {
      operation: 'receipt_vision',
      model: 'gemini-2.5-flash',
      prompt: RECEIPT_VISION_PROMPT,
      media: [sampleMediaPart],
      outputValidator: ReceiptVisionOutputValidator,
    },
    { value: 'AIzaSyFakeKeyForTest123456789012345678' }
  );

  assert.strictEqual(callCount, 1);
  assert.strictEqual(response.model, 'gemini-2.5-flash');
  assert.ok(Array.isArray(capturedParams.contents));
  assert.strictEqual(capturedParams.contents.length, 2);
  assert.strictEqual(capturedParams.contents[0].inlineData.mimeType, 'image/jpeg');
  assert.strictEqual(capturedParams.contents[0].inlineData.data, Buffer.from(sampleJpeg).toString('base64'));
  assert.strictEqual(capturedParams.config.httpOptions.retryOptions.attempts, 1);
  totalTestsPassed += 6;

  // Case 4.2: Receipt + no media (undefined) -> AI_INVALID_REQUEST, callCount = 0
  callCount = 0;
  await assert.rejects(
    async () =>
      providerCore.execute(
        {
          operation: 'receipt_vision',
          model: 'gemini-2.5-flash',
          prompt: RECEIPT_VISION_PROMPT,
        },
        { value: 'AIzaSyFakeKeyForTest123456789012345678' }
      ),
    (err: AiError) => err.code === 'AI_INVALID_REQUEST'
  );
  assert.strictEqual(callCount, 0);
  totalTestsPassed += 2;

  // Case 4.3: Receipt + 0 media parts ([]) -> AI_INVALID_REQUEST, callCount = 0
  callCount = 0;
  await assert.rejects(
    async () =>
      providerCore.execute(
        {
          operation: 'receipt_vision',
          model: 'gemini-2.5-flash',
          prompt: RECEIPT_VISION_PROMPT,
          media: [],
        },
        { value: 'AIzaSyFakeKeyForTest123456789012345678' }
      ),
    (err: AiError) => err.code === 'AI_INVALID_REQUEST'
  );
  assert.strictEqual(callCount, 0);
  totalTestsPassed += 2;

  // Case 4.4: Receipt + multiple media parts -> AI_INVALID_REQUEST, callCount = 0
  callCount = 0;
  await assert.rejects(
    async () =>
      providerCore.execute(
        {
          operation: 'receipt_vision',
          model: 'gemini-2.5-flash',
          prompt: RECEIPT_VISION_PROMPT,
          media: [sampleMediaPart, sampleMediaPart],
        },
        { value: 'AIzaSyFakeKeyForTest123456789012345678' }
      ),
    (err: AiError) => err.code === 'AI_INVALID_REQUEST'
  );
  assert.strictEqual(callCount, 0);
  totalTestsPassed += 2;

  // Case 4.5: Receipt + unsupported MIME type -> AI_INVALID_REQUEST, callCount = 0
  callCount = 0;
  await assert.rejects(
    async () =>
      providerCore.execute(
        {
          operation: 'receipt_vision',
          model: 'gemini-2.5-flash',
          prompt: RECEIPT_VISION_PROMPT,
          media: [
            {
              kind: 'inline_image',
              mimeType: 'image/svg+xml' as any,
              bytes: new Uint8Array(sampleJpeg),
            },
          ],
        },
        { value: 'AIzaSyFakeKeyForTest123456789012345678' }
      ),
    (err: AiError) => err.code === 'AI_INVALID_REQUEST'
  );
  assert.strictEqual(callCount, 0);
  totalTestsPassed += 2;

  // Case 4.6: Receipt + empty byte array -> AI_INVALID_REQUEST, callCount = 0
  callCount = 0;
  await assert.rejects(
    async () =>
      providerCore.execute(
        {
          operation: 'receipt_vision',
          model: 'gemini-2.5-flash',
          prompt: RECEIPT_VISION_PROMPT,
          media: [
            {
              kind: 'inline_image',
              mimeType: 'image/jpeg',
              bytes: new Uint8Array(0),
            },
          ],
        },
        { value: 'AIzaSyFakeKeyForTest123456789012345678' }
      ),
    (err: AiError) => err.code === 'AI_INVALID_REQUEST'
  );
  assert.strictEqual(callCount, 0);
  totalTestsPassed += 2;

  // Case 4.7: Text operation non-regression: transaction_parser leaves retryOptions untouched and string contents unchanged
  callCount = 0;
  capturedParams = null;
  await providerCore.execute(
    {
      operation: 'transaction_parser',
      model: 'gemini-3.5-flash-lite',
      prompt: 'An trua 85k',
    },
    { value: 'AIzaSyFakeKeyForTest123456789012345678' }
  );
  assert.strictEqual(callCount, 1);
  assert.strictEqual(typeof capturedParams.contents, 'string');
  assert.strictEqual(capturedParams.config?.httpOptions, undefined);
  totalTestsPassed += 3;

  console.log('  ✓ 4. Provider boundary, exact-one media enforcement, and retry policy passed');

  // ==========================================
  // 5. ZERO-MEDIA AIERROR & ERROR PRIVACY BOUNDARY (Finding 1)
  // ==========================================
  console.log('5. Testing Zero-Media AiError Construction & Classification...');

  const base64Sentinel = 'SECRET_BASE64_IMAGE_BYTES_MUST_NEVER_LEAK_INTO_ERROR';

  // 5.1: classifyGeminiErrorCode is a pure classifier returning string AiErrorCode
  const rawSentinelErr = new Error(`Google API Failure: payload inlineData="${base64Sentinel}" 403 Permission Denied`);
  const classifiedCode = classifyGeminiErrorCode(rawSentinelErr);
  assert.strictEqual(classifiedCode, 'AI_AUTH_FAILED');
  assert.strictEqual(typeof classifiedCode, 'string');
  totalTestsPassed += 2;

  // 5.2: normalizeGeminiError is preserved for text operations
  const normalizedTextErr = normalizeGeminiError(new Error('Quota exceeded 429'));
  assert.ok(normalizedTextErr instanceof AiError);
  assert.strictEqual(normalizedTextErr.code, 'AI_RATE_LIMITED');
  assert.ok(normalizedTextErr.message.includes('Quota exceeded'));
  totalTestsPassed += 3;

  // 5.3: Multimodal receipt_vision catch path NEVER constructs intermediate AiError with raw messages
  const failingMockClient: GeminiClientLike = {
    models: {
      async generateContent() {
        throw new Error(`Google API Failure: payload inlineData="${base64Sentinel}" 403 Permission Denied`);
      },
    },
  };

  const failingProvider = new GeminiProviderCore({
    clientFactory: () => failingMockClient,
  });

  try {
    await failingProvider.execute(
      {
        operation: 'receipt_vision',
        model: 'gemini-2.5-flash',
        prompt: RECEIPT_VISION_PROMPT,
        media: [sampleMediaPart],
      },
      { value: 'AIzaSyFakeKeyForTest123456789012345678' }
    );
    assert.fail('Should have thrown an error');
  } catch (err: any) {
    assert.ok(err instanceof AiError);
    assert.strictEqual(err.code, 'AI_AUTH_FAILED');
    assert.strictEqual(err.message, RECEIPT_SAFE_ERROR_MESSAGES.AI_AUTH_FAILED);
    assert.ok(!err.message.includes(base64Sentinel));
    assert.ok(!JSON.stringify(err).includes(base64Sentinel));
    assert.strictEqual(err.cause, undefined);
  }
  totalTestsPassed += 6;

  // 5.4: Audit gemini-core.ts source code to verify no normalizeGeminiError in receipt_vision catch block
  const geminiCorePath = path.resolve('src/lib/ai/providers/gemini-core.ts');
  const geminiCoreSource = fs.readFileSync(geminiCorePath, 'utf-8');
  assert.ok(geminiCoreSource.includes('export function classifyGeminiErrorCode'));
  assert.ok(geminiCoreSource.includes("if (request.operation === 'receipt_vision')"));
  const receiptCatchBlock = geminiCoreSource.slice(
    geminiCoreSource.indexOf("if (request.operation === 'receipt_vision')"),
    geminiCoreSource.indexOf('throw normalizeGeminiError(err);')
  );
  assert.ok(!receiptCatchBlock.includes('normalizeGeminiError'), 'receipt_vision catch block must not call normalizeGeminiError');
  totalTestsPassed += 3;

  console.log('  ✓ 5. Zero-media AiError classification & error privacy boundary verified');

  // ==========================================
  // 6. SERVER ACTION FORMDATA VALIDATION & PRE-READ BOUNDS (Finding 4)
  // ==========================================
  console.log('6. Testing Server Action FormData Validation 5-Case Contract & Pre-Read Bounds...');

  // Case 6.1: 0 files in FormData and no 'file' field -> RECEIPT_FILE_REQUIRED
  const emptyFormData = new FormData();
  const resEmpty = validateReceiptFormData(emptyFormData);
  assert.strictEqual(resEmpty.ok, false);
  if (!resEmpty.ok) {
    assert.strictEqual(resEmpty.error.code, 'RECEIPT_FILE_REQUIRED');
  }
  totalTestsPassed += 2;

  // Case 6.2: Non-File string value under 'file' -> RECEIPT_FILE_INVALID
  const stringFormData = new FormData();
  stringFormData.append('file', 'just-a-string-not-a-file');
  const resString = validateReceiptFormData(stringFormData);
  assert.strictEqual(resString.ok, false);
  if (!resString.ok) {
    assert.strictEqual(resString.error.code, 'RECEIPT_FILE_INVALID');
  }
  totalTestsPassed += 2;

  // Case 6.3: File only under non-'file' field name -> RECEIPT_FILE_INVALID
  const extraFileFormData = new FormData();
  extraFileFormData.append('attachment', new File([sampleJpeg], 'r1.jpg', { type: 'image/jpeg' }));
  const resExtraField = validateReceiptFormData(extraFileFormData);
  assert.strictEqual(resExtraField.ok, false);
  if (!resExtraField.ok) {
    assert.strictEqual(resExtraField.error.code, 'RECEIPT_FILE_INVALID');
  }
  totalTestsPassed += 2;

  // Case 6.4: Multiple files across fields -> RECEIPT_FILE_INVALID
  const multiFormData = new FormData();
  multiFormData.append('file', new File([sampleJpeg], 'r1.jpg', { type: 'image/jpeg' }));
  multiFormData.append('other_file', new File([samplePng], 'r2.png', { type: 'image/png' }));
  const resMulti = validateReceiptFormData(multiFormData);
  assert.strictEqual(resMulti.ok, false);
  if (!resMulti.ok) {
    assert.strictEqual(resMulti.error.code, 'RECEIPT_FILE_INVALID');
  }
  totalTestsPassed += 2;

  // Case 6.5: 0-byte file -> RECEIPT_FILE_REQUIRED
  const zeroByteFormData = new FormData();
  zeroByteFormData.append('file', new File([], 'empty.jpg', { type: 'image/jpeg' }));
  const resZero = validateReceiptFormData(zeroByteFormData);
  assert.strictEqual(resZero.ok, false);
  if (!resZero.ok) {
    assert.strictEqual(resZero.error.code, 'RECEIPT_FILE_REQUIRED');
  }
  totalTestsPassed += 2;

  // Case 6.6: File size > 4 MiB rejected BEFORE arrayBuffer -> RECEIPT_FILE_TOO_LARGE
  const oversizedFile = new File([new Uint8Array(PHASE_12B_MAX_RECEIPT_FILE_BYTES + 100)], 'huge.jpg', { type: 'image/jpeg' });
  const oversizedFormData = new FormData();
  oversizedFormData.append('file', oversizedFile);
  const resOversized = validateReceiptFormData(oversizedFormData);
  assert.strictEqual(resOversized.ok, false);
  if (!resOversized.ok) {
    assert.strictEqual(resOversized.error.code, 'RECEIPT_FILE_TOO_LARGE');
  }
  totalTestsPassed += 2;

  // Case 6.7: Valid file succeeds
  const validFormData = new FormData();
  validFormData.append('file', new File([sampleJpeg], 'receipt.jpg', { type: 'image/jpeg' }));
  const resValid = validateReceiptFormData(validFormData);
  assert.strictEqual(resValid.ok, true);
  totalTestsPassed += 1;

  console.log('  ✓ 6. Server Action FormData validation 5-case contract verified');

  // ==========================================
  // 7. SERVER ACTION ORCHESTRATION ORDER & PRECEDENCE (Findings 1, 2, 3, 4)
  // ==========================================
  console.log('7. Testing Server Action Orchestration Precedence & Lifecycle Matrix...');

  // Helper to create a tracked File instance that records ARRAY_BUFFER
  function createTrackedFile(bytes: Buffer | Uint8Array, name: string, type: string, onArrayBuffer: () => void): File {
    const rawFile = new File([bytes as BlobPart], name, { type });
    const originalArrayBuffer = rawFile.arrayBuffer.bind(rawFile);
    rawFile.arrayBuffer = async () => {
      onArrayBuffer();
      return originalArrayBuffer();
    };
    return rawFile;
  }

  // 7.1: Authenticated valid request executes in exact sequential order:
  // AUTH < VALIDATE < ARRAY_BUFFER < NORMALIZE < CREATE_ROUTER < CREATE_CREDENTIAL_RESOLVER < RESOLVE_CREDENTIAL < PROVIDER
  {
    const events: string[] = [];
    let routerCreated = 0;
    let resolverCreated = 0;
    let credentialResolved = 0;
    let providerExecuted = 0;

    const trackedValidFile = createTrackedFile(sampleJpeg, 'receipt.jpg', 'image/jpeg', () => {
      events.push('ARRAY_BUFFER');
    });
    const trackedValidFormData = new FormData();
    trackedValidFormData.append('file', trackedValidFile);

    const testMockRouter = new AiRouter({
      providers: [
        new GeminiProviderCore({
          clientFactory: () => ({
            models: {
              async generateContent(params) {
                events.push('PROVIDER');
                providerExecuted++;
                return {
                  text: JSON.stringify(validSampleOutput),
                  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
                };
              },
            },
          }),
        }),
      ],
    });

    const testMockCredentialProvider: AiCredentialProvider = {
      async resolveCredential() {
        events.push('RESOLVE_CREDENTIAL');
        credentialResolved++;
        return { value: 'AIzaSyFakeTestKey123456789' };
      },
    };

    const successActionRes = await executeAnalyzeReceiptAction(trackedValidFormData, {
      getUser: async () => {
        events.push('AUTH');
        return { user: { id: 'usr_test_123' }, error: null };
      },
      validateFormData: (fd) => {
        events.push('VALIDATE');
        return validateReceiptFormData(fd);
      },
      normalizeImage: async (b, m) => {
        events.push('NORMALIZE');
        return normalizeReceiptImage(b, m);
      },
      createRouter: () => {
        events.push('CREATE_ROUTER');
        routerCreated++;
        return testMockRouter;
      },
      createCredentialResolver: () => {
        events.push('CREATE_CREDENTIAL_RESOLVER');
        resolverCreated++;
        return testMockCredentialProvider;
      },
    });

    assert.strictEqual(successActionRes.ok, true);
    assert.deepStrictEqual(events, [
      'AUTH',
      'VALIDATE',
      'ARRAY_BUFFER',
      'NORMALIZE',
      'CREATE_ROUTER',
      'CREATE_CREDENTIAL_RESOLVER',
      'RESOLVE_CREDENTIAL',
      'PROVIDER',
    ]);
    assert.strictEqual(routerCreated, 1);
    assert.strictEqual(resolverCreated, 1);
    assert.strictEqual(credentialResolved, 1);
    assert.strictEqual(providerExecuted, 1);
    assert.ok(events.indexOf('NORMALIZE') < events.indexOf('CREATE_ROUTER'), 'Normalization must precede router creation');
    assert.ok(events.indexOf('CREATE_ROUTER') < events.indexOf('CREATE_CREDENTIAL_RESOLVER'), 'Router creation must precede credential resolver creation');
    assert.ok(events.indexOf('CREATE_CREDENTIAL_RESOLVER') < events.indexOf('RESOLVE_CREDENTIAL'), 'Credential resolver creation must precede credential resolution');
    assert.ok(events.indexOf('RESOLVE_CREDENTIAL') < events.indexOf('PROVIDER'), 'Credential resolution must precede provider invocation');

    if (successActionRes.ok) {
      assert.strictEqual(successActionRes.data.merchant, 'Starbucks Coffee');
      assert.strictEqual(successActionRes.data.amount, '85000');
      assert.strictEqual(successActionRes.data.canonical_amount, '85000.0000');
      assert.strictEqual(successActionRes.data.currency_code, 'VND');
    }
    totalTestsPassed += 12;
  }

  // 7.2: Unauthenticated request aborts at step 1 BEFORE validation, arrayBuffer, normalization, or AI infrastructure (Finding 4)
  {
    const events: string[] = [];
    let routerCreated = 0;
    let resolverCreated = 0;

    const trackedFile = createTrackedFile(sampleJpeg, 'receipt.jpg', 'image/jpeg', () => {
      events.push('ARRAY_BUFFER');
    });
    const fd = new FormData();
    fd.append('file', trackedFile);

    const anonActionRes = await executeAnalyzeReceiptAction(fd, {
      getUser: async () => {
        events.push('AUTH');
        return { user: null, error: null };
      },
      validateFormData: (form) => {
        events.push('VALIDATE');
        return validateReceiptFormData(form);
      },
      normalizeImage: async (b, m) => {
        events.push('NORMALIZE');
        return normalizeReceiptImage(b, m);
      },
      createRouter: () => {
        events.push('CREATE_ROUTER');
        routerCreated++;
        return {} as any;
      },
      createCredentialResolver: () => {
        events.push('CREATE_CREDENTIAL_RESOLVER');
        resolverCreated++;
        return {} as any;
      },
    });

    assert.strictEqual(anonActionRes.ok, false);
    if (!anonActionRes.ok) {
      assert.strictEqual(anonActionRes.error.code, 'AUTH_REQUIRED');
    }
    assert.deepStrictEqual(events, ['AUTH']);
    assert.strictEqual(routerCreated, 0, 'No router created on unauthenticated request');
    assert.strictEqual(resolverCreated, 0, 'No credential resolver created on unauthenticated request');
    totalTestsPassed += 4;
  }

  // 7.3: Authenticated oversized file aborts at step 2 BEFORE arrayBuffer, normalization, or AI infrastructure (Finding 4)
  {
    const events: string[] = [];
    let routerCreated = 0;
    let resolverCreated = 0;

    const oversizedBytes = new Uint8Array(PHASE_12B_MAX_RECEIPT_FILE_BYTES + 100);
    const trackedOversizedFile = createTrackedFile(oversizedBytes, 'huge.jpg', 'image/jpeg', () => {
      events.push('ARRAY_BUFFER');
    });
    const fd = new FormData();
    fd.append('file', trackedOversizedFile);

    const oversizedActionRes = await executeAnalyzeReceiptAction(fd, {
      getUser: async () => {
        events.push('AUTH');
        return { user: { id: 'usr_test_123' }, error: null };
      },
      validateFormData: (form) => {
        events.push('VALIDATE');
        return validateReceiptFormData(form);
      },
      normalizeImage: async (b, m) => {
        events.push('NORMALIZE');
        return normalizeReceiptImage(b, m);
      },
      createRouter: () => {
        events.push('CREATE_ROUTER');
        routerCreated++;
        return {} as any;
      },
      createCredentialResolver: () => {
        events.push('CREATE_CREDENTIAL_RESOLVER');
        resolverCreated++;
        return {} as any;
      },
    });

    assert.strictEqual(oversizedActionRes.ok, false);
    if (!oversizedActionRes.ok) {
      assert.strictEqual(oversizedActionRes.error.code, 'RECEIPT_FILE_TOO_LARGE');
    }
    assert.deepStrictEqual(events, ['AUTH', 'VALIDATE']);
    assert.strictEqual(routerCreated, 0, 'No router created on oversized file');
    assert.strictEqual(resolverCreated, 0, 'No credential resolver created on oversized file');
    totalTestsPassed += 4;
  }

  // 7.4: Image normalization failure creates zero AI / Credential infrastructure (Finding 2)
  {
    const events: string[] = [];
    let routerCreated = 0;
    let resolverCreated = 0;

    // Create a payload with JPEG signature header followed by corrupt garbage that fails decoding
    const corruptJpegBytes = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('CORRUPT_PAYLOAD_NOT_A_VALID_IMAGE_STREAM_FOR_SHARP_DECODER_TEST'),
    ]);
    const trackedCorruptFile = createTrackedFile(corruptJpegBytes, 'corrupt.jpg', 'image/jpeg', () => {
      events.push('ARRAY_BUFFER');
    });
    const fd = new FormData();
    fd.append('file', trackedCorruptFile);

    const corruptActionRes = await executeAnalyzeReceiptAction(fd, {
      getUser: async () => {
        events.push('AUTH');
        return { user: { id: 'usr_test_123' }, error: null };
      },
      validateFormData: (form) => {
        events.push('VALIDATE');
        return validateReceiptFormData(form);
      },
      normalizeImage: async (b, m) => {
        events.push('NORMALIZE');
        return normalizeReceiptImage(b, m);
      },
      createRouter: () => {
        events.push('CREATE_ROUTER');
        routerCreated++;
        return {} as any;
      },
      createCredentialResolver: () => {
        events.push('CREATE_CREDENTIAL_RESOLVER');
        resolverCreated++;
        return {} as any;
      },
    });

    assert.strictEqual(corruptActionRes.ok, false);
    if (!corruptActionRes.ok) {
      assert.strictEqual(corruptActionRes.error.code, 'RECEIPT_IMAGE_DECODE_FAILED');
    }
    assert.deepStrictEqual(events, ['AUTH', 'VALIDATE', 'ARRAY_BUFFER', 'NORMALIZE']);
    assert.strictEqual(routerCreated, 0, 'Zero router created on normalization failure');
    assert.strictEqual(resolverCreated, 0, 'Zero credential resolver created on normalization failure');
    totalTestsPassed += 4;
  }

  // 7.5: Invalid FormData envelope (missing file) aborts at validation (Finding 4)
  {
    const events: string[] = [];
    let routerCreated = 0;
    let resolverCreated = 0;

    const invalidActionRes = await executeAnalyzeReceiptAction(emptyFormData, {
      getUser: async () => {
        events.push('AUTH');
        return { user: { id: 'usr_test_123' }, error: null };
      },
      validateFormData: (form) => {
        events.push('VALIDATE');
        return validateReceiptFormData(form);
      },
      normalizeImage: async (b, m) => {
        events.push('NORMALIZE');
        return normalizeReceiptImage(b, m);
      },
      createRouter: () => {
        events.push('CREATE_ROUTER');
        routerCreated++;
        return {} as any;
      },
      createCredentialResolver: () => {
        events.push('CREATE_CREDENTIAL_RESOLVER');
        resolverCreated++;
        return {} as any;
      },
    });

    assert.strictEqual(invalidActionRes.ok, false);
    if (!invalidActionRes.ok) {
      assert.strictEqual(invalidActionRes.error.code, 'RECEIPT_FILE_REQUIRED');
    }
    assert.deepStrictEqual(events, ['AUTH', 'VALIDATE']);
    assert.strictEqual(routerCreated, 0, 'No router created on invalid FormData');
    assert.strictEqual(resolverCreated, 0, 'No credential resolver created on invalid FormData');
    totalTestsPassed += 4;
  }

  console.log('  ✓ 7. Server Action orchestration order and precedence verified');

  // ==========================================
  // 8. CLIENT / SERVER BOUNDARY SOURCE CODE AUDIT
  // ==========================================
  console.log('8. Testing Client / Server Module Boundary Source Isolation...');

  const indexPath = path.resolve('src/features/ai/receipt-vision/index.ts');
  const indexSource = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(!indexSource.includes('server-only'), 'index.ts must not import server-only');
  assert.ok(!indexSource.includes('./image'), 'index.ts must not re-export ./image');
  assert.ok(!indexSource.includes('./actions'), 'index.ts must not re-export ./actions');
  assert.ok(!indexSource.includes('./action-core'), 'index.ts must not re-export ./action-core');
  assert.ok(indexSource.includes('./constants'), 'index.ts must re-export ./constants');
  assert.ok(indexSource.includes('./types'), 'index.ts must re-export ./types');
  assert.ok(indexSource.includes('./components/ReceiptPicker'), 'index.ts must re-export ReceiptPicker');
  totalTestsPassed += 7;

  const serverPath = path.resolve('src/features/ai/receipt-vision/server.ts');
  const serverSource = fs.readFileSync(serverPath, 'utf-8');
  assert.ok(serverSource.includes("import 'server-only'"), "server.ts must contain import 'server-only'");
  totalTestsPassed += 1;

  const constantsPath = path.resolve('src/features/ai/receipt-vision/constants.ts');
  const constantsSource = fs.readFileSync(constantsPath, 'utf-8');
  assert.ok(!constantsSource.includes('server-only'), 'constants.ts must not import server-only');
  assert.ok(!constantsSource.includes('sharp'), 'constants.ts must not import sharp');
  assert.ok(constantsSource.includes('PHASE_12B_MAX_RECEIPT_FILE_BYTES = 4_194_304'), 'constants.ts must define 4 MiB cap');
  totalTestsPassed += 3;

  const pickerPath = path.resolve('src/features/ai/receipt-vision/components/ReceiptPicker.tsx');
  const pickerSource = fs.readFileSync(pickerPath, 'utf-8');
  assert.ok(!pickerSource.includes('../image'), 'ReceiptPicker must not import from ../image');
  assert.ok(pickerSource.includes('../constants'), 'ReceiptPicker must import from ../constants');
  assert.ok(!pickerSource.includes('err.message'), 'ReceiptPicker must not echo raw thrown error messages');
  totalTestsPassed += 3;

  console.log('  ✓ 8. Client / Server module boundary source isolation verified');

  console.log(`\n=== All Phase 12B-1 Receipt Vision Tests Passed Successfully! Total Assertions/Checks: ${totalTestsPassed} ===`);
}

runTests().catch((err) => {
  console.error('Test Suite Failure:', err);
  process.exit(1);
});
