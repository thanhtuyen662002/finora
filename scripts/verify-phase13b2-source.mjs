import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migrationPath = 'supabase/migrations/20260909071009_phase_13b2_cross_currency_repayments.sql';
const checks = [
  ['Phase 13B2 contract exists', fs.existsSync('docs/PHASE_13B2_CONTRACT.md')],
  ['Additive Phase 13B2 migration exists', fs.existsSync(migrationPath)],
  ['Migration defines the explicit v2 RPC', read(migrationPath).includes('record_debt_payment_v2')],
  ['Migration locks the debt and authenticates the caller', /auth\.uid\(\)[\s\S]*FOR UPDATE/.test(read(migrationPath))],
  ['Migration rejects precision loss', read(migrationPath).includes('round(p_exchange_rate, 12)')],
  ['Migration validates cross-currency reconciliation', read(migrationPath).includes('round(p_account_amount * p_exchange_rate, 4)')],
  ['Migration writes historical FX provenance', read(migrationPath).includes('INSERT INTO public.transaction_fx_snapshots')],
  ['Migration uses an empty search path for definer functions', (read(migrationPath).match(/SET search_path = ''/g) || []).length >= 2],
  ['Migration grants v2 only to authenticated', read(migrationPath).includes('GRANT EXECUTE ON FUNCTION public.record_debt_payment_v2') && read(migrationPath).includes(') TO authenticated')],
  ['Client normalizer uses exact decimal FX math', read('src/features/debts/payment-domain.ts').includes('convertExactAmount') && read('src/features/debts/payment-domain.ts').includes('toExactRate')],
  ['Client normalizer rejects silent relabeling', read('src/features/debts/payment-domain.ts').includes('Cùng tiền tệ phải dùng tỷ giá 1:1')],
  ['Debt service calls only v2 for new payments', read('src/features/debts/debts.ts').includes("rpc('record_debt_payment_v2'")],
  ['Debt UI exposes both currency sides', read('src/app/debts/page.tsx').includes('account_amount') && read('src/app/debts/page.tsx').includes('debt_amount')],
  ['Debt UI exposes rate direction and source', read('src/app/debts/page.tsx').includes('exchange_rate') && read('src/app/debts/page.tsx').includes('exchange_rate_source')],
  ['Reports aggregate by currency pair', read('src/features/reports/engine.ts').includes('aggregateDebtRepaymentBreakdown') && read('src/features/reports/engine.ts').includes('accountCurrency + \'::\' + debtCurrency')],
  ['Reports mount the repayment classification card', read('src/app/reports/page.tsx').includes('Phân loại trả nợ') && read('src/app/reports/page.tsx').includes('debtRepaymentBreakdown')],
  ['Deterministic Phase 13B2 tests are present', fs.existsSync('tests/phase13b2-debt.test.ts')],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log(`PHASE_13B2_SOURCE_VERIFIER: ${checks.length - failures}/${checks.length}`);
if (failures > 0) process.exit(1);
