import { toExactRate, convertExactAmount } from '../src/lib/exchange-rate/fx-math.js';

let total = 0;
let passed = 0;

function assertEqual(name, actual, expected) {
  total++;
  if (actual === expected) {
    passed++;
    console.log(`✓ PASS: ${name}`);
  } else {
    console.error(`✗ FAIL: ${name} (Expected ${expected}, got ${actual})`);
  }
}

function assertThrows(name, fn) {
  total++;
  try {
    fn();
    console.error(`✗ FAIL: ${name} (Expected to throw, but didn't)`);
  } catch (err) {
    passed++;
    console.log(`✓ PASS: ${name}`);
  }
}

console.log('--- toExactRate ---');
assertEqual('toExactRate pads', toExactRate('26316.25'), '26316.250000000000');
assertEqual('toExactRate truncates', toExactRate('1.12345678901234'), '1.123456789012');
assertEqual('toExactRate integer', toExactRate('2'), '2.000000000000');
assertThrows('toExactRate zero', () => toExactRate('0'));
assertThrows('toExactRate negative', () => toExactRate('-1'));
assertThrows('toExactRate malformed', () => toExactRate('12a'));

console.log('\\n--- convertExactAmount ---');
assertEqual('positive conversion', convertExactAmount('20.0000', '26316.25'), '526325.0000');
assertEqual('negative conversion', convertExactAmount('-20.0000', '26316.25'), '-526325.0000');
assertEqual('zero conversion', convertExactAmount('0', '26316.25'), '0.0000');
assertEqual('identity conversion', convertExactAmount('100', '1'), '100.0000');
assertEqual('rate below 1', convertExactAmount('1000', '0.5'), '500.0000');
assertEqual('rate above 1', convertExactAmount('50', '2.5'), '125.0000');

// Rounding half away from zero
// 10.0000 * 1.000050000000 = 10.0005
assertEqual('half rounding up', convertExactAmount('10.0000', '1.00005'), '10.0005');
// 10.0000 * 1.000044999999 = 10.0004
assertEqual('rounding down', convertExactAmount('10.0000', '1.000044999999'), '10.0004');
// -10.0000 * 1.00005 = -10.0005
assertEqual('negative half rounding up', convertExactAmount('-10.0000', '1.00005'), '-10.0005');

console.log(`\\nResult: ${passed}/${total} passed.`);
if (passed !== total) process.exit(1);
