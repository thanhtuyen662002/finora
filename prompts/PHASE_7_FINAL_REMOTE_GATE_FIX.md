# Finora Phase 7 — Final Remote Gate Verifier Fix

## Mission

Correct the last verifier-only omissions at authoritative remote SHA:

`b760dd817e23ce8df264b07ab3c3924baaf7fcaf`

This is SOURCE / MIGRATION-PREP ONLY.

Do NOT apply the Phase 7 migration.
Do NOT modify remote Supabase.
Do NOT run the structural verifier against remote Supabase.
Do NOT run the runtime RLS verifier against remote Supabase.
Do NOT begin Phase 8.

The Phase 7 migration is not being reopened. Expected migration blob must remain:

`5da681f7c66fdd85acda79172d1ad305496c6313`

Do not modify application code or the migration unless a new concrete defect is independently proven.

---

## 1. Structural verifier — exact nullability/defaults are still missing

`scripts/verify-phase7-db.sql` currently proves column names/cardinality and money precision but does not prove the required nullability/defaults for every Phase 7 table.

Add fail-closed catalog checks for all Phase 7 columns, including at minimum:

### budgets
- `id` NOT NULL, default `gen_random_uuid()`;
- `user_id` NOT NULL, no default;
- `category_id` NOT NULL, no default;
- `category_type` NOT NULL, default `EXPENSE`;
- `limit_amount` NOT NULL, no default;
- `currency_code` NOT NULL, no default;
- `period_month` NOT NULL, no default;
- `is_archived` NOT NULL, default false;
- `created_at` NOT NULL, default now();
- `updated_at` NOT NULL, default now().

### goals
- exact NOT NULL / NULL contract for all 14 columns;
- target/current/monthly money defaults exactly as migration defines;
- category/icon/color defaults exactly as migration defines;
- `target_date` nullable;
- `is_archived=false`, timestamps `now()`, id `gen_random_uuid()`.

### recurring_items
- exact NOT NULL / NULL contract for all 16 columns;
- `end_date` and `note` nullable;
- `is_paused=false`, `is_archived=false`;
- timestamps `now()`, id `gen_random_uuid()`;
- other required columns no unexpected defaults.

Normalize PostgreSQL expressions robustly enough to tolerate catalog formatting/casts while still proving semantics.

Every new mandatory check must feed `99_OVERALL`.

---

## 2. Structural verifier — exact policy command distribution

Current checks prove 3 policies per table plus allowed expression shapes, but they do not prove exactly one SELECT, one INSERT, and one UPDATE policy per table.

For each of:

- `public.budgets`
- `public.goals`
- `public.recurring_items`

prove simultaneously:

- exactly 3 policies total;
- exactly 1 `polcmd='r'` SELECT;
- exactly 1 `polcmd='a'` INSERT;
- exactly 1 `polcmd='w'` UPDATE;
- exactly 0 DELETE;
- role exactly authenticated;
- SELECT has only USING ownership semantics;
- INSERT has only WITH CHECK ownership semantics;
- UPDATE has both USING and WITH CHECK ownership semantics;
- ownership expression is `(SELECT auth.uid()) = user_id` semantically, not merely any expression containing `auth.uid()`.

Unexpected extra policies or duplicated command types must fail.

---

## 3. Structural verifier — account_balances Phase 5/6 formula must be proven

Current check 49 only proves `opening_balance`, `is_voided=false`, security_invoker, and text output. That is insufficient.

Prove the accepted Phase 5 formula and Cartesian-safe structure from the actual view definition:

- CTE/pre-aggregation component `tx_totals`;
- CTE/pre-aggregation component `incoming_transfers`;
- CTE/pre-aggregation component `outgoing_transfers`;
- active-only `transactions WHERE is_voided = false`;
- active-only `transfers WHERE is_voided = false` in incoming and outgoing components;
- final formula semantically contains:
  `opening_balance + net_transactions + in_transfers - out_transfers`;
- joins pre-aggregated components to accounts rather than joining raw transactions/transfers together;
- `current_balance` remains PostgreSQL text;
- `security_invoker=true`.

Use the accepted Phase 5 migration as authoritative reference:

`supabase/migrations/20260828000003_phase_5_transfers.sql`

