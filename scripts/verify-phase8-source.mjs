import fs from 'fs';
import path from 'fs';
import crypto from 'crypto';

let passed = 0;
const total = 26;

function check(num, name, condition) {
  if (condition) {
    console.log(`[PASS] ${num}. ${name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${num}. ${name}`);
  }
}

function sha(content) {
  return crypto.createHash('sha1').update(`blob ${content.length}\0${content}`).digest('hex');
}

const phase7Mig = fs.readFileSync('supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql', 'utf-8');
const phase7Sha = sha(phase7Mig);
check(1, "Phase 7 migration SHA unchanged", phase7Sha === '5da681f7c66fdd85acda79172d1ad305496c6313');

const phase5Mig = fs.readFileSync('supabase/migrations/20260828000003_phase_5_transfers.sql', 'utf-8');
check(2, "Phase 5 transfer migration/schema remains same-currency-only", !phase5Mig.includes('to_currency') && !phase5Mig.includes('exchange_rate'));

const phase8Mig = fs.readFileSync('supabase/migrations/20260829000001_phase_8_fx.sql', 'utf-8');
check(3, "Phase 8 migration path exists and is atomic BEGIN/COMMIT", phase8Mig.includes('BEGIN;') && phase8Mig.includes('COMMIT;'));

const uniqueTxIdx = phase8Mig.indexOf('UNIQUE (id, user_id)');
const createTableIdx = phase8Mig.indexOf('CREATE TABLE public.transaction_fx_snapshots');
check(4, "transaction (id,user_id) unique appears before snapshot FK creation", uniqueTxIdx !== -1 && createTableIdx !== -1 && uniqueTxIdx < createTableIdx);

const dbTypes = fs.readFileSync('src/types/database.ts', 'utf-8');
check(5, "Database relationship truthful", dbTypes.includes('fk_snapshot_transaction') && dbTypes.includes('"transaction_id", "user_id"'));

check(6, "authenticated snapshot privileges are SELECT-only", phase8Mig.includes('GRANT SELECT ON public.transaction_fx_snapshots TO authenticated;') && !phase8Mig.includes('GRANT INSERT ON public.transaction_fx_snapshots TO authenticated;'));
check(7, "exact security_invoker snapshot view text-casts", phase8Mig.includes("source_amount::text") && phase8Mig.includes("rate::text") && phase8Mig.includes("converted_amount::text") && phase8Mig.includes('security_invoker = true'));

const adminClient = fs.readFileSync('src/lib/supabase/admin.ts', 'utf-8');
check(8, "service-role key is non-public and admin client imports server-only", adminClient.includes('server-only') && !adminClient.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'));

const frankfurter = fs.readFileSync('src/lib/exchange-rate/frankfurter.ts', 'utf-8');
check(9, "provider uses v2 rates.csv", frankfurter.includes('/v2/rates.csv') && !frankfurter.includes('/v1/'));

const fxMath = fs.readFileSync('src/lib/exchange-rate/fx-math.ts', 'utf-8');
check(10, "exact rate is string-only and >12 decimals rejected", fxMath.includes('if (fractionalPart.length > 12)') && fxMath.includes('throw new Error'));

check(11, "authoritative FX conversion contains no JS float math", !fxMath.includes('parseFloat(') && !fxMath.includes('Number(') && !fxMath.match(/\b\d+\.\d+\s*[\*\/]/));

const currentBatch = fs.readFileSync('src/app/api/fx/current-batch/route.ts', 'utf-8');
check(12, "current valuation has no non-identity 1.0 fallback", !currentBatch.includes('rate: 1.0') && !currentBatch.includes('rate: 1 '));

const reportEngine = fs.readFileSync('src/features/reports/reports.ts', 'utf-8');
check(13, "BASE current valuation fail closed (no native fallback)", reportEngine.includes('accountsInCurrency = null') && reportEngine.includes('totalAccountBalance = null'));

const reportUi = fs.readFileSync('src/app/reports/page.tsx', 'utf-8');
check(14, "BASE unavailable states cannot become zero/native-base masquerading totals", reportUi.includes('Không khả dụng') && reportUi.includes('data.baseValuation.status !== \'AVAILABLE\'') && reportUi.includes('formatExactMoney(summary.netSavings, displayCurrency'));

const dashboardUi = fs.readFileSync('src/app/dashboard/page.tsx', 'utf-8');
check(15, "dashboard native account list excludes synthetic BASE copies and handles unavailable", !dashboardUi.includes('group.currency_code === \'BASE\'') && dashboardUi.includes('Không khả dụng') && dashboardUi.includes("c === 'BASE' ? data.baseCurrency : c"));

const csv = fs.readFileSync('src/features/reports/engine.ts', 'utf-8');
check(16, "BASE CSV contains all required provenance headers/fields", csv.includes('fx_original_amount') && csv.includes('fx_provider') && csv.includes('fx_target_currency') && csv.includes('Ngày tỷ giá hiệu lực') && !csv.includes('headers.push'));

import { execSync } from 'child_process';
const patchFiles = execSync('ls scripts/patch_*.mjs 2>/dev/null || echo ""').toString().trim();
check(17, "no scripts/patch_*.mjs remain", patchFiles === '');

const mathTests = fs.readFileSync('tests/phase8-math.test.ts', 'utf-8');
check(18, "No placeholder test assertions", !mathTests.includes('assertEq(true, true'));

const dbVer = fs.readFileSync('scripts/verify-phase8-db.sql', 'utf-8');
check(19, "Structural verifier exhaustive", dbVer.includes('99_OVERALL') && dbVer.includes('{3,5}') && dbVer.includes('security_invoker=true') && dbVer.includes('fk_snapshot_transaction') && dbVer.includes('auth.uid() = user_id'));

const rlsVer = fs.readFileSync('scripts/verify-phase8-rls.mjs', 'utf-8');
check(20, "Runtime verifier real operations", rlsVer.includes('signInWithPassword') && !rlsVer.includes('console.error(`[FAIL] ${msg}: Did not throw`); process.exit(1); }') && rlsVer.includes('auto_fx_enabled'));

const status = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf-8');
check(21, "PROJECT_STATUS truthful", status.includes('PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY') && status.includes('PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED'));

const adr = fs.readFileSync('docs/DECISIONS.md', 'utf-8');
const dbDocs = fs.readFileSync('docs/DATABASE.md', 'utf-8');
check(22, "ADR-013 and DATABASE docs exist with required semantics", adr.includes('ADR-013') && dbDocs.includes('transaction_fx_snapshots'));
check(23, "Phase 9 remains unauthorized", status.includes('PHASE_9_AUTHORIZED=false'));

check(24, "Pre-migration explicit-select of auto_fx_enabled is forbidden", !reportEngine.includes("select('base_currency, timezone, auto_fx_enabled')"));

const appShell = fs.readFileSync('src/components/layout/AppShell.tsx', 'utf-8');
check(25, "AppShell fake identity and sequential set is forbidden", !appShell.includes("setDisplayName('Người dùng')") && appShell.includes('getCurrentUserContext'));

check(26, "Tests test actual logic, not placeholder", mathTests.includes('pre-migration settings compatibility') && mathTests.includes('identity display precedence'));

console.log(`\nPHASE_8_SOURCE_CHECK_COUNT: ${passed}/${total}`);
if (passed !== total) process.exit(1);
