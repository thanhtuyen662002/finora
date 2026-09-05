import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Phase 12B Source Verifier', () => {
  it('does not contain hardcoded models in receipt-vision', () => {
    const dir = path.join(process.cwd(), 'src/features/ai/receipt-vision');
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        assert.ok(!/gemini-/.test(content), `Found hardcoded model in ${file}`);
      }
    }
  });

  it('enforces exact limits in constants', () => {
    const constants = fs.readFileSync(path.join(process.cwd(), 'src/features/ai/receipt-vision/constants.ts'), 'utf8');
    assert.ok(constants.includes('4194304'));
    assert.ok(constants.includes('4350000'));
    assert.ok(constants.includes('20000000'));
    assert.ok(constants.includes('8192'));
  });
});
