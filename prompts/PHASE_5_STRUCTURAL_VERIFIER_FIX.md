# Finora Phase 5 — Structural Verifier-Only Fix

## Scope

Verifier-only corrective pass after the Phase 5 migration was successfully applied to the target Supabase database.

Observed structural result on the applied database:

- checks 01-33: PASS
- check 34 `34_account_balances_pre_aggregated_derivation_exact`: FAIL
- checks 35-38: PASS
- `99_OVERALL`: FAIL only because check 34 failed

Do NOT modify the Phase 5 migration or remote database. Do NOT apply/reapply migration. Do NOT run runtime RLS yet. Do NOT begin Phase 6.

## Root cause to fix

The accepted migration defines `public.account_balances` with three independent pre-aggregated CTEs:

- `tx_totals`: transactions grouped by `account_id` with INCOME/EXPENSE signed aggregation and `is_voided = FALSE`;
- `incoming_transfers`: transfers grouped by `to_account_id` with `is_voided = FALSE`;
- `outgoing_transfers`: transfers grouped by `from_account_id` with `is_voided = FALSE`;
- final balance formula: `opening_balance + net_transactions + in_transfers - out_transfers`, cast to text.

Check 34 currently relies on regex patterns that are too coupled to PostgreSQL's rendered `pg_views.definition`, especially numeric casts/parentheses and deparser formatting. This produced a false negative on the actual applied schema.

## Mandatory fix

Modify only `scripts/verify-phase5-db.sql` unless a truthful verifier-status documentation update is necessary.

Harden check 34 so it remains semantic and fail-closed while tolerating PostgreSQL deparser formatting.

Recommended approach:

1. Normalize the actual view definition with:
   - `lower(...)`
   - `regexp_replace(..., '[[:space:]]+', ' ', 'g')`
2. Prove the three CTE sections independently rather than using one large formatting-sensitive regex.
3. The `tx_totals` section must prove:
   - source is `transactions`;
   - `CASE` includes both `INCOME` and `EXPENSE`;
   - `SUM` is used;
   - `is_voided = false` is present;
   - grouping is by transaction `account_id`.
4. The `incoming_transfers` section must prove:
   - source is `transfers`;
   - `to_account_id` is mapped/grouped as the account key;
   - `SUM(amount)` semantics are present;
   - `is_voided = false` is present.
5. The `outgoing_transfers` section must prove:
   - source is `transfers`;
   - `from_account_id` is mapped/grouped as the account key;
   - `SUM(amount)` semantics are present;
   - `is_voided = false` is present.
6. Prove the final expression references, in the correct arithmetic roles:
   - `opening_balance`
   - `tx.net_transactions` added
   - `it.in_transfers` added
   - `ot.out_transfers` subtracted
   - final result cast to text.
7. Do not weaken check 34 to generic keyword presence.
8. Preserve checks 01-33 and 35-38 substantively unchanged unless a syntax correction is required.
9. `99_OVERALL` must remain fail-closed over all 38 mandatory checks.

## Verification

Run locally after the verifier-only change:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase5-rls.mjs
git diff --check
```

Commit and push the verifier-only change to `main`, then confirm actual `origin/main`.

Return:

```text
VERIFIER_FIX=PASS/FAIL
LOCAL_HEAD_SHA=<sha>
REMOTE_MAIN_SHA=<sha>
HEAD_MATCH=true/false
WORKTREE_CLEAN=true/false
TYPECHECK=PASS/FAIL
LINT=PASS/FAIL
BUILD=PASS/FAIL
RUNTIME_RLS_SCRIPT_SYNTAX=PASS/FAIL
GIT_DIFF_CHECK=PASS/FAIL
MIGRATION_CHANGED=false
REMOTE_DB_MODIFIED=false
RUNTIME_RLS_RUN=false
PHASE_6_STARTED=false
```

After the verifier-only commit, the owner will rerun the COMPLETE `scripts/verify-phase5-db.sql` against Supabase. Runtime RLS remains blocked until all 38 checks plus `99_OVERALL` return PASS.