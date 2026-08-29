# Finora Phase 8 — Pass A Remote-Gate Corrective

## 0. Authority

Repository: `thanhtuyen662002/finora`

Authoritative rejected baseline:

```text
fc7bc9f0d9d6030d9d21fbf5a103624a32f80106
```

Phase 8 migration has NOT been applied to remote Supabase.

This pass is SOURCE / VERIFIER HARDENING ONLY.

DO NOT:

- apply any SQL migration to remote Supabase;
- modify remote Supabase;
- run `verify-phase8-db.sql` against live Supabase;
- run `verify-phase8-rls.mjs` against live Supabase;
- begin Phase 8 Pass B;
- begin Phase 9.

Phase 7 migration blob must remain exactly:

```text
5da681f7c66fdd85acda79172d1ad305496c6313
```

Phase 8 migration is currently expected to remain unchanged unless a concrete migration defect is proven:

```text
69e3ff637c0430fa701794aff497f81eb875443e
```

---

## 1. Why the baseline is rejected

The source report claimed `26/26`, but the actual remote gate remains insufficient.

### 1.1 Runtime verifier is still a skeleton

`scripts/verify-phase8-rls.mjs` only prints planned test names and then exits 1. It performs no Supabase authentication, queries, mutations, isolation assertions, or cleanup.

It must become a real future-live two-user verifier.

### 1.2 Structural verifier is not exhaustive

`scripts/verify-phase8-db.sql` currently checks only shallow counts/existence for many objects.

It does not prove exact columns/nullability/defaults, exact constraint semantics/order, exact composite keys/FKs, exact policy role/expression, `security_invoker`, all relevant grants, full Phase 2–7 RLS non-regression, or Phase 7 object non-regression.

### 1.3 Source verifier gives false confidence

`scripts/verify-phase8-source.mjs` currently accepts weak proxies such as file length and loose string checks. It must reject the rejected baseline `fc7bc9f...` for the concrete defects in this prompt.

### 1.4 BASE current-valuation fail-closed defect

In `src/features/reports/reports.ts`, when `selectedCurrency === 'BASE'` but `baseValuation.status !== 'AVAILABLE'`, code currently falls back to the user's native `baseCurrency` account group and exposes that scalar as `totalAccountBalance`.

This can masquerade a partial/native balance as complete BASE net worth. Forbidden.

### 1.5 Dashboard BASE asset card can show fake zero

If historical BASE conversion is available but current valuation is unavailable, `BASE` can still exist in `availableCurrencies`. The Dashboard then falls back to a synthetic zero account group and can display `0` as if converted net worth were valid.

Forbidden. A missing current valuation must render an explicit unavailable state, not zero and not a native fallback.

### 1.6 Reports BASE display currency defect

The reports savings card currently formats `summary.netSavings` with the pseudo code `BASE` rather than the actual user base currency in at least one path.

All BASE monetary presentation must format using the real `data.baseCurrency`.

### 1.7 Database relationship type is false

`src/types/database.ts` currently describes the snapshot relationship as a single-column FK with the wrong constraint name.

The migration defines:

```text
fk_snapshot_transaction
(transaction_id, user_id) -> transactions(id, user_id)
```

Types must reflect that composite relationship truthfully.

### 1.8 PROJECT_STATUS top-level state is stale

The historical ledger was restored, but the top still says Phase 7 and `PHASE_7_SOURCE_COMPLETE_MIGRATION_PENDING_APPLY`.

It must truthfully state Phase 8 Pass A source hardening / remote migration not applied while preserving all prior history.

### 1.9 Tests still contain fake passes

`tests/phase8-math.test.ts` contains several `assertEq(true, true, ...)` placeholders for critical domain behaviors.

Those are not tests. Replace them with executable tests of production code/helpers.

---

## 2. Application corrections

### 2.1 BASE current valuation must fail closed

Refactor report/dashboard data contracts as needed so an unavailable converted account total cannot be represented as a valid scalar.

Preferred semantics:

```text
baseValuation.status = AVAILABLE | UNAVAILABLE | DISABLED
```

When BASE is selected and current valuation is unavailable:

- converted net worth / total account balance is `null` or otherwise explicitly unavailable;
- converted account list is empty/unavailable, not substituted with native base-currency accounts;
- UI shows a clear Vietnamese unavailable message;
- UI offers retry using existing reload path;
- native currency tabs remain fully usable;
- historical BASE income/expense reporting may remain independently available if its snapshots are complete.

