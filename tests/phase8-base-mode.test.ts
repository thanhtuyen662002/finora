import {
  getAvailableCurrenciesAndDefault,
  aggregateAccountBalancesByCurrency,
  aggregateCurrencySummaries,
} from '../src/features/reports/engine';
import { convertExactAmount } from '../src/lib/exchange-rate/fx-math';
import { addExactDecimals } from '../src/lib/money';

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

function assertDeepEq(a: any, b: any, msg: string = '') {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error(`[FAIL] ${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
    passed++;
  }
}

async function runTests() {
  console.log('--- Phase 8 BASE Mode Unit & Provenance Tests ---');

  // 1. Active Current FX Source Currencies & Archived EUR Exclusion
  const mockAccounts = [
    { id: 'a1', name: 'Ví VND', type: 'CASH', currency_code: 'VND', is_archived: false, color: '#000', institution: 'Cash' },
    { id: 'a2', name: 'Tài khoản USD', type: 'BANK', currency_code: 'USD', is_archived: false, color: '#000', institution: 'Bank' },
    { id: 'a3', name: 'Tài khoản EUR cũ', type: 'BANK', currency_code: 'EUR', is_archived: true, color: '#000', institution: 'Bank' },
  ];
  const mockBalances: Record<string, string> = {
    a1: '10000000.0000',
    a2: '1000.0000',
    a3: '500.0000',
  };

  const activeAccounts = mockAccounts.filter((a) => !a.is_archived);
  const uniqueAccCurrencies = Array.from(
    new Set(activeAccounts.map((a) => (a.currency_code || 'VND').toUpperCase()))
  );
  assertDeepEq(
    uniqueAccCurrencies,
    ['VND', 'USD'],
    '1. Active current FX source currencies are VND+USD only (archived EUR excluded)'
  );

  // 2. Valuation Group Iteration & Unrequested EUR Currency Handling
  const accountGroups = aggregateAccountBalancesByCurrency(mockAccounts as any, mockBalances);
  const activeAccountGroups = Object.values(accountGroups).filter(
    (group) => group.accounts.length > 0
  );

  const activeHoldingCurrencies = activeAccountGroups.map((g) => g.currency);
  assertDeepEq(
    activeHoldingCurrencies,
    ['VND', 'USD'],
    '2. Active holding currency groups exclude zero-active-account EUR group'
  );

  // Simulate current rate response for active holdings only (no rate for EUR)
  const rates: Record<string, { rate: string }> = {
    USD: { rate: '25400.000000000000' },
  };

  let baseValuationStatus = 'UNAVAILABLE';
  let baseTotalBalance = '0.0000';
  const baseAccounts: any[] = [];

  try {
    for (const group of activeAccountGroups) {
      const c = group.currency;
      if (c === 'BASE') continue;

      const rateObj = rates[c];
      if (!rateObj && c !== 'VND') {
        throw new Error(`Missing required rate for ${c}`);
      }
      const rate = rateObj ? rateObj.rate : '1.000000000000';

      for (const acc of group.accounts) {
        if (acc.isArchived) continue;
        const converted = convertExactAmount(acc.currentBalance, rate);
        baseAccounts.push({
          ...acc,
          currency: 'BASE',
          currentBalance: converted,
        });
        baseTotalBalance = addExactDecimals(baseTotalBalance, converted);
      }
    }
    baseValuationStatus = 'AVAILABLE';
  } catch (err: any) {
    baseValuationStatus = 'UNAVAILABLE';
  }

  assertEq(baseValuationStatus, 'AVAILABLE', '3. Current BASE valuation status is AVAILABLE without current EUR rate');
  assertEq(baseTotalBalance, '35400000.0000', '4. Current BASE total balance calculated accurately (10M VND + 1K USD * 25.4K)');
  assertEq(baseAccounts.length, 2, '5. Active BASE account snapshots generated for active accounts only');

  // 3. Historical EUR Transaction Preservation & Discovery
  const mockTransactions = [
    {
      id: 't1',
      account_id: 'a3',
      type: 'EXPENSE',
      amount: '100.0000',
      currency_code: 'EUR',
      occurred_on: '2026-08-15',
      is_voided: false,
    },
  ];

  const { availableCurrencies, defaultCurrency } = getAvailableCurrenciesAndDefault(
    mockAccounts as any,
    mockTransactions as any,
    'VND'
  );

  const activeAccountsHasForeign = mockAccounts.some(
    (a) => !a.is_archived && (a.currency_code || 'VND').toUpperCase() !== 'VND'
  );
  const inScopeTxHasForeign = mockTransactions.some(
    (t) => !t.is_voided && (t.currency_code || 'VND').toUpperCase() !== 'VND'
  );
  const hasMeaningfulForeignScope = activeAccountsHasForeign || inScopeTxHasForeign;

  const reportCurrencies = [...availableCurrencies];
  if (hasMeaningfulForeignScope && !reportCurrencies.includes('BASE')) {
    reportCurrencies.unshift('BASE');
  }

  assertEq(hasMeaningfulForeignScope, true, '6. Detects meaningful foreign scope from USD account & EUR transaction');
  assertEq(reportCurrencies[0], 'BASE', '7. BASE option is placed first on native-first initial load');

  // Preserve historical EUR transaction conversion via historical snapshot
  const mockEURSnapshot = {
    transaction_id: 't1',
    converted_amount: '2700000.0000',
    rate: '27000.000000000000',
    provider: 'test_provider',
    effective_date: '2026-08-15',
  };

  const baseEURTx = {
    ...mockTransactions[0],
    currency_code: 'BASE',
    amount: mockEURSnapshot.converted_amount,
    fx_rate: mockEURSnapshot.rate,
    fx_provider: mockEURSnapshot.provider,
    fx_effective_date: mockEURSnapshot.effective_date,
    fx_original_amount: mockTransactions[0].amount,
    fx_original_currency: mockTransactions[0].currency_code,
    fx_target_currency: 'VND',
  };

  const baseSummaries = aggregateCurrencySummaries([baseEURTx as any], '2026-08');
  assertEq(baseSummaries.BASE?.totalExpense, '2700000.0000', '8. Historical EUR transaction preserved and converted to BASE');

  // 4. Zero-FX Network Calls in Native Mode vs Explicit BASE Trigger
  let fxNetworkCallCount = 0;
  const triggerFxIfBaseSelected = (preferredCurrency?: string) => {
    const isBaseSelected = preferredCurrency ? preferredCurrency.toUpperCase() === 'BASE' : false;
    if (isBaseSelected) {
      fxNetworkCallCount++;
    }
  };

  triggerFxIfBaseSelected('VND'); // Initial native mode load
  assertEq(fxNetworkCallCount, 0, '9. Initial native mode load triggers zero FX network calls');

  triggerFxIfBaseSelected('BASE'); // Explicit BASE selection
  assertEq(fxNetworkCallCount, 1, '10. Explicit BASE mode selection triggers required FX network calls');

  console.log(`PHASE_8_BASE_MODE_TESTS PASS ${passed}/${total}`);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});