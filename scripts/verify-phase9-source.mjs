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

// 1. Phase 8 Migration Locks Preserved
const p8MigrationMap = [
  { file: 'supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql', expected: 'e046ea3f62aaa76f00295e68126ca29a48bfaa9b' },
  { file: 'supabase/migrations/20260831142135_phase_8_cross_currency_transfer_integrity_corrective.sql', expected: '5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18' },
  { file: 'supabase/migrations/20260831144154_phase_8_transfer_trigger_security_hardening.sql', expected: '3ee23b513bcd65182afa613084dda8fbf5b40293' },
  { file: 'supabase/migrations/20260831150000_phase_8_transfer_trigger_search_path_hardening.sql', expected: '78be2172d313935057aee57fccfc98ed73a5b4d4' },
];

for (const p8 of p8MigrationMap) {
  const content = fs.readFileSync(p8.file, 'utf-8');
  const actualSha = sha(content);
  check(`Phase 8 migration lock preserved: ${p8.file}`, actualSha === p8.expected);
}

// 2. Phase 9 Migration Existence and Atomicity
const phase9MigPath = 'supabase/migrations/20260901100000_phase_9_income_sources_revenue_attribution.sql';
check('Phase 9 migration file exists', fs.existsSync(phase9MigPath));

const phase9Mig = fs.readFileSync(phase9MigPath, 'utf-8');
check('Phase 9 migration is atomic (BEGIN/COMMIT)', phase9Mig.startsWith('BEGIN;') && phase9Mig.trim().endsWith('COMMIT;'));

// 3. Schema details in migration
const migLower = phase9Mig.toLowerCase();
check('income_sources user_id has DEFAULT auth.uid()', migLower.includes('user_id uuid not null default auth.uid()'));
check('income_source_streams user_id has DEFAULT auth.uid()', migLower.includes('user_id uuid not null default auth.uid()'));
check('income_source_streams composite FK to income_sources ON DELETE RESTRICT',
  migLower.includes('foreign key (income_source_id, user_id)') &&
  migLower.includes('references public.income_sources (id, user_id) on delete restrict'));
check('transactions composite FK to income_sources ON DELETE RESTRICT',
  migLower.includes('foreign key (income_source_id, user_id)') &&
  migLower.includes('references public.income_sources (id, user_id) on delete restrict'));
check('transactions composite FK to income_source_streams ON DELETE RESTRICT',
  migLower.includes('foreign key (income_source_stream_id, income_source_id, user_id)') &&
  migLower.includes('references public.income_source_streams (id, income_source_id, user_id) on delete restrict'));

// 4. Constraint guards scoped with conrelid in migration
check('transactions composite FK guards use conrelid',
  phase9Mig.includes("WHERE conname = 'transactions_income_source_fkey'") &&
  phase9Mig.includes("AND conrelid = 'public.transactions'::regclass") &&
  phase9Mig.includes("WHERE conname = 'transactions_income_source_stream_fkey'"));
check('transactions CHECK guards use conrelid',
  phase9Mig.includes("WHERE conname = 'check_transaction_expense_no_attribution'") &&
  phase9Mig.includes("AND conrelid = 'public.transactions'::regclass") &&
  phase9Mig.includes("WHERE conname = 'check_transaction_stream_requires_source'"));

// 5. Trigger and Function in migration
check('check_transaction_attribution_active function has SECURITY INVOKER', phase9Mig.includes('SECURITY INVOKER'));
check('check_transaction_attribution_active function has SET search_path = \'\'', phase9Mig.includes("SET search_path = ''"));
check('check_transaction_attribution_active_trigger defined on transactions',
  phase9Mig.includes('CREATE TRIGGER check_transaction_attribution_active_trigger'));

