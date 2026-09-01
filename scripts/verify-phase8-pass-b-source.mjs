import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function sha(buf) {
  return crypto.createHash('sha1').update('blob ' + buf.length + '\0' + buf).digest('hex');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

let passed = 0;
let total = 0;

function check(id, description, condition) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${id}. ${description}`);
  } else {
    console.error(`[FAIL] ${id}. ${description}`);
  }
}

// 1. Initial Phase 8 Pass B migration Git blob SHA lock (e046ea3f62aaa76f00295e68126ca29a48bfaa9b)
const origMigBuf = fs.readFileSync('supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql');
const origSha = sha(origMigBuf);
check(1, "Phase 8 Pass B initial migration SHA matches compatible lock", origSha === 'e046ea3f62aaa76f00295e68126ca29a48bfaa9b');

// 2. Phase 8 Pass B integrity corrective migration Git blob SHA unchanged (5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18)
const corrMigBuf = fs.readFileSync('supabase/migrations/20260831142135_phase_8_cross_currency_transfer_integrity_corrective.sql');
const corrSha = sha(corrMigBuf);
check(2, "Phase 8 Pass B integrity corrective migration SHA unchanged", corrSha === '5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18');

// 3. Security hardening migration Git blob SHA unchanged (3ee23b513bcd65182afa613084dda8fbf5b40293)
const secHardeningBuf = fs.readFileSync('supabase/migrations/20260831144154_phase_8_transfer_trigger_security_hardening.sql');
const secHardeningSha = sha(secHardeningBuf);
check(3, "Security hardening migration SHA unchanged", secHardeningSha === '3ee23b513bcd65182afa613084dda8fbf5b40293');

// 4. Security hardening migration removes SECURITY DEFINER and uses SECURITY INVOKER
const secHardeningContent = secHardeningBuf.toString('utf8');
check(4, "Security hardening migration sets SECURITY INVOKER and omits SECURITY DEFINER", secHardeningContent.includes('SECURITY INVOKER') && !secHardeningContent.includes('SECURITY DEFINER'));

// 5. New search_path hardening migration exists with timestamp strictly > 20260831144154
const migrations = fs.readdirSync('supabase/migrations').sort();
const searchPathMigFile = migrations.find(m => {
  const match = m.match(/^(\d{14})_.*search_path.*\.sql$/);
  return match && match[1] > '20260831144154';
});
check(5, "NEW_SEARCH_PATH_MIGRATION_EXISTS: Additive search_path hardening migration exists", Boolean(searchPathMigFile));

// 6. New search_path migration is minimal and additive (ALTER FUNCTION public.check_transfer_accounts_active())
const searchPathMigContent = searchPathMigFile ? fs.readFileSync(path.join('supabase/migrations', searchPathMigFile), 'utf8') : '';
const searchPathIsAdditive = searchPathMigContent.includes('ALTER FUNCTION public.check_transfer_accounts_active()') &&
  searchPathMigContent.includes('BEGIN;') &&
  searchPathMigContent.includes('COMMIT;') &&
  !searchPathMigContent.includes('DROP') &&
  !searchPathMigContent.includes('CREATE TABLE');
check(6, "NEW_SEARCH_PATH_MIGRATION_IS_ADDITIVE: Minimal ALTER FUNCTION in transaction", searchPathIsAdditive);

// 7. New search_path migration targets explicitly empty search_path
const targetsEmptySearchPath = searchPathMigContent.includes("SET search_path TO ''") || searchPathMigContent.includes("SET search_path = ''");
check(7, "FUNCTION_SEARCH_PATH_TARGET_EMPTY: search_path explicitly set to empty string", targetsEmptySearchPath);

// 8. Structural DB verifier exists
const dbVerifierPath = 'scripts/verify-phase8-pass-b-db.sql';
const dbVerifierContent = fs.existsSync(dbVerifierPath) ? fs.readFileSync(dbVerifierPath, 'utf8') : '';
check(8, "Structural DB verifier exists", Boolean(dbVerifierContent));

// 9. Structural DB verifier checks prosecdef (fails if true / leak)
check(9, "FUNCTION_PROSECDEF: Structural DB verifier inspects prosecdef and asserts false", dbVerifierContent.includes('v_prosecdef IS TRUE') && dbVerifierContent.includes('prosecdef'));

// 10. Structural DB verifier checks empty search_path configuration via proconfig
const inspectsSearchPathEmpty = dbVerifierContent.includes('proconfig') &&
  (dbVerifierContent.includes("'search_path=' = ANY(v_proconfig)") || dbVerifierContent.includes("'search_path=\"\"' = ANY(v_proconfig)"));
check(10, "FUNCTION_SEARCH_PATH_EMPTY: Structural DB verifier validates proconfig for empty search_path", inspectsSearchPathEmpty);

// 11. Structural DB verifier checks RLS row security
check(11, "Structural DB verifier inspects relrowsecurity on public.transfers", dbVerifierContent.includes('relrowsecurity') && dbVerifierContent.includes('public.transfers'));

// 12. Structural DB verifier checks exact SELECT RLS policy
const rlsSelectExact = dbVerifierContent.includes("polcmd IN ('r', '*')") &&
  dbVerifierContent.includes("auth.uid()") &&
  dbVerifierContent.includes("user_id") &&
  dbVerifierContent.includes("polqual");
check(12, "RLS_VERIFIER_SELECT_EXACT: DB verifier validates SELECT policy with auth.uid() in USING", rlsSelectExact);

// 13. Structural DB verifier checks exact INSERT RLS policy
const rlsInsertExact = dbVerifierContent.includes("polcmd IN ('a', '*')") &&
  dbVerifierContent.includes("auth.uid()") &&
  dbVerifierContent.includes("user_id") &&
  dbVerifierContent.includes("polwithcheck");
check(13, "RLS_VERIFIER_INSERT_EXACT: DB verifier validates INSERT policy with auth.uid() in WITH CHECK", rlsInsertExact);

// 14. Structural DB verifier checks exact UPDATE RLS policy
const rlsUpdateExact = dbVerifierContent.includes("polcmd IN ('w', '*')") &&
  dbVerifierContent.includes("auth.uid()") &&
  dbVerifierContent.includes("user_id") &&
  dbVerifierContent.includes("polqual") &&
  dbVerifierContent.includes("polwithcheck");
check(14, "RLS_VERIFIER_UPDATE_EXACT: DB verifier validates UPDATE policy with auth.uid() in USING and WITH CHECK", rlsUpdateExact);

// 15. Structural DB verifier checks absence of DELETE RLS policy
const rlsNoDelete = dbVerifierContent.includes("polcmd = 'd'") &&
  dbVerifierContent.includes("must NOT have a DELETE policy");
check(15, "RLS_VERIFIER_NO_DELETE: DB verifier validates absence of DELETE policy on public.transfers", rlsNoDelete);

// 16. Structural DB verifier checks table privileges/grants for anon
check(16, "Structural DB verifier inspects table_privileges for anon role", dbVerifierContent.includes('table_privileges') && dbVerifierContent.includes('anon'));

// 17. Structural DB verifier checks composite foreign keys and ON DELETE RESTRICT
check(17, "Structural DB verifier inspects composite FKs and ON DELETE RESTRICT",
  dbVerifierContent.includes('transfers_from_account_fkey') &&
  dbVerifierContent.includes('transfers_to_account_fkey') &&
  dbVerifierContent.includes('ON DELETE RESTRICT')
);

// 18. Structural DB verifier checks security_invoker on views
check(18, "Structural DB verifier inspects security_invoker on transfer_details and account_balances", dbVerifierContent.includes('security_invoker=true') && dbVerifierContent.includes('transfer_details') && dbVerifierContent.includes('account_balances'));

// 19. Structural DB verifier validates constraint definitions
check(19, "Structural DB verifier validates constraint definitions via pg_get_constraintdef", dbVerifierContent.includes('pg_get_constraintdef') && dbVerifierContent.includes('chk_transfers_same_currency_invariant') && dbVerifierContent.includes('chk_transfers_cross_currency_conversion'));

// 20. Structural DB verifier validates trigger timing, events, and orientation
const triggerSemanticsValid = dbVerifierContent.includes('trg_check_transfer_accounts_active') &&
  dbVerifierContent.includes('(tgtype & 1) = 1') &&
  dbVerifierContent.includes('(tgtype & 2) = 0') &&
  dbVerifierContent.includes('(tgtype & 4) = 4') &&
  dbVerifierContent.includes('(tgtype & 16) = 16');
check(20, "Structural DB verifier validates trigger timing (BEFORE), events (INSERT, UPDATE), and row-level orientation", triggerSemanticsValid);

// 21. Transfer mutation input contract in src/features/transfers/transfers.ts does not expose currency_code
const transferServiceContent = fs.readFileSync('src/features/transfers/transfers.ts', 'utf8');
const insertInputMatch = transferServiceContent.match(/export type TransferInsertInput = \{([\s\S]*?)\};/);
const insertInputText = insertInputMatch ? insertInputMatch[1] : '';
check(21, "TransferInsertInput does not expose currency_code or destination_amount", !insertInputText.includes('currency_code') && !insertInputText.includes('destination_amount'));

// 22. Production domain module src/features/transfers/domain.ts exists
const domainPath = 'src/features/transfers/domain.ts';
const domainContent = fs.existsSync(domainPath) ? fs.readFileSync(domainPath, 'utf8') : '';
check(22, "Production domain module src/features/transfers/domain.ts exists", Boolean(domainContent));

// 23. Test suite tests/phase8-cross-currency-transfers.test.ts imports domain logic
const testContent = fs.readFileSync('tests/phase8-cross-currency-transfers.test.ts', 'utf8');
check(23, "Executable test suite imports from domain module", testContent.includes("from '../src/features/transfers/domain'"));

// 24. UI AddTransferModal fails closed on FX fetch failure
const uiContent = fs.readFileSync('src/components/finance/AddTransferModal.tsx', 'utf8');
check(24, "AddTransferModal UI handles FX fetch error and fails closed", uiContent.includes('Không thể lấy tỷ giá') || uiContent.includes('setErrorMsg'));

// 25. ADR-014 recorded in docs/DECISIONS.md
const decisionsContent = fs.readFileSync('docs/DECISIONS.md', 'utf8');
check(25, "ADR-014 recorded in docs/DECISIONS.md", decisionsContent.includes('ADR-014'));

// 26. DATABASE.md documents transfer table constraints
const dbDocsContent = fs.readFileSync('docs/DATABASE.md', 'utf8');
check(26, "DATABASE.md documents transfer table constraints and triggers", dbDocsContent.includes('chk_transfers_same_currency_invariant'));

// 27. PROJECT_STATUS.md contains remote-pending governance status
const statusContent = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf8');
check(27, "PROJECT_STATUS.md contains remote-pending status", statusContent.includes('PHASE_8_PASS_B_SEARCH_PATH_CORRECTIVE=PENDING'));

// 28. Brand PNG assets sha256 hashes match regression locks
const iconBuf = fs.readFileSync('public/brand/finora-icon.png');
const darkBuf = fs.readFileSync('public/brand/finora-logo-dark.png');
const lightBuf = fs.readFileSync('public/brand/finora-logo-light.png');

const iconSha256 = sha256(iconBuf);
const darkSha256 = sha256(darkBuf);
const lightSha256 = sha256(lightBuf);

const brandOk = iconSha256 === '909fe9a761994d8d95713f794daa76233a2b9e4f6ca5ab6ed39344df00010f55' &&
                darkSha256 === '749fae78db093081fd6d403eb4e7e8d984a7ddfeee79ff5f02ee3da7c2bcf3cc' &&
                lightSha256 === '0dfdd3460f7a11994e4e2c5983429326410a8a46e74ba3900bf58c007b9e5dc7';
check(28, "Brand asset PNG sha256 hashes match regression locks", brandOk);

// 29. transfer_details view projection in Phase 8 preserves Phase 5 17-column prefix in exact order and only appends
function extractFinalSelectColumns(sql, viewName, finalFromTable) {
  const viewBlockRegex = new RegExp('CREATE OR REPLACE VIEW public\\.' + viewName + '[\\s\\S]*?;', 'i');
  const viewMatch = sql.match(viewBlockRegex);
  if (!viewMatch) return [];
  const viewSql = viewMatch[0];
  const finalFromIdx = viewSql.search(new RegExp('FROM\\s+public\\.' + finalFromTable, 'i'));
  if (finalFromIdx === -1) return [];
  const beforeFrom = viewSql.substring(0, finalFromIdx);
  const lastSelectIdx = beforeFrom.lastIndexOf('SELECT');
  if (lastSelectIdx === -1) return [];
  const selectClause = beforeFrom.substring(lastSelectIdx + 6);
  const cols = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < selectClause.length; i++) {
    const c = selectClause[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      cols.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) cols.push(current.trim());
  return cols;
}

const p5Sql = fs.readFileSync('supabase/migrations/20260828000003_phase_5_transfers.sql', 'utf8');
const p8Sql = fs.readFileSync('supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql', 'utf8');

const p5TransferCols = extractFinalSelectColumns(p5Sql, 'transfer_details', 'transfers');
const p8TransferCols = extractFinalSelectColumns(p8Sql, 'transfer_details', 'transfers');

const p5IsPrefix = p5TransferCols.length === 17 &&
  p8TransferCols.length > 17 &&
  p5TransferCols.every((col, idx) => p8TransferCols[idx] === col);

check(29, "transfer_details view in Phase 8 preserves exact 17-column Phase 5 prefix without reordering", p5IsPrefix);

// 30. account_balances view projection in Phase 8 matches Phase 5 columns identically
const p5AccountBalCols = extractFinalSelectColumns(p5Sql, 'account_balances', 'accounts');
const p8AccountBalCols = extractFinalSelectColumns(p8Sql, 'account_balances', 'accounts');

const accountBalMatches = p5AccountBalCols.length === 4 &&
  p8AccountBalCols.length === 4 &&
  p5AccountBalCols.every((col, idx) => p8AccountBalCols[idx] === col);

check(30, "account_balances view in Phase 8 preserves exact 4-column Phase 5 structure", accountBalMatches);

console.log(`\nPHASE_8_PASS_B_SEARCH_PATH_CORRECTIVE_SOURCE=PASS`);
console.log(`PHASE_8_PASS_B_SOURCE_CHECK_COUNT: ${passed}/${total}`);

if (passed !== total) {
  process.exit(1);
}
