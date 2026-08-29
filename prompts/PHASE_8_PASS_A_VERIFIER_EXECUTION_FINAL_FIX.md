# Finora Phase 8 — Pass A Verifier Execution Final Fix

## Authority

This is a verifier/test-only corrective on top of accepted application candidate `a94f22af73a8134a4d0cb097f13eb956e4a5fcb6`.

Do not change Phase 8 application behavior unless a concrete verifier-enabling defect is proven. Do not change the Phase 8 migration unless a concrete migration defect is proven.

The following application fixes are already accepted and must be preserved:

- pre-migration compatibility when `user_settings.auto_fx_enabled` does not yet exist;
- Settings pre-migration save compatibility;
- AppShell identity flicker fix using `getCurrentUserContext`;
- exact FX application behavior and provider abstraction.

## Invariants

- Phase 7 migration blob must remain `5da681f7c66fdd85acda79172d1ad305496c6313`.
- Phase 8 migration blob is expected to remain `69e3ff637c0430fa701794aff497f81eb875443e` unless a concrete defect is proven.
- Remote Supabase MUST NOT be modified in this pass.
- Do NOT execute `scripts/verify-phase8-db.sql` against live Supabase.
- Do NOT execute `scripts/verify-phase8-rls.mjs` against live Supabase.
- Do NOT begin Phase 8 Pass B.
- Do NOT begin Phase 9.

## Rejected verifier baseline

`a94f22af73a8134a4d0cb097f13eb956e4a5fcb6`

The source gate remains FAIL because the verifier suite is not yet execution-correct.

## Mandatory Fix A — Runtime verifier must execute against the accepted schema

Rewrite `scripts/verify-phase8-rls.mjs` so a future live execution uses the exact accepted Phase 3/4/5 schema.

### Accounts fixtures

Use valid columns only:

- `user_id`
- `name`
- `type`
- `currency_code`
- `opening_balance`
- `institution` when needed
- `color`
- `is_archived` when needed

Do NOT use `current_balance` as an accounts table column.

Account color must satisfy the exact six-digit constraint. Use e.g. `#000000`, never `#000`.

### Category fixture

Use exact accepted columns and a valid six-digit color.

### Transaction fixture

Use only:

- `user_id`
- `account_id`
- `category_id`
- `type`
- `amount`
- `currency_code`
- `merchant`
- `note` when needed
- `occurred_on`

Do NOT use:

- `base_amount`
- `base_currency`
- `exchange_rate`
- `occurred_at`

### Transfer fixture

Use only the accepted same-currency Phase 5 schema:

- `user_id`
- `from_account_id`
- `to_account_id`
- `amount`
- `currency_code`
- `note` when needed
- `occurred_on`

### account_balances view

The identifier column is `account_id`, NOT `id`.

Every account balance query must therefore scope by `.eq('account_id', accountId)`.

Do not query a nonexistent `id` column on `account_balances`.

### Exact money assertions

Do not assert textual scale directly, because PostgreSQL numeric-to-text may represent zero or integral values without four trailing decimals.

Add/use a strict string/BigInt exact-money comparator consistent with Finora money semantics. For example, `150`, `150.0`, and `150.0000` must compare equal as exact amount `150.0000` without `Number()` / `parseFloat()` / tolerance math.

Use the exact comparator for balance assertions.

## Mandatory Fix B — Runtime lifecycle and cleanup must be fail-safe

Wrap fixture lifecycle in `try/finally` so cleanup runs on PASS and FAIL.

Cleanup must use only permitted UPDATE semantics:

- transaction -> `is_voided=true`
- transfer -> `is_voided=true`
- accounts -> `is_archived=true`
- category -> `is_archived=true`

No DELETE cleanup.

Mutation-denial tests against `transaction_fx_snapshots` may call DELETE intentionally to prove that DELETE is denied; that is not cleanup and is allowed.

For every cleanup mutation:

- use `.update(...).select()`;
- assert exact affected-row count;
- assert expected state in returned rows;
- perform owner readback and assert persisted state.

Restore both users' `auto_fx_enabled` values in `finally` and prove restoration with owner readback.

Use unique per-run fixture names.

## Mandatory Fix C — Runtime RLS evidence must be non-vacuous where possible

Preserve and strengthen:

- distinct A/B authentication;
- own settings read/update/readback for A and B;
- bidirectional settings SELECT isolation;
- bidirectional settings UPDATE zero-row proof;
- browser INSERT/UPDATE/DELETE denial on snapshot table;
- bidirectional snapshot table/view read isolation;
- Phase 4 transaction-details isolation;
- exact account balance effect + transaction void restoration;
- Phase 5 transfer-details isolation;
- source decrease, destination increase, combined balance neutrality, and transfer void restoration;
- deliberate non-RLS FK error distinction.

Do not use self-equality assertions or comments as evidence.

If no trusted server-created snapshot exists, do not fake one with browser INSERT. The verifier may mark trusted snapshot lifecycle as `NOT_APPLICABLE_NO_TRUSTED_FIXTURE` while still requiring browser mutation denial and bidirectional zero-row isolation. If an owner trusted snapshot is available, verify owner table/view read and other-user zero-row isolation.

The verifier must fail closed on unexpected errors and exit nonzero on any failed assertion.

## Mandatory Fix D — Structural verifier exactness

Rewrite/harden `scripts/verify-phase8-db.sql` so all mandatory checks individually produce rows and feed `99_OVERALL`.

### Exact table schema

Prove all 12 snapshot columns with exact:

