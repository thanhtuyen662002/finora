import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReceiptDraft } from '../src/features/ai/receipt-vision/domain';
import { applyReceiptDraftToForm } from '../src/features/ai/receipt-vision/form-state';
import { receiptVisionOutputValidator } from '../src/features/ai/receipt-vision/schema';
import type { ReceiptVisionParseOutput, ReceiptTransactionDraft } from '../src/features/ai/receipt-vision/types';

test('Phase 12B Receipt Vision Domain Tests', async (t) => {
  await t.test('receiptVisionOutputValidator - Valid 11-key output', () => {
    const valid = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Highlands Coffee',
      occurred_on: '2023-10-25',
      occurred_on_state: 'PRESENT',
      amount: '45000',
      amount_state: 'PRESENT',
      currency_code: 'VND',
      currency_state: 'PRESENT',
      category_token: 'CAT_1',
      note: 'Coffee',
      image_quality: 'OK',
    };
    const res = receiptVisionOutputValidator.validate(valid);
    assert.equal(res.amount, '45000');
    assert.equal(res.merchant, 'Highlands Coffee');
  });

  await t.test('receiptVisionOutputValidator - Rejects extra keys', () => {
    const extra = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: null,
      amount_state: 'MISSING',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
      extra_key: 'not allowed',
    };
    assert.throws(() => receiptVisionOutputValidator.validate(extra), /exactly 11 keys/);
  });

  await t.test('receiptVisionOutputValidator - Rejects missing keys', () => {
    const missing = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: null,
      amount_state: 'MISSING',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      // image_quality missing
    };
    assert.throws(() => receiptVisionOutputValidator.validate(missing), /exactly 11 keys/);
  });

  await t.test('receiptVisionOutputValidator - Zero coercion: rejects numbers for amount', () => {
    const numericAmount = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: 45000,
      amount_state: 'PRESENT',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    assert.throws(() => receiptVisionOutputValidator.validate(numericAmount), /numeric values are strictly prohibited/);
  });

  await t.test('receiptVisionOutputValidator - Rejects invalid lexical amount format', () => {
    const commaAmount = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: '45,000',
      amount_state: 'PRESENT',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    assert.throws(() => receiptVisionOutputValidator.validate(commaAmount), /Invalid lexical amount format/);
  });

  await t.test('receiptVisionOutputValidator - Rejects state inconsistency', () => {
    const inconsistentAmount = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: null,
      occurred_on_state: 'MISSING',
      amount: '45000',
      amount_state: 'MISSING', // State says MISSING but amount is present
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    assert.throws(() => receiptVisionOutputValidator.validate(inconsistentAmount), /amount_state is MISSING but amount is not null/);
  });
  await t.test('deriveReceiptDraft - Valid Purchase Receipt', () => {
    const output: ReceiptVisionParseOutput = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Highlands Coffee',
      occurred_on: '2023-10-25',
      occurred_on_state: 'PRESENT',
      amount: '45000',
      amount_state: 'PRESENT',
      currency_code: 'VND',
      currency_state: 'PRESENT',
      category_token: 'CAT_1',
      note: 'Coffee',
      image_quality: 'OK',
    };
    
    const draft = deriveReceiptDraft(output, 'cat-uuid-123');
    
    assert.equal(draft.can_apply, true);
    assert.equal(draft.amount, '45000.0000');
    assert.equal(draft.currency_code, 'VND');
    assert.equal(draft.occurred_on, '2023-10-25');
    assert.equal(draft.merchant, 'Highlands Coffee');
    assert.equal(draft.category_id, 'cat-uuid-123');
    assert.equal(draft.note, 'Coffee');
    assert.deepEqual(draft.warnings, []);
  });

  await t.test('deriveReceiptDraft - Stale Category', () => {
    const output: ReceiptVisionParseOutput = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: '2023-10-25',
      occurred_on_state: 'PRESENT',
      amount: '45000',
      amount_state: 'PRESENT',
      currency_code: 'VND',
      currency_state: 'PRESENT',
      category_token: 'CAT_99',
      note: null,
      image_quality: 'OK',
    };
    
    // category resolved to null
    const draft = deriveReceiptDraft(output, null);
    
    assert.equal(draft.can_apply, true);
    assert.equal(draft.category_id, null);
    assert.deepEqual(draft.warnings, ['CATEGORY_STALE']);
  });

  await t.test('deriveReceiptDraft - Invalid Date', () => {
    const output: ReceiptVisionParseOutput = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: '2023-02-30', // Impossible date
      occurred_on_state: 'PRESENT',
      amount: '45000',
      amount_state: 'PRESENT',
      currency_code: 'VND',
      currency_state: 'PRESENT',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    
    const draft = deriveReceiptDraft(output, null);
    
    assert.equal(draft.can_apply, false);
    assert.equal(draft.occurred_on, null);
    assert.deepEqual(draft.warnings, ['DATE_INVALID']);
  });

  await t.test('deriveReceiptDraft - Missing Currency and Amount', () => {
    const output: ReceiptVisionParseOutput = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Store',
      occurred_on: '2023-10-25',
      occurred_on_state: 'PRESENT',
      amount: null,
      amount_state: 'MISSING',
      currency_code: null,
      currency_state: 'MISSING',
      category_token: null,
      note: null,
      image_quality: 'OK',
    };
    
    const draft = deriveReceiptDraft(output, null);
    
    assert.equal(draft.can_apply, false);
    assert.deepEqual(draft.warnings, ['AMOUNT_MISSING', 'CURRENCY_MISSING']);
  });

  await t.test('applyReceiptDraftToForm - Overrides and clears', () => {
    const draft: ReceiptTransactionDraft = {
      type: 'EXPENSE',
      amount: '123.4500',
      currency_code: 'USD',
      occurred_on: '2023-11-01',
      merchant: 'New Merchant',
      category_id: 'new-cat',
      note: 'New note',
      can_apply: true,
      warnings: [],
    };

    const currentState = {
      type: 'INCOME' as const,
      amount: '999',
      currency: 'VND',
      accountId: 'acc-1',
      categoryId: 'old-cat',
      incomeSourceId: 'src-1',
      incomeSourceStreamId: 'stream-1',
      merchant: 'Old merchant',
      note: 'Old note',
      occurredOn: '2023-10-01',
    };

    const nextState = applyReceiptDraftToForm(draft, currentState);

    assert.equal(nextState.type, 'EXPENSE');
    assert.equal(nextState.accountId, ''); // Account always cleared to prevent silent relabeling
    assert.equal(nextState.amount, '123.4500');
    assert.equal(nextState.currency, 'USD');
    assert.equal(nextState.occurredOn, '2023-11-01');
    assert.equal(nextState.merchant, 'New Merchant');
    assert.equal(nextState.categoryId, 'new-cat');
    assert.equal(nextState.note, 'New note');
    assert.equal(nextState.incomeSourceId, null);
    assert.equal(nextState.incomeSourceStreamId, null);
  });
});
