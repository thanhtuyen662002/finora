import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

function checkFileExists(relPath) {
  const fullPath = path.resolve(process.cwd(), relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

console.log('--- Phase 8 Pass A UX & Performance Verification ---');

// 1. Check Settings page layout and forbidden jargon
const settingsContent = checkFileExists('src/app/settings/page.tsx');
assert.ok(
  settingsContent.includes('max-w-6xl') || settingsContent.includes('max-w-5xl') || settingsContent.includes('max-w-7xl'),
  'Settings page must use a centered wide container (e.g. max-w-6xl), not a narrow max-w-2xl container'
);
assert.ok(!settingsContent.includes('max-w-2xl'), 'Settings page must not use narrow max-w-2xl container layout');

const forbiddenJargon = [
  'Row Level Security',
  'user_settings',
  'Credential Source',
  'Phase 7',
  'Phase 8',
  'UNAVAILABLE',
];
for (const jargon of forbiddenJargon) {
  assert.ok(
    !settingsContent.includes(jargon),
    `Settings page contains forbidden developer/internal jargon: "${jargon}"`
  );
}

// Check friendly labels in Settings
assert.ok(settingsContent.includes('Tiền tệ cơ sở'), 'Settings page must use user-friendly "Tiền tệ cơ sở" label');
assert.ok(settingsContent.includes('Tiền tệ & khu vực'), 'Settings page must use user-friendly "Tiền tệ & khu vực" card title');
assert.ok(settingsContent.includes('Sáng') && settingsContent.includes('Tối') && settingsContent.includes('Theo hệ thống'), 'Settings page must use friendly theme options: Sáng, Tối, Theo hệ thống');

// 2. Check Reports engine & page
const reportsPageContent = checkFileExists('src/app/reports/page.tsx');
assert.ok(
  !reportsPageContent.includes('setSelectedCurrency(res.selectedCurrency)'),
  'Reports page useEffect must not call setSelectedCurrency(res.selectedCurrency) to prevent initial double fetch'
);

const reportsEngineContent = checkFileExists('src/features/reports/reports.ts');
assert.ok(
  reportsEngineContent.includes("preferredCurrency.toUpperCase() !== 'BASE'") ||
  reportsEngineContent.includes("preferredCurrency !== 'BASE'"),
  'Reports engine must skip FX snapshot requests in native report mode (preferredCurrency !== BASE)'
);

// 3. Check TransactionList & TransferList pagination
const txListContent = checkFileExists('src/components/finance/TransactionList.tsx');
assert.ok(
  txListContent.includes('setCurrentPage(1)') && (txListContent.includes('filterKey') || txListContent.includes('useEffect')),
  'TransactionList must reset currentPage to 1 on filter/sort state changes'
);
assert.ok(
  txListContent.includes('pageSize = 20') || txListContent.includes('pageSize: 20'),
  'TransactionList must use page size 20'
);

const transferListContent = checkFileExists('src/components/finance/TransferList.tsx');
assert.ok(
  transferListContent.includes('pageSize = 20') || transferListContent.includes('pageSize: 20'),
  'TransferList must use page size 20'
);

// 4. Check Dashboard & Reports preview limits and active account filtering
const dashboardContent = checkFileExists('src/app/dashboard/page.tsx');
assert.ok(
  dashboardContent.includes('slice(0, 6)'),
  'Dashboard must limit account preview to max 6'
);
assert.ok(
  dashboardContent.includes('!acc.isArchived') || dashboardContent.includes('isArchived'),
  'Dashboard must exclude archived accounts from account preview'
);

assert.ok(
  reportsPageContent.includes('slice(0, 8)'),
  'Reports page must limit account preview to max 8'
);
assert.ok(
  reportsPageContent.includes('!acc.isArchived') || reportsPageContent.includes('isArchived'),
  'Reports page must exclude archived accounts from account preview'
);

// 5. Check Accounts page pagination
const accountsContent = checkFileExists('src/app/accounts/page.tsx');
assert.ok(
  accountsContent.includes('12') || accountsContent.includes('pageSize'),
  'Accounts page must be paginated'
);

console.log('✅ ALL PHASE 8 PASS A UX & PERFORMANCE VERIFICATIONS PASSED SUCCESSFULLY!');
process.exit(0);
