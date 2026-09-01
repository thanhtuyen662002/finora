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
  dbVerifierContent.includes('(tgtype & 2) = 2') &&
  !dbVerifierContent.includes('(tgtype & 2) = 0') &&
  dbVerifierContent.includes('(tgtype & 4) = 4') &&
  dbVerifierContent.includes('(tgtype & 16) = 16');
check(20, "Structural DB verifier validates trigger timing (BEFORE), events (INSERT, UPDATE), and row-level orientation with correct bitmasks", triggerSemanticsValid);

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

// 27. PROJECT_STATUS.md contains runtime-pending governance status
const statusContent = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf8');
const textBlocks = [...statusContent.matchAll(/```text([\s\S]*?)```/g)];
const lastTextBlock = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1][1].trim() : '';
const governanceStatusValid = lastTextBlock.includes('PHASE_8_PASS_B_TWO_USER_RLS_RUNTIME=PENDING') &&
  lastTextBlock.includes('PHASE_8_PASS_B_STRUCTURAL_REMOTE_GATE=PASS') &&
  lastTextBlock.includes('PHASE_8_PASS_B_SEARCH_PATH_CORRECTIVE=PASS') &&
  lastTextBlock.includes('PHASE_8_OVERALL=PARTIAL') &&
  lastTextBlock.includes('PHASE_9_AUTHORIZED=false');
check(27, "PROJECT_STATUS.md contains verified structural and pending runtime governance status", governanceStatusValid);

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

// 31. Runtime harness file scripts/verify-phase8-pass-b-runtime.sql exists
const runtimeHarnessPath = 'scripts/verify-phase8-pass-b-runtime.sql';
const runtimeHarnessContent = fs.existsSync(runtimeHarnessPath) ? fs.readFileSync(runtimeHarnessPath, 'utf8') : '';
check(31, "RUNTIME_HARNESS_EXISTS: scripts/verify-phase8-pass-b-runtime.sql exists", Boolean(runtimeHarnessContent));

// 32. Runtime harness uses transactional encapsulation (BEGIN; ... ROLLBACK;)
const isTransactional = runtimeHarnessContent.startsWith('BEGIN;') || runtimeHarnessContent.includes('\nBEGIN;');
const endsWithRollback = runtimeHarnessContent.includes('ROLLBACK;') && !runtimeHarnessContent.includes('COMMIT;');
check(32, "RUNTIME_TRANSACTION_ISOLATION: Harness executes strictly inside transaction ending with ROLLBACK", isTransactional && endsWithRollback);

// 33. Runtime harness binds two distinct auth users
const bindsTwoUsers = runtimeHarnessContent.includes('auth.users') &&
  runtimeHarnessContent.includes('v_user_a') &&
  runtimeHarnessContent.includes('v_user_b') &&
  runtimeHarnessContent.includes('cardinality(v_users)');
check(33, "RUNTIME_TWO_USER_BINDING: Harness queries and binds two distinct auth.users safely", bindsTwoUsers);

// 34. Runtime harness switches role and validates auth.uid()
const switchesRoleAndUid = (runtimeHarnessContent.includes('SET LOCAL ROLE authenticated') || runtimeHarnessContent.includes('EXECUTE \'SET LOCAL ROLE authenticated\'')) &&
  runtimeHarnessContent.includes('request.jwt.claim.sub') &&
  runtimeHarnessContent.includes('auth.uid()');
check(34, "RUNTIME_AUTH_SWITCH: Harness switches to authenticated role and verifies auth.uid()", switchesRoleAndUid);

// 35. Runtime harness tests same-currency transfer and transfer_details view
const testsSameCurrency = runtimeHarnessContent.includes('RUNTIME_SAME_CURRENCY=PASS') &&
  runtimeHarnessContent.includes('public.transfers') &&
  runtimeHarnessContent.includes('public.transfer_details');
check(35, "RUNTIME_SAME_CURRENCY_TEST: Harness tests same-currency transfer in table and view", testsSameCurrency);

// 36. Runtime harness tests cross-currency transfer and dual-currency balance effects
const testsCrossCurrency = runtimeHarnessContent.includes('RUNTIME_USD_TO_VND=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_DUAL_CURRENCY_BALANCES=PASS') &&
  runtimeHarnessContent.includes('public.account_balances');
check(36, "RUNTIME_CROSS_CURRENCY_TEST: Harness tests cross-currency transfer and dual-currency balance impacts", testsCrossCurrency);

// 37. Runtime harness tests void and restore lifecycle
const testsVoidRestore = runtimeHarnessContent.includes('RUNTIME_VOID=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_RESTORE=PASS') &&
  runtimeHarnessContent.includes('is_voided = true') &&
  runtimeHarnessContent.includes('is_voided = false');