Never use native base-currency balance as a substitute for missing converted total.

Never use `0.0000` as a placeholder that visually looks authoritative.

### 2.2 Dashboard current BASE unavailable state

If `effectiveCurrency === 'BASE'` and `baseValuation.status !== 'AVAILABLE'`:

- asset/net-worth card must show an unavailable state such as `—` / `Không khả dụng`;
- do not show a scalar zero/native fallback;
- explain missing current FX briefly;
- retry must be reachable.

Historical BASE cards may be shown only if `baseHistorical.status === 'AVAILABLE'`.

### 2.3 Avoid synthetic BASE account duplication

Keep the existing native-account de-duplication. The account list must never flatten synthetic BASE copies alongside native accounts.

### 2.4 Correct BASE money formatting

Every BASE monetary value must call the shared formatter using the actual base currency, not the pseudo code `BASE`.

Audit Dashboard, Reports, charts, account summaries, and CSV presentation labels.

### 2.5 BASE CSV provenance must be explicit

For BASE export, include explicit, truthful columns at minimum:

```text
original amount
original currency
converted amount
target/base currency
rate
requested transaction date
effective FX date
provider
```

Do not rely on ambiguous duplication of generic columns. Header count must equal data column count for every row. Keep RFC 4180 and UTF-8 BOM behavior.

### 2.6 Truthful TypeScript DB relationship

Fix `src/types/database.ts` snapshot relationship to match the actual migration:

```text
foreignKeyName = fk_snapshot_transaction
columns = [transaction_id, user_id]
referencedRelation = transactions
referencedColumns = [id, user_id]
```

Do not invent a single-column FK.

### 2.7 PROJECT_STATUS

Preserve all historical ledger content.

Correct the top-level current state to Phase 8 Pass A and record exactly:

