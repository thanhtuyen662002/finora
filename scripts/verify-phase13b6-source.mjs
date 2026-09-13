import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260913214500_phase_13b6_receivable_account_linkage.sql';
const servicePath = 'src/features/receivables/receivables.ts';
const typesPath = 'src/features/receivables/types.ts';
const pagePath = 'src/app/receivables/page.tsx';
const read = (path) => fs.readFileSync(path, 'utf8');

const migration = read(migrationPath);
const service = read(servicePath);
const types = read(typesPath);
const page = read(pagePath);

const checks = [
  ['13B6 migration exists', fs.existsSync(migrationPath)],
  ['receivable stores funding account', migration.includes('ADD COLUMN IF NOT EXISTS funding_account_id UUID NULL')],
  ['payment stores receiving account', migration.includes('ADD COLUMN IF NOT EXISTS receiving_account_id UUID NULL')],
  ['funding account ownership and currency are FK-bound', migration.includes('receivables_funding_account_fkey') && migration.includes('(funding_account_id, user_id, currency_code)')],
  ['receiving account ownership and currency are FK-bound', migration.includes('receivable_payments_receiving_account_fkey') && migration.includes('(receiving_account_id, user_id, currency_code)')],
  ['new receivable RPC authenticates caller', /create_receivable_v2[\s\S]*auth\.uid\(\)/.test(migration)],
  ['new receivable RPC rejects credit-card funding', migration.includes('Credit-card accounts cannot fund a receivable')],
  ['legacy receivable can be linked once', migration.includes('link_receivable_funding_account') && migration.includes('Funding account is already linked')],
  ['payment RPC requires receiving account', migration.includes('record_receivable_payment_v2') && migration.includes('Receiving account not found or archived')],
  ['principal disbursement reduces account balance without EXPENSE', migration.includes('- COALESCE(rd.lent_principal, 0)')],
  ['principal collection restores account balance without INCOME', migration.includes('+ COALESCE(rc.returned_principal, 0)')],
  ['only interest creates INCOME transaction', migration.includes("'INCOME',\n            p_interest_amount")],
  ['interest transaction is protected from client mutation', migration.includes('guard_receivable_interest_transaction_mutation') && migration.includes('managed by the receivable ledger')],
  ['old unlinked payment RPC is revoked', migration.includes('REVOKE EXECUTE ON FUNCTION public.record_receivable_payment')],
  ['direct legacy receivable insert path is revoked', migration.includes('REVOKE INSERT (') && migration.includes('ON public.receivables FROM authenticated')],
  ['existing receivable view columns stay before appended linkage columns', /payment_count,\s*r\.funding_account_id/.test(migration)],
  ['existing payment view currency stays before appended linkage columns', /p\.currency_code,\s*p\.receiving_account_id/.test(migration)],
  ['service creates via v2 RPC', service.includes("rpc('create_receivable_v2'")],
  ['service collects via v2 RPC', service.includes("rpc('record_receivable_payment_v2'")],
  ['service supports legacy source linking', service.includes("rpc('link_receivable_funding_account'")],
  ['types require funding account on create', types.includes('funding_account_id: string;')],
  ['types require receiving account on payment', types.includes('receiving_account_id: string;')],
  ['UI asks for funding account', page.includes('Nguồn tiền cho vay')],
  ['UI asks for receiving account', page.includes('Tài khoản nhận tiền')],
  ['UI explains principal is not expense or income', page.includes('không tính là chi tiêu') && page.includes('không tính là thu nhập')],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log(`PHASE_13B6_SOURCE_VERIFIER: ${checks.length - failures}/${checks.length}`);
if (failures > 0) process.exit(1);