- names;
- types;
- numeric precision/scale;
- nullability;
- defaults.

### Exact CHECK semantics

Prove exactly eight Phase 8 CHECK constraints semantically, robust to PostgreSQL canonical formatting/casts/parentheses:

- source currency `^[A-Z]{3,5}$`;
- target currency `^[A-Z]{3,5}$`;
- source != target;
- source_amount > 0;
- rate > 0;
- converted_amount > 0;
- effective_date <= requested_date;
- trimmed provider length 1..100.

Do not depend on `!=` if PostgreSQL canonicalizes to `<>`.

### Ordered keys/FK

Prove with `pg_constraint`, `conkey`, `confkey`, and `pg_attribute`:

- `transactions_id_user_id_key` exact ordered `(id, user_id)`;
- `transaction_fx_snapshots_version_key` exact ordered `(user_id, transaction_id, target_currency_code, source_currency_code, source_amount, requested_date)`;
- `fk_snapshot_transaction` exact ordered `(transaction_id, user_id) -> transactions(id, user_id)`;
- `ON DELETE RESTRICT`.

### RLS and policy

Prove:

- RLS enabled on snapshot table;
- exactly one policy total;
- exactly one SELECT policy;
- zero INSERT/UPDATE/DELETE policies;
- authenticated role only;
- ownership USING semantically `(SELECT auth.uid()) = user_id`.

### Grants

Prove exact grants, not merely presence:

- anon/PUBLIC zero table privileges on snapshot table and view;
- authenticated table SELECT only;
- authenticated view SELECT only;
- authenticated has no table INSERT/UPDATE/DELETE;
- `user_settings.auto_fx_enabled` has the intended authenticated UPDATE column grant;
- no unexpected extra privileges introduced by Phase 8.

### View

Prove:

- `transaction_fx_snapshot_details` exists;
- exactly 12 columns;
- source_amount/rate/converted_amount are text;
- `security_invoker=true` using relation options or an equivalent direct catalog check.

Do NOT use `pg_relation_is_updatable()` as evidence of `security_invoker`; that proves a different property.

The security-invoker check MUST be included in `99_OVERALL`.

### user_settings

Prove `auto_fx_enabled` exact structure:

- boolean;
- NOT NULL;
- DEFAULT true.

### Non-regression

Prove:

- all nine Phase 2–7 user-owned tables still have RLS enabled;
- Phase 5 transfers remain same-currency only and no Phase 8 cross-currency columns were added;
- accepted views `transaction_details`, `transfer_details`, `account_balances`, `budget_progress`, `goal_details`, `recurring_details` still exist with `security_invoker=true`;
- accepted exact-money text columns on those views remain intact where applicable.

Every mandatory check must appear in the output and participate in `99_OVERALL`.

## Mandatory Fix E — Tests must execute production helpers

Keep deterministic tests for production FX math/provider/report helpers.

For pre-migration capability and identity precedence, tests must import and execute production helpers, not duplicate equivalent local expressions.

Required production helper coverage:

- missing `auto_fx_enabled` => schema capability false and FX disabled;
- explicit `true` => enabled;
- explicit `false` => disabled;
- display identity precedence: profile display_name > auth full_name > auth name > email local-part;
- no fake `Người dùng` transition in the loading path.

Also add regression assertions that the runtime verifier source does not contain:

- account color `'#000'`;
- `.eq('id', ...` for `account_balances`;
- direct string-scale-only balance assertions;
- missing `try/finally` cleanup.

## Mandatory Fix F — Source verifier must reject the current rejected baseline

Harden `scripts/verify-phase8-source.mjs` so baseline `a94f22af73a8134a4d0cb097f13eb956e4a5fcb6` would fail specifically for:

- invalid three-digit account color fixture;
- `account_balances` queried by `id` instead of `account_id`;
- lack of exact-money normalization in runtime balance assertions;
- cleanup not guaranteed by `try/finally`;
- structural `security_invoker` check not included in `99_OVERALL`;
- misuse of `pg_relation_is_updatable` as security-invoker evidence;
- fragile `!=` CHECK matching;
- missing exact 12-column nullability/default/type proof;
- missing exact anon/PUBLIC grants and Phase 2–7 non-regression proof.

No unconditional `check(..., true)`.

## Required local verification

Run all of the following:

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

Do NOT execute the live DB or live RLS verifier.

## Git/provenance requirements

Commit and push to `main`, then run:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require:

- `HEAD == origin/main`;
- clean worktree.

## Required final state

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_8_STRUCTURAL_GATE=NOT_RUN
PHASE_8_TWO_USER_RLS=NOT_RUN
PHASE_8_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

## Exact report format

Return exactly:

```text
TASK
Finora Phase 8 — Pass A Verifier Execution Final Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
a94f22af73a8134a4d0cb097f13eb956e4a5fcb6

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

RUNTIME_ACCOUNT_FIXTURE_SCHEMA
PASS / FAIL

RUNTIME_ACCOUNT_BALANCES_KEY
PASS / FAIL

RUNTIME_EXACT_MONEY_COMPARATOR
PASS / FAIL

RUNTIME_TRY_FINALLY_CLEANUP
PASS / FAIL

RUNTIME_SETTINGS_RESTORE_READBACK
PASS / FAIL

STRUCTURAL_SECURITY_INVOKER
PASS / FAIL

STRUCTURAL_EXACT_COLUMNS_DEFAULTS
PASS / FAIL

STRUCTURAL_GRANTS_NONREGRESSION
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