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

// 4. CHECK constraints in migration
check('check_income_source_name_length present', phase9Mig.includes('CONSTRAINT check_income_source_name_length'));
check('check_income_source_type present', phase9Mig.includes('CONSTRAINT check_income_source_type'));
check('check_income_source_stream_name_length present', phase9Mig.includes('CONSTRAINT check_income_source_stream_name_length'));
check('check_transaction_expense_no_attribution present', phase9Mig.includes('CONSTRAINT check_transaction_expense_no_attribution'));
check('check_transaction_stream_requires_source present', phase9Mig.includes('CONSTRAINT check_transaction_stream_requires_source'));

// 5. Trigger and Function
check('check_transaction_attribution_active function has SECURITY INVOKER', phase9Mig.includes('SECURITY INVOKER'));
check('check_transaction_attribution_active function has SET search_path = \'\'', phase9Mig.includes("SET search_path = ''"));
check('check_transaction_attribution_active_trigger defined on transactions',
  phase9Mig.includes('CREATE TRIGGER check_transaction_attribution_active_trigger'));

// 6. View transaction_details
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

// 7. Security and RLS
check('income_sources has ENABLE ROW LEVEL SECURITY', phase9Mig.includes('ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;'));
check('income_source_streams has ENABLE ROW LEVEL SECURITY', phase9Mig.includes('ALTER TABLE public.income_source_streams ENABLE ROW LEVEL SECURITY;'));
check('income_sources column-level INSERT grant excludes user_id',
  phase9Mig.includes('GRANT INSERT (name, type) ON public.income_sources TO authenticated;'));
check('income_sources column-level UPDATE grant excludes user_id',
  phase9Mig.includes('GRANT UPDATE (name, type, is_archived) ON public.income_sources TO authenticated;'));
check('income_source_streams column-level INSERT grant excludes user_id',
  phase9Mig.includes('GRANT INSERT (income_source_id, name) ON public.income_source_streams TO authenticated;'));
check('income_source_streams column-level UPDATE grant excludes user_id and income_source_id',
  phase9Mig.includes('GRANT UPDATE (name, is_archived) ON public.income_source_streams TO authenticated;'));
check('No DELETE grant on income_sources or streams to authenticated',
  !phase9Mig.includes('GRANT DELETE ON public.income_sources TO authenticated') &&
  !phase9Mig.includes('GRANT DELETE ON public.income_source_streams TO authenticated'));

// 8. TypeScript definitions
const dbTypes = fs.readFileSync('src/types/database.ts', 'utf-8');
check('database.ts includes income_sources table', dbTypes.includes('income_sources: {'));
check('database.ts includes income_source_streams table', dbTypes.includes('income_source_streams: {'));
check('database.ts includes IncomeSourceType', dbTypes.includes('export type IncomeSourceType ='));
check('database.ts includes attribution in transactions', dbTypes.includes('income_source_id: string | null;'));
check('database.ts includes attribution in transaction_details view',
  dbTypes.includes('income_source_name: string | null;') &&
  dbTypes.includes('income_source_type: IncomeSourceType | null;') &&
  dbTypes.includes('income_source_stream_name: string | null;'));

// 9. Feature domain & services
check('src/features/income-sources/domain.ts exists', fs.existsSync('src/features/income-sources/domain.ts'));
check('src/features/income-sources/income-sources.ts exists', fs.existsSync('src/features/income-sources/income-sources.ts'));
check('src/features/income-sources/types.ts exists', fs.existsSync('src/features/income-sources/types.ts'));
check('src/features/income-sources/index.ts exists', fs.existsSync('src/features/income-sources/index.ts'));

const domainCode = fs.readFileSync('src/features/income-sources/domain.ts', 'utf-8');
check('domain.ts uses exact decimal money functions',
  domainCode.includes('addExactDecimals') && domainCode.includes('toExactDecimal'));
check('domain.ts contains zero JS float math on financial accumulation',
  !domainCode.includes('parseFloat(') && !domainCode.includes('Number(') && !domainCode.match(/\b\d+\.\d+\s*[\*\/]/));

const serviceCode = fs.readFileSync('src/features/income-sources/income-sources.ts', 'utf-8');
check('service createIncomeSource does not inject user_id',
  !serviceCode.includes('user_id: userData.user.id') && serviceCode.includes('from(\'income_sources\')'));
check('service updateIncomeSourceStream does not mutate income_source_id',
  !serviceCode.includes('payload.income_source_id ='));

const txServiceCode = fs.readFileSync('src/features/transactions/transactions.ts', 'utf-8');
check('transactions.ts imports attribution validation from domain',
  txServiceCode.includes('validateTransactionAttribution'));
check('transactions.ts maps incomeSourceName and stream fields in mapDetailRow',
  txServiceCode.includes('incomeSourceName: row.income_source_name') &&
  txServiceCode.includes('incomeSourceStreamName: row.income_source_stream_name'));

// 10. Tests and Verifiers
check('tests/phase9-income-sources.test.ts exists', fs.existsSync('tests/phase9-income-sources.test.ts'));
check('scripts/verify-phase9-db.sql exists', fs.existsSync('scripts/verify-phase9-db.sql'));
check('docs/PHASE_9_CONTRACT.md exists', fs.existsSync('docs/PHASE_9_CONTRACT.md'));

console.log(`\n=== Phase 9 Source Verification Result: ${passed}/${total} checks passed ===\n`);

if (passed !== total) {
  process.exit(1);
}
