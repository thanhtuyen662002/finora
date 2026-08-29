# Finora Phase 8 — Pass A Verifier Schema Final Fix

## Authority

This is a **verifier/test corrective only** on top of actual accepted application source candidate:

- baseline remote implementation: `62fc8a4e05be9bde9097dc3303ce5fbff59d3914`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte unless a concrete migration defect is proven: `69e3ff637c0430fa701794aff497f81eb875443e`

Remote Supabase remains untouched in this pass.

Do NOT:
- apply Phase 8 migration;
- modify remote Supabase;
- execute the structural verifier against live DB;
- execute the RLS verifier against live DB;
- begin Phase 8 Pass B;
- begin Phase 9.

## Accepted application fixes that must not regress

The current source already corrected these owner-reported live defects and they should be preserved:

1. Pre-migration DB compatibility:
   - Dashboard/Reports use a Phase-7-compatible settings read;
   - absence of `auto_fx_enabled` means FX is disabled;
   - no FX APIs/synthetic BASE totals when the schema field is absent;
   - Settings does not write `auto_fx_enabled` when the field is absent.
2. AppShell identity flicker:
   - no initial fake `"Người dùng"` initials;
   - one `getCurrentUserContext()` load;
   - final display-name precedence: profile display name -> auth full_name -> auth name -> email local-part;
   - one visible final identity commit.
3. Existing exact FX/application behavior from the previous Phase 8 corrective.

Do not reopen those implementations unless a concrete regression is proven.

---

# 1. Runtime verifier is currently invalid against the accepted schema

Rewrite `scripts/verify-phase8-rls.mjs` completely enough that it can later run against the real live database after migration.

The rejected verifier at baseline `62fc8a4...` uses fields that do not exist, including examples such as:

- `accounts.current_balance`
- `transactions.base_amount`
- `transactions.base_currency`
- `transactions.exchange_rate`
- `transactions.occurred_at`

It also attempts `DELETE` cleanup on `accounts`, `transactions`, and `transfers`, although the accepted schema intentionally has no DELETE policies for these tables.

The final verifier MUST use the accepted Phase 3/4/5 schema exactly.

## 1.1 Credential behavior

Require explicit env vars and fail closed if any are missing. No default fake credentials.

Use:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (allow legacy anon alias only if the project itself still supports it)
- `FINORA_TEST_USER_A_EMAIL`
- `FINORA_TEST_USER_A_PASSWORD`
- `FINORA_TEST_USER_B_EMAIL`
- `FINORA_TEST_USER_B_PASSWORD`

Do NOT silently fall back to `testa@example.com` / `testpassword`.

## 1.2 Valid fixture schema

Use unique per-run IDs/names.

Create owner-scoped fixture categories using valid accepted fields:

- `user_id`
- `name`
- `type` = `INCOME` or `EXPENSE`
- `icon`
- `color`

Create owner-scoped accounts using valid fields:

- `user_id`
- `name`
- `type`
- `currency_code`
- `opening_balance` as exact decimal string
- optional `institution`
- `color`

Do NOT write `current_balance`; it is derived by the `account_balances` view.

Create transactions using valid Phase 4 fields only:

- `user_id`
- `account_id`
- `category_id`
- `type`
- `amount` as exact decimal string
- `currency_code`
- `merchant`
- optional `note`
- `occurred_on`

Create transfers using valid Phase 5 fields only:

- `user_id`
- `from_account_id`
- `to_account_id`
- `amount` as exact decimal string
- `currency_code`
- optional `note`
- `occurred_on`

## 1.3 Settings A/B lifecycle and isolation

For BOTH users:

- read own `auto_fx_enabled`;
- toggle own value using `.update(...).select()`;
- assert exactly one returned row and exact persisted value;
- read back;
- restore original value in `finally` and assert restored state.

Bidirectional cross-user UPDATE attempts must use `.update(...).select()` and assert **zero affected rows**. Then owner readback must prove unchanged.

Bidirectional cross-user SELECT must return zero rows.

No self-equality assertions such as:

`assertEq(getB2.data.auto_fx_enabled, getB2.data.auto_fx_enabled, ...)`

## 1.4 Snapshot mutation denial

Using each public authenticated client, prove direct browser:

- INSERT denied;
- UPDATE denied;
- DELETE denied.

Distinguish privilege/RLS denial from unrelated malformed-FK/domain errors. For INSERT denial, use a payload that would otherwise be valid if the role had INSERT authority, or prove the denial is the privilege layer before FK/domain semantics.

Do not count a random invalid UUID/FK failure as proof of write denial.

## 1.5 Snapshot SELECT/view isolation

