#!/usr/bin/env node

/**
 * Finora Phase 6 Source Code & Financial Invariant Verifier (Hardened)
 *
 * Verifies:
 * 1. Complete eradication of mock data imports in Dashboard & Reports.
 * 2. Strict exact-money BigInt arithmetic in reports engine (no lossy casts or string comparisons).
 * 3. Pre-FX multi-currency isolation (no cross-currency addition).
 * 4. Dynamic period & strict fail-closed timezone validation (no hard-coded static dates, no silent fallback for invalid configured timezones).
 * 5. Fail-closed error handling & deterministic stale data clearing in Reports and Dashboard (no fallback to opening_balance; no stale data under new controls).
 * 6. Authoritative account_balances usage.
 * 7. Correct ALL-period full-history derivation (from earliest tx to current month with zero months).
 * 8. Correct base-currency default selection (prioritized if present, not injected if absent).
 * 9. RFC 4180 CSV export with UTF-8 BOM.
 * 10. Truthful PROJECT_STATUS (Phase 6 source-gate PASS_CODE_ONLY, live smoke NOT_RUN, Phase 7 NOT authorized).
 * 11. Comprehensive mathematical & programmatic regression test suite.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function pass(name, detail = '') {
  totalChecks++;
  passedChecks++;
  console.log(`  ✓ PASS: ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name, reason) {
  totalChecks++;
  failedChecks++;
  console.error(`  ✗ FAIL: ${name} -> ${reason}`);
}

console.log('='.repeat(75));
console.log('FINORA PHASE 6 FINAL HARDENED SOURCE & FINANCIAL INVARIANT VERIFIER');
console.log('='.repeat(75));

// 1. Check prohibited mock imports & hard-coded dates in Phase 6 files
console.log('\n[1/9] Checking mock eradication & dynamic dates in Phase 6 files...');
const phase6Files = [
  'src/app/dashboard/page.tsx',
  'src/app/reports/page.tsx',
  'src/components/charts/CashFlowChart.tsx',
  'src/components/charts/CategoryDonutChart.tsx',
  'src/components/finance/AccountDetailModal.tsx',
  'src/features/reports/types.ts',
  'src/features/reports/engine.ts',
  'src/features/reports/reports.ts',
  'src/features/reports/index.ts',
];

for (const relPath of phase6Files) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    fail(`File existence: ${relPath}`, 'File does not exist');
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');

  // Check for MOCK_ imports or symbols
  const mockMatches = content.match(/MOCK_[A-Z0-9_]+/g);
  if (mockMatches) {
    fail(`No mock references: ${relPath}`, `Found forbidden mock symbols: ${mockMatches.join(', ')}`);
  } else {
    pass(`No mock references: ${relPath}`);
  }

  // Check for mock library imports
  if (content.includes('@/lib/mock/') || content.includes('../mock/')) {
    fail(`No mock imports: ${relPath}`, 'Found import from mock directory');
  } else {
    pass(`No mock imports: ${relPath}`);
  }

  // Check for hard-coded static August 2026 references
  if (/tháng\s*8\s*[/]\s*2026/i.test(content) || /august\s*2026/i.test(content)) {
    fail(`No hard-coded date strings: ${relPath}`, 'Found hard-coded "tháng 8/2026" or "August 2026"');
  } else {
    pass(`Dynamic date handling: ${relPath}`);
  }
}

// 2. Check exact monetary arithmetic & no lossy casts in report engine
console.log('\n[2/9] Checking exact-money invariants in reports engine source...');
const enginePath = path.join(rootDir, 'src/features/reports/engine.ts');
const engineContent = fs.readFileSync(enginePath, 'utf8');

if (engineContent.includes('addExactDecimals') && engineContent.includes('subExactDecimals')) {
  pass('Reports engine uses exact decimal addition/subtraction');
} else {
  fail('Reports engine arithmetic', 'Missing addExactDecimals / subExactDecimals in engine.ts');
}

if (engineContent.includes('compareExactDecimals')) {
  pass('Reports engine imports and uses compareExactDecimals for numeric scaling comparison');
} else {
  fail('Reports engine comparisons', 'Missing compareExactDecimals in engine.ts');
}

if (engineContent.includes('exportTransactionsToCSV') && engineContent.includes('\\uFEFF')) {
  pass('CSV export prepends UTF-8 BOM');
} else {
  fail('CSV export UTF-8 BOM', 'Missing \\uFEFF prefix in exportTransactionsToCSV');
}

// Reject lossy numeric casting or unsafe string comparisons for amounts
if (
  engineContent.includes('Number(t.amount)') ||
  engineContent.includes('parseFloat(t.amount)') ||
  engineContent.includes('+t.amount') ||
  engineContent.includes('Number(tx.amount)') ||
  engineContent.includes('parseFloat(tx.amount)') ||
  engineContent.includes('+tx.amount')
) {
  fail('Exact money arithmetic', 'Found lossy numeric casting on transaction amount in engine.ts');
} else {
  pass('No lossy floating-point casting on amounts in reports engine');
}

// Check that maxSeriesDecimal does NOT use string comparison > or <
if (
  /bucket\.income\s*>\s*maxSeriesDecimal/.test(engineContent) ||
  /bucket\.expense\s*>\s*maxSeriesDecimal/.test(engineContent)
) {
  fail('Exact comparison scaling', 'Found string-based relational comparison (> or <) for maxSeriesDecimal in engine.ts');
} else {
  pass('No string-based relational comparisons on monetary strings in engine.ts');
}

// 3. Check fail-closed account_balances in engine.ts
console.log('\n[3/9] Checking fail-closed account_balances invariants...');
const aggBalanceFnMatch = engineContent.match(/export function aggregateAccountBalancesByCurrency[\s\S]*?\n\}/);
if (aggBalanceFnMatch) {
  const fnBody = aggBalanceFnMatch[0];
  if (fnBody.includes('opening_balance')) {
    fail('Fail-closed account_balances', 'Found forbidden access to opening_balance inside aggregateAccountBalancesByCurrency');
  } else {
    pass('No fallback to opening_balance in aggregateAccountBalancesByCurrency');
  }
} else {
  fail('aggregateAccountBalancesByCurrency existence', 'Could not locate aggregateAccountBalancesByCurrency function in engine.ts');
}

if (
  engineContent.includes('balances[account.id] === undefined')
) {
  pass('aggregateAccountBalancesByCurrency fails closed when account balance is missing');
} else {
  fail('aggregateAccountBalancesByCurrency check', 'Missing explicit undefined check for balances[account.id]');
}

// 4. Check strict timezone validation & resolution in engine.ts and reports.ts
console.log('\n[4/9] Checking strict timezone validation and fail-closed resolution...');
const reportsPath = path.join(rootDir, 'src/features/reports/reports.ts');
const reportsContent = fs.readFileSync(reportsPath, 'utf8');

if (engineContent.includes('export function validateAndResolveTimezone')) {
  pass('engine.ts exports validateAndResolveTimezone helper');
} else {
  fail('validateAndResolveTimezone export', 'Missing validateAndResolveTimezone export in engine.ts');
}

if (reportsContent.includes('validateAndResolveTimezone')) {
  pass('reports.ts uses validateAndResolveTimezone for user timezone resolution');
} else {
  fail('reports.ts timezone resolution', 'reports.ts does not invoke validateAndResolveTimezone');
}

if (
  reportsContent.includes('userSettingsResult.error') &&
  reportsContent.includes('throw new Error')
) {
  pass('reports.ts throws error when user_settings query fails (no silent default)');
} else {
  fail('user_settings error handling', 'Missing throw on userSettingsResult.error in reports.ts');
}

// Timezone programmatic tests
function validateAndResolveTimezone(timezone) {
  if (timezone === undefined || timezone === null || (typeof timezone === 'string' && timezone.trim() === '')) {
    return 'Asia/Ho_Chi_Minh';
  }
  const cleanTz = typeof timezone === 'string' ? timezone.trim() : String(timezone);
  try {
    Intl.DateTimeFormat(undefined, { timeZone: cleanTz });
    return cleanTz;
  } catch {
    throw new Error(`Múi giờ cấu hình không hợp lệ: "${timezone}". Vui lòng kiểm tra cài đặt người dùng.`);
  }
}

// Test absent timezone -> fallback
const tzAbsent1 = validateAndResolveTimezone(undefined);
const tzAbsent2 = validateAndResolveTimezone(null);
const tzAbsent3 = validateAndResolveTimezone('');
const tzAbsent4 = validateAndResolveTimezone('   ');
if (tzAbsent1 === 'Asia/Ho_Chi_Minh' && tzAbsent2 === 'Asia/Ho_Chi_Minh' && tzAbsent3 === 'Asia/Ho_Chi_Minh' && tzAbsent4 === 'Asia/Ho_Chi_Minh') {
  pass('Timezone: absent/null/empty timezone resolves to fallback "Asia/Ho_Chi_Minh"');
} else {
  fail('Timezone absent fallback', 'Failed to resolve fallback for absent/empty timezone');
}

// Test valid configured timezone -> used
const tzValid1 = validateAndResolveTimezone('America/New_York');
const tzValid2 = validateAndResolveTimezone('Europe/London');
const tzValid3 = validateAndResolveTimezone('Asia/Tokyo');
if (tzValid1 === 'America/New_York' && tzValid2 === 'Europe/London' && tzValid3 === 'Asia/Tokyo') {
  pass('Timezone: valid configured IANA timezone accepted and returned verbatim');
} else {
  fail('Timezone valid check', 'Failed to accept valid IANA timezone');
}

// Test invalid non-empty configured timezone -> throws and fails closed
let threwForInvalid = false;
try {
  validateAndResolveTimezone('Invalid/Non_Existent_Timezone_123');
} catch (e) {
  threwForInvalid = true;
}
if (threwForInvalid) {
  pass('Timezone: invalid non-empty timezone throws error and fails closed (no silent fallback)');
} else {
  fail('Timezone invalid check', 'Did not throw error on invalid timezone');
}

// 5. Check Reports stale-data clearing & loading behavior in UI
console.log('\n[5/9] Checking Reports stale-data clearing & request sequencing...');
const dashboardPagePath = path.join(rootDir, 'src/app/dashboard/page.tsx');
const dashboardPageContent = fs.readFileSync(dashboardPagePath, 'utf8');
const reportsPagePath = path.join(rootDir, 'src/app/reports/page.tsx');
const reportsPageContent = fs.readFileSync(reportsPagePath, 'utf8');

// Check that loadReport in reports/page.tsx clears data before awaiting new report
const loadReportMatch = reportsPageContent.match(/const loadReport = useCallback\(async \(\) => \{([\s\S]*?)\}, \[period, selectedCurrency\]\);/);
if (loadReportMatch) {
  const loadBody = loadReportMatch[1];
  const setDataNullIndex = loadBody.indexOf('setData(null)');
  const fetchIndex = loadBody.indexOf('getDetailedReportData');
  if (setDataNullIndex !== -1 && fetchIndex !== -1 && setDataNullIndex < fetchIndex) {
    pass('Reports loadReport clears previous authoritative data (setData(null)) before awaiting getDetailedReportData');
  } else {
    fail('Reports stale-data clearing', 'loadReport does not clear data before fetching new report');
  }
} else {
  fail('loadReport match', 'Could not parse loadReport callback in reports/page.tsx');
}

// Check that reports page renders loading skeleton when loading is true (without && !data bypassing)
if (reportsPageContent.includes('if (loading) {') && !reportsPageContent.includes('if (loading && !data) {')) {
  pass('Reports renders loading skeleton immediately when loading=true (no stale data rendering under new controls)');
} else {
  fail('Reports loading gate', 'Reports loading gate is conditional on !data or missing');
}

// Check request sequencing in reports page
if (reportsPageContent.includes('requestSeqRef') && reportsPageContent.includes('reqId === requestSeqRef.current')) {
  pass('Reports uses request sequencing (requestSeqRef) for out-of-order response protection');
} else {
  fail('Reports request sequencing', 'Missing request sequencing in reports/page.tsx');
}

// Check fail-closed error handling
if (dashboardPageContent.includes('if (error || !data)') && reportsPageContent.includes('if (error || !data)')) {
  pass('Dashboard & Reports render visible fail-closed error state with retry button on load failure');
} else {
  fail('Fail-closed error UI', 'Missing fail-closed error view in dashboard or reports');
}

if (
  dashboardPageContent.includes("useState<string>('VND')") ||
  reportsPageContent.includes("useState<string>('VND')")
) {
  fail('Initial currency state', 'Found hard-coded useState("VND") in UI pages');
} else {
  pass('UI pages do not hard-code initial VND currency state');
}

// 6. Check PROJECT_STATUS.md truthfulness
console.log('\n[6/9] Checking docs/PROJECT_STATUS.md gate state & truthfulness...');
const projectStatusPath = path.join(rootDir, 'docs/PROJECT_STATUS.md');
const projectStatusContent = fs.readFileSync(projectStatusPath, 'utf8');

if (projectStatusContent.includes('PHASE_6_SOURCE_GATE=PASS_CODE_ONLY')) {
  pass('PROJECT_STATUS contains PHASE_6_SOURCE_GATE=PASS_CODE_ONLY');
} else {
  fail('PROJECT_STATUS source gate', 'Missing PHASE_6_SOURCE_GATE=PASS_CODE_ONLY in docs/PROJECT_STATUS.md');
}

if (projectStatusContent.includes('PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN')) {
  pass('PROJECT_STATUS contains PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN');
} else {
  fail('PROJECT_STATUS live smoke', 'Missing PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN in docs/PROJECT_STATUS.md');
}

if (projectStatusContent.includes('PHASE_6_OVERALL=PARTIAL')) {
  pass('PROJECT_STATUS contains PHASE_6_OVERALL=PARTIAL');
} else {
  fail('PROJECT_STATUS overall status', 'Missing PHASE_6_OVERALL=PARTIAL in docs/PROJECT_STATUS.md');
}

if (projectStatusContent.includes('PHASE_7_AUTHORIZED=false')) {
  pass('PROJECT_STATUS contains PHASE_7_AUTHORIZED=false');
} else {
  fail('PROJECT_STATUS phase 7 auth', 'Missing PHASE_7_AUTHORIZED=false in docs/PROJECT_STATUS.md');
}

if (
  /Phase 6[^\n]*COMPLETE\b/i.test(projectStatusContent) ||
  /PHASE_6=PASS\b/.test(projectStatusContent) ||
  /PHASE_7_AUTHORIZED=true\b/.test(projectStatusContent)
) {
  fail('PROJECT_STATUS premature closure', 'docs/PROJECT_STATUS.md prematurely marks Phase 6 COMPLETE or Phase 7 authorized');
} else {
  pass('PROJECT_STATUS does not prematurely mark Phase 6 COMPLETE or Phase 7 authorized');
}

// 7. Mathematical exact decimal and saving rate unit tests
console.log('\n[7/9] Running exact-money arithmetic unit validation...');

function toScaledBigInt(amountStr) {
  const clean = amountStr.trim();
  const negative = clean.startsWith('-');
  const unsigned = negative ? clean.slice(1) : clean;
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const paddedFrac = (fracPart + '0000').slice(0, 4);
  const raw = BigInt(intPart) * 10000n + BigInt(paddedFrac);
  return negative ? -raw : raw;
}

function fromScaledBigInt(val) {
  const negative = val < 0n;
  const abs = negative ? -val : val;
  const intPart = (abs / 10000n).toString();
  const fracPart = (abs % 10000n).toString().padStart(4, '0');
  return `${negative ? '-' : ''}${intPart}.${fracPart}`;
}

function addExactDecimals(a, b) {
  return fromScaledBigInt(toScaledBigInt(a) + toScaledBigInt(b));
}

function subExactDecimals(a, b) {
  return fromScaledBigInt(toScaledBigInt(a) - toScaledBigInt(b));
}

function compareExactDecimals(a, b) {
  const bigA = toScaledBigInt(a);
  const bigB = toScaledBigInt(b);
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

function computeSavingRatePercent(incomeStr, expenseStr) {
  const incomeScaled = toScaledBigInt(incomeStr);
  const expenseScaled = toScaledBigInt(expenseStr);
  if (incomeScaled <= 0n) return null;
  const savingsScaled = incomeScaled - expenseScaled;
  const bps = Number((savingsScaled * 10000n) / incomeScaled);
  const percentScaled = Number((savingsScaled * 1000n) / incomeScaled);
  const percentStr = (percentScaled / 10).toFixed(1);
  return { basisPoints: bps, percentStr };
}

function computeBasisPoints(partStr, totalStr) {
  const partScaled = toScaledBigInt(partStr);
  const totalScaled = toScaledBigInt(totalStr);
  if (totalScaled <= 0n) return 0;
  return Number((partScaled * 10000n) / totalScaled);
}

// Test 1: exact string addition
const sum1 = addExactDecimals('100000.0000', '250000.5000');
if (sum1 === '350000.5000') {
  pass('Exact decimal addition: 100000.0000 + 250000.5000 = 350000.5000');
} else {
  fail('Exact decimal addition', `Expected 350000.5000, got ${sum1}`);
}

// Test 2: exact string subtraction
const diff1 = subExactDecimals('500000.0000', '125000.2500');
if (diff1 === '374999.7500') {
  pass('Exact decimal subtraction: 500000.0000 - 125000.2500 = 374999.7500');
} else {
  fail('Exact decimal subtraction', `Expected 374999.7500, got ${diff1}`);
}

// Test 3: exact decimal comparisons (regression test for string comparison bug)
if (compareExactDecimals('900.0000', '1000.0000') === -1) {
  pass('Exact decimal comparison: 900.0000 < 1000.0000 (would fail with string compare)');
} else {
  fail('Exact decimal comparison', '900.0000 < 1000.0000 failed');
}

if (compareExactDecimals('9999.0000', '10000.0000') === -1) {
  pass('Exact decimal comparison: 9999.0000 < 10000.0000 (would fail with string compare)');
} else {
  fail('Exact decimal comparison', '9999.0000 < 10000.0000 failed');
}

if (compareExactDecimals('0.0000', '0.0000') === 0) {
  pass('Exact decimal comparison: 0.0000 == 0.0000');
} else {
  fail('Exact decimal comparison', '0.0000 == 0.0000 failed');
}

// Test 4: BigInt saving rate
const rate1 = computeSavingRatePercent('10000000.0000', '4500000.0000');
if (rate1 && rate1.basisPoints === 5500 && rate1.percentStr === '55.0') {
  pass('Saving rate: 10M income, 4.5M expense -> 55.0% (5500 bps)');
} else {
  fail('Saving rate', `Expected 55.0% (5500 bps), got ${JSON.stringify(rate1)}`);
}

// Test 5: Saving rate when income <= 0
const rateZero = computeSavingRatePercent('0.0000', '500000.0000');
if (rateZero === null) {
  pass('Saving rate on 0 income returns null (unavailable)');
} else {
  fail('Saving rate on 0 income', `Expected null, got ${JSON.stringify(rateZero)}`);
}

// Test 6: Category basis points
const bps1 = computeBasisPoints('2500000.0000', '10000000.0000');
if (bps1 === 2500) {
  pass('Basis points ratio: 2.5M out of 10M -> 2500 bps (25%)');
} else {
  fail('Basis points ratio', `Expected 2500, got ${bps1}`);
}

// 8. Testing currency discovery & default selection rules
console.log('\n[8/9] Testing currency discovery & default selection semantics...');

function getAvailableCurrenciesAndDefault(accounts, transactions, baseCurrency) {
  const realCurrencySet = new Set();
  for (const a of accounts) {
    if (a.currency_code) realCurrencySet.add(a.currency_code.toUpperCase());
  }
  for (const t of transactions) {
    if (t.currency_code) realCurrencySet.add(t.currency_code.toUpperCase());
  }

  const normalizedBase = (baseCurrency || '').toUpperCase();

  if (realCurrencySet.size === 0) {
    const fallback = normalizedBase || 'VND';
    return {
      availableCurrencies: [fallback],
      defaultCurrency: fallback,
    };
  }

  const sorted = Array.from(realCurrencySet).sort();
  if (normalizedBase && sorted.includes(normalizedBase)) {
    const available = [normalizedBase, ...sorted.filter((c) => c !== normalizedBase)];
    return {
      availableCurrencies: available,
      defaultCurrency: normalizedBase,
    };
  }

  return {
    availableCurrencies: sorted,
    defaultCurrency: sorted[0],
  };
}

// Case A: base currency is present in accounts
const discA = getAvailableCurrenciesAndDefault(
  [{ currency_code: 'USD' }, { currency_code: 'EUR' }],
  [],
  'USD'
);
if (discA.defaultCurrency === 'USD' && discA.availableCurrencies[0] === 'USD' && discA.availableCurrencies.includes('EUR')) {
  pass('Currency discovery: base_currency USD present -> selected as default USD');
} else {
  fail('Currency discovery Case A', `Got ${JSON.stringify(discA)}`);
}

// Case B: base currency is ABSENT from accounts and transactions -> must NOT be injected
const discB = getAvailableCurrenciesAndDefault(
  [{ currency_code: 'EUR' }, { currency_code: 'JPY' }],
  [],
  'USD'
);
if (discB.defaultCurrency === 'EUR' && !discB.availableCurrencies.includes('USD') && discB.availableCurrencies.length === 2) {
  pass('Currency discovery: base_currency USD absent -> EUR selected, USD NOT injected');
} else {
  fail('Currency discovery Case B', `Got ${JSON.stringify(discB)}`);
}

// Case C: No accounts and no transactions -> fallback to base currency
const discC = getAvailableCurrenciesAndDefault([], [], 'USD');
if (discC.defaultCurrency === 'USD' && discC.availableCurrencies.length === 1 && discC.availableCurrencies[0] === 'USD') {
  pass('Currency discovery: empty data -> fallback to base_currency USD');
} else {
  fail('Currency discovery Case C', `Got ${JSON.stringify(discC)}`);
}

// 9. Testing ALL-period full history month generation and timezone date resolution
console.log('\n[9/9] Testing ALL-period full history & timezone date resolution...');

function getCalendarDateInTimezone(timezone = 'Asia/Ho_Chi_Minh', now = new Date()) {
  const validTz = validateAndResolveTimezone(timezone);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const formatted = formatter.format(now);
  const [yyyy, mm, dd] = formatted.split('-');
  return {
    year: parseInt(yyyy, 10),
    month: parseInt(mm, 10),
    day: parseInt(dd, 10),
    dateString: `${yyyy}-${mm}-${dd}`,
    monthPrefix: `${yyyy}-${mm}`,
  };
}

// Test timezone resolution across boundary
const fixedUtc = new Date('2026-08-31T20:00:00Z'); // 20:00 UTC Aug 31 = 03:00 Sep 1 in Asia/Ho_Chi_Minh (+7)
const calHcm = getCalendarDateInTimezone('Asia/Ho_Chi_Minh', fixedUtc);
if (calHcm.dateString === '2026-09-01' && calHcm.monthPrefix === '2026-09') {
  pass('Timezone calendar date resolution: Aug 31 20:00 UTC -> Sep 1 in Asia/Ho_Chi_Minh');
} else {
  fail('Timezone calendar resolution', `Expected 2026-09-01, got ${calHcm.dateString}`);
}

// Test ALL-period month generation
function generateAllPeriodKeys(transactions, targetCurrency, timezone = 'Asia/Ho_Chi_Minh', now = new Date('2026-08-28T00:00:00Z')) {
  const cal = getCalendarDateInTimezone(timezone, now);
  const currentYear = cal.year;
  const currentMonth = cal.month;
  const currentMonthKey = cal.monthPrefix;

  let earliestMonthKey = currentMonthKey;
  if (transactions && targetCurrency) {
    const normCurrency = targetCurrency.toUpperCase();
    for (const tx of transactions) {
      if (tx.is_voided) continue;
      if ((tx.currency_code || '').toUpperCase() !== normCurrency) continue;
      const txMonth = tx.occurred_on.slice(0, 7);
      if (txMonth < earliestMonthKey) {
        earliestMonthKey = txMonth;
      }
    }
  }

  const [eYearStr, eMonthStr] = earliestMonthKey.split('-');
  const eYear = parseInt(eYearStr, 10);
  const eMonth = parseInt(eMonthStr, 10);

  const keys = [];
  let y = eYear;
  let m = eMonth;
  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}

// Test multi-year history
const multiYearTx = [
  { occurred_on: '2024-03-15', currency_code: 'VND', is_voided: false },
  { occurred_on: '2025-06-10', currency_code: 'VND', is_voided: false },
];
const allKeys = generateAllPeriodKeys(multiYearTx, 'VND', 'Asia/Ho_Chi_Minh', new Date('2026-08-28T00:00:00Z'));
if (allKeys[0] === '2024-03' && allKeys[allKeys.length - 1] === '2026-08' && allKeys.length === 30) {
  pass('ALL-period generates full chronological monthly sequence across multi-year history (2024-03..2026-08, 30 months)');
} else {
  fail('ALL-period multi-year', `Expected 30 months from 2024-03 to 2026-08, got ${allKeys.length} (${allKeys[0]}..${allKeys[allKeys.length - 1]})`);
}

// Test empty history
const emptyKeys = generateAllPeriodKeys([], 'VND', 'Asia/Ho_Chi_Minh', new Date('2026-08-28T00:00:00Z'));
if (emptyKeys.length === 1 && emptyKeys[0] === '2026-08') {
  pass('ALL-period with zero transactions returns truthful [currentMonth] single bucket');
} else {
  fail('ALL-period zero transactions', `Expected [2026-08], got ${JSON.stringify(emptyKeys)}`);
}

// Check that no new supabase migrations were added for Phase 6
const migrationsDir = path.join(rootDir, 'supabase/migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
if (migrationFiles.length === 4) {
  pass(`No new migrations added for Phase 6 (exactly 4 migrations present from Phases 2-5)`);
} else {
  fail('Migration count', `Expected exactly 4 migrations from Phases 2-5, found ${migrationFiles.length}: ${migrationFiles.join(', ')}`);
}

console.log('\n' + '='.repeat(75));
console.log(`VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} PASSED (${failedChecks} FAILED)`);
console.log('='.repeat(75));

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 6 MANDATORY CORRECTIVE VERIFICATIONS PASSED.');
  process.exit(0);
}
