import test from 'node:test';
import assert from 'node:assert/strict';
import { maskFinancialValue } from '../src/features/preferences/balance-visibility';

test('balance masking hides financial values without changing visible values', () => {
  assert.equal(maskFinancialValue('85.000 ₫', true), '••••••');
  assert.equal(maskFinancialValue('85.000 ₫', false), '85.000 ₫');
});