At minimum prove bidirectional A->B and B->A zero-row isolation for both:

- `transaction_fx_snapshots`
- `transaction_fx_snapshot_details`

If a trusted owner snapshot fixture is available through a supported application path, also prove:

- owner can read its row from table and exact-text view;
- other user cannot read it;
- `source_amount`, `rate`, `converted_amount` are exact strings in the details view.

If trusted snapshot creation cannot safely be performed in this runtime verifier without service-role credentials, represent that sub-check explicitly as a future live prerequisite instead of faking coverage. Do not use service-role in this verifier.

## 1.6 Phase 4 regression

Create a real transaction fixture and prove:

- owner exact read through `transaction_details`;
- other user sees zero rows;
- owner account balance changes by exact amount through `account_balances`;
- void transaction through UPDATE;
- balance reverts exactly;
- restore if needed for subsequent checks.

Use exact-decimal string normalization; no Number/parseFloat/tolerance.

## 1.7 Phase 5 regression and transfer neutrality

Create two same-currency owner accounts and a real transfer.

Prove:

- owner reads transfer through `transfer_details`;
- other user sees zero rows;
- source balance decreases by exact transfer amount;
- destination balance increases by exact transfer amount;
- combined owner net balance is unchanged;
- voiding transfer restores both balances;
- no income/expense transaction is created by the transfer.

## 1.8 Deliberate non-RLS error distinction

Issue one deliberate request that must fail for a non-RLS reason and assert it is observably different from the intended RLS/privilege denials.

## 1.9 Cleanup

Cleanup MUST run in `finally` on PASS and FAIL.

Because DELETE is intentionally unavailable, cleanup must be **state cleanup**, not physical delete:

- transactions -> set `is_voided=true` via owner client, `.select()`, assert affected row and persisted readback;
- transfers -> set `is_voided=true`, assert affected row/readback;
- accounts -> set `is_archived=true`, assert affected row/readback;
- categories -> set `is_archived=true`, assert affected row/readback.

Never call `.delete()` on these accepted user-owned tables.

Restore `auto_fx_enabled` originals for A and B.

Every cleanup mutation must be owner-specific and assert affected rows.

## 1.10 Runtime PASS markers

Emit explicit markers such as:

- `AUTH_A_B=PASS`
- `AUTO_FX_LIFECYCLE_A_B=PASS`
- `BIDIRECTIONAL_SETTINGS_ISOLATION=PASS`
- `SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS`
- `BIDIRECTIONAL_SNAPSHOT_ISOLATION=PASS`
- `PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS`
- `PHASE5_TRANSFER_NEUTRALITY_REGRESSION=PASS`
- `DELIBERATE_NON_RLS_ERROR_DISTINCTION=PASS`
- `DETERMINISTIC_CLEANUP=PASS`
- `99_OVERALL=PASS`

Exit nonzero on any failed assertion.

Do NOT execute this verifier live during this source pass.

---

# 2. Structural verifier exact key/FK semantics

Harden `scripts/verify-phase8-db.sql` beyond name/existence checks.

The current key/FK check is insufficient because it only proves named constraints exist.

Using `pg_constraint`, `pg_attribute`, `conkey`, `confkey`, and ordinality as appropriate, prove exact ordered columns:

## 2.1 transactions unique

Exactly one accepted unique constraint on ordered columns:

`(id, user_id)`

for `transactions_id_user_id_key`.

## 2.2 snapshot version unique

Exactly ordered:

`(user_id, transaction_id, target_currency_code, source_currency_code, source_amount, requested_date)`

for `transaction_fx_snapshots_version_key`.

## 2.3 snapshot composite FK

Exactly ordered local columns:

`(transaction_id, user_id)`

references exactly ordered remote columns:

`transactions(id, user_id)`

with `ON DELETE RESTRICT`.

## 2.4 Snapshot schema/defaults

Keep exact 12-column audit. Also ensure no unexpected defaults on columns that must have no default.

## 2.5 Eight CHECK constraints

Prove all eight exact semantic domains while being robust to PostgreSQL canonicalization/casts/parentheses:

- source currency regex `^[A-Z]{3,5}$`
- target currency regex `^[A-Z]{3,5}$`
- currencies distinct
- source_amount > 0
- rate > 0
- converted_amount > 0
- effective_date <= requested_date
- trimmed provider length 1..100

Do not rely on a fragile single exact formatting variant of `pg_get_constraintdef`.

## 2.6 RLS/policy

Prove:

- RLS enabled;
- exactly one policy total on snapshot table;
- command exactly SELECT;
- role exactly authenticated;
- USING semantically `(SELECT auth.uid()) = user_id`;
- no INSERT/UPDATE/DELETE policies.

