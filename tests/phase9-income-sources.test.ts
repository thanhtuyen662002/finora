import {
  aggregateRealizedIncomeAttribution,
  isValidIncomeSourceType,
  SUPPORTED_INCOME_SOURCE_TYPES,
  validateIncomeSourceName,
  validateIncomeSourceStreamName,
  validateTransactionAttribution,
  type RealizedTransactionForAttribution,
} from '../src/features/income-sources/domain';

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

async function runPhase9Tests() {
  console.log('--- Phase 9 Income Source Domain Tests ---');

  // 1. Supported Types
  assertEq(SUPPORTED_INCOME_SOURCE_TYPES.length, 5, '5 supported income source types');
  assertTrue(isValidIncomeSourceType('SALARY'), 'SALARY is valid');
  assertTrue(isValidIncomeSourceType('YOUTUBE'), 'YOUTUBE is valid');
  assertTrue(isValidIncomeSourceType('FREELANCE'), 'FREELANCE is valid');
  assertTrue(isValidIncomeSourceType('INVESTMENT'), 'INVESTMENT is valid');
  assertTrue(isValidIncomeSourceType('OTHER'), 'OTHER is valid');
  assertTrue(!isValidIncomeSourceType('INVALID'), 'INVALID is not valid');
  assertTrue(!isValidIncomeSourceType(''), 'empty string is not valid');
  assertTrue(!isValidIncomeSourceType(123), 'number is not valid');

  // 2. Name validation
  assertTrue(validateIncomeSourceName('Công ty ABC').valid, 'valid source name');
  assertTrue(!validateIncomeSourceName('').valid, 'empty source name rejected');
  assertTrue(!validateIncomeSourceName('   ').valid, 'whitespace source name rejected');
  assertTrue(!validateIncomeSourceName('a'.repeat(201)).valid, 'oversized source name rejected');
  assertTrue(validateIncomeSourceName('a'.repeat(200)).valid, '200 char source name accepted');

  // 3. Stream Name validation
  assertTrue(validateIncomeSourceStreamName('Kênh Tech').valid, 'valid stream name');
  assertTrue(!validateIncomeSourceStreamName('').valid, 'empty stream name rejected');
  assertTrue(!validateIncomeSourceStreamName('   ').valid, 'whitespace stream name rejected');
  assertTrue(!validateIncomeSourceStreamName('a'.repeat(201)).valid, 'oversized stream name rejected');

  // 4. Attribution invariant validation
  // Rule: EXPENSE cannot have attribution
  const expWithSource = validateTransactionAttribution({
    type: 'EXPENSE',
    income_source_id: 'src-123',
  });
  assertTrue(!expWithSource.valid, 'expense with source rejected');

  const expWithStream = validateTransactionAttribution({
    type: 'EXPENSE',
    income_source_stream_id: 'stm-123',
  });
  assertTrue(!expWithStream.valid, 'expense with stream rejected');

  const expClean = validateTransactionAttribution({
    type: 'EXPENSE',
  });
  assertTrue(expClean.valid, 'expense without attribution accepted');

  // Rule: Stream requires parent source
  const incomeOrphanStream = validateTransactionAttribution({
    type: 'INCOME',
    income_source_stream_id: 'stm-123',
  });
  assertTrue(!incomeOrphanStream.valid, 'income with orphan stream rejected');

  const incomeValidBoth = validateTransactionAttribution({
    type: 'INCOME',
    income_source_id: 'src-123',
    income_source_stream_id: 'stm-123',
  });
  assertTrue(incomeValidBoth.valid, 'income with both source and stream accepted');

  const incomeSourceOnly = validateTransactionAttribution({
    type: 'INCOME',
    income_source_id: 'src-123',
  });
  assertTrue(incomeSourceOnly.valid, 'income with source only accepted');

  const incomeUnattributed = validateTransactionAttribution({
    type: 'INCOME',
  });
  assertTrue(incomeUnattributed.valid, 'income with no attribution accepted');

  // 5. Aggregation engine tests
  const testTransactions: RealizedTransactionForAttribution[] = [
    // Active VND income
    {
      type: 'INCOME',
      is_voided: false,
      amount: '25000000.0000',
      currency_code: 'VND',
      income_source_id: 'src-salary',
      income_source_name: 'Main Job',
      income_source_type: 'SALARY',
      income_source_stream_id: null,
      income_source_stream_name: null,
    },
    {
      type: 'INCOME',
      is_voided: false,
      amount: '5000000.0000',
      currency_code: 'VND',
      income_source_id: 'src-freelance',
      income_source_name: 'Freelance Design',
      income_source_type: 'FREELANCE',
      income_source_stream_id: 'stm-client-a',
      income_source_stream_name: 'Client A Project',
    },
    {
      type: 'INCOME',
      is_voided: false,
      amount: '3000000.0000',
      currency_code: 'VND',
      income_source_id: 'src-freelance',
      income_source_name: 'Freelance Design',
      income_source_type: 'FREELANCE',
      income_source_stream_id: 'stm-client-b',
      income_source_stream_name: 'Client B Project',
    },
    {
      type: 'INCOME',
      is_voided: false,
      amount: '1200000.0000',
      currency_code: 'VND',
      income_source_id: null,
      income_source_name: null,
      income_source_type: null,
      income_source_stream_id: null,
      income_source_stream_name: null,
    },
    // Voided income (must be excluded)
    {
      type: 'INCOME',
      is_voided: true,
      amount: '99999999.0000',
      currency_code: 'VND',
      income_source_id: 'src-salary',
      income_source_name: 'Main Job',
      income_source_type: 'SALARY',
    },
    // Expense (must be excluded)
    {
      type: 'EXPENSE',
      is_voided: false,
      amount: '10000000.0000',
      currency_code: 'VND',
    },
    // USD Income with streams
    {
      type: 'INCOME',
      is_voided: false,
      amount: '860.5000',
      currency_code: 'USD',
      income_source_id: 'src-yt',
      income_source_name: 'YouTube Channels',
      income_source_type: 'YOUTUBE',
      income_source_stream_id: 'stm-yt-chan-a',
      income_source_stream_name: 'Channel Alpha',
    },
    {
      type: 'INCOME',
      is_voided: false,
      amount: '420.2500',
      currency_code: 'USD',
      income_source_id: 'src-yt',
      income_source_name: 'YouTube Channels',
      income_source_type: 'YOUTUBE',
      income_source_stream_id: 'stm-yt-chan-b',
      income_source_stream_name: 'Channel Beta',
    },
  ];

  const reports = aggregateRealizedIncomeAttribution(testTransactions);
  assertEq(reports.length, 2, '2 currency reports generated (USD and VND)');

  // USD report verification
  const usdReport = reports.find((r) => r.currencyCode === 'USD')!;
  assertTrue(Boolean(usdReport), 'USD report found');
  assertEq(usdReport.totalIncome, '1280.7500', 'USD exact total sum 860.5000 + 420.2500 = 1280.7500');
  assertEq(usdReport.sources.length, 1, '1 USD source');
  assertEq(usdReport.sources[0].sourceName, 'YouTube Channels', 'source is YouTube Channels');
  assertEq(usdReport.sources[0].totalAmount, '1280.7500', 'YouTube total amount exact');
  assertEq(usdReport.sources[0].streams.length, 2, '2 YouTube streams');

  const streamA = usdReport.sources[0].streams.find((s) => s.streamId === 'stm-yt-chan-a')!;
  assertEq(streamA.totalAmount, '860.5000', 'Channel Alpha stream exact');
  const streamB = usdReport.sources[0].streams.find((s) => s.streamId === 'stm-yt-chan-b')!;
  assertEq(streamB.totalAmount, '420.2500', 'Channel Beta stream exact');

  // VND report verification
  const vndReport = reports.find((r) => r.currencyCode === 'VND')!;
  assertTrue(Boolean(vndReport), 'VND report found');
  // 25M + 5M + 3M + 1.2M = 34.2M
  assertEq(vndReport.totalIncome, '34200000.0000', 'VND exact total sum = 34,200,000.0000');
  assertEq(vndReport.sources.length, 3, '3 VND source categories (Salary, Freelance, Unattributed)');

  // Check highest revenue sort order: Main Job (25M) > Freelance (8M) > Unattributed (1.2M)
  assertEq(vndReport.sources[0].sourceName, 'Main Job', 'Highest source is Main Job');
  assertEq(vndReport.sources[0].totalAmount, '25000000.0000', 'Main Job total is 25M');
  assertEq(vndReport.sources[1].sourceName, 'Freelance Design', 'Second highest is Freelance Design');
  assertEq(vndReport.sources[1].totalAmount, '8000000.0000', 'Freelance total is 8M');
  assertEq(vndReport.sources[1].streams.length, 2, 'Freelance has 2 streams (Client A & B)');
  assertEq(vndReport.sources[2].sourceName, 'Unattributed', 'Third is Unattributed');
  assertEq(vndReport.sources[2].totalAmount, '1200000.0000', 'Unattributed total is 1.2M');

  console.log(`\n=== All Phase 9 Domain Tests Passed (${passed}/${total}) ===\n`);
}

runPhase9Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
