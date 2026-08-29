# FINORA PHASE 7 — RUNTIME RLS DECIMAL-BOUNDARY & FAIL-CLOSED CLEANUP FIX

## Purpose

Fix only the Phase 7 live runtime verifier after the first live attempt failed at an invalid representation-level money assertion:

`Initial spent must be 0.0000, got 0`

The remote Phase 7 migration is already applied. The structural gate is already PASS. This pass MUST NOT modify application behavior, the Phase 7 migration, or the remote database schema.

## Authoritative evidence

Accepted Phase 7 application/source SHA:

`ec1dcc338a26ea14e356aea5ec5c8e4429404a1a`

Accepted migration blob SHA:

`5da681f7c66fdd85acda79172d1ad305496c6313`

Current structural gate receipt exists at:

`docs/receipts/PHASE_7_STRUCTURAL_GATE.md`

Runtime verifier blob that failed:

`27414fe39d7a7caa81a38f36ed00e5becf52e894`

The failure is NOT evidence that budget arithmetic is wrong. `budget_progress` intentionally returns money as PostgreSQL text, but `CAST(COALESCE(SUM(t.amount), 0) AS TEXT)` may serialize the empty aggregate as `"0"`. The application boundary `toExactDecimal("0")` normalizes it to `"0.0000"` exactly, without floating point.

## Scope

Primary file to modify:

- `scripts/verify-phase7-rls.mjs`

Also modify:

- `scripts/verify-phase7-source.mjs`

only as needed so source verification rejects the old representation-level runtime assertions and proves the new fail-closed cleanup structure.

Do NOT modify unless a new concrete defect is proven:

- `supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql`
- application pages/components/services
- any remote Supabase schema/object

Do NOT begin Phase 8.

## Mandatory corrections

### 1. Compare monetary values semantically, not by textual scale

The runtime verifier MUST NOT assume that all exact zero values are serialized as `"0.0000"`.

For authoritative text views, compare via an exact decimal normalizer that accepts valid decimal strings with 0–4 fractional digits and normalizes to 4 digits using string/BigInt-safe logic.

Examples that MUST compare equal:

- `"0"` == `"0.0000"`
- `"1200000"` == `"1200000.0000"`
- `"1200000.0"` == `"1200000.0000"`

Forbidden in money assertions:

- `Number(...)`
- `parseFloat(...)`
- floating-point arithmetic
- tolerance/epsilon comparisons

The helper must reject malformed values and more than 4 fractional digits.

### 2. Do not trust base-table `numeric` JSON representation as an exact-text boundary

Supabase/PostgREST may return base-table PostgreSQL `numeric` columns as JSON numbers. Therefore the verifier MUST NOT require assertions such as:

- `editedBudget.limit_amount === "6000000.0000"`
- `goal.current_amount === "25000000.0000"`
- `recurring.amount === "380000.0000"`

For money mutations:

1. require the mutation itself to succeed;
2. verify non-money mutation fields directly when useful;
3. read the corresponding exact-money `security_invoker` view and compare the money field via exact normalization.

Use:

- `budget_progress` for budget money;
- `goal_details` for goal money;
- `recurring_details` for recurring money;
- `transaction_details` for transaction money;
- `transfer_details` for transfer money;
- `account_balances` for current balances.

All exact-text view money assertions should use the common exact comparator.

### 3. Fix all zero-spent assertions

At minimum update all assertions for:

- initial User A budget spent;
- User A budget spent after transaction void;
- initial User B budget spent;
- User B budget spent after transaction void;

so `"0"` and `"0.0000"` are semantically equal.

Do not weaken the expected arithmetic value.

### 4. Make cleanup execute on BOTH PASS and FAIL

The first live attempt aborted before the cleanup block. This violates the intended deterministic fail-closed fixture cleanup contract.

Refactor execution so created resources are cleaned in a guaranteed failure path, e.g. `try/finally` or an equivalent explicit primary-error + cleanup-error flow.

Requirements:

- owner-specific clients remain mandatory;
- each cleanup mutation must use `.select()` and prove exactly one affected owned row when an ID was created during the current run;
- persisted readback must confirm final `is_voided=true` / `is_archived=true` state;
- a primary test assertion failure must still produce process exit code 1 after cleanup is attempted;
- cleanup failure must also produce process exit code 1;
- do not silently swallow cleanup errors.

### 5. Recover stale fixtures from the already-failed live attempt

