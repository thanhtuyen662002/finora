import { formatExactMoney } from '../src/lib/money/index.js';
import { parseMoneyInputValue } from '../src/lib/money/input.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  if (actual === expected) {
    console.log(`✓ PASS: ${name} -> ${actual}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${name} -> Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('='.repeat(75));
console.log('MONEY UX DETERMINISTIC VERIFIER');
console.log('='.repeat(75));

console.log('\\n[1] VND Display (No Fractional Digits)');
assert('formatExactMoney("1000000.0000", "VND")', formatExactMoney('1000000.0000', 'VND'), '1.000.000 ₫');
assert('formatExactMoney("250000.0000", "VND")', formatExactMoney('250000.0000', 'VND'), '250.000 ₫');
assert('formatExactMoney("0.0000", "VND")', formatExactMoney('0.0000', 'VND'), '0 ₫');

console.log('\\n[2] Localized Decimal Comma (Non-VND)');
assert('parseMoneyInputValue("12,34", "USD")', parseMoneyInputValue('12,34', 'USD'), '12.34');
assert('parseMoneyInputValue("1.234,56", "EUR")', parseMoneyInputValue('1.234,56', 'EUR'), '1234.56');
assert('parseMoneyInputValue("1,234.56", "USD")', parseMoneyInputValue('1,234.56', 'USD'), '1234.56');
assert('parseMoneyInputValue("1000.5", "USD")', parseMoneyInputValue('1000.5', 'USD'), '1000.5');
assert('parseMoneyInputValue("12,", "USD")', parseMoneyInputValue('12,', 'USD'), '12.');

console.log('\\n[3] Preserve VND Integer-Only Input');
assert('parseMoneyInputValue("1000000", "VND")', parseMoneyInputValue('1000000', 'VND'), '1000000');
assert('parseMoneyInputValue("1.000.000", "VND")', parseMoneyInputValue('1.000.000', 'VND'), '1000000');

console.log('\\n[4] Code Inspection for Floating Point Math');
const inputTs = readFileSync(join(process.cwd(), 'src/lib/money/input.ts'), 'utf8');
if (inputTs.includes('parseFloat') || inputTs.includes('Number(')) {
  console.error('✗ FAIL: Found floating-point functions in input.ts');
  failed++;
} else {
  console.log('✓ PASS: No floating point math in input.ts');
  passed++;
}

console.log('\\n' + '='.repeat(75));
console.log(`MONEY UX RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(75));

if (failed > 0) {
  process.exit(1);
}