## 2.7 Grants

Prove exact snapshot table and view grants:

- anon/PUBLIC: zero privileges;
- authenticated: SELECT only;
- no table INSERT/UPDATE/DELETE;
- view authenticated SELECT only;
- `user_settings.auto_fx_enabled`: authenticated UPDATE column grant exists, while Phase 2 immutable columns remain protected.

## 2.8 security_invoker + exact view money types

Prove `transaction_fx_snapshot_details` is `security_invoker=true`, has exact expected columns, and:

- source_amount = text
- rate = text
- converted_amount = text.

## 2.9 Non-regression

Keep Phase 2-7 user-owned RLS table-set exact at 9 and prove accepted Phase 4/5/7 security-invoker views still exist.

Keep Phase 5 same-currency transfer schema invariant.

Every mandatory check MUST feed `99_OVERALL`.

---

# 3. Tests must exercise production helpers

The baseline test still contains replicated/toy logic for pre-migration capability and identity precedence.

Do not test behavior by re-implementing the same expression inside the test.

Extract small pure production helpers if needed, then make application code use them and tests import them.

Required examples:

## 3.1 Auto-FX capability helper

One production helper should resolve settings capability/state such that:

- missing `auto_fx_enabled` -> `{ schemaAvailable:false, enabled:false }`
- boolean false -> available + disabled
- boolean true -> available + enabled

Dashboard/Reports/Settings should consume the same semantics rather than tests duplicating them.

## 3.2 Identity resolver

One production helper should resolve display identity precedence:

1. profile.display_name
2. auth metadata full_name
3. auth metadata name
4. email local-part
5. neutral fallback only after load if all are absent

AppShell must consume this helper, and tests must import/test it.

## 3.3 Preserve real production tests

Keep and execute real production logic tests for:

- exact FX math and rounding;
- rate precision rejection;
- Frankfurter v2 CSV parsing;
- bounded historical lookup;
- snapshot version matching helper;
- BASE CSV header/data/provenance;
- per-transaction historical aggregation;
- native reporting availability when FX unavailable;
- production native currency selection/dedup.

No `assertEq(true, true)` and no inline toy replacement of production logic.

---

# 4. Source verifier must reject baseline 62fc8a4

Harden `scripts/verify-phase8-source.mjs` so baseline

`62fc8a4e05be9bde9097dc3303ce5fbff59d3914`

would FAIL for at least these reasons:

1. runtime verifier references invalid schema columns (`current_balance`, `base_amount`, `base_currency`, `exchange_rate`, `occurred_at`);
2. runtime verifier uses `.delete()` cleanup on no-DELETE-policy tables;
3. runtime verifier uses default fake credentials;
4. runtime verifier contains self-equality/non-assertive isolation checks;
5. structural verifier does not prove ordered unique/FK columns;
6. tests duplicate pre-migration/identity logic instead of importing production helpers.

Do not add unconditional `check(..., true)`.

Do not treat file length, marker presence, or comments alone as sufficient evidence.

---

# 5. Migration invariant

The Phase 8 migration should remain exactly:

`69e3ff637c0430fa701794aff497f81eb875443e`

unless you prove a concrete migration defect. If changed, report the exact defect and new blob SHA; otherwise do not modify it.

Phase 7 migration must remain exactly:

`5da681f7c66fdd85acda79172d1ad305496c6313`

---

# 6. Required verification commands

Run:

```bash
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
npm exec --yes tsx tests/phase8-math.test.ts
git diff --check
```

Do NOT execute `verify-phase8-db.sql` live.
Do NOT execute `verify-phase8-rls.mjs` live.

Commit and push to `main`, then:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require exact HEAD match and clean worktree.

---

# 7. Required final state

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

---

# 8. Exact report format

Return exactly:

```text
TASK
Finora Phase 8 — Pass A Verifier Schema Final Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
62fc8a4e05be9bde9097dc3303ce5fbff59d3914

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
PASS <passed>/<total> / FAIL

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

AUTO_FX_CAPABILITY_HELPER_BLOB_SHA
<sha>

IDENTITY_RESOLVER_BLOB_SHA
<sha>

RUNTIME_SCHEMA_ALIGNMENT
PASS / FAIL

RUNTIME_NO_DELETE_CLEANUP
PASS / FAIL

RUNTIME_BIDIRECTIONAL_ISOLATION
PASS / FAIL

STRUCTURAL_ORDERED_KEYS_FK
PASS / FAIL

PRODUCTION_HELPER_TESTS
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

No prose before or after the report.