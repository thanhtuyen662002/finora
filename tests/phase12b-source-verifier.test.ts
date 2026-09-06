import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Phase 12B Source Verifier', async (t) => {
  const actionsPath = path.join(process.cwd(), 'src/features/ai/receipt-vision/actions.ts');
  const actionCorePath = path.join(process.cwd(), 'src/features/ai/receipt-vision/action-core.ts');
  const imagePath = path.join(process.cwd(), 'src/features/ai/receipt-vision/image.ts');
  
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
  });
});