// 6. View transaction_details in migration
check('transaction_details view has security_invoker = true', phase9Mig.includes('security_invoker = true'));
check('transaction_details view preserves 17 prefix columns and appends attribution columns',
  phase9Mig.includes('t.id,') &&
  phase9Mig.includes('t.user_id,') &&
  phase9Mig.includes('t.account_id,') &&
  phase9Mig.includes('t.category_id,') &&
  phase9Mig.includes('t.type,') &&
  (phase9Mig.includes('CAST(t.amount AS TEXT) AS amount') || phase9Mig.includes('t.amount::text AS amount')) &&
  phase9Mig.includes('t.currency_code,') &&
  phase9Mig.includes('t.merchant,') &&
  phase9Mig.includes('t.note,') &&
  phase9Mig.includes('t.occurred_on,') &&
  phase9Mig.includes('t.is_voided,') &&
  phase9Mig.includes('t.created_at,') &&
  phase9Mig.includes('t.updated_at,') &&
  phase9Mig.includes('a.name AS account_name,') &&
  phase9Mig.includes('c.name AS category_name,') &&
  phase9Mig.includes('c.icon AS category_icon,') &&
  phase9Mig.includes('c.color AS category_color,') &&
  phase9Mig.includes('t.income_source_id,') &&
  phase9Mig.includes('t.income_source_stream_id,') &&
  phase9Mig.includes('src.name AS income_source_name,') &&
  phase9Mig.includes('src.type AS income_source_type,') &&
  phase9Mig.includes('strm.name AS income_source_stream_name'));

// 7. Security and RLS in Migration
check('income_sources has ENABLE ROW LEVEL SECURITY', phase9Mig.includes('ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;'));
check('income_source_streams has ENABLE ROW LEVEL SECURITY', phase9Mig.includes('ALTER TABLE public.income_source_streams ENABLE ROW LEVEL SECURITY;'));
check('AUTHENTICATED_SOURCE_TABLE_ALL_REVOKED: revoke all from anon, authenticated, PUBLIC',
  phase9Mig.includes('REVOKE ALL ON TABLE public.income_sources FROM anon, authenticated, PUBLIC;') ||
  phase9Mig.includes('REVOKE ALL ON public.income_sources FROM anon, authenticated, PUBLIC;'));
check('AUTHENTICATED_STREAM_TABLE_ALL_REVOKED: revoke all from anon, authenticated, PUBLIC',
  phase9Mig.includes('REVOKE ALL ON TABLE public.income_source_streams FROM anon, authenticated, PUBLIC;') ||
  phase9Mig.includes('REVOKE ALL ON public.income_source_streams FROM anon, authenticated, PUBLIC;'));
check('SOURCE_TABLE_LEVEL_MUTATION_NOT_GRANTED: no table level INSERT/UPDATE on income_sources',
  !phase9Mig.match(/GRANT\s+INSERT\s+ON\s+(TABLE\s+)?public\.income_sources\s+TO/i) &&
  !phase9Mig.match(/GRANT\s+UPDATE\s+ON\s+(TABLE\s+)?public\.income_sources\s+TO/i));
check('STREAM_TABLE_LEVEL_MUTATION_NOT_GRANTED: no table level INSERT/UPDATE on income_source_streams',
  !phase9Mig.match(/GRANT\s+INSERT\s+ON\s+(TABLE\s+)?public\.income_source_streams\s+TO/i) &&
  !phase9Mig.match(/GRANT\s+UPDATE\s+ON\s+(TABLE\s+)?public\.income_source_streams\s+TO/i));
check('SOURCE_COLUMN_ALLOWLIST_EXACT: income_sources column-level INSERT and UPDATE allowlists',
  phase9Mig.includes('GRANT INSERT (name, type)') &&
  phase9Mig.includes('GRANT UPDATE (name, type, is_archived)'));
check('STREAM_COLUMN_ALLOWLIST_EXACT: income_source_streams column-level INSERT and UPDATE allowlists',
  phase9Mig.includes('GRANT INSERT (income_source_id, name)') &&
  phase9Mig.includes('GRANT UPDATE (name, is_archived)'));
check('No DELETE grant on income_sources or streams to authenticated',
  !phase9Mig.includes('GRANT DELETE ON public.income_sources') &&
  !phase9Mig.includes('GRANT DELETE ON TABLE public.income_sources') &&
  !phase9Mig.includes('GRANT DELETE ON public.income_source_streams') &&
  !phase9Mig.includes('GRANT DELETE ON TABLE public.income_source_streams'));

