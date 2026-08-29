# Finora Phase 8 — Pass A Pre-Migration Live Compatibility + Verifier Fix

## Authority

- Repository: `thanhtuyen662002/finora`
- Rejected implementation baseline: `93a1304bd83c39b35e3b2a5b0fabba262359f3e6`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration expected unchanged unless a concrete migration defect is proven: `69e3ff637c0430fa701794aff497f81eb875443e`
- Remote Supabase MUST NOT be modified in this pass.
- Phase 8 migration MUST NOT be applied in this pass.
- Phase 8 Pass B and Phase 9 are NOT authorized.

## Mission

Repair the final remaining Phase 8 Pass A source-gate defects in one bounded pass:

1. Make the application safe to deploy while the live DB is still Phase 7 and `user_settings.auto_fx_enabled` does not yet exist.
2. Eliminate authenticated-user avatar/name flicker (`ND -> auth-metadata initials -> profile initials`) in `AppShell`.
3. Replace false-confidence Phase 8 source/structural/runtime verifiers with substantive gates that would reject baseline `93a1304...`.
4. Replace residual simulated/placeholder Phase 8 tests with executable tests against production helpers.
5. Preserve all accepted Phase 2-7 behavior and Phase 8 migration source unless a migration defect is proven.

---

## A. PRE-MIGRATION LIVE COMPATIBILITY — MANDATORY

The currently deployed code can run before the Phase 8 migration is applied. Therefore it MUST remain compatible with a Phase 7 database.

### A1. Dashboard / Reports settings read

Current rejected behavior explicitly selects:

`base_currency, timezone, auto_fx_enabled`

from `user_settings`. On a Phase 7 DB this fails with:

`column user_settings.auto_fx_enabled does not exist`

Fix this.

Required behavior:

- Reading user settings MUST NOT reference a not-yet-existing Phase 8 column in an explicit select while remote DB is pre-migration.
- A schema-compatible read such as `select('*')` is acceptable if handled safely at runtime.
- Determine `fxSchemaReady` only when `typeof settings.auto_fx_enabled === 'boolean'`.
- If the column is absent, authoritative behavior is:
  - `autoFxEnabled = false`
  - FX status = disabled/not-yet-available
  - no current FX endpoint call
  - no historical snapshot endpoint call
  - all native-currency Dashboard/Reports behavior remains available
  - no fake BASE totals and no fallback to identity except same-currency conversion inside an actually-enabled FX flow.
- Never default a missing schema field to `true`.

### A2. Settings pre-migration compatibility

Settings page must also work before migration.

Required:

- Load current Phase 7 settings successfully when `auto_fx_enabled` is absent.
- Track whether Phase 8 FX schema is ready.
- If absent, the Auto FX control must be disabled/hidden or clearly marked unavailable pending database activation.
- Saving unrelated settings (name, base currency, locale, timezone, theme) MUST still succeed pre-migration.
- Do NOT send `auto_fx_enabled` in an update payload when the live field is absent.
- Once the migration is applied and the field exists, load/save Auto FX normally.

### A3. Add deterministic compatibility tests

Add tests for a settings object with no `auto_fx_enabled` field proving:

- native reports remain usable;
- FX is treated as disabled;
- no BASE synthetic state is exposed;
- settings save payload omits `auto_fx_enabled` when schema is not ready.

Prefer extracting small pure production helpers if needed. Do not test by source regex only.

---

## B. APPSHELL AUTH/AVATAR FLICKER — MANDATORY

Rejected `AppShell` initializes `displayName = 'Người dùng'` and then sequentially updates from auth metadata and then profile, causing visible `ND -> TT -> T` style transitions.

Required final behavior:

- Do not render fake `Người dùng` initials while auth/profile is unresolved.
- During loading, show a neutral avatar skeleton/placeholder that does not imply another identity.
- Resolve final display identity once, with precedence:
  1. `profiles.display_name`
  2. Auth `user_metadata.full_name`
  3. Auth `user_metadata.name`
  4. email local-part
  5. neutral fallback only after loading has completed.
- Commit display name/avatar to React state once after the required reads complete, rather than setting it once per source.
- Avoid repeated redundant `auth.getUser()` calls during one AppShell load.

Preferred architecture:

Create/reuse a helper such as `getCurrentUserContext()` that:

1. calls `auth.getUser()` once;
2. uses that user id to query `profiles` and `user_settings` in parallel;
3. returns user + profile + settings as one context.

Do not weaken RLS. Do not use service role for this client UI context.

Add a deterministic helper test for identity precedence. If component testing is available, also prove no fake initials appear during loading.

---

## C. STRUCTURAL VERIFIER — REWRITE TO EXACT/EXHAUSTIVE

Rewrite `scripts/verify-phase8-db.sql` so baseline `93a1304...` would fail.

The verifier must remain read-only and MUST include every mandatory check in `99_OVERALL`.

### C1. Exact snapshot table schema

