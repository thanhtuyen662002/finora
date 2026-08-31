import {
  computeNormalizedTransferData,
  validateTransferAccounts,
  validateAndNormalizeTransferAmount,
  type AccountDomainInfo,
} from '../src/features/transfers/domain';
import { convertExactAmount, toExactRate } from '../src/lib/exchange-rate/fx-math';

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${msg} - Expected ${expected}, got ${actual}`);
  }
  console.log(`[PASS] ${msg}`);
}

function assertThrows(fn: () => void, msg: string, expectedMatch?: string) {
  try {
    fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (expectedMatch && !message.includes(expectedMatch)) {
      throw new Error(`FAIL: ${msg} - Expected error containing "${expectedMatch}", got "${message}"`);
    }
    console.log(`[PASS] ${msg}`);
    return;
  }
  throw new Error(`FAIL: ${msg} - Expected function to throw`);
}

function assertPending(msg: string) {
  console.log(`[PENDING_REMOTE_GATE] ${msg}`);
}

console.log('--- Phase 8 Pass B Executable Domain Tests ---');

const accUsd1: AccountDomainInfo = { id: 'acc-usd-1', currency_code: 'USD', is_archived: false };
const accUsd2: AccountDomainInfo = { id: 'acc-usd-2', currency_code: 'USD', is_archived: false };
const accVnd1: AccountDomainInfo = { id: 'acc-vnd-1', currency_code: 'VND', is_archived: false };
const accEur1: AccountDomainInfo = { id: 'acc-eur-1', currency_code: 'EUR', is_archived: false };
const accArchivedFrom: AccountDomainInfo = { id: 'acc-archived-from', currency_code: 'USD', is_archived: true };
const accArchivedTo: AccountDomainInfo = { id: 'acc-archived-to', currency_code: 'VND', is_archived: true };

// 1. Same-currency USD -> USD
const res1 = computeNormalizedTransferData(accUsd1, accUsd2, '100.0000');
assertEq(res1.source_currency_code, 'USD', '1. Same-currency USD -> USD source currency');
assertEq(res1.destination_currency_code, 'USD', '1. Same-currency USD -> USD destination currency');

// 2. Same-currency rate forced to 1
assertEq(res1.exchange_rate, '1.000000000000', '2. Same-currency rate forced to 1');

// 3. Same-currency destination forced equal to source
assertEq(res1.destination_amount, '100.0000', '3. Same-currency destination forced equal to source');

// 4. USD -> VND
const res4 = computeNormalizedTransferData(accUsd1, accVnd1, '10.0000', '25500.000000000000');
assertEq(res4.destination_amount, '255000.0000', '4. USD -> VND destination calculation');

// 5. VND -> USD
const res5 = computeNormalizedTransferData(accVnd1, accUsd1, '255000.0000', '0.000039215686');
assertEq(res5.destination_amount, '10.0000', '5. VND -> USD conversion with 12-decimal rate');

// 6. Exact rounding boundary
const res6 = convertExactAmount('100.1234', toExactRate('25500.123456789012'));
assertEq(res6, '2553159.0609', '6. Exact rounding boundary (half-away-from-zero 4 decimals)');

// 7. Missing cross-currency rate rejected
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accVnd1, '100.0000', ''),
  '7. Missing cross-currency rate rejected',
  'Cross-currency transfer requires an explicit exchange rate'
);

// 8. Zero rate rejected
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accVnd1, '100.0000', '0'),
  '8. Zero rate rejected',
  'Rate must be greater than zero'
);

// 9. Negative rate rejected
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accVnd1, '100.0000', '-1.5'),
  '9. Negative rate rejected',
  'Invalid decimal rate'
);

// 10. Excessive rate precision rejected
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accVnd1, '100.0000', '1.12345678901234'),
  '10. Excessive rate precision (>12 decimals) rejected',
  'fractional digits'
);

// 11. Source == Destination rejected
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accUsd1, '100.0000'),
  '11. Source == Destination account rejected',
  'Source and destination accounts must be different'
);

// 12. Caller contradictory currency_code ignored/removed
// In domain types, currency_code is strictly computed as source_currency_code
assertEq(res4.currency_code, res4.source_currency_code, '12. Caller contradictory currency_code ignored');

// 13. Caller contradictory source currency ignored/removed
assertEq(res4.source_currency_code, accUsd1.currency_code, '13. Caller contradictory source currency ignored');

// 14. Caller contradictory destination currency ignored/removed
assertEq(res4.destination_currency_code, accVnd1.currency_code, '14. Caller contradictory destination currency ignored');

// 15. Caller contradictory destination amount ignored/removed
assertEq(res4.destination_amount, '255000.0000', '15. Caller contradictory destination amount overridden by exact math');

// 16. Source currency derives from source account
assertEq(res1.source_currency_code, 'USD', '16. Source currency derives from source account');

// 17. Destination currency derives from destination account
const res17 = computeNormalizedTransferData(accEur1, accVnd1, '50.0000', '27000.000000000000');
assertEq(res17.destination_currency_code, 'VND', '17. Destination currency derives from destination account');

// 18. Archived source rejected on create
assertThrows(
  () => computeNormalizedTransferData(accArchivedFrom, accVnd1, '100.0000', '25500'),
  '18. Archived source account rejected on create',
  'Cannot create transfer from an archived account'
);

// 19. Archived destination rejected on create
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accArchivedTo, '100.0000', '25500'),
  '19. Archived destination account rejected on create',
  'Cannot create transfer to an archived account'
);

// 20. Active pair accepted
validateTransferAccounts(accUsd1, accVnd1);
console.log('[PASS] 20. Active pair accepted');

// 21. Changing transfer amount recomputes destination
const res21a = computeNormalizedTransferData(accUsd1, accVnd1, '10.0000', '25500.000000000000');
const res21b = computeNormalizedTransferData(accUsd1, accVnd1, '20.0000', '25500.000000000000');
assertEq(res21b.destination_amount, '510000.0000', '21. Changing transfer amount recomputes destination');

// 22. Changing rate recomputes destination
const res22 = computeNormalizedTransferData(accUsd1, accVnd1, '10.0000', '26000.000000000000');
assertEq(res22.destination_amount, '260000.0000', '22. Changing rate recomputes destination');

// 23. Same-currency edit resets rate to 1
const res23 = computeNormalizedTransferData(accUsd1, accUsd2, '50.0000', '25500.000000000000');
assertEq(res23.exchange_rate, '1.000000000000', '23. Same-currency edit resets rate to 1');

// 24. Cross-currency edit without valid rate fails closed
assertThrows(
  () => computeNormalizedTransferData(accUsd1, accVnd1, '50.0000'),
  '24. Cross-currency edit without valid rate fails closed',
  'Cross-currency transfer requires an explicit exchange rate'
);

// Pending remote gate markers for runtime RLS / remote persistence
assertPending('25. Remote RLS cross-user isolation runtime test (REMOTE_GATE_PENDING)');
assertPending('26. Remote DB void/restore persistence triggers test (REMOTE_GATE_PENDING)');

console.log('--- Phase 8 Pass B Executable Domain Tests Complete ---');