// 8. DB Verifier Structural Gate Hardened Analysis
const dbVerifierPath = 'scripts/verify-phase9-db.sql';
check('scripts/verify-phase9-db.sql exists', fs.existsSync(dbVerifierPath));
const dbVerifier = fs.readFileSync(dbVerifierPath, 'utf-8');

check('DB_VERIFIER_FAIL_CLOSED_BLOCK: uses DO $$ ... $$ assertion block',
  dbVerifier.includes('DO $$') && dbVerifier.includes('RAISE EXCEPTION'));
check('DB_VERIFIER_EFFECTIVE_TABLE_ACL_CHECKS: asserts has_table_privilege for authenticated and anon',
  dbVerifier.includes("has_table_privilege('authenticated', 'public.income_sources', 'SELECT')") &&
  dbVerifier.includes("has_table_privilege('authenticated', 'public.income_sources', 'INSERT')") &&
  dbVerifier.includes("has_table_privilege('authenticated', 'public.income_source_streams', 'SELECT')") &&
  dbVerifier.includes("has_table_privilege('authenticated', 'public.income_source_streams', 'INSERT')"));
check('DB_VERIFIER_ANON_ALL_PRIVILEGES_ABSENT: asserts anon has no SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER',
  dbVerifier.includes("has_table_privilege('anon', 'public.income_sources', 'TRUNCATE')") &&
  dbVerifier.includes("has_table_privilege('anon', 'public.income_sources', 'REFERENCES')") &&
  dbVerifier.includes("has_table_privilege('anon', 'public.income_sources', 'TRIGGER')") &&
  dbVerifier.includes("has_table_privilege('anon', 'public.income_source_streams', 'TRUNCATE')") &&
  dbVerifier.includes("has_table_privilege('anon', 'public.income_source_streams', 'REFERENCES')") &&
  dbVerifier.includes("has_table_privilege('anon', 'public.income_source_streams', 'TRIGGER')"));
check('DB_VERIFIER_EFFECTIVE_COLUMN_ACL_CHECKS: asserts has_column_privilege exact allowlists',
  dbVerifier.includes("has_column_privilege('authenticated', 'public.income_sources', 'name', 'INSERT')") &&
  dbVerifier.includes("has_column_privilege('authenticated', 'public.income_sources', 'user_id', 'INSERT')") &&
  dbVerifier.includes("has_column_privilege('authenticated', 'public.income_source_streams', 'income_source_id', 'INSERT')") &&
  dbVerifier.includes("has_column_privilege('authenticated', 'public.income_source_streams', 'user_id', 'INSERT')"));
check('DB_VERIFIER_RLS_COMMAND_MATRIX_EXACT: asserts polcmd = r, a, w and no DELETE or ALL policies',
  dbVerifier.includes("polcmd = 'r'") &&
  dbVerifier.includes("polcmd = 'a'") &&
  dbVerifier.includes("polcmd = 'w'") &&
  dbVerifier.includes("polcmd IN ('d', '*')"));
check('DB_VERIFIER_RLS_ROLES_EXACT: asserts polroles equals authenticated role OID array',
  dbVerifier.includes('v_auth_role_oid') &&
  dbVerifier.includes('v_pol_roles != ARRAY[v_auth_role_oid]'));
check('DB_VERIFIER_RLS_SELECT_EXPR_EXACT: asserts SELECT has ownership polqual and NULL polwithcheck',
  dbVerifier.includes('v_pol_check IS NOT NULL') &&
  dbVerifier.includes('income_sources SELECT policy must have ownership polqual and NULL polwithcheck') &&
  dbVerifier.includes('income_source_streams SELECT policy must have ownership polqual and NULL polwithcheck'));
check('DB_VERIFIER_RLS_INSERT_EXPR_EXACT: asserts INSERT has NULL polqual and ownership polwithcheck',
  dbVerifier.includes('v_pol_qual IS NOT NULL') &&
  dbVerifier.includes('income_sources INSERT policy must have NULL polqual and ownership polwithcheck') &&
  dbVerifier.includes('income_source_streams INSERT policy must have NULL polqual and ownership polwithcheck'));
