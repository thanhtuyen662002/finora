/**
 * Finora Phase 12B-1 — Receipt Vision Deterministic Test Suite
 * Corrective Pass 1: Client/Server Boundary, Media Cardinality, Upload Authority, Error Contract & Image Security
 *
 * Zero Network, Zero Supabase Remote DB, Zero Gemini Remote API Calls
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { AiError } from '../src/lib/ai/errors';
import { GeminiProviderCore, type GeminiClientLike } from '../src/lib/ai/providers/gemini-core';
import { AiRouter } from '../src/lib/ai/router';
import type {
  AiCredential,
  AiCredentialProvider,
  AiInlineMediaPart,
  AiStructuredRequest,
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
  detectImageSignature,
  normalizeReceiptImage,
  ReceiptImageError,
} from '../src/features/ai/receipt-vision/image';
import {
  RECEIPT_VISION_PROMPT,
  RECEIPT_VISION_SYSTEM_INSTRUCTION,
} from '../src/features/ai/receipt-vision/prompt';
import { executeReceiptVisionCore } from '../src/features/ai/receipt-vision/action-core';
import { validateReceiptFormData } from '../src/features/ai/receipt-vision/actions';
import type { ReceiptVisionParseOutput } from '../src/features/ai/receipt-vision/types';

async function runTests() {
  console.log('--- Running Phase 12B-1 Receipt Vision Test Suite (Corrective Pass 1) ---');
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
  assert.strictEqual(isValidReceiptLexicalAmount('+4.50'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('1e6'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('85,000'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('$4.50'), false);
  assert.strictEqual(isValidReceiptLexicalAmount('4.50₫'), false);
  assert.strictEqual(isValidReceiptLexicalAmount(' 85000 '), false);
  assert.strictEqual(isValidReceiptLexicalAmount('4.12345'), false); // Scale > 4
  assert.strictEqual(isValidReceiptLexicalAmount(''), false);
  assert.strictEqual(isValidReceiptLexicalAmount(null), false);
  assert.strictEqual(isValidReceiptLexicalAmount(85000), false);
  totalTestsPassed += 15;

  // Canonicalization
  assert.strictEqual(canonicalizeReceiptAmount('85000'), '85000.0000');
  assert.strictEqual(canonicalizeReceiptAmount('4.5'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('4.50'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('4.5000'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('1234567890123456.9999'), '1234567890123456.9999');
  totalTestsPassed += 5;

  console.log('  ✓ 1. Exact Money validation and 4-decimal canonicalization passed');

  // ==========================================
  // 2. PROVIDER OUTPUT VALIDATOR & STATE CONSISTENCY
  // ==========================================
  console.log('2. Testing 11-Key Output Schema & State Consistency...');

  const validSampleOutput: ReceiptVisionParseOutput = {
    document_kind: 'PURCHASE_RECEIPT',
    merchant: 'Starbucks Coffee',
    occurred_on: '2026-09-04',
    occurred_on_state: 'PRESENT',
    amount: '85000',
    amount_state: 'PRESENT',
    currency_code: 'VND',
    currency_state: 'PRESENT',
    category_token: null,
    note: 'Cà phê sáng',
    image_quality: 'OK',
  };

  const validated = validateReceiptVisionOutput(validSampleOutput);
  assert.deepStrictEqual(validated, validSampleOutput);
  assert.strictEqual(EXPECTED_RECEIPT_VISION_OUTPUT_KEYS.length, 11);
  totalTestsPassed += 2;

  // Missing key fails
  const missingKeyObj: Record<string, unknown> = { ...validSampleOutput };
  delete missingKeyObj.image_quality;
  assert.throws(() => validateReceiptVisionOutput(missingKeyObj), /contain exactly 11 keys/);
  totalTestsPassed += 1;

  // Substituted key fails
  const substitutedKeyObj: Record<string, unknown> = { ...validSampleOutput };
  delete substitutedKeyObj.image_quality;
  substitutedKeyObj.wrong_field = 'OK';
  assert.throws(() => validateReceiptVisionOutput(substitutedKeyObj), /missing required key 'image_quality'/);
  totalTestsPassed += 1;

  // Extra key fails
  const extraKeyObj: Record<string, unknown> = { ...validSampleOutput, extra_field: 'leak' };
  assert.throws(() => validateReceiptVisionOutput(extraKeyObj), /must contain exactly 11 keys/);
  totalTestsPassed += 1;

  // State consistency: amount_state
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, amount_state: 'MISSING', amount: '85000' }),
    /amount_state is 'MISSING' but amount is not null/
  );
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, amount_state: 'AMBIGUOUS', amount: '85000' }),
    /amount_state is 'AMBIGUOUS' but amount is not null/
  );
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, amount_state: 'PRESENT', amount: null }),
    /amount_state is 'PRESENT' but amount is invalid or null/
  );
  totalTestsPassed += 3;

  // Valid MISSING amount
  const missingAmountValid = validateReceiptVisionOutput({
    ...validSampleOutput,
    amount_state: 'MISSING',
    amount: null,
  });
  assert.strictEqual(missingAmountValid.amount, null);
  assert.strictEqual(missingAmountValid.amount_state, 'MISSING');
  totalTestsPassed += 2;

  // State consistency: occurred_on_state
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, occurred_on_state: 'MISSING', occurred_on: '2026-09-04' }),
    /occurred_on_state is 'MISSING' but occurred_on is not null/
  );
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, occurred_on_state: 'PRESENT', occurred_on: null }),
    /occurred_on_state is 'PRESENT' but occurred_on is not a valid/
  );
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, occurred_on_state: 'PRESENT', occurred_on: '2026-02-30' }),
    /occurred_on_state is 'PRESENT' but occurred_on is not a valid/
  );
  totalTestsPassed += 3;

  // State consistency: currency_state
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, currency_state: 'UNSUPPORTED', currency_code: 'USD' }),
    /currency_state is 'UNSUPPORTED' but currency_code is not null/
  );
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, currency_state: 'PRESENT', currency_code: null }),
    /currency_state is 'PRESENT' but currency_code is not supported or null/
  );
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, currency_state: 'PRESENT', currency_code: 'GBP' as any }),
    /currency_state is 'PRESENT' but currency_code is not supported or null/
  );
  totalTestsPassed += 3;

  // Pass 12B-1 category invariant: category_token must be null
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, category_token: 'CAT_1' }),
    /category_token must be null in Pass 12B-1/
  );
  totalTestsPassed += 1;

  // Calendar dates validation
  assert.strictEqual(isValidCalendarDate('2024-02-29'), true); // Leap year
  assert.strictEqual(isValidCalendarDate('2025-02-29'), false); // Non-leap year
  assert.strictEqual(isValidCalendarDate('2026-09-04'), true);
  assert.strictEqual(isValidCalendarDate('2026-13-01'), false);
  assert.strictEqual(isValidCalendarDate('2026-04-31'), false);
  totalTestsPassed += 5;

  console.log('  ✓ 2. 11-key schema and state consistency validation passed');

  // ==========================================
  // 3. IMAGE SECURITY & SHARP NORMALIZATION PIPELINE
  // ==========================================
  console.log('3. Testing Image Security & Sharp Normalization Matrix...');

  // Signatures
  assert.strictEqual(detectImageSignature(sampleJpeg), 'image/jpeg');
  assert.strictEqual(detectImageSignature(samplePng), 'image/png');
  assert.strictEqual(detectImageSignature(sampleWebp), 'image/webp');
  assert.strictEqual(detectImageSignature(sampleGif), null);
  assert.strictEqual(detectImageSignature(Buffer.from('not an image')), null);
  totalTestsPassed += 5;

  // Input byte bounds: empty input (0 bytes) rejected -> RECEIPT_FILE_REQUIRED
  await assert.rejects(
    async () => normalizeReceiptImage(Buffer.alloc(0)),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_REQUIRED'
  );
  totalTestsPassed += 1;

  // Input byte bounds: oversized input (> 4 MiB) rejected -> RECEIPT_FILE_TOO_LARGE
  const oversizedFakeBuffer = Buffer.alloc(PHASE_12B_MAX_RECEIPT_FILE_BYTES + 1);
  oversizedFakeBuffer[0] = 0xff;
  oversizedFakeBuffer[1] = 0xd8;
  oversizedFakeBuffer[2] = 0xff;
  await assert.rejects(
    async () => normalizeReceiptImage(oversizedFakeBuffer),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TOO_LARGE'
  );
  totalTestsPassed += 1;

  // Normalize JPEG
  const normJpeg = await normalizeReceiptImage(sampleJpeg, { name: 'receipt.jpg', type: 'image/jpeg' });
  assert.strictEqual(normJpeg.mimeType, 'image/jpeg');
  assert.strictEqual(normJpeg.width, 100);
  assert.strictEqual(normJpeg.height, 80);
  assert.ok(normJpeg.bytes.length <= PHASE_12B_MAX_RECEIPT_FILE_BYTES);
  totalTestsPassed += 4;

  // Empty File.type with valid binary accepted
  const normPngNoType = await normalizeReceiptImage(samplePng, { name: 'receipt' });
  assert.strictEqual(normPngNoType.mimeType, 'image/png');
  totalTestsPassed += 1;

  // Conflicting File.type rejected -> RECEIPT_FILE_TYPE_UNSUPPORTED
  await assert.rejects(
    async () => normalizeReceiptImage(sampleJpeg, { name: 'receipt.jpg', type: 'image/png' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // Invalid File.type rejected -> RECEIPT_FILE_TYPE_UNSUPPORTED
  await assert.rejects(
    async () => normalizeReceiptImage(sampleJpeg, { name: 'receipt.jpg', type: 'image/bmp' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // GIF rejected before Sharp -> RECEIPT_FILE_TYPE_UNSUPPORTED
  await assert.rejects(
    async () => normalizeReceiptImage(sampleGif, { name: 'receipt.gif', type: 'image/gif' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // SVG rejected -> RECEIPT_FILE_TYPE_UNSUPPORTED
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  await assert.rejects(
    async () => normalizeReceiptImage(svgBuffer, { name: 'receipt.svg', type: 'image/svg+xml' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_FILE_TYPE_UNSUPPORTED'
  );
  totalTestsPassed += 1;

  // Real Multi-frame / Animated WebP rejection test
  // Construct a deterministic VP8X animated WebP buffer with Animation flag set
  const animatedWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // 'RIFF'
    0x24, 0x00, 0x00, 0x00, // Size
    0x57, 0x45, 0x42, 0x50, // 'WEBP'
    0x56, 0x50, 0x38, 0x58, // 'VP8X'
    0x0a, 0x00, 0x00, 0x00, // Chunk size 10
    0x02,                   // Flags: bit 1 (0x02) = Animation flag
    0x00, 0x00, 0x00,       // Reserved
    0x63, 0x00, 0x00,       // Canvas width (100 - 1)
    0x4f, 0x00, 0x00,       // Canvas height (80 - 1)
    0x41, 0x4e, 0x49, 0x4d, // 'ANIM'
    0x06, 0x00, 0x00, 0x00, // ANIM chunk size 6
    0x00, 0x00, 0x00, 0x00, // Background color
    0x00, 0x00,             // Loop count
  ]);

  await assert.rejects(
    async () => normalizeReceiptImage(animatedWebpBuffer),
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
  assert.strictEqual(normJpeg.width, 100);
  assert.strictEqual(normJpeg.height, 80);
  totalTestsPassed += 2;

  // Large image resize: 3000x1500 is scaled down inside 2048x2048 (preserving aspect ratio to 2048x1024)
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

  // EXIF Auto-orientation & Metadata stripping
  const exifJpeg = await sharp({
    create: { width: 120, height: 60, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .withMetadata({ orientation: 6 }) // Orientation 6 = rotate 90 deg clockwise
    .jpeg()
    .toBuffer();

  const normExif = await normalizeReceiptImage(exifJpeg);
  // Rotated 90 degrees: 120x60 -> 60x120
  assert.strictEqual(normExif.width, 60);
  assert.strictEqual(normExif.height, 120);

  // Check that EXIF metadata is stripped from normalized output
  const normExifMeta = await sharp(normExif.bytes).metadata();
  assert.strictEqual(normExifMeta.orientation, undefined);
  assert.strictEqual(normExifMeta.exif, undefined);
  totalTestsPassed += 4;

  console.log('  ✓ 3. Image security matrix, bounded normalization, and metadata stripping passed');

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
          media: undefined,
        },
        { value: 'AIzaSyFakeKeyForTest123456789012345678' }
      ),
    (err: AiError) => err.code === 'AI_INVALID_REQUEST'
  );
  assert.strictEqual(callCount, 0);
  totalTestsPassed += 2;

  // Case 4.3: Receipt + empty media array [] -> AI_INVALID_REQUEST, callCount = 0
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

  // Case 4.4: Receipt + >1 media parts -> AI_INVALID_REQUEST, callCount = 0
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

  // Case 4.5: Receipt + invalid runtime MIME (e.g. image/svg+xml cast) -> AI_INVALID_REQUEST, callCount = 0
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
  // 5. MEDIA-SAFE ERROR PRIVACY BOUNDARY
  // ==========================================
  console.log('5. Testing Media-Safe Error Boundary (Zero Sentinel Leaks)...');

  const base64Sentinel = 'SECRET_BASE64_IMAGE_BYTES_MUST_NEVER_LEAK_INTO_ERROR';
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
    assert.ok(!err.message.includes(base64Sentinel));
    assert.ok(!JSON.stringify(err.toJSON()).includes(base64Sentinel));
    assert.strictEqual(err.message, 'Gemini authentication failed during receipt vision analysis.');
  }
  totalTestsPassed += 5;

  console.log('  ✓ 5. Media-safe error boundary verified with zero sentinel leakage');

  // ==========================================
  // 6. SERVER ACTION FORMDATA VALIDATION & PRE-READ BOUNDS
  // ==========================================
  console.log('6. Testing Server Action FormData Validation & Auth Precedence...');

  // 6.1: 0 files in FormData -> RECEIPT_FILE_REQUIRED
  const emptyFormData = new FormData();
  const resEmpty = validateReceiptFormData(emptyFormData);
  assert.strictEqual(resEmpty.ok, false);
  if (!resEmpty.ok) {
    assert.strictEqual(resEmpty.error.code, 'RECEIPT_FILE_REQUIRED');
  }
  totalTestsPassed += 2;

  // 6.2: Multiple files in FormData -> RECEIPT_FILE_INVALID
  const multiFormData = new FormData();
  multiFormData.append('file', new File([sampleJpeg], 'r1.jpg', { type: 'image/jpeg' }));
  multiFormData.append('file', new File([samplePng], 'r2.png', { type: 'image/png' }));
  const resMulti = validateReceiptFormData(multiFormData);
  assert.strictEqual(resMulti.ok, false);
  if (!resMulti.ok) {
    assert.strictEqual(resMulti.error.code, 'RECEIPT_FILE_INVALID');
  }
  totalTestsPassed += 2;

  // 6.3: Extra file under different field -> RECEIPT_FILE_INVALID
  const extraFileFormData = new FormData();
  extraFileFormData.append('file', new File([sampleJpeg], 'r1.jpg', { type: 'image/jpeg' }));
  extraFileFormData.append('other_file', new File([samplePng], 'r2.png', { type: 'image/png' }));
  const resExtra = validateReceiptFormData(extraFileFormData);
  assert.strictEqual(resExtra.ok, false);
  if (!resExtra.ok) {
    assert.strictEqual(resExtra.error.code, 'RECEIPT_FILE_INVALID');
  }
  totalTestsPassed += 2;

  // 6.4: Non-File string value under 'file' -> RECEIPT_FILE_INVALID
  const stringFormData = new FormData();
  stringFormData.append('file', 'just-a-string-not-a-file');
  const resString = validateReceiptFormData(stringFormData);
  assert.strictEqual(resString.ok, false);
  if (!resString.ok) {
    assert.strictEqual(resString.error.code, 'RECEIPT_FILE_REQUIRED'); // No file objects found
  }
  totalTestsPassed += 2;

  // 6.5: 0-byte file -> RECEIPT_FILE_REQUIRED
  const zeroByteFormData = new FormData();
  zeroByteFormData.append('file', new File([], 'empty.jpg', { type: 'image/jpeg' }));
  const resZero = validateReceiptFormData(zeroByteFormData);
  assert.strictEqual(resZero.ok, false);
  if (!resZero.ok) {
    assert.strictEqual(resZero.error.code, 'RECEIPT_FILE_REQUIRED');
  }
  totalTestsPassed += 2;

  // 6.6: File size > 4 MiB rejected BEFORE arrayBuffer -> RECEIPT_FILE_TOO_LARGE
  const oversizedFile = new File([new Uint8Array(PHASE_12B_MAX_RECEIPT_FILE_BYTES + 100)], 'huge.jpg', { type: 'image/jpeg' });
  const oversizedFormData = new FormData();
  oversizedFormData.append('file', oversizedFile);
  const resOversized = validateReceiptFormData(oversizedFormData);
  assert.strictEqual(resOversized.ok, false);
  if (!resOversized.ok) {
    assert.strictEqual(resOversized.error.code, 'RECEIPT_FILE_TOO_LARGE');
  }
  totalTestsPassed += 2;

  // 6.7: Valid file succeeds
  const validFormData = new FormData();
  validFormData.append('file', new File([sampleJpeg], 'receipt.jpg', { type: 'image/jpeg' }));
  const resValid = validateReceiptFormData(validFormData);
  assert.strictEqual(resValid.ok, true);
  totalTestsPassed += 1;

  // Action Core Orchestration & Auth Isolation
  const mockRouter = new AiRouter({
    providers: [
      new GeminiProviderCore({
        clientFactory: () => mockClient,
      }),
    ],
  });

  const mockCredentialProvider: AiCredentialProvider = {
    async resolveCredential() {
      return { value: 'AIzaSyFakeTestKey123456789' };
    },
  };

  // Anonymous request fails with AUTH_REQUIRED before any normalization
  const anonResult = await executeReceiptVisionCore(
    sampleJpeg,
    { name: 'receipt.jpg', type: 'image/jpeg', size: sampleJpeg.length },
    null,
    {
      router: mockRouter,
      credentialProvider: mockCredentialProvider,
      normalizeImage: normalizeReceiptImage,
    }
  );

  assert.strictEqual(anonResult.ok, false);
  if (!anonResult.ok) {
    assert.strictEqual(anonResult.error.code, 'AUTH_REQUIRED');
  }
  totalTestsPassed += 2;

  // Authenticated request succeeds end-to-end
  const authResult = await executeReceiptVisionCore(
    sampleJpeg,
    { name: 'receipt.jpg', type: 'image/jpeg', size: sampleJpeg.length },
    { id: 'usr_test_123' },
    {
      router: mockRouter,
      credentialProvider: mockCredentialProvider,
      normalizeImage: normalizeReceiptImage,
    }
  );

  assert.strictEqual(authResult.ok, true);
  if (authResult.ok) {
    assert.strictEqual(authResult.data.document_kind, 'PURCHASE_RECEIPT');
    assert.strictEqual(authResult.data.merchant, 'Starbucks Coffee');
    assert.strictEqual(authResult.data.amount, '85000');
    assert.strictEqual(authResult.data.canonical_amount, '85000.0000');
    assert.strictEqual(authResult.data.currency_code, 'VND');
    assert.strictEqual(authResult.data.category_token, null);
    assert.strictEqual(authResult.provider, 'gemini');
  }
  totalTestsPassed += 8;

  console.log('  ✓ 6. Server Action FormData validation, auth precedence, and core execution passed');

  // ==========================================
  // 7. CLIENT / SERVER BOUNDARY SOURCE CODE AUDIT
  // ==========================================
  console.log('7. Testing Client / Server Module Boundary Source Isolation...');

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

  console.log('  ✓ 7. Client / Server module boundary source isolation verified');

  console.log(`\n=== All Phase 12B-1 Receipt Vision Tests Passed Successfully! Total Assertions/Checks: ${totalTestsPassed} ===`);
}

runTests().catch((err) => {
  console.error('Test Suite Failure:', err);
  process.exit(1);
});
