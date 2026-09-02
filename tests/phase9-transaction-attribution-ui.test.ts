import { buildTransactionUpdatePayload } from '../src/features/transactions/mutation';
import { validateTransactionAttribution } from '../src/features/income-sources/domain';

let passed = 0;
let total = 0;

function assertEq(a: any, b: any, msg: string = '') {
  total++;
  if (a !== b) {
    console.error(`[FAIL] ${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
    passed++;
  }
}

function assertTrue(cond: boolean, msg: string = '') {
  total++;
  if (!cond) {
    console.error(`[FAIL] ${msg}: condition is false`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
    passed++;
  }
}

function assertThrows(fn: () => void, msg: string = '') {
  total++;
  try {
    fn();
    console.error(`[FAIL] ${msg}: expected function to throw error`);
    process.exit(1);
  } catch (_e) {
    console.log(`[PASS] ${msg}`);
    passed++;
  }
}

async function runTests() {
  console.log('--- Phase 9 Transaction Attribution UI & Mutation Builder Tests ---');

  // Test 1: Expense update modifying only note and merchant does NOT emit type/income_source keys
  const expenseInitial = {
    id: 'tx-1',
    type: 'EXPENSE' as const,
    amount: '150000.0000',
    currency_code: 'VND',
    account_id: 'acc-1',
    category_id: 'cat-food',
    merchant: 'GrabFood',
    note: 'Lunch',
    occurred_on: '2026-09-01',
    income_source_id: null,
    income_source_stream_id: null,
  };

  const payload1 = buildTransactionUpdatePayload(expenseInitial, {
    type: 'EXPENSE',
    amount: '150000.0000',
    currency_code: 'VND',
    account_id: 'acc-1',
    category_id: 'cat-food',
    merchant: 'GrabFood Vietnam',
    note: 'Team Lunch',
    occurred_on: '2026-09-01',
    income_source_id: null,
    income_source_stream_id: null,
  });

  assertEq(payload1.merchant, 'GrabFood Vietnam', 'Merchant updated');
  assertEq(payload1.note, 'Team Lunch', 'Note updated');
  assertTrue(!('type' in payload1), 'type omitted when unchanged');
  assertTrue(!('income_source_id' in payload1), 'income_source_id omitted when unchanged');
  assertTrue(!('income_source_stream_id' in payload1), 'income_source_stream_id omitted when unchanged');

  // Test 2: Income with unchanged source/stream omits trigger columns
  const incomeInitial = {
    id: 'tx-2',
    type: 'INCOME' as const,
    amount: '25000000.0000',
    currency_code: 'VND',
    account_id: 'acc-vcb',
    category_id: 'cat-salary',
    merchant: 'Acme Corp',
    note: 'August Salary',
    occurred_on: '2026-08-31',
    income_source_id: 'src-salary',
    income_source_stream_id: 'stream-base-salary',
  };

  const payload2 = buildTransactionUpdatePayload(incomeInitial, {
    type: 'INCOME',
    amount: '25000000.0000',
    currency_code: 'VND',
    account_id: 'acc-vcb',
    category_id: 'cat-salary',
    merchant: 'Acme Corp Vietnam',
    note: 'August Salary Final',
    occurred_on: '2026-08-31',
    income_source_id: 'src-salary',
    income_source_stream_id: 'stream-base-salary',
  });

  assertEq(payload2.merchant, 'Acme Corp Vietnam', 'Merchant updated');
  assertTrue(!('type' in payload2), 'type omitted for identical income');
  assertTrue(!('income_source_id' in payload2), 'income_source_id omitted for identical income');
  assertTrue(!('income_source_stream_id' in payload2), 'income_source_stream_id omitted for identical income');

  // Test 3: Type change from INCOME to EXPENSE resets attribution fields
  const payload3 = buildTransactionUpdatePayload(incomeInitial, {
    type: 'EXPENSE',
    amount: '25000000.0000',
    currency_code: 'VND',
    account_id: 'acc-vcb',
    category_id: 'cat-other',
    merchant: 'Acme Refund',
    note: 'Chargeback',
    occurred_on: '2026-08-31',
    income_source_id: null,
    income_source_stream_id: null,
  });

  assertEq(payload3.type, 'EXPENSE', 'type is EXPENSE');
  assertEq(payload3.income_source_id, null, 'income_source_id set to null');
  assertEq(payload3.income_source_stream_id, null, 'income_source_stream_id set to null');

  // Test 4: Income source changed from Source A to Source B clears stream if incompatible or stream not specified
  const payload4 = buildTransactionUpdatePayload(incomeInitial, {
    type: 'INCOME',
    amount: '25000000.0000',
    currency_code: 'VND',
    account_id: 'acc-vcb',
    category_id: 'cat-salary',
    merchant: 'YouTube Partner',
    note: null,
    occurred_on: '2026-08-31',
    income_source_id: 'src-youtube',
    income_source_stream_id: null,
  });

  assertEq(payload4.income_source_id, 'src-youtube', 'income_source_id updated to src-youtube');
  assertEq(payload4.income_source_stream_id, null, 'income_source_stream_id cleared to null');

  // Test 5: EXPENSE changed to INCOME sets source and stream
  const payload5 = buildTransactionUpdatePayload(expenseInitial, {
    type: 'INCOME',
    amount: '150000.0000',
    currency_code: 'VND',
    account_id: 'acc-1',
    category_id: 'cat-other-income',
    merchant: 'Cashback',
    note: null,
    occurred_on: '2026-09-01',
    income_source_id: 'src-other',
    income_source_stream_id: 'stream-cashback',
  });

  assertEq(payload5.type, 'INCOME', 'type updated to INCOME');
  assertEq(payload5.income_source_id, 'src-other', 'income_source_id set');
  assertEq(payload5.income_source_stream_id, 'stream-cashback', 'income_source_stream_id set');

  // Test 6: Amount formatting validation
  assertThrows(() => {
    buildTransactionUpdatePayload(expenseInitial, {
      ...expenseInitial,
      amount: '-5000',
    });
  }, 'Negative amount must throw in buildTransactionUpdatePayload');

  assertThrows(() => {
    buildTransactionUpdatePayload(expenseInitial, {
      ...expenseInitial,
      amount: '0',
    });
  }, 'Zero amount must throw in buildTransactionUpdatePayload');

  // Test 7: Validate Attribution Domain Helper
  const validAttribution = validateTransactionAttribution({
    type: 'INCOME',
    income_source_id: 'src-1',
    income_source_stream_id: 'str-1',
  });
  assertTrue(validAttribution.valid, 'Valid income attribution');

  const expenseNoAttribution = validateTransactionAttribution({
    type: 'EXPENSE',
    income_source_id: null,
    income_source_stream_id: null,
  });
  assertTrue(expenseNoAttribution.valid, 'Expense with null attribution is valid');

  const invalidExpenseAttribution = validateTransactionAttribution({
    type: 'EXPENSE',
    income_source_id: 'src-1',
    income_source_stream_id: null,
  });
  assertTrue(!invalidExpenseAttribution.valid, 'Expense cannot have income_source_id');

  const orphanStreamAttribution = validateTransactionAttribution({
    type: 'INCOME',
    income_source_id: null,
    income_source_stream_id: 'str-1',
  });
  assertTrue(!orphanStreamAttribution.valid, 'Orphan stream without parent source is invalid');

  console.log(`\nResults: ${passed}/${total} assertions passed successfully.`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
