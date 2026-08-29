# Finora Phase 7 — Remote Gate Verifier Fix

## Mission

Correct the remaining verifier defects at authoritative remote SHA:

`274ddca192c5bea756f928ee47d902ac3a8b6024`

This is still SOURCE / MIGRATION-PREP ONLY.

Do NOT apply the Phase 7 migration to Supabase.
Do NOT modify the remote database.
Do NOT execute the structural verifier against remote Supabase.
Do NOT execute the runtime verifier against remote Supabase.
Do NOT begin Phase 8.

The Phase 7 migration blob is currently:

`5da681f7c66fdd85acda79172d1ad305496c6313`

Do not modify the migration unless a new concrete migration defect is proven. This pass is intentionally focused on verification correctness and truthful gate provenance.

Read first:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/DECISIONS.md`
- `prompts/PHASE_7_BUDGETS_GOALS_RECURRING.md`
- `prompts/PHASE_7_CORRECTIVE.md`
- `prompts/PHASE_7_FINAL_CORRECTIVE.md`
- `prompts/PHASE_7_VERIFIER_PROVENANCE_FIX.md`

---

## 1. Structural verifier still contains blocking defects

`scripts/verify-phase7-db.sql` is NOT accepted at SHA `274ddca...`.

### 1.1 Fix the invalid Goals numeric precision expression

Current check `08_numeric_precision_goals` effectively does:

```sql
(SELECT count(*) = 3 FROM ...) = 3
```

The subquery already returns boolean, so comparing it to integer `3` is invalid PostgreSQL.

Rewrite as a valid boolean predicate, for example an integer count equality or an explicit boolean expression, but do not retain boolean-vs-integer comparison.

### 1.2 Exact schema checks must be semantic, not generic counts

Checks 13–19 currently use generic forms such as:

- `count(*) >= N` for constraints;
- existence of any unique constraint;
- existence of any FK with `confdeltype='r'`.

That does not prove the Phase 7 contract.

Verify each required named/semantic constraint individually using catalog definitions / `pg_get_constraintdef`, including:

Budgets:
- `check_budget_limit_positive` => `limit_amount > 0`;
- `check_budget_category_type` => EXPENSE only;
- `check_budget_currency_code` => `^[A-Z]{3,5}$`;
- `check_budget_period_month_first_day` => first day of month;
- exact unique ordered columns `(user_id, category_id, currency_code, period_month)`;
- exact FK local ordered columns `(category_id,user_id,category_type)` -> `public.categories(id,user_id,type)` with `ON DELETE RESTRICT`.

Goals:
- exact name length 1..200;
- target amount > 0;
- current amount >= 0;
- monthly contribution >= 0;
- exact currency regex;
- category length 1..100;
- icon length 1..100;
- color length 1..32.

Recurring:
- amount > 0;
- transaction_type IN (`INCOME`,`EXPENSE`);
- frequency IN (`WEEKLY`,`MONTHLY`,`YEARLY`);
- exact currency regex;
- name length 1..200;
- note NULL or <=1000;
- end_date NULL or >= anchor_date;
- exact account FK `(account_id,user_id,currency_code)` -> `public.accounts(id,user_id,currency_code)` RESTRICT;
- exact category FK `(category_id,user_id,transaction_type)` -> `public.categories(id,user_id,type)` RESTRICT.

### 1.3 Trigger check must prove the actual trigger contract

For each of budgets/goals/recurring_items prove exactly one non-internal trigger that is:

- BEFORE UPDATE;
- FOR EACH ROW;
- executes function `public.handle_updated_at()`.

Do not merely count any trigger calling a function named `handle_updated_at` in any schema/event/timing.

### 1.4 RLS policies must be exact per command

Do not accept `auth.uid()` appearing in either USING or WITH CHECK generically.

For each Phase 7 table prove exactly:

- SELECT authenticated with ownership USING;
- INSERT authenticated with ownership WITH CHECK;
- UPDATE authenticated with ownership USING AND WITH CHECK;
- no DELETE policy;
- no extra policy.

Normalize catalog expressions if needed, but make the verifier fail if command-specific ownership semantics are absent.

### 1.5 Grants must reject extra privileges

For Phase 7 tables prove exact sets, not merely that all expected columns are present.

Authenticated:
- table-level SELECT only;
- exact INSERT column allowlist;
- exact UPDATE column allowlist;
- no extra INSERT/UPDATE columns;
- no DELETE;
- immutable/server-generated columns not writable.

For `anon` and PostgreSQL `PUBLIC` prove zero table AND column privileges. Be careful that information_schema exposes the PUBLIC grantee as `PUBLIC`, not a lowercase placeholder.

Apply the same `PUBLIC` correctness to the Phase 7 views.

### 1.6 Views must prove exact output and derivation semantics

For all three views prove existence, `security_invoker=true`, authenticated SELECT only, anon/PUBLIC none.

Money output check must assert all six expected money columns exist AND are text:

- budget_progress.limit_amount
- budget_progress.spent_amount
- goal_details.target_amount
- goal_details.current_amount
- goal_details.monthly_contribution
- recurring_details.amount

`budget_progress` must prove the definition matches:
- user_id;
- category_id;
- currency_code;
- EXPENSE only;
- `is_voided = false`;
- `occurred_on >= period_month`;
- `< period_month + 1 month`;
- ownership/type-safe category join.

`recurring_details` must prove:
- account ownership + currency join;
- category ownership + transaction_type join.

### 1.7 Phase 4–6 non-regression must be real

Check 49 is labelled as account balance formula verification but currently proves only `security_invoker` and text type.

Prove the accepted account_balances definition still has independent/pre-aggregated active transaction, incoming transfer and outgoing transfer components and the formula:

`opening_balance + transaction_net + incoming - outgoing`

with active-only transaction/transfer semantics.

Keep transaction_details / transfer_details exact text and security_invoker checks.

### 1.8 Fix Phase 2–7 RLS table set

Current check 51 includes `income_sources`, which belongs to future Phase 9 and has no migration in the current repository.

For current Phase 2–7 user-owned tables the expected set is:

- profiles
- user_settings
- accounts
- categories
- transactions
- transfers
- budgets
- goals
- recurring_items

That is 9 tables.

Do not require a future `income_sources` table.

### 1.9 `99_OVERALL`

Every mandatory check must feed `99_OVERALL` and any NULL/false mandatory result must make overall fail.

The verifier must remain read-only.

The total check count may increase beyond 51 if individual semantic checks are split. Correctness is more important than preserving 51.

---

## 2. Runtime verifier still contains false-pass paths

`scripts/verify-phase7-rls.mjs` also needs further hardening.

### 2.1 Cleanup must be ownership-correct and assert affected rows

Current `cleanupResources.transactions` stores both User A and User B transaction IDs, but cleanup loops them through `clientA` only. An RLS-filtered update of User B's row can return no error while updating zero rows, creating a false cleanup PASS.

Use owner-specific collections/clients, e.g. transactionsA/transactionsB and transfersA/transfersB where relevant.

For every cleanup mutation:

- request/select the affected identifier/state;
- assert exactly the expected owned row changed;
- perform final readback with the owner client;
- assert transactions/transfers are voided and planning/reference rows are archived as required.

Do not treat `error === null` alone as proof that cleanup changed a row.

### 2.2 User B must have a genuinely full lifecycle

`USER_B_FULL_LIFECYCLE` currently mostly proves create/read and transaction spent derivation.

For User B independently prove persisted:

Budget:
- create;
- exact read;
- edit limit;
- real expense spent derivation;
- void/restore transaction effect;
- archive/unarchive.

Goal:
- create;
- exact read;
- edit;
- contribution/current amount update;
- overfunded value allowed;
- archive/unarchive.

Recurring:
- create;
- exact read;
- edit;
- pause/resume;
- archive/unarchive.

User A should retain equivalent lifecycle evidence.

### 2.3 Bidirectional isolation must cover all three domains

For both A->B and B->A prove where applicable:

- base-table SELECT isolation;
- view isolation;
- UPDATE isolation;
- spoofed `user_id` INSERT rejection;
- ownership mutation impossible;
- foreign category/account references rejected for Budgets/Recurring.

Do not use Budget-only update/spoof coverage as a substitute for Goals and Recurring.

### 2.4 Complete domain/integrity rejection matrix

Add explicit negative tests for the actual migration constraints.

Budgets:
- zero and negative limit;
- non-EXPENSE category type;
- invalid/lowercase currency;
- non-first-day period;
- duplicate `(user,category,currency,month)`;
- wrong-user/foreign category reference.

Goals:
- zero/negative target;
- negative current;
- negative monthly contribution;
- invalid/lowercase currency;
- blank/overlong name;
- invalid category/icon/color lengths as constrained by DB.

Recurring:
- zero/negative amount;
- invalid transaction type;
- invalid frequency;
- invalid/lowercase currency;
- blank/overlong name;
- note >1000;
- end_date before anchor_date;
- account/currency mismatch;
- category/type mismatch;
- wrong-user account/category references.

Direct DELETE must be rejected for budgets, goals and recurring_items, not Budget alone.

### 2.5 Phase 4/5 regressions

Preserve and strengthen:

- transaction_details exact read;
- account_balances expense effect and void/restore reversal;
- same-currency transfer source/destination balance changes;
- transfer net neutrality;
- transfer void reversal;
- transfer never contributes to budget spent.

### 2.6 Failure semantics

Keep missing credentials => exit 1.
Keep deliberate unrelated DB error distinction.
Never use service role.
Never print secrets.
Any mandatory assertion or cleanup failure => process exit 1.

At source gate run syntax check only; do NOT execute this verifier remotely yet.

---

## 3. Source verifier must detect these exact false passes

Harden `scripts/verify-phase7-source.mjs` so SHA `274ddca...` would FAIL.

It must explicitly reject at least:

- the boolean-vs-integer Goals precision expression;
- structural RLS check including future `income_sources`;
- generic constraint-count checks instead of named/definition checks;
- generic any-unique / any-FK checks instead of exact column/reference semantics;
- trigger checks that do not prove BEFORE UPDATE ROW + `public.handle_updated_at()`;
- grant checks that allow unexpected extra columns;
- lowercase-only `public` grantee assumptions;
- account_balances check that does not inspect the actual accepted formula/active derivation;
- runtime cleanup that sends mixed-owner transaction IDs through one client;
- cleanup assertions based only on absence of error;
- incomplete User B lifecycle;
- Budget-only bidirectional update/spoof isolation;
- incomplete domain rejection matrix;
- DELETE rejection tested for only one Phase 7 table.

Static source verification must not claim remote DB execution.

The source verifier may parse/inspect the SQL text, but do not pretend that source inspection is equivalent to executing the SQL against PostgreSQL.

---

## 4. Recurring projection and application source

Preserve the now-explicit monthly-equivalent projection documentation/UI if already correct.

Do not modify unrelated application behavior.
Do not change migration unless a concrete migration defect is newly proven.

---

## 5. Truthful project status

Until this pass is independently audited, the project must remain migration-blocked.

Required final state if source verification passes:

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_7_STRUCTURAL_GATE=NOT_RUN
PHASE_7_TWO_USER_RLS=NOT_RUN
PHASE_7_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

Next recommended action must be independent exact-remote audit; do NOT instruct the owner to apply migration in the ledger before that audit.

---

## 6. Final exact-head verification

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

Do NOT execute DB/RLS live verifiers yet.

Then commit and push `main`, fetch actual `origin/main`, and require:

- local HEAD == actual origin/main;
- worktree clean;
- exact same SHA passed every source command;
- exact blob SHAs recorded for migration, structural verifier, runtime verifier.

---

## 7. Required final report

Return EXACTLY:

```text
TASK
Finora Phase 7 — Remote Gate Verifier Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
274ddca192c5bea756f928ee47d902ac3a8b6024

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

MONEY_MOCK_FX_SCAN
PASS / FAIL

MIGRATION_PATH
supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql

MIGRATION_BLOB_SHA
<sha>

STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

RUNTIME_VERIFIER_BLOB_SHA
<sha>

MIGRATION_CHANGED_IN_THIS_FIX
true / false

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