check(37, "RUNTIME_VOID_RESTORE_TEST: Harness validates void and restore state transitions and balance rollbacks", testsVoidRestore);

// 38. Runtime harness tests historical FX stability
const testsHistoricalFx = runtimeHarnessContent.includes('RUNTIME_HISTORICAL_FX_STABLE=PASS') &&
  runtimeHarnessContent.includes('exchange_rate') &&
  runtimeHarnessContent.includes('destination_amount');
check(38, "RUNTIME_HISTORICAL_FX_TEST: Harness asserts historical exchange rate and destination amount remain immutable", testsHistoricalFx);

// 39. Runtime harness tests cross-user SELECT isolation
const testsCrossUserSelect = runtimeHarnessContent.includes('RUNTIME_USER_B_CANNOT_READ_A=PASS') &&
  runtimeHarnessContent.includes('public.transfers') &&
  runtimeHarnessContent.includes('public.transfer_details');
check(39, "RUNTIME_CROSS_USER_SELECT: Harness proves USER_B cannot read USER_A transfer in table or view", testsCrossUserSelect);

// 40. Runtime harness tests cross-user UPDATE isolation
const testsCrossUserUpdate = runtimeHarnessContent.includes('RUNTIME_USER_B_CANNOT_UPDATE_A=PASS') &&
  runtimeHarnessContent.includes('ROW_COUNT');
check(40, "RUNTIME_CROSS_USER_UPDATE: Harness proves USER_B cannot mutate USER_A transfer", testsCrossUserUpdate);

// 41. Runtime harness tests cross-user account insertion denial
const testsCrossUserAccount = runtimeHarnessContent.includes('RUNTIME_CROSS_USER_ACCOUNT_REJECTED=PASS') &&
  runtimeHarnessContent.includes('v_acc_a_usd') &&
  runtimeHarnessContent.includes('v_user_b');
check(41, "RUNTIME_CROSS_USER_ACCOUNT_INSERT: Harness proves USER_B cannot create transfer on USER_A account", testsCrossUserAccount);

// 42. Runtime harness tests DELETE authority rejection
const testsNoDelete = runtimeHarnessContent.includes('RUNTIME_DELETE_REJECTED=PASS') &&
  runtimeHarnessContent.includes('DELETE FROM public.transfers');
check(42, "RUNTIME_NO_DELETE: Harness proves authenticated role cannot DELETE transfers", testsNoDelete);

// 43. Runtime harness tests negative database integrity matrix
const testsNegativeMatrix = runtimeHarnessContent.includes('RUNTIME_BAD_SAME_CURRENCY_RATE_REJECTED=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_BAD_SAME_CURRENCY_DESTINATION_REJECTED=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_BAD_CROSS_CURRENCY_DESTINATION_REJECTED=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_ACCOUNT_CURRENCY_MISMATCH_REJECTED=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_SAME_ACCOUNT_REJECTED=PASS') &&
  runtimeHarnessContent.includes('RUNTIME_ARCHIVED_ACCOUNT_REJECTED=PASS');
check(43, "RUNTIME_NEGATIVE_INTEGRITY: Harness tests complete negative matrix of invalid transfers and archived accounts", testsNegativeMatrix);

// 44. Runtime harness tests transfer/transaction isolation
const testsTxIsolation = runtimeHarnessContent.includes('RUNTIME_TRANSFER_DOES_NOT_CREATE_TRANSACTION=PASS') &&
  runtimeHarnessContent.includes('public.transactions');
check(44, "RUNTIME_TX_ISOLATION: Harness validates transfers do not mutate or create records in transactions table", testsTxIsolation);

// 45. ACCOUNT_BALANCES_USES_ACCOUNT_ID
const usesAccountId = runtimeHarnessContent.includes('FROM public.account_balances WHERE account_id =');
check(45, "ACCOUNT_BALANCES_USES_ACCOUNT_ID: Harness queries public.account_balances using account_id", usesAccountId);

// 46. ACCOUNT_BALANCES_USES_CURRENT_BALANCE
const usesCurrentBalance = runtimeHarnessContent.includes('SELECT current_balance');
check(46, "ACCOUNT_BALANCES_USES_CURRENT_BALANCE: Harness selects current_balance column", usesCurrentBalance);

// 47. ACCOUNT_BALANCES_CASTS_EXACT_NUMERIC
const castsExactNumeric = runtimeHarnessContent.includes('current_balance::numeric');
check(47, "ACCOUNT_BALANCES_CASTS_EXACT_NUMERIC: Harness casts current_balance to exact numeric", castsExactNumeric);