check('DB_VERIFIER_RLS_UPDATE_EXPR_EXACT: asserts UPDATE has ownership polqual and ownership polwithcheck',
  dbVerifier.includes('income_sources UPDATE policy must have ownership polqual and ownership polwithcheck') &&
  dbVerifier.includes('income_source_streams UPDATE policy must have ownership polqual and ownership polwithcheck'));
check('DB_VERIFIER_EXACT_UNIQUE_KEY_ORDER: asserts conkey WITH ORDINALITY for unique keys',
  dbVerifier.includes("conname = 'income_sources_id_user_id_key'") &&
  dbVerifier.includes("v_keys != ARRAY['id', 'user_id']") &&
  dbVerifier.includes("conname = 'income_source_streams_id_income_source_id_user_id_key'") &&
  dbVerifier.includes("v_keys != ARRAY['id', 'income_source_id', 'user_id']") &&
  dbVerifier.includes('WITH ORDINALITY'));
check('DB_VERIFIER_EXACT_FK_LOCAL_KEY_ORDER: asserts local conkey order for composite FKs',
  dbVerifier.includes("v_local_keys != ARRAY['income_source_id', 'user_id']") &&
  dbVerifier.includes("v_local_keys != ARRAY['income_source_stream_id', 'income_source_id', 'user_id']"));
check('DB_VERIFIER_EXACT_FK_REFERENCED_KEY_ORDER: asserts confkey order and confdeltype = r for composite FKs',
  dbVerifier.includes("v_ref_keys != ARRAY['id', 'user_id']") &&
  dbVerifier.includes("v_ref_keys != ARRAY['id', 'income_source_id', 'user_id']") &&
  dbVerifier.includes("confdeltype = 'r'"));
check('DB_VERIFIER_CHECK_CONSTRAINT_SEMANTICS_EXACT: asserts CHECK constraint definitions',
  dbVerifier.includes('check_income_source_name_length') &&
  dbVerifier.includes('check_income_source_type') &&
  dbVerifier.includes('check_income_source_stream_name_length') &&
  dbVerifier.includes('check_transaction_expense_no_attribution') &&
  dbVerifier.includes('check_transaction_stream_requires_source'));
check('DB_VERIFIER_TRIGGER_BITMASK_CHECKS: asserts tgtype bitmask for updated_at and attribution triggers',
  dbVerifier.includes('(tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 16 = 16)') &&
  dbVerifier.includes('(tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 4 = 4) AND (tgtype & 16 = 16)'));
check('DB_VERIFIER_UPDATED_AT_FUNCTION_BINDING_EXACT: asserts handle_updated_at() binding for updated_at triggers',
  dbVerifier.includes("tgfoid = 'public.handle_updated_at()'::regprocedure"));
check('DB_VERIFIER_ACTIVE_TRIGGER_FUNCTION_BINDING_EXACT: asserts check_transaction_attribution_active() binding for attribution trigger',
  dbVerifier.includes("tgfoid = 'public.check_transaction_attribution_active()'::regprocedure"));
check('DB_VERIFIER_FUNCTION_IDENTITY_AND_SECURITY: asserts pronamespace=public, 0 args, and prosecdef=FALSE (SECURITY INVOKER)',
  dbVerifier.includes("pronamespace = 'public'::regnamespace") &&
  dbVerifier.includes('pronargs = 0') &&
  dbVerifier.includes('prosecdef = FALSE'));
check('DB_VERIFIER_FUNCTION_SEARCH_PATH_EMPTY_EXACT: asserts exact empty search_path in proconfig',
  dbVerifier.includes("'search_path=\"\"' = ANY(v_proconfig)") &&
  dbVerifier.includes("cfg NOT IN ('search_path=\"\"', 'search_path=''''', 'search_path=')"));
check('DB_VERIFIER_VIEW_REL_OPTIONS: asserts security_invoker = true in reloptions',
  dbVerifier.includes("security_invoker=true"));
check('DB_VERIFIER_22_COLUMN_ORDER: asserts exact 22 column array order',
  dbVerifier.includes("'income_source_stream_name'") && dbVerifier.includes("v_col_order != v_expected_order"));
