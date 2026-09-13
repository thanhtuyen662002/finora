import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260913210000_phase_13b5_receivables.sql';
const servicePath = 'src/features/receivables/receivables.ts';
const pagePath = 'src/app/receivables/page.tsx';
const read = (path) => fs.readFileSync(path, 'utf8');

const migration = read(migrationPath);
const service = read(servicePath);
const page = read(pagePath);

const checks = [
  ['receivables migration exists', fs.existsSync(migrationPath)],
  ['receivables table is owner scoped', migration.includes('CREATE TABLE IF NOT EXISTS public.receivables') && migration.includes('user_id UUID NOT NULL DEFAULT auth.uid()')],
  ['payments are append-only through RPC', migration.includes('CREATE TABLE IF NOT EXISTS public.receivable_payments') && migration.includes('record_receivable_payment')],
  ['payment RPC authenticates and locks receivable', /auth\.uid\(\)[\s\S]*FOR UPDATE/.test(migration)],
  ['payment RPC reduces principal only', migration.includes('outstanding_amount = outstanding_amount - p_principal_amount')],
  ['payment RPC rejects principal above outstanding', migration.includes('Principal received exceeds outstanding receivable')],
  ['views use security invoker', (migration.match(/security_invoker = true/g) || []).length >= 2],
  ['RLS is enabled for both tables', migration.includes('ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY') && migration.includes('ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY')],
  ['payment mutation is not directly writable', migration.includes('REVOKE ALL ON TABLE public.receivable_payments FROM anon, authenticated, PUBLIC') && !migration.includes('GRANT INSERT ON public.receivable_payments TO authenticated')],
  ['RPC is restricted to authenticated', migration.includes('GRANT EXECUTE ON FUNCTION public.record_receivable_payment') && migration.includes('TO authenticated')],
  ['service performs exact decimal split validation', service.includes('addExactDecimals(principal, interest)') && service.includes('compareExactDecimals')],
  ['service rechecks outstanding before RPC', service.includes('current.outstanding_amount') && service.includes('Tiền gốc nhận vượt quá dư còn phải thu')],
  ['UI exposes borrower and outstanding semantics', page.includes('Người vay') && page.includes('Dư còn phải thu')],
  ['UI keeps principal and interest separate', page.includes('Tiền gốc') && page.includes('Tiền lãi')],
  [
    'UI keeps receivable cashflow classification explicit',
    page.includes('Chưa tự tạo giao dịch thu tiền vào ví/ngân hàng') ||
      (page.includes('không tính là chi tiêu') && page.includes('không tính là thu nhập')),
  ],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log(`PHASE_13B5_SOURCE_VERIFIER: ${checks.length - failures}/${checks.length}`);
if (failures > 0) process.exit(1);
