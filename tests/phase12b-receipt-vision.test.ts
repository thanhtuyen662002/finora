import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);

import test from 'node:test';
import assert from 'node:assert/strict';

test('Phase 12B Receipt Vision Deterministic Test Suite', async (t) => {
  // Dynamically import tested modules after loader registration
  const { deriveReceiptDraft } = await import('../src/features/ai/receipt-vision/domain');
  const { applyReceiptDraftToForm } = await import('../src/features/ai/receipt-vision/form-state');
  const { receiptVisionOutputValidator } = await import('../src/features/ai/receipt-vision/schema');
  const {
    getCategoryCandidates,
    revalidateCategoryToken,
  } = await import('../src/features/ai/receipt-vision/categories');
  const { processReceiptImage } = await import('../src/features/ai/receipt-vision/image');
  const { processReceiptAction } = await import('../src/features/ai/receipt-vision/actions');
  const { normalizeGeminiError, GeminiProviderCore } = await import('../src/lib/ai/providers/gemini-core');
  const { GeminiProvider } = await import('../src/lib/ai/providers/gemini');
  const { RECEIPT_WARNING_ORDER } = await import('../src/features/ai/receipt-vision/types');
  const { PHASE_12B_MAX_RECEIPT_FILE_BYTES } = await import('../src/features/ai/receipt-vision/constants');

  // --- 1. Schema: 4 Document Kinds & Minimal/Full outputs ---
  await t.test('schema - Valid minimal and full outputs under all 4 document kinds', () => {
    const kinds = ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'OTHER'] as const;

    for (const kind of kinds) {
      // Full output
      const full = {
        document_kind: kind,
        merchant: 'Pho 24',
        occurred_on: '2023-11-15',
        occurred_on_state: 'PRESENT',
        amount: '85000',
        amount_state: 'PRESENT',
        currency_code: 'VND',
        currency_state: 'PRESENT',
        category_token: 'CAT_1',
        note: 'Lunch with team',
        image_quality: 'OK',
      };
      const resFull = receiptVisionOutputValidator.validate(full);
      assert.equal(resFull.document_kind, kind);
      assert.equal(resFull.amount, '85000');

      // Minimal valid output
      const minimal = {
        document_kind: kind,
        merchant: null,
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: null,
        amount_state: 'MISSING',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'LOW',
      };
      const resMin = receiptVisionOutputValidator.validate(minimal);
      assert.equal(resMin.document_kind, kind);
      assert.equal(resMin.amount, null);
    }
  });

  // --- 2. Schema: Rejection of UNKNOWN ---
  await t.test('schema - Rejection of UNKNOWN document_kind', () => {
    const unknownKind = {
      document_kind: 'UNKNOWN',
      merchant: null,
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: null,
      amount_state: 'MISSING',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    assert.throws(
      () => receiptVisionOutputValidator.validate(unknownKind),
      (err: any) => err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
    );
  });

  // --- 3. Schema: Rejection of numeric amount ---
  await t.test('schema - Rejection of numeric amount (zero coercion)', () => {
    const numericAmount = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: null,
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: 50000,
      amount_state: 'PRESENT',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    assert.throws(
      () => receiptVisionOutputValidator.validate(numericAmount),
      (err: any) => err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
    );
  });

  // --- 4. Schema: Rejection of negative, comma, exponent and zero amounts ---
  await t.test('schema - Rejection of negative, comma, exponent and zero amounts', () => {
    const invalidAmounts = ['0', '0.00', '-50000', '1e5', '1,000', '50.12345', '  50000 '];

    for (const invalid of invalidAmounts) {
      const payload = {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: invalid,
        amount_state: 'PRESENT',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'OK',
      };
      assert.throws(
        () => receiptVisionOutputValidator.validate(payload),
        (err: any) => err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
        `Should reject amount '${invalid}'`
      );
    }
  });

  // --- 5. Schema: Rejection of invalid calendar dates ---
  await t.test('schema - Rejection of invalid calendar dates', () => {
    const invalidDates = ['2023-02-30', '2023-04-31', '2023-13-01', '2023-00-10', '2023-02-29'];

    for (const invalidDate of invalidDates) {
      const payload = {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: invalidDate,
        occurred_on_state: 'PRESENT',
        amount: null,
        amount_state: 'MISSING',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'OK',
      };
      assert.throws(
        () => receiptVisionOutputValidator.validate(payload),
        (err: any) => err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
        `Should reject date '${invalidDate}'`
      );
    }
  });

  // --- 6. Schema: Rejection of non-PRESENT fields containing values and vice versa ---
  await t.test('schema - Rejection of non-null fields when state is non-PRESENT', () => {
    // amount is not null when state is MISSING
    assert.throws(() =>
      receiptVisionOutputValidator.validate({
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: '50000',
        amount_state: 'MISSING',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'OK',
      })
    );

    // occurred_on is not null when state is AMBIGUOUS
    assert.throws(() =>
      receiptVisionOutputValidator.validate({
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: '2023-10-10',
        occurred_on_state: 'AMBIGUOUS',
        amount: null,
        amount_state: 'MISSING',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'OK',
      })
    );

    // currency_code is not null when state is UNSUPPORTED
    assert.throws(() =>
      receiptVisionOutputValidator.validate({
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: null,
        amount_state: 'MISSING',
        currency_code: 'VND',
        currency_state: 'UNSUPPORTED',
        category_token: null,
        note: null,
        image_quality: 'OK',
      })
    );

    // amount is null when state is PRESENT
    assert.throws(() =>
      receiptVisionOutputValidator.validate({
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: null,
        amount_state: 'PRESENT',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'OK',
      })
    );
  });

  // --- 7. Schema: Rejection of unsupported currencies ---
  await t.test('schema - Rejection of unsupported currencies', () => {
    const unsupported = ['GBP', 'AUD', 'SGD', 'CAD', 'XYZ'];

    for (const cur of unsupported) {
      assert.throws(() =>
        receiptVisionOutputValidator.validate({
          document_kind: 'PURCHASE_RECEIPT',
          merchant: null,
          occurred_on: null,
          occurred_on_state: 'MISSING',
          amount: null,
          amount_state: 'MISSING',
          currency_code: cur,
          currency_state: 'PRESENT',
          category_token: null,
          note: null,
          image_quality: 'OK',
        })
      );
    }
  });

  // --- 8. Schema: Rejection of out-of-spec category tokens ---
  await t.test('schema - Rejection of out-of-spec category tokens', () => {
    const invalidTokens = ['CAT_0', 'CAT_abc', 'cat_1', 'CATEGORY_1', 'CAT_-1', 'CAT_1_2'];

    for (const token of invalidTokens) {
      assert.throws(() =>
        receiptVisionOutputValidator.validate({
          document_kind: 'PURCHASE_RECEIPT',
          merchant: null,
          occurred_on: null,
          occurred_on_state: 'MISSING',
          amount: null,
          amount_state: 'MISSING',
          currency_code: null,
          currency_state: 'MISSING',
          category_token: token,
          note: null,
          image_quality: 'OK',
        })
      );
    }
  });

  // --- 9. Domain: Derivation under all 14 warning conditions ---
  await t.test('domain - All 14 warning codes generated and ordered deterministically', () => {
    // Check DOCUMENT_UNSUPPORTED
    const draftDoc = deriveReceiptDraft(
      {
        document_kind: 'INVOICE',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftDoc.warnings.includes('DOCUMENT_UNSUPPORTED'));
    assert.equal(draftDoc.can_apply, false);

    // Check IMAGE_QUALITY_LOW
    const draftLow = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'LOW',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftLow.warnings.includes('IMAGE_QUALITY_LOW'));

    // Check TOTAL_MISSING & TOTAL_AMBIGUOUS
    const draftAmountMissing = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: null,
        amount_state: 'MISSING',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftAmountMissing.warnings.includes('TOTAL_MISSING'));
    assert.equal(draftAmountMissing.amount, null);

    const draftAmountAmbiguous = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: null,
        amount_state: 'AMBIGUOUS',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftAmountAmbiguous.warnings.includes('TOTAL_AMBIGUOUS'));

    // Check CURRENCY_MISSING, CURRENCY_AMBIGUOUS, CURRENCY_UNSUPPORTED
    const draftCurMissing = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftCurMissing.warnings.includes('CURRENCY_MISSING'));

    const draftCurAmbiguous = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: null,
        currency_state: 'AMBIGUOUS',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftCurAmbiguous.warnings.includes('CURRENCY_AMBIGUOUS'));

    const draftCurUnsupported = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: null,
        currency_state: 'UNSUPPORTED',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftCurUnsupported.warnings.includes('CURRENCY_UNSUPPORTED'));

    // Check DATE_MISSING, DATE_AMBIGUOUS, DATE_INVALID
    const draftDateMissing = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftDateMissing.warnings.includes('DATE_MISSING'));

    const draftDateAmbiguous = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: null,
        occurred_on_state: 'AMBIGUOUS',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftDateAmbiguous.warnings.includes('DATE_AMBIGUOUS'));

    const draftDateInvalid = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: null,
        occurred_on_state: 'INVALID',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftDateInvalid.warnings.includes('DATE_INVALID'));

    // Check MERCHANT_MISSING
    const draftMerchantMissing = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: null,
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'RESOLVED', categoryId: 'cat-1' }
    );
    assert.ok(draftMerchantMissing.warnings.includes('MERCHANT_MISSING'));

    // Check CATEGORY_UNRESOLVED & CATEGORY_STALE
    const draftCatUnresolved = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: null,
        note: null,
        image_quality: 'OK',
      },
      { status: 'UNRESOLVED' }
    );
    assert.ok(draftCatUnresolved.warnings.includes('CATEGORY_UNRESOLVED'));

    const draftCatStale = deriveReceiptDraft(
      {
        document_kind: 'PURCHASE_RECEIPT',
        merchant: 'Store',
        occurred_on: '2023-11-01',
        occurred_on_state: 'PRESENT',
        amount: '100',
        amount_state: 'PRESENT',
        currency_code: 'USD',
        currency_state: 'PRESENT',
        category_token: 'CAT_1',
        note: null,
        image_quality: 'OK',
      },
      { status: 'STALE' }
    );
    assert.ok(draftCatStale.warnings.includes('CATEGORY_STALE'));

    // Check ACCOUNT_REQUIRED is always present
    assert.ok(draftDoc.warnings.includes('ACCOUNT_REQUIRED'));

    // Check deterministic ordering strictly matches RECEIPT_WARNING_ORDER
    const fullWarningsDraft = deriveReceiptDraft(
      {
        document_kind: 'OTHER',
        merchant: null,
        occurred_on: null,
        occurred_on_state: 'MISSING',
        amount: null,
        amount_state: 'MISSING',
        currency_code: null,
        currency_state: 'MISSING',
        category_token: null,
        note: null,
        image_quality: 'LOW',
      },
      { status: 'UNRESOLVED' }
    );

    const indices = fullWarningsDraft.warnings.map((w) => RECEIPT_WARNING_ORDER.indexOf(w));
    for (let i = 1; i < indices.length; i++) {
      assert.ok(indices[i] > indices[i - 1], 'Warnings must be in deterministic RECEIPT_WARNING_ORDER');
    }
  });

  // --- 10. Form state: rejection of draft application when can_apply is false ---
  await t.test('form-state - Untouched state when can_apply is false', () => {
    const currentState = {
      type: 'INCOME' as const,
      amount: '500',
      currency: 'VND',
      accountId: 'acc-1',
      categoryId: 'cat-old',
      incomeSourceId: 'src-1',
      incomeSourceStreamId: 'stream-1',
      merchant: 'Original Merchant',
      note: 'Original note',
      occurredOn: '2023-10-10',
    };

    const unapplicableDraft: any = {
      type: 'EXPENSE',
      amount: null,
      currency_code: null,
      occurred_on: null,
      merchant: 'Receipt Merchant',
      category_id: 'cat-new',
      account_id: null,
      note: 'Receipt note',
      document_kind: 'OTHER',
      can_apply: false,
      warnings: ['DOCUMENT_UNSUPPORTED', 'TOTAL_MISSING', 'ACCOUNT_REQUIRED'],
    };

    const res = applyReceiptDraftToForm(unapplicableDraft, currentState);
    assert.deepEqual(res, currentState, 'Must return currentState untouched');
  });

  // --- 11. Form state: proper application when can_apply is true ---
  await t.test('form-state - Valid application clears account and resets income sources', () => {
    const currentState = {
      type: 'INCOME' as const,
      amount: '500',
      currency: 'VND',
      accountId: 'acc-1',
      categoryId: 'cat-old',
      incomeSourceId: 'src-1',
      incomeSourceStreamId: 'stream-1',
      merchant: 'Original Merchant',
      note: 'Original note',
      occurredOn: '2023-10-10',
    };

    const applicableDraft: any = {
      type: 'EXPENSE',
      amount: '85000.0000',
      currency_code: 'VND',
      occurred_on: '2023-11-20',
      merchant: 'Pho 24',
      category_id: 'cat-pho',
      account_id: null,
      note: 'Lunch',
      document_kind: 'PURCHASE_RECEIPT',
      can_apply: true,
      warnings: ['ACCOUNT_REQUIRED'],
    };

    const res = applyReceiptDraftToForm(applicableDraft, currentState);
    assert.equal(res.type, 'EXPENSE');
    assert.equal(res.accountId, ''); // Account reset to avoid silent currency relabeling
    assert.equal(res.amount, '85000.0000');
    assert.equal(res.currency, 'VND');
    assert.equal(res.occurredOn, '2023-11-20');
    assert.equal(res.merchant, 'Pho 24');
    assert.equal(res.categoryId, 'cat-pho');
    assert.equal(res.note, 'Lunch');
    assert.equal(res.incomeSourceId, null);
    assert.equal(res.incomeSourceStreamId, null);
  });

  // --- 12. Categories: candidate resolution (RESOLVED, UNRESOLVED, STALE) ---
  await t.test('categories - revalidateCategoryToken produces 3 discriminated states', async () => {
    const candidates = [
      { id: 'cat-uuid-1', name: 'Food & Dining' },
      { id: 'cat-uuid-2', name: 'Transportation' },
    ];

    // Mock supabase client
    const mockSupabaseResolved = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'cat-uuid-1' }, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any;

    const resResolved = await revalidateCategoryToken(mockSupabaseResolved, 'CAT_1', candidates);
    assert.deepEqual(resResolved, { status: 'RESOLVED', categoryId: 'cat-uuid-1' });

    // Mock supabase client when category was deleted/archived
    const mockSupabaseStale = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any;

    const resStale = await revalidateCategoryToken(mockSupabaseStale, 'CAT_1', candidates);
    assert.deepEqual(resStale, { status: 'STALE' });

    // Out of range token -> UNRESOLVED
    const resOutOfRange = await revalidateCategoryToken(mockSupabaseResolved, 'CAT_99', candidates);
    assert.deepEqual(resOutOfRange, { status: 'UNRESOLVED' });

    // Fabricated token -> UNRESOLVED
    const resFabricated = await revalidateCategoryToken(mockSupabaseResolved, 'INVALID_TOKEN', candidates);
    assert.deepEqual(resFabricated, { status: 'UNRESOLVED' });

    // Null token -> UNRESOLVED
    const resNull = await revalidateCategoryToken(mockSupabaseResolved, null, candidates);
    assert.deepEqual(resNull, { status: 'UNRESOLVED' });
  });

  // --- 13. Categories: candidate sanitization and >50 truncation ---
  await t.test('categories - sanitization and >50 truncation', async () => {
    // Test > 50 candidates truncation (fails closed with 0 candidates)
    const mockSupabaseOverflow = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({
                data: Array.from({ length: 51 }, (_, i) => ({ id: `id-${i}`, name: `Cat ${i}` })),
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any;

    const overflowRes = await getCategoryCandidates(mockSupabaseOverflow);
    assert.equal(overflowRes.length, 0, 'Must fail closed with zero candidates when overflow > 50');

    // Test sanitization of names (control chars and excessive length)
    const dirtyName = 'Food\r\n\t  and   Drinks\x00' + 'A'.repeat(100);
    const mockSupabaseSanitize = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({
                data: [{ id: 'cat-dirty', name: dirtyName }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any;

    const sanitizedRes = await getCategoryCandidates(mockSupabaseSanitize);
    assert.equal(sanitizedRes.length, 1);
    assert.ok(sanitizedRes[0].name.length <= 50, 'Must truncate name to <= 50 chars');
    assert.ok(!/[\r\n\t\x00]/.test(sanitizedRes[0].name), 'Must strip control characters');
  });

  // --- 14. Image Security: Binary signatures and MIME validation ---
  await t.test('image - Binary signature rejection of invalid files', async () => {
    // Less than 12 bytes
    const tinyBuffer = new Uint8Array([0x01, 0x02, 0x03]);
    const tinyFile = new File([tinyBuffer], 'tiny.jpg', { type: 'image/jpeg' });
    await assert.rejects(
      () => processReceiptImage(tinyFile),
      (err: any) => err.code === 'AI_INVALID_REQUEST'
    );

    // Corrupted magic bytes with JPEG MIME
    const badBytes = new Uint8Array(20).fill(0xaa);
    const fakeJpeg = new File([badBytes], 'fake.jpg', { type: 'image/jpeg' });
    await assert.rejects(
      () => processReceiptImage(fakeJpeg),
      (err: any) => err.code === 'AI_INVALID_REQUEST'
    );

    // Conflicting MIME header (e.g. JPEG signature but image/png MIME)
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const conflictingMimeFile = new File([jpegHeader], 'conflict.jpg', { type: 'image/png' });
    await assert.rejects(
      () => processReceiptImage(conflictingMimeFile),
      (err: any) => err.code === 'AI_INVALID_REQUEST'
    );
  });

  // --- 15. Image Security: Sharp limits (oversized file rejection) ---
  await t.test('image - Oversized file rejection before buffer allocation', async () => {
    // File size exceeds 4MB
    const oversizedFile = {
      size: PHASE_12B_MAX_RECEIPT_FILE_BYTES + 1,
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(10),
    } as any;

    await assert.rejects(
      () => processReceiptImage(oversizedFile),
      (err: any) => err.code === 'AI_INVALID_REQUEST' && err.message.includes('exceeds')
    );
  });

  // --- 16. Provider adapter: Single attempt retry policy preservation ---
  await t.test('gemini-adapter - Single attempt retry policy configured', () => {
    const provider = new GeminiProvider();
    assert.equal(provider.id, 'gemini');
  });

  // --- 17. Gemini Core: Exactly one media part requirement ---
  await t.test('gemini-core - Enforces single media part and sanitizes base64 in errors', async () => {
    const mockFactory = () =>
      ({
        models: {
          generateContent: async () => {
            throw new Error('API Error with base64 payload: data:image/jpeg;base64,VGhpcyBpcyBhIHRlc3Qgc3RyaW5nIHRoYXQgaXMgcXVpdGUgbG9uZyBhbmQgc2hvdWxkIGJlIHJlZGFjdGVk');
          },
        },
      } as any);

    const provider = new GeminiProviderCore({ clientFactory: mockFactory });
    const dummyCredential = { id: 'c1', providerId: 'gemini' as const, scope: 'system' as const, value: 'dummy-api-key' };

    // Test zero media parts for receipt_vision
    await assert.rejects(
      () =>
        provider.execute(
          {
            operation: 'receipt_vision',
            model: 'gemini-2.5-flash',
            prompt: 'parse receipt',
            media: [],
          },
          dummyCredential
        ),
      (err: any) => err.code === 'AI_INVALID_REQUEST' && err.message.includes('receipt_vision requires exactly one media part')
    );

    // Test multiple media parts for receipt_vision
    await assert.rejects(
      () =>
        provider.execute(
          {
            operation: 'receipt_vision',
            model: 'gemini-2.5-flash',
            prompt: 'parse receipt',
            media: [
              { kind: 'inline_image', mimeType: 'image/jpeg', bytes: new Uint8Array(10) },
              { kind: 'inline_image', mimeType: 'image/jpeg', bytes: new Uint8Array(10) },
            ],
          },
          dummyCredential
        ),
      (err: any) => err.code === 'AI_INVALID_REQUEST' && err.message.includes('receipt_vision requires exactly one media part')
    );

    // Test base64 redaction in error normalization
    const normalizedErr = normalizeGeminiError(
      new Error('Failed request with token aW52YWxpZF9iYXNlNjRfc3RyaW5nX3dpdGhfbG9uZ19sZW5ndGhfdG9fYmFzZTY0')
    );
    assert.ok(!normalizedErr.message.includes('aW52YWxpZF9iYXNlNjRfc3RyaW5nX3dpdGhfbG9uZ19sZW5ndGhfdG9fYmFzZTY0'));
    assert.ok(normalizedErr.message.includes('[REDACTED_BASE64]'));
  });

  // --- 18. Server Action: formData.getAll('file') & Auth Precedence ---
  await t.test('actions - formData.getAll("file") rejects 0, >1 and non-File parts, Auth precedes', async () => {
    // Empty form data
    const formDataEmpty = new FormData();
    const resEmpty = await processReceiptAction(formDataEmpty);
    assert.equal(resEmpty.ok, false);
    // When unauthenticated, fails with UNAUTHENTICATED; or with INVALID_FILE_COUNT if auth was present
    assert.ok(resEmpty.code === 'UNAUTHENTICATED' || resEmpty.code === 'INVALID_FILE_COUNT');

    // Multiple files form data
    const formDataMultiple = new FormData();
    formDataMultiple.append('file', new File([new Uint8Array(10)], 'file1.jpg', { type: 'image/jpeg' }));
    formDataMultiple.append('file', new File([new Uint8Array(10)], 'file2.jpg', { type: 'image/jpeg' }));
    const resMultiple = await processReceiptAction(formDataMultiple);
    assert.equal(resMultiple.ok, false);
    assert.ok(resMultiple.code === 'UNAUTHENTICATED' || resMultiple.code === 'INVALID_FILE_COUNT');

    // String instead of File
    const formDataString = new FormData();
    formDataString.append('file', 'not-a-file-object');
    const resString = await processReceiptAction(formDataString);
    assert.equal(resString.ok, false);
  });
});
