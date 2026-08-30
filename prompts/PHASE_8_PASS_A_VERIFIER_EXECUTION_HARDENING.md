# Finora Phase 8 — Pass A Verifier Execution Hardening

## Authority

- Repository: `thanhtuyen662002/finora`
- Expected baseline: `5e9832b4d5c7248b7c2c51b293ce9758881887fe`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte unless a concrete migration defect is proven: `69e3ff637c0430fa701794aff497f81eb875443e`
- Remote Supabase MUST NOT be modified in this pass.
- Do NOT run Phase 8 DB verifier live.
- Do NOT run Phase 8 RLS verifier live.
- Do NOT begin Pass B or Phase 9.

## Mission

Verifier/test-only hardening. Preserve accepted Phase 8 application behavior, including pre-migration compatibility and avatar identity fix.

The current source gate is NOT accepted because the verifier implementation itself contains deterministic execution defects.

## Mandatory Runtime Verifier Fixes

File: `scripts/verify-phase8-rls.mjs`

1. Declare every mutable lifecycle variable before the `try` block with `let`, including at minimum:
   - `origA`, `origB`
   - `catAId`
   - `accA1Id`, `accA2Id`
   - `txId`, `trId`
   - any other cleanup-dependent fixture id

ES modules are strict mode; assignments to undeclared identifiers must be impossible.

2. Keep valid account color exactly six hex digits, e.g. `#000000`.

3. Query `account_balances` by `account_id`, never `id`.

4. Exact money comparison must normalize string decimal semantics without Number/parseFloat/float tolerance.

5. `try/finally` cleanup must execute on both PASS and FAIL.

6. Cleanup must be UPDATE-only, never DELETE:
   - transactions -> `is_voided=true`
   - transfers -> `is_voided=true`
   - accounts -> `is_archived=true`
   - categories -> `is_archived=true`
   - settings restored to originals

7. Cleanup assertions must prove affected-row count and final readback state. Do not only inspect the update response.

8. Snapshot INSERT/UPDATE/DELETE denial must assert the actual denied state. For UPDATE/DELETE, do not treat `data === null` by itself as sufficient proof. Require an expected permission/RLS error or a zero-row result with a readback proving no mutation.

9. Require explicit A/B test credentials. No default fake credentials.

10. Preserve bidirectional settings isolation, transaction isolation, transfer isolation, deliberate non-RLS FK error distinction, Phase 4 balance effect/void restoration, and Phase 5 transfer neutrality/void restoration.

## Mandatory Structural Verifier Fixes

File: `scripts/verify-phase8-db.sql`

The current baseline contains deterministic false negatives. Fix all of them.

1. `transaction_fx_snapshots` currency/provider columns are PostgreSQL `TEXT`, not `character varying`.

2. Exact schema check must prove:
   - exactly 12 columns total, no extras
   - exact column names
   - exact types
   - exact nullability
   - exact numeric precision/scale
   - exact defaults/no-defaults

Expected:
- id uuid NOT NULL DEFAULT gen_random_uuid()
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
- created_at timestamptz NOT NULL DEFAULT now()

3. CHECK constraints must be robust to PostgreSQL canonical formatting/casts and prove all eight exact semantics:
   - source currency `^[A-Z]{3,5}$`
   - target currency `^[A-Z]{3,5}$`
   - source <> target
   - source_amount > 0
   - rate > 0
   - converted_amount > 0
   - effective_date <= requested_date
   - trimmed provider length BETWEEN 1 AND 100

4. Keep ordered key/FK proof using `pg_constraint.conkey/confkey` + `pg_attribute`:
   - transactions unique `(id,user_id)`
   - snapshot version unique `(user_id,transaction_id,target_currency_code,source_currency_code,source_amount,requested_date)`
   - FK `(transaction_id,user_id)->transactions(id,user_id)` with ON DELETE RESTRICT

5. Fix authenticated SELECT-only grant checks. The current `count(*) = 1 ... HAVING count(*) = 0` logic is self-contradictory. Prove exactly one table privilege `SELECT` and exactly one view privilege `SELECT`, with no extra privileges.

6. Prove anon and PUBLIC have zero table/view privileges.

7. Prove snapshot RLS enabled and exactly one policy:
   - SELECT only
   - authenticated only
   - ownership `(SELECT auth.uid()) = user_id`
   - zero INSERT/UPDATE/DELETE policies

8. Prove view `security_invoker=true` directly via relation options and INCLUDE this check in `99_OVERALL`.

9. Prove snapshot view has exactly 12 columns and exact money/rate columns as `text`.

10. Prove `user_settings.auto_fx_enabled` exact structure:
    - boolean
    - NOT NULL
    - DEFAULT true
    - authenticated UPDATE column grant

11. Phase 2–7 non-regression must use the correct table name `recurring_items`, NOT `recurring_transactions`, and prove RLS on exactly the accepted 9 user-owned tables.

12. Keep `transaction_details`, `transfer_details`, `account_balances`, `budget_progress`, `goal_details`, `recurring_details` as `security_invoker=true`.

13. Every mandatory structural check must feed `99_OVERALL`.

## Mandatory Source Verifier Hardening

File: `scripts/verify-phase8-source.mjs`

The baseline `5e9832b4d5c7248b7c2c51b293ce9758881887fe` MUST fail source verification for at least:

- undeclared mutable variables in runtime verifier
- structural TEXT vs varchar mismatch
- broken authenticated SELECT-only grant checks
- wrong `recurring_transactions` non-regression table name
- security_invoker check missing from overall, if present
- runtime denial assertions that accept null data without proving denial

Do not add unconditional checks.

## Tests

Run existing deterministic Phase 8 tests and keep 31/31 or higher.
Do not weaken tests.
Do not modify production application code unless required solely to expose a production helper already covered by this contract.

## Required Verification

Run:

```bash
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
# run the existing deterministic Phase 8 test command used by the repo
git diff --check
```

Do NOT execute `verify-phase8-db.sql` against live Supabase.
Do NOT execute `verify-phase8-rls.mjs` against live Supabase.

Then commit/push/fetch and prove:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require `HEAD == origin/main` and clean worktree.

## Required Report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A Verifier Execution Hardening

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
5e9832b4d5c7248b7c2c51b293ce9758881887fe

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

RUNTIME_DECLARATIONS
PASS / FAIL

RUNTIME_DENIAL_ASSERTIONS
PASS / FAIL

RUNTIME_TRY_FINALLY_CLEANUP
PASS / FAIL

STRUCTURAL_EXACT_SCHEMA
PASS / FAIL

STRUCTURAL_EXACT_GRANTS
PASS / FAIL

STRUCTURAL_SECURITY_INVOKER
PASS / FAIL

STRUCTURAL_PHASE2_7_NONREGRESSION
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