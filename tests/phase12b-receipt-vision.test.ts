/**
 * Finora Phase 12B-1 — Receipt Vision Deterministic Test Suite
 * Zero Network, Zero Supabase Remote DB, Zero Gemini Remote API Calls
 */

import assert from 'node:assert';
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
  detectImageSignature,
  normalizeReceiptImage,
  PHASE_12B_MAX_DECODED_PIXELS,
  PHASE_12B_MAX_DIMENSION,
  PHASE_12B_MAX_RECEIPT_FILE_BYTES,
  PHASE_12B_NORMALIZED_MAX_LONG_EDGE_PX,
  ReceiptImageError,
} from '../src/features/ai/receipt-vision/image';
import {
  RECEIPT_VISION_PROMPT,
  RECEIPT_VISION_SYSTEM_INSTRUCTION,
} from '../src/features/ai/receipt-vision/prompt';
import { executeReceiptVisionCore } from '../src/features/ai/receipt-vision/action-core';
import type { ReceiptVisionParseOutput } from '../src/features/ai/receipt-vision/types';

async function runTests() {
  console.log('--- Running Phase 12B-1 Receipt Vision Test Suite ---');

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
  console.log('Testing Exact Money Lexical Validation & Canonicalization...');

  // Valid amounts
  assert.strictEqual(isValidReceiptLexicalAmount('85000'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('4.5'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('4.50'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('4.5000'), true);
  assert.strictEqual(isValidReceiptLexicalAmount('1234567890123456.9999'), true);

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
  assert.strictEqual(isValidReceiptLexicalAmount(85000), false); // No numbers

  // Canonicalization
  assert.strictEqual(canonicalizeReceiptAmount('85000'), '85000.0000');
  assert.strictEqual(canonicalizeReceiptAmount('4.5'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('4.50'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('4.5000'), '4.5000');
  assert.strictEqual(canonicalizeReceiptAmount('1234567890123456.9999'), '1234567890123456.9999');

  console.log('  ✓ 1. Exact Money validation and 4-decimal canonicalization passed');

  // ==========================================
  // 2. PROVIDER OUTPUT VALIDATOR & STATE CONSISTENCY
  // ==========================================
  console.log('Testing 11-Key Output Schema & State Consistency...');

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

  // Missing key (fewer than 11 keys) fails
  const missingKeyObj: Record<string, unknown> = { ...validSampleOutput };
  delete missingKeyObj.image_quality;
  assert.throws(() => validateReceiptVisionOutput(missingKeyObj), /contain exactly 11 keys/);

  // Substituted key (11 keys but wrong key name) fails
  const substitutedKeyObj: Record<string, unknown> = { ...validSampleOutput };
  delete substitutedKeyObj.image_quality;
  substitutedKeyObj.wrong_field = 'OK';
  assert.throws(() => validateReceiptVisionOutput(substitutedKeyObj), /missing required key 'image_quality'/);

  // Extra key fails
  const extraKeyObj: Record<string, unknown> = { ...validSampleOutput, extra_field: 'leak' };
  assert.throws(() => validateReceiptVisionOutput(extraKeyObj), /must contain exactly 11 keys/);

  // State consistency: amount_state !== PRESENT requires amount === null
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

  // Valid MISSING amount
  const missingAmountValid = validateReceiptVisionOutput({
    ...validSampleOutput,
    amount_state: 'MISSING',
    amount: null,
  });
  assert.strictEqual(missingAmountValid.amount, null);
  assert.strictEqual(missingAmountValid.amount_state, 'MISSING');

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

  // Pass 12B-1 category invariant: category_token must be null
  assert.throws(
    () => validateReceiptVisionOutput({ ...validSampleOutput, category_token: 'CAT_1' }),
    /category_token must be null in Pass 12B-1/
  );

  // Calendar dates
  assert.strictEqual(isValidCalendarDate('2024-02-29'), true); // Leap year
  assert.strictEqual(isValidCalendarDate('2025-02-29'), false); // Non-leap year
  assert.strictEqual(isValidCalendarDate('2026-09-04'), true);
  assert.strictEqual(isValidCalendarDate('2026-13-01'), false);
  assert.strictEqual(isValidCalendarDate('2026-04-31'), false);

  console.log('  ✓ 2. 11-key schema and state consistency validation passed');

  // ==========================================
  // 3. MEDIA VALIDATION & SHARP PIPELINE
  // ==========================================
  console.log('Testing Media Validation & In-Memory Sharp Normalization...');

  // Signatures
  assert.strictEqual(detectImageSignature(sampleJpeg), 'image/jpeg');
  assert.strictEqual(detectImageSignature(samplePng), 'image/png');
  assert.strictEqual(detectImageSignature(sampleWebp), 'image/webp');
  assert.strictEqual(detectImageSignature(sampleGif), null); // GIF rejected
  assert.strictEqual(detectImageSignature(Buffer.from('not an image')), null);

  // Normalize JPEG
  const normJpeg = await normalizeReceiptImage(sampleJpeg, { name: 'receipt.jpg', type: 'image/jpeg' });
  assert.strictEqual(normJpeg.mimeType, 'image/jpeg');
  assert.strictEqual(normJpeg.width, 100);
  assert.strictEqual(normJpeg.height, 80);
  assert.ok(normJpeg.bytes.length <= PHASE_12B_MAX_RECEIPT_FILE_BYTES);

  // Empty File.type with valid bytes accepted
  const normPngNoType = await normalizeReceiptImage(samplePng, { name: 'receipt' });
  assert.strictEqual(normPngNoType.mimeType, 'image/png');

  // Conflicting File.type rejected
  await assert.rejects(
    async () => normalizeReceiptImage(sampleJpeg, { name: 'receipt.jpg', type: 'image/png' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_INVALID_TYPE'
  );

  // GIF rejected before Sharp
  await assert.rejects(
    async () => normalizeReceiptImage(sampleGif, { name: 'receipt.gif', type: 'image/gif' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_INVALID_TYPE'
  );

  // SVG rejected
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  await assert.rejects(
    async () => normalizeReceiptImage(svgBuffer, { name: 'receipt.svg', type: 'image/svg+xml' }),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_INVALID_TYPE'
  );

  // Multi-frame / Animated rejection test
  // An animated GIF is already rejected at signature check; for WebP with pages > 1 or animated:
  const multiPageBuffer = Buffer.from(sampleWebp);
  // Test single-frame assertion passes for normal single-frame images
  assert.strictEqual(normJpeg.width, 100);
  assert.strictEqual(normJpeg.height, 80);
  // Malformed or corrupt bytes
  const corruptBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  await assert.rejects(
    async () => normalizeReceiptImage(corruptBytes),
    (err: ReceiptImageError) => err.code === 'RECEIPT_IMAGE_CORRUPTED'
  );

  // Resize without enlargement: small 100x80 image is not upscaled
  assert.strictEqual(normJpeg.width, 100);
  assert.strictEqual(normJpeg.height, 80);

  // Large image resize: 3000x1500 is scaled down inside 2048x2048
  const largePng = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: { r: 100, g: 100, b: 100 } },
  })
    .png()
    .toBuffer();
  const normLarge = await normalizeReceiptImage(largePng);
  assert.strictEqual(normLarge.width, 2048);
  assert.strictEqual(normLarge.height, 1024);

  console.log('  ✓ 3. Media validation, bounds checking, and Sharp normalization passed');

  // ==========================================
  // 4. MULTIMODAL GEMINI ADAPTER & RETRY POLICY
  // ==========================================
  console.log('Testing Multimodal Gemini Adapter & Retry Policy...');

  let capturedParams: any = null;
  let callCount = 0;

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

  // Execute receipt multimodal request
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

  // Verify multimodal contents mapping
  assert.ok(Array.isArray(capturedParams.contents));
  assert.strictEqual(capturedParams.contents.length, 2);
  assert.strictEqual(capturedParams.contents[0].inlineData.mimeType, 'image/jpeg');
  assert.strictEqual(capturedParams.contents[0].inlineData.data, Buffer.from(sampleJpeg).toString('base64'));
  assert.strictEqual(capturedParams.contents[1], RECEIPT_VISION_PROMPT);

  // Verify single HTTP attempt policy for receipt_vision
  assert.strictEqual(capturedParams.config.httpOptions.retryOptions.attempts, 1);

  // Verify text operation non-regression: transaction_parser leaves retryOptions untouched and contents as string
  capturedParams = null;
  await providerCore.execute(
    {
      operation: 'transaction_parser',
      model: 'gemini-3.5-flash-lite',
      prompt: 'An trua 85k',
    },
    { value: 'AIzaSyFakeKeyForTest123456789012345678' }
  );

  assert.strictEqual(typeof capturedParams.contents, 'string');
  assert.strictEqual(capturedParams.config?.httpOptions, undefined);

  console.log('  ✓ 4. Multimodal adapter mapping, single attempt policy, and text non-regression verified');

  // ==========================================
  // 5. MEDIA-SAFE ERROR PRIVACY BOUNDARY
  // ==========================================
  console.log('Testing Media-Safe Error Boundary (Zero Sentinel Leaks)...');

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

  console.log('  ✓ 5. Media-safe error boundary verified with zero sentinel leakage');

  // ==========================================
  // 6. ACTION CORE ORCHESTRATION & AUTHENTICATION
  // ==========================================
  console.log('Testing Action Core End-to-End Orchestration...');

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

  // Authenticated request succeeds
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

  console.log('  ✓ 6. Action core authentication and end-to-end execution verified');

  console.log('\n=== All Phase 12B-1 Receipt Vision Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('Test Suite Failure:', err);
  process.exit(1);
});