Prove exactly 12 columns, exact names, data types, numeric precision/scale, nullability and defaults:

- id uuid NOT NULL default `gen_random_uuid()`
- user_id uuid NOT NULL no default
- transaction_id uuid NOT NULL no default
- source_currency_code text NOT NULL no default
- target_currency_code text NOT NULL no default
- source_amount numeric(20,4) NOT NULL no default
- rate numeric(30,12) NOT NULL no default
- converted_amount numeric(20,4) NOT NULL no default
- requested_date date NOT NULL no default
- effective_date date NOT NULL no default
- provider text NOT NULL no default
- created_at timestamptz NOT NULL default `now()`

Normalize PostgreSQL default expressions robustly.

### C2. Exact eight CHECK constraints

Prove exactly and semantically:

- source currency regex `^[A-Z]{3,5}$`
- target currency regex `^[A-Z]{3,5}$`
- source != target
- source_amount > 0
- rate > 0
- converted_amount > 0
- effective_date <= requested_date
- trimmed provider length 1..100

Do NOT use the rejected `{3}` regex assumption.
Handle `pg_get_constraintdef()` casts/parentheses/TRIM/BTRIM formatting robustly.

### C3. Exact keys/FK

Using `pg_constraint`, `conkey/confkey` + ordinality, prove:

- `transactions_id_user_id_key` exactly UNIQUE `(id,user_id)`
- `transaction_fx_snapshots_version_key` exactly UNIQUE `(user_id,transaction_id,target_currency_code,source_currency_code,source_amount,requested_date)` in that order
- `fk_snapshot_transaction` exactly `(transaction_id,user_id) -> transactions(id,user_id)`
- ON DELETE RESTRICT
- expected update action
- no unexpected extra FK/unique semantics used to satisfy the checks.

### C4. RLS/policy

Prove:

- RLS enabled on snapshot table;
- exactly one policy total;
- exactly one SELECT policy;
- zero INSERT/UPDATE/DELETE policies;
- role exactly authenticated;
- USING semantically `(SELECT auth.uid()) = user_id`;
- no WITH CHECK for SELECT.

### C5. Grants

Prove exact privileges:

- anon and PUBLIC: zero table/column privileges on snapshot table and view;
- authenticated snapshot table: SELECT only, no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER and no write column grants;
- authenticated snapshot view: SELECT only;
- authenticated `user_settings.auto_fx_enabled`: required UPDATE column privilege exists without broadening immutable fields.

### C6. View

Prove:

- view exists;
- `security_invoker=true`;
- exact 12 columns;
- exact key/provenance fields;
- source_amount/rate/converted_amount are PostgreSQL text;
- view selects from snapshot table as expected.

### C7. Phase 2-7 non-regression

At minimum prove:

- RLS enabled on all 9 accepted user-owned tables:
  profiles,user_settings,accounts,categories,transactions,transfers,budgets,goals,recurring_items
- transactions/transfers remain no-DELETE policy design as accepted;
- transfers remain same-currency-only (no Phase 8 Pass B columns);
- accepted exact-text/security_invoker views still exist:
  transaction_details, transfer_details, account_balances,
  budget_progress, goal_details, recurring_details
- no persisted accounts.current_balance regression.

### C8. Overall

Every check must feed `99_OVERALL`.
A single omission/failure => `99_OVERALL=false`.

---

## D. TWO-USER RUNTIME VERIFIER — REAL OPERATIONS

Rewrite `scripts/verify-phase8-rls.mjs` so it is a genuine live verifier when later authorized.

Do NOT execute it live in this pass.
Only syntax-check it now.

Use public/publishable credentials only. Never service role.

Support the repository's public key convention (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); an explicit legacy anon-key fallback is acceptable only if intentionally documented.

When eventually run it must:

1. fail closed on missing credentials;
2. authenticate distinct User A and B;
3. verify A and B own `auto_fx_enabled` read/update/persistence/restore;
4. verify bidirectional settings isolation A->B and B->A;
5. verify direct browser snapshot INSERT denied;
6. verify direct browser snapshot UPDATE denied;
7. verify direct browser snapshot DELETE denied;
8. distinguish privilege/RLS denial from a deliberate non-RLS/domain error instead of accepting any error;
9. verify bidirectional snapshot table SELECT isolation;
10. verify bidirectional snapshot details view isolation;
11. where a trusted application snapshot fixture can be created, verify owner can read it and the other user cannot;
12. verify spoof ownership cannot be used;
13. include substantive Phase 4 transaction RLS regression;
14. include substantive Phase 5 transfer RLS + balance-neutrality regression;
15. use unique run ids;
16. cleanup deterministically in `finally` on PASS and FAIL;
17. assert cleanup affected rows/final persisted state;
18. print explicit PASS markers and final overall PASS;
19. exit non-zero on any unmet assertion.

Do not create a script that merely logs planned tests.
Do not silently ignore Supabase errors.

---

## E. SOURCE VERIFIER — REMOVE FALSE CONFIDENCE

