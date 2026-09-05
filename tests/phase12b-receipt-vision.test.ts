import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deriveReceiptDraft } from '../src/features/ai/receipt-vision/domain';
import type { ReceiptVisionParseOutput } from '../src/features/ai/receipt-vision/types';

describe('Phase 12B Receipt Vision', () => {
  it('derives draft and warnings correctly', () => {
    const parsed: ReceiptVisionParseOutput = {
      document_kind: 'PURCHASE_RECEIPT',
      merchant: 'Coffee Shop',
      occurred_on: '2026-09-05',
      occurred_on_state: 'PRESENT',
      amount: '85000',
      amount_state: 'PRESENT',
      currency_code: 'VND',
      currency_state: 'PRESENT',
      category_token: 'CAT_0',
      note: 'Lunch',
      image_quality: 'OK'
    };

    const draft = deriveReceiptDraft(parsed, [{ id: '123', token: 'CAT_0', label: 'Food' }], true);

    assert.strictEqual(draft.type, 'EXPENSE');
    assert.strictEqual(draft.amount, '85000');
    assert.strictEqual(draft.can_apply, true);
    assert.ok(draft.warnings.includes('ACCOUNT_REQUIRED'));
  });
});
