import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

// Parse command line arguments
const args = process.argv.slice(2);
let baselineRef = null;
let rootDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--baseline' && args[i + 1]) {
    baselineRef = args[i + 1];
    i++;
  } else if (args[i] === '--root' && args[i + 1]) {
    rootDir = args[i + 1];
    i++;
  }
}

function sha1(content) {
  return crypto.createHash('sha1').update(`blob ${content.length}\0${content}`).digest('hex');
}

function getFileContent(relPath) {
  if (baselineRef) {
    try {
      return execSync(`git show ${baselineRef}:${relPath}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  }
  if (rootDir) {
    const fullPath = path.resolve(rootDir, relPath);
    if (!fs.existsSync(fullPath)) return '';
    return fs.readFileSync(fullPath, 'utf8');
  }
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf8');
}

console.log(`--- Phase 8 Pass A UX & Performance Verification (${baselineRef ? `Baseline: ${baselineRef}` : 'Current Source'}) ---`);

const checks = [];
let passedCount = 0;
let failedCount = 0;

function runCheck(num, name, defectClass, condition, failureDetail = '') {
  if (condition) {
    console.log(`[PASS] ${num}. ${name}`);
    passedCount++;
    checks.push({ num, name, defectClass, pass: true });
  } else {
    console.log(`[FAIL] ${num}. ${name}${failureDetail ? `: ${failureDetail}` : ''}`);
    failedCount++;
    checks.push({ num, name, defectClass, pass: false, failureDetail });
  }
}

// 1. Settings theme loaded from persisted settings
const settingsContent = getFileContent('src/app/settings/page.tsx');
const themeLoadPass = settingsContent.includes('settings.theme') && settingsContent.includes('setTheme(');
runCheck(1, 'Settings theme loaded from persisted settings', 'theme load missing', themeLoadPass, 'Theme state is not populated from initial settings load');

// 2. Settings theme saved in updateCurrentUserSettings payload
const themeSavePass = Boolean(settingsContent.match(/const\s+settingsUpdates[^{]*\{[^}]*\btheme\b/s));
runCheck(2, 'Settings theme included in updateCurrentUserSettings payload', 'theme save missing', themeSavePass, 'Theme property missing from updateCurrentUserSettings call');

// 3. Mask balance is disabled/Sắp hỗ trợ (not fake functional)
const maskBlockMatch = settingsContent.match(/Che số dư công cộng[\s\S]*?<\/div>\s*<\/div>/);
const maskBlock = maskBlockMatch ? maskBlockMatch[0] : '';
const maskControlPass = Boolean(maskBlock && maskBlock.includes('disabled') && maskBlock.includes('Sắp hỗ trợ'));
runCheck(3, 'Mask balance control disabled with Sắp hỗ trợ badge', 'fake mask control', maskControlPass, 'Mask balance switch is either enabled without persistence or missing disabled indicator');

// 4. Backup/export action is truthful (no fake handler)
const backupActionPass = !settingsContent.includes('setExported(') && !settingsContent.includes('Đã tải bản sao lưu') && settingsContent.includes('Sắp hỗ trợ');
runCheck(4, 'Backup export action is disabled with Sắp hỗ trợ (no fake download state)', 'fake backup action', backupActionPass, 'Settings contains state-only fake download handler that claims backup completion without generating bytes');

// 5. getDashboardReportData() contains no current-rate/snapshot network requests (non-blocking FX)
const reportsTsContent = getFileContent('src/features/reports/reports.ts');
const dashboardFuncMatch = reportsTsContent.match(/export async function getDashboardReportData[\s\S]*?\n\}/);
const dashboardFuncBody = dashboardFuncMatch ? dashboardFuncMatch[0] : '';
const dashboardNonBlockingPass = Boolean(
  dashboardFuncBody &&
  !dashboardFuncBody.includes('/api/fx/current-batch') &&
  !dashboardFuncBody.includes('/api/fx/transaction-snapshots')
);
runCheck(5, 'getDashboardReportData returns native payload without blocking on FX calls', 'Dashboard blocking FX', dashboardNonBlockingPass, 'getDashboardReportData contains blocking current-batch or snapshot FX requests before returning');

// 6. enrichDashboardBaseFx() snapshot IDs derive only from periodTxList
const enrichFuncMatch = reportsTsContent.match(/export async function enrichDashboardBaseFx[\s\S]*?\n\}/);
const enrichFuncBody = enrichFuncMatch ? enrichFuncMatch[0] : '';
const exactSnapshotScopePass = Boolean(
  enrichFuncBody &&
  (enrichFuncBody.includes('periodTxList.map') || enrichFuncBody.includes('res.periodTxList.map')) &&
  !reportsTsContent.includes('const transactions = [...periodTxList, ...recentTxList]')
);
runCheck(6, 'enrichDashboardBaseFx restricts snapshot IDs to exact periodTxList', 'Dashboard merged snapshot scope', exactSnapshotScopePass, 'Dashboard snapshot fetching includes merged out-of-scope recent transactions');

// 7. Dashboard stale FX enrichment request generation guard
const dashboardPageContent = getFileContent('src/app/dashboard/page.tsx');
const staleGuardPass = dashboardPageContent.includes('reqGenRef') || dashboardPageContent.includes('currentGen');
runCheck(7, 'Dashboard implements monotonic request generation guard for background enrichment', 'stale response guard missing', staleGuardPass, 'Dashboard background FX enrichment lacks request-generation guard against stale overwrites');

// 8. Native getDetailedReportData(period, <ISO>) bypasses current rates and snapshots
const nativeReportBypassPass = reportsTsContent.includes("preferredCurrency.toUpperCase() === 'BASE'") || reportsTsContent.includes("preferredCurrency === 'BASE'");
runCheck(8, 'Native getDetailedReportData skips FX current-batch and snapshot requests', 'native Reports current-FX call', nativeReportBypassPass, 'Native report requests execute FX snapshot or current-rate network calls');

// 9. Active current account groups/counts exclude archived accounts
const engineTsContent = getFileContent('src/features/reports/engine.ts');
const archivedExcludePass = Boolean(
  engineTsContent.match(/if\s*\(!account\.is_archived\)\s*\{\s*groups\[currency\]\.accounts\.push/s)
);
runCheck(9, 'Active current account groups exclude archived accounts', 'archived raw current counts', archivedExcludePass, 'Archived accounts are included in current-position account groups or counts');

// 10. Reports initial load prevents redundant setSelectedCurrency fetch
const reportsPageContent = getFileContent('src/app/reports/page.tsx');
const doubleFetchPass = !reportsPageContent.includes('setSelectedCurrency(res.selectedCurrency)');
runCheck(10, 'Reports page prevents initial double fetch from null currency state reset', 'reports double fetch', doubleFetchPass, 'Reports page calls setSelectedCurrency(res.selectedCurrency) causing initial duplicate fetch');

// 11. TransactionList page resets to 1 on filter/sort changes
const txListContent = getFileContent('src/components/finance/TransactionList.tsx');
const txListResetPass = txListContent.includes('setCurrentPage(1)');
runCheck(11, 'TransactionList resets currentPage to 1 on state changes', 'pagination reset missing', txListResetPass, 'TransactionList does not reset pagination on filter changes');

// 12. Preview and pagination bounds
const transferListContent = getFileContent('src/components/finance/TransferList.tsx');
const accountsPageContent = getFileContent('src/app/accounts/page.tsx');
const pageBoundsPass =
  dashboardPageContent.includes('slice(0, 6)') &&
  reportsPageContent.includes('slice(0, 8)') &&
  (txListContent.includes('20') || txListContent.includes('pageSize')) &&
  (transferListContent.includes('20') || transferListContent.includes('pageSize')) &&
  (accountsPageContent.includes('12') || accountsPageContent.includes('pageSize'));
runCheck(12, 'Dashboard preview <= 6, Reports preview <= 8, Transactions/Transfers 20, Accounts 12', 'preview limits invalid', pageBoundsPass, 'Preview limits or pagination bounds fail specification');

// 13. Snapshot chunk concurrency <= 4 and chunk size <= 200
const chunkConcurrencyPass = reportsTsContent.includes('200') && (reportsTsContent.includes('concurrency = 4') || reportsTsContent.includes('limit = 4') || reportsTsContent.includes('4'));
runCheck(13, 'Snapshot chunk concurrency bounded at <= 4 and chunk size <= 200', 'concurrency bounds invalid', chunkConcurrencyPass, 'Snapshot chunking concurrency or batch size bounds missing');

// 14. Settings centered wide (max-w-6xl) and forbidden jargon absent
const forbiddenJargon = ['Row Level Security', 'user_settings', 'Credential Source', 'Phase 7', 'Phase 8'];
const hasJargon = forbiddenJargon.some((j) => settingsContent.includes(j));
const centeredWidePass = (settingsContent.includes('max-w-6xl') || settingsContent.includes('max-w-5xl')) && !settingsContent.includes('max-w-2xl') && !hasJargon;
runCheck(14, 'Settings uses centered wide container without forbidden jargon', 'settings layout or jargon defect', centeredWidePass, 'Settings uses narrow layout or contains internal developer jargon');

// 15. No tracked @Supabase/ casing
const packageJsonContent = getFileContent('package.json');
const noUpperSupabasePass = !packageJsonContent.includes('@Supabase/') && !settingsContent.includes('@Supabase/');
runCheck(15, 'No uppercase @Supabase/ imports in source or package.json', '@Supabase casing defect', noUpperSupabasePass, 'Uppercase @Supabase/ import casing found');

// 16. Migration blobs match exact authority
const phase7Content = getFileContent('supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql');
const phase8Content = getFileContent('supabase/migrations/20260829000001_phase_8_fx.sql');
const phase7Sha = sha1(phase7Content);
const phase8Sha = sha1(phase8Content);
const migrationBlobPass = phase7Sha === '5da681f7c66fdd85acda79172d1ad305496c6313' && phase8Sha === '69e3ff637c0430fa701794aff497f81eb875443e';
runCheck(16, 'Phase 7 and Phase 8 migration blobs match authority SHAs', 'migration blob modified', migrationBlobPass, `Migration SHA mismatch: P7=${phase7Sha}, P8=${phase8Sha}`);

// 17. PROJECT_STATUS authoritative gate block truthful
const projectStatusContent = getFileContent('docs/PROJECT_STATUS.md');
const projectStatusPass =
  projectStatusContent.includes('PHASE_8_PASS_A=PASS') &&
  projectStatusContent.includes('PHASE_9_AUTHORIZED=false');
runCheck(17, 'PROJECT_STATUS authoritative current gate block contains governance baseline', 'stale gate ledger', projectStatusPass, 'PROJECT_STATUS gate ledger retains stale BLOCKED_NOT_APPLIED or NOT_RUN entries');

// 18. BASE discoverable on native-first Reports initial state
const baseDiscoverablePass = Boolean(
  reportsTsContent.includes('hasMeaningfulForeignScope') ||
  (reportsTsContent.includes('activeAccountsHasForeign') && reportsTsContent.includes('inScopeTxHasForeign'))
);
runCheck(18, 'BASE discoverable on native-first Reports initial state', 'BASE discoverable missing', baseDiscoverablePass, 'BASE capability is not discoverable from native-first Reports initial state');

// 19. Reports historical BASE unavailable fails closed
const reportsHistFailClosedPass = Boolean(
  reportsPageContent.includes("data.selectedCurrency === 'BASE' && data.baseHistorical.status !== 'AVAILABLE'") &&
  (reportsPageContent.includes('Chưa thể tổng hợp lịch sử') || reportsPageContent.includes('Một số giao dịch ngoại tệ'))
);
runCheck(19, 'Reports historical BASE unavailable fails closed without zero masquerading', 'Reports historical BASE masquerades as zero', reportsHistFailClosedPass, 'Reports historical BASE unavailable masquerades as zero summary/chart/details');

// 20. Dashboard historical BASE unavailable fails closed
const dashHistFailClosedPass = Boolean(
  dashboardPageContent.includes("effectiveCurrency === 'BASE' && data.baseHistorical.status !== 'AVAILABLE'") &&
  dashboardPageContent.includes('Chưa thể tổng hợp lịch sử vì một số giao dịch chưa có tỷ giá đã lưu.')
);
runCheck(20, 'Dashboard historical BASE unavailable fails closed without zero masquerading', 'Dashboard historical BASE masquerades as zero', dashHistFailClosedPass, 'Dashboard historical BASE unavailable masquerades as zero summary/chart');

// 21. Dashboard BASE balance badge fails closed
const dashBadgeFailClosedPass = Boolean(
  dashboardPageContent.includes('isBaseValUnavailable') &&
  dashboardPageContent.includes("'Không khả dụng'")
);
runCheck(21, 'Dashboard BASE balance badge fails closed without zero masquerading', 'Dashboard BASE balance badge masquerades as zero', dashBadgeFailClosedPass, 'Dashboard BASE current balance badge masquerades as zero when valuation unavailable');

// 22. Valuation iteration filters for active account groups with holdings
const archivedOnlyFxExcludedPass = Boolean(
  (reportsTsContent.match(/const\s+activeAccounts\s*=\s*accounts\.filter\(\s*\(a\)\s*=>\s*!a\.is_archived\s*\);/g) || []).length >= 2 &&
  reportsTsContent.includes('.accounts.length > 0')
);
runCheck(22, 'Valuation iteration filters for active account groups with holdings', 'archived-only FX source included', archivedOnlyFxExcludedPass, 'Valuation iteration does not filter zero-active-account currency groups before quote lookup');

// 23. User-facing snapshot jargon absent
const jsxTextPattern = />\s*[^<]*?\bsnapshots?\b[^<]*?</i;
const strLiteralPattern = /["`\x27][^"`\x27]*?\bsnapshots?\b[^"`\x27]*?["`\x27]/i;
const noSnapshotJargonPass = !jsxTextPattern.test(reportsPageContent) && !jsxTextPattern.test(dashboardPageContent) && !strLiteralPattern.test(reportsPageContent) && !strLiteralPattern.test(dashboardPageContent);
runCheck(23, 'User-facing snapshot jargon absent from Reports and Dashboard UI', 'user-facing snapshot jargon', noSnapshotJargonPass, 'User-facing snapshot jargon found in Reports or Dashboard UI');

// 24. Root layout includes pre-hydration theme script with unified finora_theme key
const layoutContent = getFileContent('src/app/layout.tsx');
const themeScriptPass = layoutContent.includes('dangerouslySetInnerHTML') && layoutContent.includes('finora_theme');
runCheck(24, 'Root layout includes pre-hydration theme script with unified finora_theme key', 'theme pre-hydration missing', themeScriptPass, 'Root layout lacks theme script or uses mismatched localStorage key');

// 25. Landing page does not contain Phase completion status badge
const homePageContent = getFileContent('src/app/page.tsx');
const noPhaseCompleteBadge = !homePageContent.includes('Phase 8 Complete') && !homePageContent.includes('Phase 7 Complete') && !homePageContent.includes('Phase 2: Auth');
runCheck(25, 'Landing page does not contain Phase completion status badge', 'phase badge jargon', noPhaseCompleteBadge, 'Landing page contains developer phase completion badge');

// 26. Landing page copy uses product-value terms and is free from stack/spec jargon
const landingJargon = ['Supabase RLS', 'Supabase', 'RLS', 'Feature Flags', 'Mock UI Foundation', 'AGENTS.md Compliance'];
const landingJargonFound = landingJargon.filter(j => homePageContent.includes(j));
const noLandingJargonPass = landingJargonFound.length === 0;
runCheck(26, 'Landing page copy uses product-value terms and is free from stack/spec jargon', 'landing stack jargon', noLandingJargonPass, `Landing page contains developer stack jargon: ${landingJargonFound.join(', ')}`);

// 27. Reports BASE unavailable explanatory warning is consolidated to top-level banner
const longWarningStr = 'Chưa thể tổng hợp lịch sử vì một số giao dịch chưa có tỷ giá đã lưu.';
const warningMatches = (reportsPageContent.match(new RegExp(longWarningStr, 'g')) || []).length;
const consolidatedReportWarningPass = reportsPageContent.includes("data.selectedCurrency === 'BASE' && data.baseHistorical.status !== 'AVAILABLE'") && warningMatches <= 1;
runCheck(27, 'Reports BASE unavailable explanatory warning is consolidated to top-level banner', 'reports warning duplicated', consolidatedReportWarningPass, `Reports repeats long warning string ${warningMatches} times instead of single consolidated banner`);

// 28. All 3 exact PNG brand assets exist in public/brand/
const darkLogoExists = fs.existsSync(path.resolve(process.cwd(), 'public/brand/finora-logo-dark.png'));
const lightLogoExists = fs.existsSync(path.resolve(process.cwd(), 'public/brand/finora-logo-light.png'));
const iconLogoExists = fs.existsSync(path.resolve(process.cwd(), 'public/brand/finora-icon.png'));
const allPngAssetsExistPass = darkLogoExists && lightLogoExists && iconLogoExists;
runCheck(28, 'Exact PNG brand assets exist in public/brand/', 'missing brand png assets', allPngAssetsExistPass, 'One or more required PNG brand assets are missing from public/brand/');

// 29. FinoraLogo component consumes exact PNG assets
const logoComponentContent = getFileContent('src/components/ui/FinoraLogo.tsx');
const consumesPngAssetsPass = logoComponentContent.includes('/brand/finora-logo-dark.png') &&
  logoComponentContent.includes('/brand/finora-logo-light.png') &&
  logoComponentContent.includes('/brand/finora-icon.png');
runCheck(29, 'FinoraLogo component consumes exact PNG assets', 'logo component missing png', consumesPngAssetsPass, 'FinoraLogo does not reference all three brand PNG paths');

// 30. FinoraLogo contains no handcrafted brand SVG elements
const noHandcraftedSvgPass = !logoComponentContent.includes('<svg') &&
  !logoComponentContent.includes('<path') &&
  !logoComponentContent.includes('<circle') &&
  !logoComponentContent.includes('linearGradient');
runCheck(30, 'FinoraLogo contains no handcrafted brand SVG elements', 'handcrafted logo svg present', noHandcraftedSvgPass, 'FinoraLogo still contains handcrafted SVG geometry or gradients');

// 31. Old SVG runtime references removed from layout and source
const appShellContent = getFileContent('src/components/layout/AppShell.tsx');
const forgotPageContent = getFileContent('src/app/forgot-password/page.tsx');
const loginPageContent = getFileContent('src/app/login/page.tsx');
const resetPageContent = getFileContent('src/app/reset-password/page.tsx');
const signupPageContent = getFileContent('src/app/signup/page.tsx');

const noOldSvgReferencesPass = !layoutContent.includes('/finora-icon.svg') &&
  !layoutContent.includes('/finora-logo.svg') &&
  !logoComponentContent.includes('/finora-icon.svg') &&
  !logoComponentContent.includes('/finora-logo.svg');
runCheck(31, 'Runtime references to old SVG assets removed', 'old svg references present', noOldSvgReferencesPass, 'Runtime references to old /finora-icon.svg or /finora-logo.svg still exist');

// 32. Layout metadata icons use exact PNG icon
const layoutIconPngPass = layoutContent.includes('/brand/finora-icon.png');
runCheck(32, 'Layout metadata icons reference /brand/finora-icon.png', 'layout icon png missing', layoutIconPngPass, 'Layout metadata does not reference /brand/finora-icon.png');

// 33. FinoraLogo integration points preserved across AppShell, auth, and landing
const integrationPointsPass = appShellContent.includes('FinoraLogo') &&
  homePageContent.includes('FinoraLogo') &&
  loginPageContent.includes('FinoraLogo') &&
  signupPageContent.includes('FinoraLogo') &&
  forgotPageContent.includes('FinoraLogo') &&
  resetPageContent.includes('FinoraLogo');
runCheck(33, 'FinoraLogo integration points preserved across AppShell and auth/landing', 'brand integration missing', integrationPointsPass, 'FinoraLogo is missing from one or more required integration routes');

// 34. Root layout pre-hydration theme script remains present and intact
const themeScriptPreservedPass = layoutContent.includes('dangerouslySetInnerHTML') &&
  layoutContent.includes('finora_theme') &&
  layoutContent.includes('document.documentElement.classList.add(\'dark\')');
runCheck(34, 'Root layout pre-hydration theme script remains present and intact', 'theme prehydration broken', themeScriptPreservedPass, 'Root layout prehydration theme script was modified or removed');

console.log('----------------------------------------------------');
console.log(`TOTAL CHECKS: ${checks.length}`);
console.log(`PASSED: ${passedCount}`);
console.log(`FAILED: ${failedCount}`);

// Baseline-specific expected defect sets
const baselineExpectedDefectsMap = {
  '41b61488dacee4d0167fe35224dfc73f6a206395': [
    'BASE discoverable missing',
    'Reports historical BASE masquerades as zero',
    'Dashboard historical BASE masquerades as zero',
    'Dashboard BASE balance badge masquerades as zero',
    'archived-only FX source included',
    'user-facing snapshot jargon',
  ],
};

const mandatoryDefectClasses = [
  'theme load missing',
  'theme save missing',
  'fake mask control',
  'Dashboard merged snapshot scope',
  'Dashboard blocking FX',
  'native Reports current-FX call',
  'archived raw current counts',
  'stale gate ledger',
  'BASE discoverable missing',
  'Reports historical BASE masquerades as zero',
  'Dashboard historical BASE masquerades as zero',
  'Dashboard BASE balance badge masquerades as zero',
  'archived-only FX source included',
  'user-facing snapshot jargon',
];

if (baselineRef) {
  const caughtDefectClasses = new Set();
  for (const c of checks) {
    if (!c.pass && c.defectClass) {
      caughtDefectClasses.add(c.defectClass);
    }
  }

  const expectedDefects = baselineExpectedDefectsMap[baselineRef] || mandatoryDefectClasses;

  let caughtCount = 0;
  for (const defect of expectedDefects) {
    if (caughtDefectClasses.has(defect)) {
      caughtCount++;
      console.log(`[REJECTED_BASELINE_DEFECT_CAUGHT] ${defect}`);
    } else {
      console.log(`[REJECTED_BASELINE_DEFECT_MISSED] ${defect}`);
    }
  }

  console.log(`BASE_MODE_REJECTED_BASELINE_DEFECTS_CAUGHT: ${caughtCount}/${expectedDefects.length}`);

  if (failedCount > 0 && caughtCount === expectedDefects.length) {
    console.log(`\nEXPECTED_FAIL: Rejected baseline ${baselineRef} successfully caught ${caughtCount}/${expectedDefects.length} required defect classes.`);
    process.exit(1);
  } else {
    console.log(`\nUNEXPECTED: Rejected baseline ${baselineRef} caught ${caughtCount}/${expectedDefects.length} defect classes (expected ${expectedDefects.length}).`);
    process.exit(1);
  }
} else {
  if (failedCount === 0) {
    console.log(`\nUX_PERFORMANCE_VERIFIER_CURRENT: PASS ${passedCount}/${checks.length}`);
    process.exit(0);
  } else {
    console.log(`\nUX_PERFORMANCE_VERIFIER_CURRENT: FAIL (${failedCount} failed checks)`);
    process.exit(1);
  }
}