Rewrite/harden `scripts/verify-phase8-source.mjs`.

Baseline `93a1304...` MUST fail it for all of these reasons:

- structural verifier uses the wrong `{3}` regex assumption instead of `{3,5}`;
- structural FK/unique checks are name/count-only rather than ordered semantic checks;
- structural verifier does not prove exact authenticated grants/view invoker/text semantics;
- runtime verifier lacks the required lifecycle/isolation/regression/cleanup coverage;
- unconditional checks like `check(..., true)` are forbidden;
- pre-migration explicit-select of `auto_fx_enabled` is forbidden;
- missing-schema fallback to auto FX enabled is forbidden;
- AppShell fake `Người dùng` initial identity + sequential identity set behavior is forbidden;
- tests must not claim database/application behavior solely through comments or local array simulations.

Do not claim static source verification executes PostgreSQL or proves live RLS.

Every reported source check must correspond to a concrete enforceable condition.

---

## F. PHASE 8 TESTS — EXECUTE PRODUCTION LOGIC

Remove remaining simulated claims.

Required executable deterministic coverage:

- exact rate parsing / reject >12 decimals;
- conversion and rounding/overflow;
- Frankfurter v2 CSV parsing with mocked network;
- bounded historical lookback and latest effectiveDate <= requestedDate;
- malformed/provider errors;
- BASE CSV header/data/provenance equality;
- per-transaction historical aggregation;
- native reporting survives FX unavailable;
- missing one required current rate produces no converted net-worth scalar;
- Dashboard native account projection excludes synthetic BASE entries via production helper, not a local `['VND','USD','BASE'].filter(...)` toy test;
- transaction snapshot identity/version helper behavior if such helper exists;
- pre-migration settings compatibility;
- identity display precedence helper.

Extract pure helpers from production code if needed to make these testable.

No `assertEq(true,true)` or equivalent placeholders.
No comments counted as tests.

---

## G. DO NOT REGRESS ACCEPTED FX SOURCE

Preserve unless a concrete defect is found:

- Frankfurter v2 `/v2/rates.csv` exact-string transport;
- bounded <=7 day historical window;
- latest effective date <= requested date;
- `toExactRate` string-only and reject >12 decimals;
- BigInt exact FX math;
- server-only admin/service-role boundary;
- snapshot reads through exact-text view;
- same-currency Phase 5 transfers unchanged;
- Dashboard synthetic BASE account dedup;
- Reports BASE current account position null/unavailable when current valuation unavailable;
- correct composite FK metadata in `database.ts`;
- BASE CSV provenance;
- zero patch scratch scripts.

---

## H. DOCUMENTATION TRUTH

`docs/PROJECT_STATUS.md` must retain all historical ledger content.

Until remote migration is actually applied, final source state must be exactly equivalent to:

PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_8_STRUCTURAL_GATE=NOT_RUN
PHASE_8_TWO_USER_RLS=NOT_RUN
PHASE_8_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false

Also document that source remains Phase-7-DB-compatible before migration.

---

## I. REQUIRED LOCAL COMMANDS

Run all:

```bash
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
npx tsx tests/phase8-math.test.ts
git diff --check
```

If additional dedicated tests are added, run them too.

DO NOT run:

- Phase 8 SQL against remote Supabase;
- `verify-phase8-db.sql` against live DB;
- `verify-phase8-rls.mjs` against live DB.

After implementation:

```bash
git status --short
git rev-parse HEAD
git push origin main
git fetch origin
git rev-parse origin/main
git status --short
```

Required:

- HEAD == origin/main
- clean worktree

---

## J. REQUIRED REPORT — EXACT FORMAT

Return exactly this block and no prose before/after:

```text
TASK
Finora Phase 8 — Pass A Pre-Migration Live Compatibility + Verifier Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
93a1304bd83c39b35e3b2a5b0fabba262359f3e6

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

SOURCE_VERIFIER_SYNTAX
PASS / FAIL

SOURCE_VERIFIER
PASS / FAIL

SOURCE_CHECK_COUNT
<number>/<number>

RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_TESTS
PASS <number>/<number> / FAIL

GIT_DIFF_CHECK
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

SOURCE_VERIFIER_BLOB_SHA
<sha>

STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

RUNTIME_VERIFIER_BLOB_SHA
<sha>

REPORTS_SERVICE_BLOB_SHA
<sha>

APPSHELL_BLOB_SHA
<sha>

AUTH_CONTEXT_BLOB_SHA
<sha or N/A>

PREMIGRATION_DB_COMPAT
PASS / FAIL

SETTINGS_PREMIGRATION_SAVE
PASS / FAIL

AVATAR_IDENTITY_FLICKER_FIX
PASS / FAIL

STRUCTURAL_EXACT_EXHAUSTIVE
PASS / FAIL

RUNTIME_VERIFIER_SUBSTANTIVE
PASS / FAIL

PLACEHOLDER_TESTS_REMAINING
0 / <number>

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
