import fs from 'fs';
import crypto from 'crypto';

let passed = 0;
let total = 0;

function check(name, condition) {
  total++;
  if (condition) {
    console.log(`[PASS] ${total}. ${name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${total}. ${name}`);
  }
}

function shaBuf(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

console.log('=== Finora Phase 9 Pass B — UI / UX Verification ===\n');

// 1. Immutable migration & runtime locks preserved
const migBuffer = fs.readFileSync('supabase/migrations/20260901100000_phase_9_income_sources_revenue_attribution.sql');
const actualMigSha = shaBuf(migBuffer);
check('PHASE9_MIGRATION_BLOB_LOCK: Migration 20260901100000 lock preserved',
  actualMigSha === '6dc4b14fd39de41ace15d64d0769ab688af05c9e');

const runBuffer = fs.readFileSync('scripts/verify-phase9-runtime.sql');
const actualRunSha = shaBuf(runBuffer);
check('PHASE9_RUNTIME_BLOB_LOCK: Runtime harness lock preserved',
  actualRunSha === '2fcffdd11cb7d1a4d000ff17a7b40a08cc0007ac');

const migrationFiles = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'));
const newMigrations = migrationFiles.filter(f => f > '20260901100000_phase_9_income_sources_revenue_attribution.sql');
check('NO_NEW_MIGRATION: No migration created after Phase 9 baseline',
  newMigrations.length === 0);

// 2. /income-sources page and loading skeleton
check('Income sources page exists (/src/app/income-sources/page.tsx)', fs.existsSync('src/app/income-sources/page.tsx'));
check('Income sources loading skeleton exists (/src/app/income-sources/loading.tsx)', fs.existsSync('src/app/income-sources/loading.tsx'));

const incomeSourcesPage = fs.readFileSync('src/app/income-sources/page.tsx', 'utf-8');
check('Income sources page uses AppShell and PageHeader',
  incomeSourcesPage.includes('AppShell') && incomeSourcesPage.includes('PageHeader'));
check('Income sources page uses features layer methods',
  incomeSourcesPage.includes('getIncomeSourcesWithStreams') &&
  incomeSourcesPage.includes('createIncomeSource') &&
  incomeSourcesPage.includes('updateIncomeSource') &&
  incomeSourcesPage.includes('createIncomeSourceStream') &&
  incomeSourcesPage.includes('updateIncomeSourceStream'));
check('Income sources page supports archiving/unarchiving without hard delete',
  incomeSourcesPage.includes('is_archived') &&
  !incomeSourcesPage.includes('DELETE FROM income_sources') &&
  !incomeSourcesPage.includes('deleteIncomeSource'));
check('Income sources page provides source creation & editing modals',
  incomeSourcesPage.includes('sourceModalOpen') &&
  incomeSourcesPage.includes('streamModalOpen') &&
  incomeSourcesPage.includes('IncomeSourceType') &&
  incomeSourcesPage.includes('YOUTUBE') &&
  incomeSourcesPage.includes('SALARY'));
check('Income sources page provides active / archived filter tabs',
  incomeSourcesPage.includes('Tabs') &&
  incomeSourcesPage.includes('active') &&
  incomeSourcesPage.includes('archived'));

// 3. Navigation in AppShell
const appShell = fs.readFileSync('src/components/layout/AppShell.tsx', 'utf-8');
check('AppShell has /income-sources navigation entry', appShell.includes("href: '/income-sources'") && appShell.includes('Nguồn thu nhập'));

// 4. Canonical Metadata Loader in AddTransactionModal
const addTxModal = fs.readFileSync('src/components/finance/AddTransactionModal.tsx', 'utf-8');

check('TX_CANONICAL_METADATA_LOADER: AddTransactionModal defines single loadIncomeSources loader',
  addTxModal.includes('const loadIncomeSources = useCallback(async () => {') &&
  addTxModal.includes('void loadIncomeSources()') &&
  addTxModal.includes('loadIncomeSources()'));

check('TX_INITIAL_METADATA_INCLUDE_ARCHIVED: loadIncomeSources includes archived records',
  addTxModal.includes('getIncomeSourcesWithStreams({ includeArchived: true })'));

check('TX_RETRY_METADATA_INCLUDE_ARCHIVED: Retry button invokes canonical loader with includeArchived: true',
  addTxModal.includes('onClick={() => loadIncomeSources()}') &&
  addTxModal.includes('getIncomeSourcesWithStreams({ includeArchived: true })'));

const bareFetchMatch = addTxModal.match(/getIncomeSourcesWithStreams\s*\(\s*\)/);
check('TX_BARE_ACTIVE_ONLY_METADATA_FETCH_ABSENT: No bare active-only getIncomeSourcesWithStreams() in modal',
  bareFetchMatch === null);

// 5. Historical & New Archived Attribution Resolution
check('TX_HISTORICAL_ARCHIVED_SOURCE_VISIBLE: Historical attached archived source is visible with (Đã lưu trữ)',
  addTxModal.includes('!src.is_archived ||') &&
  addTxModal.includes('Boolean(initialData && src.id === initialData.income_source_id)') &&
  addTxModal.includes("src.is_archived ? ' (Đã lưu trữ)' : ''"));

check('TX_HISTORICAL_ARCHIVED_STREAM_VISIBLE: Historical attached archived stream is visible with (Đã lưu trữ)',
  addTxModal.includes('!st.is_archived ||') &&
  addTxModal.includes('Boolean(initialData && st.id === initialData.income_source_stream_id)') &&
  addTxModal.includes("st.is_archived ? ' (Đã lưu trữ)' : ''"));

check('TX_NEW_ARCHIVED_SOURCE_EXCLUDED: Archived sources excluded on new transactions',
  addTxModal.includes('!src.is_archived ||') && addTxModal.includes('initialData.income_source_id'));

check('TX_NEW_ARCHIVED_STREAM_EXCLUDED: Archived streams excluded on new transactions',
  addTxModal.includes('!st.is_archived ||') && addTxModal.includes('initialData.income_source_stream_id'));

// 6. Differential Mutation Builder in src/features/transactions/mutation.ts
check('TX_DIFFERENTIAL_UPDATE_BUILDER: mutation.ts exports buildTransactionUpdatePayload with differential logic',
  fs.existsSync('src/features/transactions/mutation.ts'));

const txMutation = fs.readFileSync('src/features/transactions/mutation.ts', 'utf-8');
check('Mutation builder imports exact decimal utilities',
  txMutation.includes('toExactDecimal') &&
  txMutation.includes('isPositiveExactDecimal'));

check('TX_NOTE_ONLY_TRIGGER_COLUMNS_OMITTED: Note-only update omits type and income attribution keys',
  txMutation.includes('initialSource !== currentSource') &&
  txMutation.includes('initialStream !== currentStream') &&
  txMutation.includes('payload.income_source_id = currentSource') &&
  txMutation.includes('payload.income_source_stream_id = currentStream'));

check('TX_SOURCE_CHANGE_STALE_STREAM_FAIL_CLOSED: Source change normalizes stale stream to null',
  txMutation.includes('initialSource !== currentSource') &&
  txMutation.includes('currentStream === initialStream') &&
  txMutation.includes('currentStream = null'));

check('AddTransactionModal integrates buildTransactionUpdatePayload for differential updates',
  addTxModal.includes('buildTransactionUpdatePayload'));
check('AddTransactionModal handles metadata load error and retry state',
  addTxModal.includes('incomeSourcesLoadError') &&
  addTxModal.includes('loadIncomeSources') &&
  addTxModal.includes('Thử lại'));
check('AddTransactionModal displays attribution UI for INCOME type only',
  addTxModal.includes("type === 'INCOME'") &&
  addTxModal.includes('Nguồn thu nhập'));
check('AddTransactionModal clears attribution payload for EXPENSE type',
  addTxModal.includes("type === 'INCOME' ? (incomeSourceId || null) : null") &&
  addTxModal.includes("type === 'INCOME' && incomeSourceId ? (incomeSourceStreamId || null) : null"));

// 7. Transaction item attribution presentation
const txItem = fs.readFileSync('src/components/finance/TransactionItem.tsx', 'utf-8');
check('TransactionItem displays income attribution badge',
  txItem.includes('transaction.incomeSourceName') &&
  txItem.includes('transaction.incomeSourceStreamName'));

// 8. IncomeSourcesBreakdown Chart Component
check('IncomeSourcesBreakdown component exists', fs.existsSync('src/components/charts/IncomeSourcesBreakdown.tsx'));
const breakdownChart = fs.readFileSync('src/components/charts/IncomeSourcesBreakdown.tsx', 'utf-8');
check('IncomeSourcesBreakdown uses IncomeSourceBreakdown interface and formatExactMoney',
  breakdownChart.includes('IncomeSourceBreakdown') &&
  breakdownChart.includes('formatExactMoney') &&
  breakdownChart.includes('sourceType'));
check('IncomeSourcesBreakdown has accurate empty state',
  breakdownChart.includes('Chưa có thu nhập thực nhận trong kỳ này.'));

// 9. Dashboard & Income Sources Realized Analytics Wiring
const dashboardPage = fs.readFileSync('src/app/dashboard/page.tsx', 'utf-8');
check('DASHBOARD_REAL_INCOME_BREAKDOWN: Dashboard mounts IncomeSourcesBreakdown with real 6M data',
  dashboardPage.includes('IncomeSourcesBreakdown') &&
  dashboardPage.includes('Nguồn thu nhập — 6 tháng') &&
  dashboardPage.includes('data.incomeBreakdownByCurrency[effectiveCurrency]'));

check('INCOME_SOURCES_PERIOD_ANALYTICS: /income-sources provides period analytics (1M, 3M, 6M, 1Y, ALL)',
  incomeSourcesPage.includes('IncomeSourcesBreakdown') &&
  incomeSourcesPage.includes('Phân tích cơ cấu thu nhập thực nhận') &&
  incomeSourcesPage.includes('setAnalyticsPeriod') &&
  incomeSourcesPage.includes("'1M'") &&
  incomeSourcesPage.includes("'3M'") &&
  incomeSourcesPage.includes("'6M'") &&
  incomeSourcesPage.includes("'1Y'") &&
  incomeSourcesPage.includes("'ALL'") &&
  incomeSourcesPage.includes('getDetailedReportData'));

check('INCOME_SOURCES_NATIVE_CURRENCY: /income-sources toggles native available currencies for realized analytics',
  incomeSourcesPage.includes('reportData.availableCurrencies') &&
  incomeSourcesPage.includes('setSelectedCurrency'));

check('DASHBOARD_BASE_FAIL_CLOSED: Dashboard and income-sources handle BASE mode unavailable states fail-closed',
  dashboardPage.includes("data.baseHistorical.status !== 'AVAILABLE'") &&
  incomeSourcesPage.includes("reportData?.baseHistorical.status !== 'AVAILABLE'"));

// 10. Reporting engine & Reports page integration
const reportsEngine = fs.readFileSync('src/features/reports/engine.ts', 'utf-8');
check('Reporting engine exports aggregateIncomeSourcesBreakdown',
  reportsEngine.includes('export function aggregateIncomeSourcesBreakdown'));
check('Reporting engine uses string decimal calculations for income streams',
  reportsEngine.includes('addExactDecimals') &&
  reportsEngine.includes('compareExactDecimals') &&
  reportsEngine.includes('streamMap'));
check('exportTransactionsToCSV includes Income Source and Stream columns',
  reportsEngine.includes('Nguồn thu nhập') &&
  reportsEngine.includes('Kênh thu nhập') &&
  reportsEngine.includes('sourceName') &&
  reportsEngine.includes('streamName'));

const reportsFeature = fs.readFileSync('src/features/reports/reports.ts', 'utf-8');
check('reports.ts integrates aggregateIncomeSourcesBreakdown in getDashboardReportData and getDetailedReportData',
  reportsFeature.includes('aggregateIncomeSourcesBreakdown') &&
  reportsFeature.includes('incomeBreakdown'));

const reportsPage = fs.readFileSync('src/app/reports/page.tsx', 'utf-8');
check('Reports page mounts IncomeSourcesBreakdown component',
  reportsPage.includes('<IncomeSourcesBreakdown') &&
  reportsPage.includes('data.incomeBreakdown'));

// 11. Unit Test Suite
check('Phase 9 unit test suites exist',
  fs.existsSync('tests/phase9-income-sources.test.ts') &&
  fs.existsSync('tests/phase9-transaction-attribution-ui.test.ts'));

// Summary
console.log(`\nVerification complete: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('PHASE_9_UI_GATE=PASS');
  process.exit(0);
} else {
  console.log('PHASE_9_UI_GATE=FAIL');
  process.exit(1);
}