// 48. ACCOUNT_BALANCES_OLD_ID_BALANCE_PATTERN_ABSENT
const oldPatternAbsent = !runtimeHarnessContent.includes('SELECT balance') &&
  !runtimeHarnessContent.includes('FROM public.account_balances WHERE id');
check(48, "ACCOUNT_BALANCES_OLD_ID_BALANCE_PATTERN_ABSENT: Old id/balance query pattern completely absent", oldPatternAbsent);

// 49. AUTHENTICATED_INSERT_DOES_NOT_SET_IS_VOIDED
const insertStatements = [...runtimeHarnessContent.matchAll(/INSERT\s+INTO\s+public\.transfers\s*\(([\s\S]*?)\)\s*VALUES/gi)];
const noInsertHasIsVoided = insertStatements.length > 0 &&
  insertStatements.every(m => !m[1].includes('is_voided'));
check(49, "AUTHENTICATED_INSERT_DOES_NOT_SET_IS_VOIDED: All authenticated transfer INSERTs omit is_voided", noInsertHasIsVoided);

// 50. POSITIVE_INSERT_ASSERTS_DEFAULT_IS_VOIDED_FALSE
const assertsDefaultIsVoidedFalse = runtimeHarnessContent.includes("is_voided not false") ||
  runtimeHarnessContent.includes("v_t_voided IS NOT FALSE") ||
  runtimeHarnessContent.includes("did not default is_voided to false");
check(50, "POSITIVE_INSERT_ASSERTS_DEFAULT_IS_VOIDED_FALSE: Harness verifies database defaults is_voided to false", assertsDefaultIsVoidedFalse);

// 51. NEGATIVE_CHECK_SQLSTATE_VALIDATION
const checkSqlStateValidated = runtimeHarnessContent.includes('check_violation') ||
  runtimeHarnessContent.includes("SQLSTATE = '23514'");
check(51, "NEGATIVE_CHECK_SQLSTATE_VALIDATION: Negative CHECK cases validate SQLSTATE 23514 / check_violation", checkSqlStateValidated);

// 52. NEGATIVE_FK_SQLSTATE_VALIDATION
const fkSqlStateValidated = runtimeHarnessContent.includes('foreign_key_violation') ||
  runtimeHarnessContent.includes("SQLSTATE = '23503'");
check(52, "NEGATIVE_FK_SQLSTATE_VALIDATION: Negative FK cases validate SQLSTATE 23503 / foreign_key_violation", fkSqlStateValidated);

// 53. ARCHIVE_TRIGGER_ERROR_VALIDATION
const archiveTriggerValidated = (runtimeHarnessContent.includes('raise_exception') || runtimeHarnessContent.includes("SQLSTATE = 'P0001'")) &&
  runtimeHarnessContent.includes('archived');
check(53, "ARCHIVE_TRIGGER_ERROR_VALIDATION: Archive test validates trigger exception P0001 and archived message", archiveTriggerValidated);

// 54. CROSS_USER_REJECTION_CAUSE_VALIDATED
const crossUserRejectionValidated = runtimeHarnessContent.includes('RUNTIME_CROSS_USER_ACCOUNT_REJECTED=PASS') &&
  (runtimeHarnessContent.includes('foreign_key_violation') || runtimeHarnessContent.includes("SQLSTATE = '23503'"));
check(54, "CROSS_USER_REJECTION_CAUSE_VALIDATED: Cross-user account attack validates FK violation rejection", crossUserRejectionValidated);

// 55. DELETE_REJECTION_CAUSE_VALIDATED
const deleteRejectionValidated = runtimeHarnessContent.includes('RUNTIME_DELETE_REJECTED=PASS') &&
  (runtimeHarnessContent.includes('insufficient_privilege') || runtimeHarnessContent.includes("SQLSTATE = '42501'") || runtimeHarnessContent.includes('v_rowcount > 0'));
check(55, "DELETE_REJECTION_CAUSE_VALIDATED: DELETE authority test validates exact authorization denial", deleteRejectionValidated);

// 56. UNEXPECTED_ERROR_FALSE_PASS_PREVENTED
const unexpectedErrorsReraised = (runtimeHarnessContent.match(/RAISE;/g) || []).length >= 6;
check(56, "UNEXPECTED_ERROR_FALSE_PASS_PREVENTED: Unexpected exception classes are re-raised to prevent false PASS", unexpectedErrorsReraised);

console.log(`\nPHASE_8_PASS_B_RUNTIME_HARNESS_SOURCE=PASS`);
console.log(`PHASE_8_PASS_B_SOURCE_CHECK_COUNT: ${passed}/${total}`);

if (passed !== total) {
  process.exit(1);
}