```text
FINORA_PHASE_7=PASS
PHASE_8_AUTHORIZED=true
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY  # only after this source pass truly passes
PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_8_STRUCTURAL_GATE=NOT_RUN
PHASE_8_TWO_USER_RLS=NOT_RUN
PHASE_8_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

Do not erase prior receipts/history.

---

## 3. Structural verifier — mandatory exhaustive rewrite

Rewrite `scripts/verify-phase8-db.sql` as a strict read-only verifier returning rows with:

```text
check_name
passed
detail
```

and a final:

```text
99_OVERALL
```

which aggregates EVERY mandatory check.

At minimum prove all of the following.

### 3.1 Snapshot table exact schema

For `public.transaction_fx_snapshots`, prove exactly 12 columns and exact names/order/types/nullability/defaults:

```text
id uuid NOT NULL default gen_random_uuid()
user_id uuid NOT NULL no default
transaction_id uuid NOT NULL no default
source_currency_code text NOT NULL no default
target_currency_code text NOT NULL no default
source_amount numeric(20,4) NOT NULL no default
rate numeric(30,12) NOT NULL no default
converted_amount numeric(20,4) NOT NULL no default
requested_date date NOT NULL no default
effective_date date NOT NULL no default
provider text NOT NULL no default
created_at timestamptz NOT NULL default now()
```

Normalize PostgreSQL default expressions robustly.

### 3.2 Exact domain constraints

Prove exactly the intended eight snapshot CHECK constraints and their semantics, robust to PostgreSQL casts/parentheses:

- source currency regex;
- target currency regex;
- source != target;
- source_amount > 0;
- rate > 0;
- converted_amount > 0;
- effective_date <= requested_date;
- provider trimmed length 1..100.

Do not accept generic count-only evidence.

### 3.3 Exact unique keys and FK

Prove exact ordered columns for:

```text
transactions_id_user_id_key
UNIQUE (id, user_id)
```

and:

```text
transaction_fx_snapshots_version_key
UNIQUE (
  user_id,
  transaction_id,
  target_currency_code,
  source_currency_code,
  source_amount,
  requested_date
)
```

Prove exact composite FK:

```text
(transaction_id, user_id)
-> public.transactions(id, user_id)
ON DELETE RESTRICT
```

Do not rely on constraint names alone.

### 3.4 Exact RLS policy

Prove:

- RLS enabled;
- exactly one policy total on snapshot table;
- command SELECT only;
- role `authenticated` only;
- USING semantically `(SELECT auth.uid()) = user_id`;
- no WITH CHECK for SELECT;
- zero INSERT/UPDATE/DELETE policies.

### 3.5 Exact privileges

Prove:

- `anon` and `PUBLIC`: zero table and column privileges on snapshot table/view;
- authenticated snapshot table: SELECT only;
- authenticated: no INSERT/UPDATE/DELETE table privilege and no write column grants;
- snapshot view: authenticated SELECT only.

Use correct PUBLIC casing/role semantics.

### 3.6 Snapshot view exactness

Prove:

- `public.transaction_fx_snapshot_details` exists;
- `security_invoker=true`;
- expected exact columns;
- `source_amount`, `rate`, `converted_amount` are PostgreSQL text;
- no unexpected write privileges.

### 3.7 user_settings auto_fx

Prove:

```text
auto_fx_enabled boolean NOT NULL default true
```

and authenticated has the required UPDATE column grant for it without weakening ownership/RLS.

### 3.8 Phase 2–7 non-regression

Prove RLS remains enabled on all nine pre-Phase-8 user-owned tables:

```text
profiles
user_settings
accounts
categories
transactions
transfers
budgets
goals
recurring_items
```

Retain representative non-regression checks for accepted exact views/grants.

### 3.9 Phase 5 same-currency transfer invariant

Prove transfers remain same-currency-only, including the ownership/currency composite FKs to both source/destination accounts, and no Phase 8 cross-currency transfer columns were added.

### 3.10 Phase 7 object non-regression

Prove `budgets`, `goals`, `recurring_items`, `budget_progress`, `goal_details`, `recurring_details` remain present with RLS/security-invoker properties expected from accepted Phase 7.

Do NOT execute this verifier live in this source pass.

---

## 4. Two-user runtime verifier — mandatory real implementation

Rewrite `scripts/verify-phase8-rls.mjs` into executable future-live verification code.

It must NOT use service-role credentials.

Accept the public Supabase key and two distinct test users from environment. Support the repository's current publishable-key naming and fail closed when required credentials are missing.

The script must actually authenticate A/B and perform/assert database operations.

Required runtime coverage:

1. User A and User B authenticate successfully and IDs differ.
2. `auto_fx_enabled`:
   - own read;
   - own update;
   - persistence/readback;
   - cross-user SELECT isolation;
   - cross-user UPDATE isolation;
   - restore original values in `finally`.
3. snapshot table direct browser INSERT is denied.
4. snapshot UPDATE is denied.
5. snapshot DELETE is denied.
6. snapshot table/view reads return only rows belonging to the current user.
7. If owned snapshot rows exist for both test users, perform bidirectional explicit ID isolation assertions across table and view. If no snapshot fixtures exist yet, report that fact explicitly but do not fake a row.
8. spoofed `user_id` insert remains denied.
9. Phase 4 transaction RLS regression using real owner-scoped fixtures.
10. Phase 5 transfer RLS + neutrality regression using real owner-scoped fixtures and exact account-balance reads.
11. deliberate non-RLS database error is distinguishable from expected RLS denial.
12. all mutable fixtures created by the verifier are deterministically voided/archived/restored in `finally`, owner by owner, with readback assertions.
13. success exits 0; any failed assertion exits non-zero.

Do not merely log planned tests.
Do not unconditionally `process.exit(1)` at the end.
Do not execute it live in this source pass; only syntax-check it.

---

## 5. Source verifier — must reject the current rejected baseline

Harden `scripts/verify-phase8-source.mjs` so `fc7bc9f0...` would fail.

It must meaningfully detect at least:

- runtime verifier skeleton/log-only behavior;
- unconditional final failure in runtime verifier;
- structural verifier shallow count-only schema checks;
- missing exact nullability/default checks;
- missing exact composite unique/FK checks;
- missing exact policy role/expression checks;
- missing `security_invoker` structural verification;
- incomplete Phase 2–7 RLS set;
- stale top-level PROJECT_STATUS Phase 7 state;
- false single-column snapshot FK in `database.ts`;
- BASE current valuation native fallback in reports;
- Dashboard fake-zero BASE asset fallback;
- pseudo `BASE` passed to money formatter where real base currency is required;
- placeholder `assertEq(true, true, ...)` tests;
- incomplete BASE CSV provenance;
- Phase 7 migration modification;
- Phase 5 cross-currency transfer changes;
- Phase 9 authorization.

Do not claim static source verification equals live PostgreSQL/RLS execution.

---

## 6. Deterministic tests — no fake passes

Replace all placeholder assertions with executable tests of production code or extracted pure production helpers.

At minimum test real behavior for:

- `toExactRate` rejects >12 fractional digits;
- exact FX rounding including negative values;
- Frankfurter v2 CSV exact parsing;
- bounded historical lookback and latest `effectiveDate <= requestedDate`;
- malformed/missing/out-of-window provider responses rejected;
- snapshot version match changes when amount/date/currency changes;
- base-currency change does not mutate/reuse a mismatched prior target snapshot;
- current valuation completeness: one missing non-identity quote returns unavailable/no scalar;
- provider outage leaves native report data path usable;
- historical aggregation converts per transaction, not subtotal;
- dashboard native account list excludes synthetic BASE copies;
- BASE CSV header/data counts and complete provenance.

Factor pure helpers out of production modules if necessary so tests execute real implementation, not duplicated test logic.

No `assertEq(true, true, ...)` or equivalent no-op assertions.

---

## 7. Migration invariant

Unless a concrete migration defect is discovered during this pass, keep:

```text
supabase/migrations/20260829000001_phase_8_fx.sql
blob = 69e3ff637c0430fa701794aff497f81eb875443e
```

If migration changes, STOP and report the exact concrete reason and new blob. Do not apply it.

Phase 7 migration must remain:

```text
5da681f7c66fdd85acda79172d1ad305496c6313
```

---

## 8. Required source verification

Run all:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
git diff --check
```

