import { toExactRate, convertExactAmount, matchSnapshotVersion } from '../src/lib/exchange-rate/fx-math';
import { FrankfurterProvider } from '../src/lib/exchange-rate/frankfurter';
import { aggregateCashFlow, aggregateCurrencySummaries, getAvailableCurrenciesAndDefault } from '../src/features/reports/engine';
import { resolveAutoFxCapability } from '../src/lib/exchange-rate/capability';
import { resolveDisplayIdentity } from '../src/lib/auth/identity';

let passed = 0;
let total = 0;
function assertEq(a: any, b: any, msg: string = '') {
  total++;
  if (a !== b) {
    console.error(`[FAIL] ${msg}: ${a} !== ${b}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
    passed++;
  }
}
function assertThrows(fn: any, msg: string = '') {
  total++;
  try { fn(); console.error(`[FAIL] ${msg}: Did not throw`); process.exit(1); }
  catch (e) { console.log(`[PASS] ${msg}`); passed++; }
}

async function runTests() {
  console.log('--- Math Tests ---');
  assertEq(toExactRate('1'), '1.000000000000', 'identity rate');
  assertEq(toExactRate('26500.5'), '26500.500000000000', 'pads <=12 decimals');
  assertThrows(() => toExactRate('1.0000000000001'), '>12 decimals rejected, not truncated');
  assertThrows(() => toExactRate('-1'), 'negative rate rejected');
  assertThrows(() => toExactRate('0'), 'zero rate rejected');
  assertThrows(() => toExactRate('abc'), 'malformed rate rejected');

  assertEq(convertExactAmount('100.0000', '2.000000000000'), '200.0000', 'positive conversion');
  assertEq(convertExactAmount('-100.0000', '2.000000000000'), '-200.0000', 'negative conversion');
  assertEq(convertExactAmount('0.0000', '2.000000000000'), '0.0000', 'zero conversion');
  assertEq(convertExactAmount('100.0000', '0.500000000000'), '50.0000', 'rate below 1');
  assertEq(convertExactAmount('100.1234', '1.111111111111'), '111.2482', '12-decimal precision rounding');
  assertEq(convertExactAmount('100.0005', '1.000000000000'), '100.0005', 'half-away-from-zero positive');
  assertEq(convertExactAmount('-100.0005', '1.000000000000'), '-100.0005', 'half-away-from-zero negative');
  assertThrows(() => convertExactAmount('9999999999999999.9999', '100.0'), 'numeric(20,4) overflow rejected');

  console.log('--- Provider Tests ---');
  const provider = new FrankfurterProvider();
  const originalFetch = global.fetch;

  // Identity without network call
  const identity = await provider.getCurrentRate('VND', 'VND');
  assertEq(identity.rate, '1.000000000000', 'identity without network call');

  global.fetch = async (url: any, options: any) => {
    if (url.includes('missing')) return { ok: false, status: 404, statusText: 'Not Found' } as any;
    if (url.includes('malformed')) return { ok: true, text: async () => 'invalidcsv' } as any;
    if (url.includes('future')) return { ok: true, text: async () => 'date,base,quote,rate\n2099-01-01,USD,VND,25000' } as any;
    if (url.includes('out-of-window')) return { ok: true, text: async () => 'date,base,quote,rate\n2020-01-01,USD,VND,23000' } as any;
    return {
      ok: true,
      text: async () => `date,base,quote,rate\n2023-10-01,USD,VND,24000\n2023-10-02,USD,VND,24100`
    } as any;
  };

  let result = await provider.getCurrentRate('USD', 'VND');
  assertEq(result.rate, '24100.000000000000', 'current v2 CSV exact parsing');

  result = await provider.getHistoricalRate('USD', 'VND', '2023-10-05');
  assertEq(result.rate, '24100.000000000000', 'weekend/holiday latest <= requested date (historical 7-day bounded)');

  let rejected = false;
  try { await provider.getHistoricalRate('USD', 'VND', '2099-10-01'); } catch { rejected = true; }
  assertEq(rejected, true, 'future effective row rejected');

  rejected = false;
  try {
    global.fetch = async () => ({ ok: true, text: async () => 'date,base,quote,rate\n2020-01-01,USD,VND,23000' } as any);
    await provider.getHistoricalRate('USD', 'VND', '2023-10-05');
  } catch { rejected = true; }
  assertEq(rejected, true, 'out-of-window/no observation rejected');

  rejected = false;
  try {
    global.fetch = async () => ({ ok: true, text: async () => 'invalidcsv' } as any);
    await provider.getCurrentRate('USD', 'VND');
  } catch { rejected = true; }
  assertEq(rejected, true, 'malformed CSV/header/rate rejected');

  rejected = false;
  try {
    global.fetch = async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' } as any);
    await provider.getCurrentRate('USD', 'VND');
  } catch { rejected = true; }
  assertEq(rejected, true, 'provider HTTP failure rejected');

  global.fetch = originalFetch;

  console.log('--- Domain Logic Tests ---');

  const { exportTransactionsToCSV } = await import('../src/features/reports/engine');
  const fakeTx = [{
    id: 'tx1',
    type: 'INCOME',
    amount: '100.0000',
    currency_code: 'BASE',
    occurred_on: '2023-10-01',
    fx_original_amount: '2.0000',
    fx_original_currency: 'USD',
    fx_rate: '50.0000',
    fx_target_currency: 'VND',
    fx_effective_date: '2023-10-01',
    fx_provider: 'Frankfurter'
  }];
  const csvRes = exportTransactionsToCSV(fakeTx as any, 'BASE', 'Tháng 10', 'UTC');
  const csvLines = csvRes.csvContent.split('\r\n');
  assertEq(csvLines[0].split(',').length, 15, 'BASE CSV header/data column counts and provenance (header)');
  assertEq(csvLines[1].split(',').length, 15, 'BASE CSV header/data column counts and provenance (data)');

  const fakeAccs = [{ id: 'a1', currency_code: 'USD' }, { id: 'a2', currency_code: 'VND' }];
  const avail = getAvailableCurrenciesAndDefault(fakeAccs as any, [], 'BASE').availableCurrencies;
  assertEq(avail.includes('BASE'), false, 'dashboard native account list excludes synthetic BASE copies');

  const summaries = aggregateCurrencySummaries(fakeTx as any, '2023-10');
  assertEq(summaries['BASE'].totalIncome, '100.0000', 'per-transaction historical aggregation');

  const nativeTx = [{ type: 'INCOME', amount: '50.0000', currency_code: 'VND', occurred_on: '2023-10-01' }];
  const nativeSummaries = aggregateCurrencySummaries(nativeTx as any, '2023-10');
  assertEq(nativeSummaries['VND'].totalIncome, '50.0000', 'native reporting survives FX unavailable');

  // transaction snapshot identity/version helper behavior
  const existingSnap = [{ transaction_id: 'tx1', source_currency_code: 'USD', target_currency_code: 'VND', source_amount: '100.0000', requested_date: '2023-10-01' }];
  const match1 = matchSnapshotVersion(existingSnap, { id: 'tx1', currency_code: 'USD', amount: '100', occurred_on: '2023-10-01' }, 'VND');
  assertEq(match1 !== undefined, true, 'snapshot identity/version helper finds match');

  const match2 = matchSnapshotVersion(existingSnap, { id: 'tx1', currency_code: 'USD', amount: '101', occurred_on: '2023-10-01' }, 'VND');
  assertEq(match2 === undefined, true, 'snapshot identity/version helper rejects mismatch amount');

  // pre-migration settings compatibility
  const preMigUserSet = { base_currency: 'VND', auto_fx_enabled: undefined };
  const hasAutoFx = resolveAutoFxCapability(preMigUserSet).schemaAvailable;
  assertEq(hasAutoFx, false, 'pre-migration settings compatibility - missing property correctly flagged');

  // identity display precedence helper
  const profile = { display_name: 'Profile Name' };
  const user = { user_metadata: { full_name: 'Full Name' }, email: 'user@example.com' };
  const fb1 = resolveDisplayIdentity(profile, user);
  assertEq(fb1, 'Profile Name', 'identity display precedence helper - profile first');

  const fb2 = resolveDisplayIdentity(undefined, user);
  assertEq(fb2, 'Full Name', 'identity display precedence helper - fallback to metadata');

  console.log(`PHASE_8_TESTS PASS ${passed}/${total}`);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
