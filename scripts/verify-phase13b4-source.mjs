import fs from 'node:fs';

const baseMigration = 'supabase/migrations/20260911130000_phase_13b4_credit_account_linkage.sql';
const authorityFix = 'supabase/migrations/20260913203000_phase_13b4_credit_trigger_authority_fix.sql';
const read = (path) => fs.readFileSync(path, 'utf8');

const base = read(baseMigration);
const fix = read(authorityFix);

const checks = [
  ['credit linkage migration exists', fs.existsSync(baseMigration)],
  ['authority corrective migration exists', fs.existsSync(authorityFix)],
  ['linked account expenses accrue debt', base.includes('sync_credit_account_debt') && base.includes("NEW.type = 'EXPENSE'")],
  ['repayment transactions are excluded from accrual', base.includes('NEW.debt_id IS NULL') && base.includes('OLD.debt_id IS NULL')],
  ['credit limit guard remains enforced', base.includes('outstanding_amount + p_delta > p_credit_limit')],
  ['trigger authority is security definer', /CREATE OR REPLACE FUNCTION public\.sync_credit_account_debt\(\)[\s\S]*SECURITY DEFINER/.test(fix)],
  ['trigger authority pins search path', fix.includes("SET search_path = ''")],
  ['trigger authority authenticates caller', fix.includes('auth.uid()') && fix.includes('Authentication required')],
  ['trigger authority binds inserted owner to caller', fix.includes('NEW.user_id IS DISTINCT FROM v_actor_user_id')],
  ['trigger authority binds deleted owner to caller', fix.includes('OLD.user_id IS DISTINCT FROM v_actor_user_id')],
  ['trigger function remains non-callable from API roles', /REVOKE ALL ON FUNCTION public\.sync_credit_account_debt\(\)[\s\S]*FROM PUBLIC, anon, authenticated/.test(fix)],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log(`PHASE_13B4_SOURCE_VERIFIER: ${checks.length - failures}/${checks.length}`);
if (failures > 0) process.exit(1);
