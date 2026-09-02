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

function sha(content) {
  return crypto.createHash('sha1').update(`blob ${content.length}\0${content}`).digest('hex');
}

console.log('=== Finora Phase 9 Pass B — UI / UX Verification ===\n');

// 1. Immutable migration locks preserved
const immutableMigrations = [
  { file: 'supabase/migrations/20260901100000_phase_9_income_sources_revenue_attribution.sql', expected: '6dc4b14fd39de41ace15d64d0769ab688af05c9e' },
];

for (const mig of immutableMigrations) {
  const content = fs.readFileSync(mig.file, 'utf-8');
  const actualSha = sha(content);
  check(`Migration lock preserved: ${mig.file}`, actualSha === mig.expected);
}

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

// 4. Transaction Attribution in AddTransactionModal
const addTxModal = fs.readFileSync('src/components/finance/AddTransactionModal.tsx', 'utf-8');
check('AddTransactionModal loads income sources & streams',
  addTxModal.includes('getIncomeSourcesWithStreams') &&
  addTxModal.includes('incomeSources') &&
  addTxModal.includes('incomeSourceId') &&
  addTxModal.includes('incomeSourceStreamId'));
check('AddTransactionModal displays attribution UI for INCOME type only',
  addTxModal.includes("type === 'INCOME'") &&
  addTxModal.includes('Nguồn thu nhập'));
check('AddTransactionModal clears attribution payload for EXPENSE type',
  addTxModal.includes("type === 'INCOME' ? (incomeSourceId || null) : null") &&
  addTxModal.includes("type === 'INCOME' && incomeSourceId ? (incomeSourceStreamId || null) : null"));

// 5. Transaction item attribution presentation
const txItem = fs.readFileSync('src/components/finance/TransactionItem.tsx', 'utf-8');
check('TransactionItem displays income attribution badge',
  txItem.includes('transaction.incomeSourceName') &&
  txItem.includes('transaction.incomeSourceStreamName'));

// 6. IncomeSourcesBreakdown Chart Component
check('IncomeSourcesBreakdown component exists', fs.existsSync('src/components/charts/IncomeSourcesBreakdown.tsx'));
const breakdownChart = fs.readFileSync('src/components/charts/IncomeSourcesBreakdown.tsx', 'utf-8');
check('IncomeSourcesBreakdown uses IncomeSourceBreakdown interface and formatExactMoney',
  breakdownChart.includes('IncomeSourceBreakdown') &&
  breakdownChart.includes('formatExactMoney') &&
  breakdownChart.includes('sourceType'));

// 7. Reporting engine & Reports page integration
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

// Summary
console.log(`\nVerification complete: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('PHASE_9_UI_GATE=PASS');
  process.exit(0);
} else {
  console.log('PHASE_9_UI_GATE=FAIL');
  process.exit(1);
}