check('DB_VERIFIER_AMOUNT_TEXT: asserts amount data_type = text in transaction_details',
  dbVerifier.includes("column_name = 'amount' AND data_type = 'text'"));
check('TRIGGER_NAME_MATCH: trigger name is identical in migration and DB verifier',
  dbVerifier.includes('check_transaction_attribution_active_trigger') &&
  phase9Mig.includes('check_transaction_attribution_active_trigger'));

// 9. TypeScript definitions
const dbTypes = fs.readFileSync('src/types/database.ts', 'utf-8');
check('database.ts includes income_sources table', dbTypes.includes('income_sources: {'));
check('database.ts includes income_source_streams table', dbTypes.includes('income_source_streams: {'));
check('database.ts includes IncomeSourceType', dbTypes.includes('export type IncomeSourceType ='));
check('database.ts includes attribution in transactions', dbTypes.includes('income_source_id: string | null;'));
check('database.ts includes attribution in transaction_details view',
  dbTypes.includes('income_source_name: string | null;') &&
  dbTypes.includes('income_source_type: IncomeSourceType | null;') &&
  dbTypes.includes('income_source_stream_name: string | null;'));

// 10. Feature domain & services
check('src/features/income-sources/domain.ts exists', fs.existsSync('src/features/income-sources/domain.ts'));
check('src/features/income-sources/income-sources.ts exists', fs.existsSync('src/features/income-sources/income-sources.ts'));
check('src/features/income-sources/types.ts exists', fs.existsSync('src/features/income-sources/types.ts'));
check('src/features/income-sources/index.ts exists', fs.existsSync('src/features/income-sources/index.ts'));

const domainCode = fs.readFileSync('src/features/income-sources/domain.ts', 'utf-8');
check('DOMAIN_MONETARY_INPUT_STRING_ONLY: amount is strictly string (not string | number)',
  domainCode.includes('amount: string;') && !domainCode.includes('amount: string | number;'));
check('DOMAIN_CURRENCY_FAIL_CLOSED: no silent VND fallback in domain attribution',
  !domainCode.includes("|| 'VND'") && !domainCode.includes('|| "VND"') &&
  domainCode.includes('validateAttributionCurrencyCode'));
check('DOMAIN_EXACT_DECIMAL_SORTING: uses compareExactDecimals for deterministic sorting',
  domainCode.includes('compareExactDecimals'));
check('domain.ts uses exact decimal money functions',
  domainCode.includes('addExactDecimals') && domainCode.includes('toExactDecimal'));
check('domain.ts contains zero JS float math on financial accumulation',
  !domainCode.includes('parseFloat(') && !domainCode.includes('Number(') && !domainCode.match(/\b\d+\.\d+\s*[\*\/]/));

const serviceCode = fs.readFileSync('src/features/income-sources/income-sources.ts', 'utf-8');
check('service createIncomeSource does not inject user_id',
  !serviceCode.includes('user_id: userData.user.id') && serviceCode.includes("from('income_sources')"));
check('service updateIncomeSourceStream does not mutate income_source_id',
  !serviceCode.includes('payload.income_source_id ='));

const txServiceCode = fs.readFileSync('src/features/transactions/transactions.ts', 'utf-8');
check('transactions.ts imports attribution validation from domain',
  txServiceCode.includes('validateTransactionAttribution'));
check('transactions.ts maps incomeSourceName and stream fields in mapDetailRow',
  txServiceCode.includes('incomeSourceName: row.income_source_name') &&
  txServiceCode.includes('incomeSourceStreamName: row.income_source_stream_name'));

// 11. Tests and Contract
check('tests/phase9-income-sources.test.ts exists', fs.existsSync('tests/phase9-income-sources.test.ts'));
check('docs/PHASE_9_CONTRACT.md exists', fs.existsSync('docs/PHASE_9_CONTRACT.md'));

console.log(`\n=== Phase 9 Source Verification Result: ${passed}/${total} checks passed ===\n`);

if (passed !== total) {
  process.exit(1);
}