---

## 4. Structural verifier — robust constraint semantics

The verifier must not false-fail because PostgreSQL renders numeric constants with casts/parentheses in `pg_get_constraintdef()`.

Audit checks 13–15 and make each required named constraint comparison robust to normal PostgreSQL catalog formatting while still proving the exact intended semantics.

Do not reduce them back to generic counts/keywords.

---

## 5. Source verifier MUST be updated in this commit

`scripts/verify-phase7-source.mjs` did not change in the previous remote-gate pass and therefore still cannot prove the omissions above.

Modify it so SHA `b760dd817e23ce8df264b07ab3c3924baaf7fcaf` would FAIL because it lacks:

- Phase 7 nullability/default checks;
- exact per-table SELECT/INSERT/UPDATE policy command-distribution checks;
- exact account_balances incoming/outgoing/pre-aggregation formula checks.

Also statically reject the old shallow variants.

Do not claim the source verifier executes PostgreSQL. It may statically prove verifier source structure and run actual TypeScript/pure-engine tests only.

Update the source check count truthfully.

---

## 6. Runtime verifier

The current runtime verifier at `b760dd817...` has been independently audited as materially corrected:

- owner-specific A/B resource collections;
- User A and User B complete lifecycle;
- bidirectional SELECT/UPDATE/spoof/foreign-reference isolation across Budget/Goal/Recurring;
- broad domain rejection matrix;
- Phase 4 transaction regression;
- Phase 5 transfer/budget neutrality regression;
- owner-specific cleanup with `.select()` affected-row assertions and final readback;
- missing credential exit 1.

Do not rewrite it unnecessarily.

Only change it if needed to preserve syntax or if you identify a concrete remaining contract defect.

---

## 7. Migration invariant

The migration must remain byte-for-byte unchanged unless a new concrete migration defect is proven.

Required expected blob:

`5da681f7c66fdd85acda79172d1ad305496c6313`

If it changes, STATUS must be FAIL/BLOCKED unless the report explains the newly proven migration defect and the change is independently reviewable.

---

## 8. Final exact-head verification

At the FINAL revision run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase7-source.mjs
node scripts/verify-phase7-source.mjs
node --check scripts/verify-phase7-rls.mjs
git diff --check
```

Do NOT execute the DB or live RLS verifiers yet.

Then:

1. commit;
2. push main;
3. git fetch origin;
4. require local HEAD == origin/main;
5. require clean worktree;
6. record exact blob SHAs for migration, structural verifier, runtime verifier, source verifier.

---

## 9. Required final state

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_7_STRUCTURAL_GATE=NOT_RUN
PHASE_7_TWO_USER_RLS=NOT_RUN
PHASE_7_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

Do not recommend applying migration until this exact remote SHA is independently audited.

---

## 10. Required report

Return EXACTLY:

```text
TASK
Finora Phase 7 — Final Remote Gate Verifier Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
b760dd817e23ce8df264b07ab3c3924baaf7fcaf

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

HEAD_MATCH
true / false

WORKTREE_CLEAN
true / false

TYPECHECK
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

PHASE_7_SOURCE_VERIFIER_SYNTAX
PASS / FAIL

PHASE_7_SOURCE_VERIFIER
PASS / FAIL

PHASE_7_SOURCE_CHECK_COUNT
<number passed>/<number total>

PHASE_7_RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

GIT_DIFF_CHECK
PASS / FAIL

MIGRATION_BLOB_SHA
<sha>

STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

RUNTIME_VERIFIER_BLOB_SHA
<sha>

SOURCE_VERIFIER_BLOB_SHA
<sha>

MIGRATION_CHANGED_IN_THIS_FIX
false / true

REMOTE_DATABASE_MODIFIED
false

PHASE_7_SOURCE_GATE
PASS_CODE_ONLY / FAIL

PHASE_7_REMOTE_DATABASE
BLOCKED_NOT_APPLIED

PHASE_7_STRUCTURAL_GATE
NOT_RUN

PHASE_7_TWO_USER_RLS
NOT_RUN

PHASE_7_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_7_OVERALL
PARTIAL

PHASE_8_AUTHORIZED
false
```

No prose before or after the report.