Run the complete deterministic Phase 8 test suite.

DO NOT run live DB/RLS verification.

After committing/pushing:

```text
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require exact local/remote head match and clean worktree.

---

## 9. Required end state

Only if every source requirement passes:

```text
FINORA_PHASE_7=PASS
PHASE_8_AUTHORIZED=true
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_8_STRUCTURAL_GATE=NOT_RUN
PHASE_8_TWO_USER_RLS=NOT_RUN
PHASE_8_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

---

## 10. Exact report format

Return exactly this block with no prose before/after:

```text
TASK
Finora Phase 8 — Pass A Remote-Gate Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
fc7bc9f0d9d6030d9d21fbf5a103624a32f80106

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

PHASE_8_SOURCE_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_SOURCE_VERIFIER
PASS / FAIL

PHASE_8_SOURCE_CHECK_COUNT
<n>/<n>

PHASE_8_RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_TESTS
PASS <n>/<n> / FAIL

GIT_DIFF_CHECK
PASS / FAIL

PHASE_8_MIGRATION_BLOB_SHA
<sha>

PHASE_7_MIGRATION_BLOB_SHA
<sha>

FX_SOURCE_VERIFIER_BLOB_SHA
<sha>

FX_STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

FX_RUNTIME_VERIFIER_BLOB_SHA
<sha>

DATABASE_TYPES_BLOB_SHA
<sha>

REPORTS_SERVICE_BLOB_SHA
<sha>

REPORTS_UI_BLOB_SHA
<sha>

DASHBOARD_UI_BLOB_SHA
<sha>

PROJECT_STATUS_BLOB_SHA
<sha>

RUNTIME_VERIFIER_REAL_OPERATIONS
PASS / FAIL

STRUCTURAL_VERIFIER_EXHAUSTIVE
PASS / FAIL

BASE_CURRENT_VALUATION_FAIL_CLOSED
PASS / FAIL

DATABASE_RELATIONSHIP_TRUTHFUL
PASS / FAIL

NO_PLACEHOLDER_TEST_ASSERTIONS
PASS / FAIL

PROJECT_STATUS_TRUTHFUL
PASS / FAIL

REMOTE_DATABASE_MODIFIED
false

PHASE_8_PASS_A_SOURCE_GATE
PASS_CODE_ONLY / FAIL

PHASE_8_REMOTE_DATABASE
BLOCKED_NOT_APPLIED

PHASE_8_STRUCTURAL_GATE
NOT_RUN

PHASE_8_TWO_USER_RLS
NOT_RUN

PHASE_8_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS
NOT_STARTED

PHASE_8_OVERALL
PARTIAL

PHASE_9_AUTHORIZED
false
```
