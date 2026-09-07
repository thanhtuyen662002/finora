import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('Phase 12B Source Verifier', async (t) => {
  const actionsPath = path.join(process.cwd(), 'src/features/ai/receipt-vision/actions.ts');
  const actionCorePath = path.join(process.cwd(), 'src/features/ai/receipt-vision/action-core.ts');
  const imagePath = path.join(process.cwd(), 'src/features/ai/receipt-vision/image.ts');
  const pickerPath = path.join(process.cwd(), 'src/features/ai/receipt-vision/components/ReceiptPicker.tsx');
  const modalPath = path.join(process.cwd(), 'src/components/finance/AddTransactionModal.tsx');
  const globalStylesPath = path.join(process.cwd(), 'src/app/globals.css');
  
  await t.test('Server action exists and uses auth.getUser', () => {
    const actionsCode = fs.readFileSync(actionsPath, 'utf8');
    assert.match(actionsCode, /'use server'/);
    assert.match(actionsCode, /auth\.getUser\(\)/);
  });

  await t.test('Action Core uses AI Router', () => {
    const actionCoreCode = fs.readFileSync(actionCorePath, 'utf8');
    assert.match(actionCoreCode, /router\.execute/);
    assert.match(actionCoreCode, /processReceiptImage/);
  });

  await t.test('Image processing validates sizes and uses Sharp', () => {
    const imageCode = fs.readFileSync(imagePath, 'utf8');
    assert.match(imageCode, /PHASE_12B_MAX_RECEIPT_FILE_BYTES/);
    assert.match(imageCode, /PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES/);
    assert.match(imageCode, /sharp\(/);
    assert.match(imageCode, /limitInputPixels/);

    const output = execFileSync(
      process.execPath,
      [path.join(process.cwd(), 'scripts/verify-phase12b-source.mjs')],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    assert.match(output, /TOTAL CHECKS: 91/);
    assert.match(output, /PHASE_12B_SOURCE_VERIFIER: PASS 91\/91/);
  });

  await t.test('Receipt entry point and application scrollbars remain visible and accessible', () => {
    const modalCode = fs.readFileSync(modalPath, 'utf8');
    const globalStyles = fs.readFileSync(globalStylesPath, 'utf8');
    const pickerCode = fs.readFileSync(pickerPath, 'utf8');

    assert.match(modalCode, /aria-label="Chọn cách nhập giao dịch"/);
    assert.match(modalCode, /aria-pressed=\{aiInputMode === 'receipt'\}/);
    assert.match(modalCode, />Quét hóa đơn</);
    assert.match(modalCode, /overflow-y-auto overscroll-contain/);
    assert.match(globalStyles, /\*::\-webkit\-scrollbar-thumb/);
    assert.match(globalStyles, /\*::\-webkit\-scrollbar-thumb:hover/);
    assert.match(globalStyles, /scrollbar-width: thin/);
    assert.match(globalStyles, /scrollbar-gutter: stable/);
    assert.match(pickerCode, /Cần kiểm tra trước khi áp dụng/);
    assert.match(pickerCode, /aria-label="Cảnh báo từ kết quả phân tích hóa đơn"/);
    assert.match(pickerCode, /dark:text-amber-50/);
    assert.match(pickerCode, /break-words/);
  });
});