Before creating fresh fixtures, perform a bounded owner-scoped legacy fixture recovery for the fixed names used by the old verifier, because attempt 1 may have left active rows.

Relevant known fixed fixture identifiers include at least:

User A:
- account names `User A Test Bank`, `User A Test Savings`
- category names `User A Food Expense`, `User A Salary Income`

User B equivalents where present.

Recovery MUST remain authenticated-owner scoped and must only archive/void clearly identified test fixtures/dependents. It must never use service-role credentials.

Because budgets have no name, resolve old test category/account IDs first, then archive/void dependent Phase 4–7 test rows before archiving the test references.

The recovery path must be safe when no stale fixtures exist.

### 6. Make new fixture names unique per run

Use a runtime run identifier (for example `crypto.randomUUID()` or a timestamp+random marker) in newly created account/category/goal/recurring names, transaction merchant/note, and transfer note where applicable.

This avoids collisions and makes ownership/recovery easier.

Do not use the run marker in authoritative money values.

### 7. Preserve full runtime coverage

Do NOT remove or weaken existing coverage for:

- authentication of two distinct users;
- schema/view readiness;
- User A full Budget/Goal/Recurring lifecycle;
- User B full independent lifecycle;
- budget spent derivation from real active EXPENSE transactions;
- transaction void/restore effects;
- overfunded goals;
- recurring pause/resume/archive/unarchive;
- bidirectional cross-user read/update/spoof isolation across all Phase 7 domains;
- ownership-safe foreign reference rejection;
- domain rejection matrix;
- direct DELETE rejection for all Phase 7 tables;
- Phase 4 transaction/account-balance regression;
- Phase 5 transfer neutrality and budget neutrality;
- deliberate non-RLS error distinction;
- deterministic final fixture cleanup.

### 8. Source verifier regression assertions

Update `scripts/verify-phase7-source.mjs` so the old runtime verifier blob behavior would fail source verification.

At minimum prove:

- runtime verifier has an exact-decimal semantic comparator;
- old direct zero-spent string assertions are absent;
- money update verification reads through exact-money views instead of relying on base-table numeric JSON text representation;
- cleanup is guaranteed on the failure path;
- owner-specific cleanup with affected-row/readback assertions remains present;
- stale legacy fixture recovery exists;
- per-run unique fixture marker exists;
- no `Number()` / `parseFloat()` money comparison path was introduced.

## Source-only verification before live rerun

At the final exact revision run:

```bash
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase7-source.mjs
node scripts/verify-phase7-source.mjs
node --check scripts/verify-phase7-rls.mjs
git diff --check
```

Do NOT execute any SQL migration.

Do NOT modify remote Supabase schema.

## Then perform exactly one live runtime rerun

Using the same two distinct confirmed test accounts and only the public/publishable Supabase key, run:

```bash
node scripts/verify-phase7-rls.mjs
```

Do not use a service-role key.

## Required provenance

After source changes:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
git hash-object supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql
git hash-object scripts/verify-phase7-rls.mjs
git hash-object scripts/verify-phase7-source.mjs
```

Require:

- local HEAD == origin/main;
- worktree clean;
- migration blob remains exactly `5da681f7c66fdd85acda79172d1ad305496c6313`.

## Required final report

Return exactly:

```text
TASK
Phase 7 Runtime RLS Decimal-Boundary & Fail-Closed Cleanup Fix

STATUS
PASS | FAIL

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

HEAD_MATCH
true | false

WORKTREE_CLEAN
true | false

MIGRATION_BLOB_SHA
<sha>

RLS_VERIFIER_BLOB_SHA
<sha>

SOURCE_VERIFIER_BLOB_SHA
<sha>

TYPECHECK
PASS | FAIL

LINT
PASS | FAIL

BUILD
PASS | FAIL

PHASE_7_SOURCE_VERIFIER
PASS (<n>/<n>) | FAIL

RLS_VERIFIER_SYNTAX
PASS | FAIL

LIVE_RLS_RUNTIME
PASS | FAIL

PROCESS_EXIT_CODE
<number>

LIVE_TERMINAL_OUTPUT
<complete runtime terminal output>

REMOTE_DATABASE_SCHEMA_MODIFIED
false

PHASE_7_TWO_USER_RLS
PASS | FAIL

PHASE_7_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_7_OVERALL
PARTIAL

PHASE_8_AUTHORIZED
false
```

No prose before or after the report.
