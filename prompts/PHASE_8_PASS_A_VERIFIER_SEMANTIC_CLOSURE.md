# Finora Phase 8 — Pass A Verifier Semantic Closure

## Authority

- Repository: `thanhtuyen662002/finora`
- Expected baseline: `8a64e755ff964840bfcb71b7b5ef0e37c2723a0b`
- Preserve accepted Phase 8 application behavior.
- Preserve Phase 7 migration byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Preserve Phase 8 migration byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Remote Supabase MUST NOT be modified.
- Do NOT execute live DB/RLS verifiers.
- Do NOT begin Pass B or Phase 9.

## Mission

Verifier-only semantic closure. The current application/migration candidate is accepted for source review, but the verifier gate is still not trustworthy.

The current baseline MUST NOT be reported `PASS_CODE_ONLY` until all items below are implemented and statically enforced.

## 1. Source Verifier Must Actually Regress the Rejected Baseline

File: `scripts/verify-phase8-source.mjs`

The current source verifier blob `342a366742f8200e1bbe50dbf85cbcf51de34ea8` already passed before the final verifier corrections and therefore cannot be reused unchanged.

It MUST change in this commit.

It must make baseline `5e9832b4d5c7248b7c2c51b293ce9758881887fe` fail for at least:

- undeclared runtime lifecycle variables;
- PostgreSQL TEXT vs `character varying` mismatch;
- wrong `recurring_transactions` name;
- broken authenticated SELECT-only grant logic;
- structural CHECK assertions that do not prove operators/bounds;
- structural exact-schema logic that does not reject extra columns;
- runtime cleanup lacking final readback;
- snapshot UPDATE/DELETE denial accepting zero rows without mutation proof.

Do not use unconditional checks. Do not count comments as proof.

## 2. Structural Verifier Semantic Exactness

File: `scripts/verify-phase8-db.sql`

Keep ordered key/FK proof and current correct TEXT types, but fix the remaining weak semantics.

### Exact 12 columns

Prove BOTH:

- total number of columns is exactly 12;
- the exact expected column-name set is present.

An `INTERSECT` count of 12 alone is insufficient because it does not reject extra columns.

### Exact defaults

Normalize PostgreSQL default expressions and prove:

- `id` default is semantically `gen_random_uuid()`;
- `created_at` default is semantically `now()`;
- every other snapshot column has no default.

Do not merely check `column_default IS NOT NULL` for id/created_at.

### Exact CHECK semantics

Do not weaken checks to patterns such as:

- `%source_amount%0%`
- `%rate%0%`
- `%converted_amount%0%`
- `%effective_date%requested_date%`
- `%length%trim%provider%`

Those do not prove the operators or bounds.

Prove all eight named constraints semantically and robustly against PostgreSQL formatting/casts:

- source currency regex `^[A-Z]{3,5}$`;
- target currency regex `^[A-Z]{3,5}$`;
- `source_currency_code <> target_currency_code`;
- `source_amount > 0`;
- `rate > 0`;
- `converted_amount > 0`;
- `effective_date <= requested_date`;
- `char_length(trim(provider)) BETWEEN 1 AND 100`.

Use constraint names plus normalized definitions/tokens as appropriate.

### RLS policy semantics

Prove exactly one policy on snapshot table and that it is:

- SELECT;
- role authenticated only;
- ownership using `(SELECT auth.uid()) = user_id` semantically;
- no INSERT/UPDATE/DELETE policies.

### Grants

Prove exactly one authenticated table privilege SELECT and exactly one authenticated view privilege SELECT, with no extras.

Prove anon and PUBLIC have zero privileges.

### View

Keep direct `security_invoker=true` proof in `99_OVERALL`.

Prove exact 12 view columns, not merely count 12, and exact text type for `source_amount`, `rate`, `converted_amount`.

### user_settings

Prove `auto_fx_enabled`:

- boolean;
- NOT NULL;
- semantically DEFAULT true;
- exact authenticated UPDATE column grant;
- no unintended anon/PUBLIC column grant.

### Non-regression

Keep correct table name `recurring_items`.

Prove RLS remains enabled on exactly the accepted Phase 2–7 user-owned tables and retain security-invoker proof for:

- transaction_details
- transfer_details
- account_balances
- budget_progress
- goal_details
- recurring_details

Every mandatory check must feed `99_OVERALL`.

## 3. Runtime Verifier Denial and Cleanup Proof

File: `scripts/verify-phase8-rls.mjs`

Keep current explicit credentials, declarations, correct schema, exact-money comparison, account_id queries and try/finally.

### Distinct users

Assert `userAId !== userBId` immediately after authentication.

### Settings readiness

Assert both settings reads succeed and both original `auto_fx_enabled` values are booleans before toggling.

### Snapshot mutation denial

INSERT:
- require expected permission/RLS denial;
- distinguish it from FK/domain errors.

UPDATE/DELETE:
- do NOT accept `error != null OR zero rows` as sufficient proof by itself;
- require either an expected permission/RLS error OR zero affected rows PLUS an authoritative readback proving no snapshot changed.

The verifier may use owner-visible snapshot rows if available. If none exist, the permission-error path must be the proof; do not manufacture trusted snapshots with a browser key.

Also test `transaction_fx_snapshot_details` cross-user isolation bidirectionally, not only the base table.

### Phase 4/5 isolation

Preserve owner read + foreign zero-row checks. Add the reverse direction using a minimal B-owned fixture or otherwise prove bidirectional isolation for both transaction_details and transfer_details.

### Cleanup

`finally` must attempt all cleanup steps even if one cleanup assertion fails.

Do not call an assertion helper that immediately `process.exit(1)` in the middle of cleanup and prevents later cleanup.

Collect cleanup failures, continue all cleanup operations, then fail at the end if any cleanup failed.

For settings, transactions, transfers, accounts and categories:

- perform UPDATE-only cleanup;
- assert affected row counts;
- perform separate final readback queries;
- assert persisted final state.

No DELETE cleanup.

## 4. Tests

Keep existing Phase 8 deterministic production-module tests at 31/31 or higher.

Do not weaken application tests.

## 5. Required Verification

Run:

```bash
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
# existing deterministic Phase 8 test command
git diff --check
```

Do NOT run DB/RLS verifiers live.

Then commit/push/fetch and prove:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require HEAD == origin/main and clean worktree.

## Required Report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A Verifier Semantic Closure

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
8a64e755ff964840bfcb71b7b5ef0e37c2723a0b

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
<n>/<n>

RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_TESTS
PASS <n>/<n> / FAIL

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

SOURCE_VERIFIER_CHANGED
true / false

STRUCTURAL_CHECK_SEMANTICS_EXACT
PASS / FAIL

STRUCTURAL_EXACT_COLUMN_SET_DEFAULTS
PASS / FAIL

RUNTIME_DISTINCT_USERS
PASS / FAIL

RUNTIME_DENIAL_READBACK_PROOF
PASS / FAIL

RUNTIME_BIDIRECTIONAL_VIEW_ISOLATION
PASS / FAIL

RUNTIME_CLEANUP_CONTINUES_AND_READS_BACK
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

No prose before or after.
