import { toExactRate, convertExactAmount } from '../src/lib/exchange-rate/fx-math';

function assertEq(a: any, b: any) {
  if (a !== b) throw new Error(`Assertion failed: ${a} !== ${b}`);
}

function assertThrows(fn: any) {
  try { fn(); throw new Error('Did not throw'); } catch (e) { if ((e as any).message === 'Did not throw') throw e; }
}

// 1. toExactRate tests
assertEq(toExactRate('1'), '1.000000000000');
assertEq(toExactRate('26500.5'), '26500.500000000000');
assertEq(toExactRate('0.000012345678'), '0.000012345678');
assertThrows(() => toExactRate('0'));
assertThrows(() => toExactRate('-1'));
assertThrows(() => toExactRate('1.0000000000001')); // 13 decimals

// 2. convertExactAmount tests
assertEq(convertExactAmount('100.0000', '2.000000000000'), '200.0000');
assertEq(convertExactAmount('-100.0000', '2.000000000000'), '-200.0000');
assertEq(convertExactAmount('100.1234', '1.100000000000'), '110.1357'); // 100.1234 * 1.1 = 110.13574
assertEq(convertExactAmount('100.1234', '1.111111111111'), '111.2482'); 

console.log('Math tests passed!');
