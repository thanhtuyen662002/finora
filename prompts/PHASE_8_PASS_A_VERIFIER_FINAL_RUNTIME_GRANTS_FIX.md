# Finora Phase 8 — Pass A Verifier Final Runtime + Grants Fix

## Authority

- Repository: `thanhtuyen662002/finora`
- Actual accepted application/migration candidate baseline: `1ec6e7042d760742ba35a3d04727d2f297889852`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- This is VERIFIER-ONLY.
- Remote Supabase MUST NOT be modified.
- Do NOT execute the DB verifier live.
- Do NOT execute the RLS verifier live.
- Do NOT begin Phase 8 Pass B or Phase 9.

## Mission

Close the final verifier correctness gaps without modifying Phase 8 application behavior or migrations.

The baseline `1ec6e7042d760742ba35a3d04727d2f297889852` is NOT accepted as the final source gate because the runtime verifier can still skip `finally` cleanup on a normal assertion failure, and the structural privilege/policy checks are not yet authoritative enough.

## Mandatory Runtime Verifier Fixes

File: `scripts/verify-phase8-rls.mjs`

1. `assert()` MUST NOT call `process.exit(1)`.

Current behavior is invalid because `process.exit(1)` inside the main `try` terminates Node immediately and bypasses `finally`, leaving fixtures behind.

Required pattern:
- assertion failure throws an `Error` (or records a primary failure and throws);
- the enclosing `finally` ALWAYS executes;
- all cleanup resources are attempted independently;
- after cleanup finishes, the original failure is allowed to propagate to the outer catch/non-zero exit.

2. Cleanup helper code must not terminate the process before every cleanup resource has been attempted. If cleanup has failures, aggregate them and throw only AFTER all cleanup attempts/readbacks finish.

3. Preserve all current accepted runtime checks:
- distinct A/B users;
- settings lifecycle + restoration;
- bidirectional settings isolation;
- snapshot INSERT/UPDATE/DELETE denial;
- denial readback proof;
- table + view snapshot isolation;
- bidirectional Phase 4 transaction isolation;
- Phase 4 exact balance effect + void restoration;
- bidirectional Phase 5 transfer isolation;
- Phase 5 source/destination effect + combined neutrality + void restoration;
- deliberate non-RLS FK error distinction;
- UPDATE-only cleanup with persisted readback.

4. Snapshot readback comparisons must be deterministic. If comparing arrays with `JSON.stringify`, sort by stable key (`id`) first or compare a canonical projection, so unchanged state does not depend on unspecified row order.

## Mandatory Structural Grants Fix

File: `scripts/verify-phase8-db.sql`

1. Do NOT use `information_schema.role_table_grants` / `role_column_grants` as proof that PUBLIC has zero privileges. Those views are role-scoped and are not an authoritative PUBLIC-grant audit.

Use authoritative privilege catalog/views, e.g.:
- `information_schema.table_privileges` for table/view grantees including `PUBLIC`;
- `information_schema.column_privileges` for `auto_fx_enabled` column grants;
- or equivalent `aclexplode`/catalog proof.

2. Prove exact snapshot TABLE privileges:
- authenticated: exactly SELECT and nothing else;
- anon: zero privileges;
- PUBLIC: zero privileges.

3. Prove exact snapshot VIEW privileges:
- authenticated: exactly SELECT and nothing else;
- anon: zero privileges;
- PUBLIC: zero privileges.

4. Prove `user_settings.auto_fx_enabled` column privilege:
- authenticated has UPDATE on that column;
- anon has zero privilege on that column;
- PUBLIC has zero privilege on that column.

Do not confuse pre-existing table privileges on `user_settings` with the new column-level grant. Audit the exact column privilege.

## Mandatory Structural RLS Policy Fix

Do not rely on fragile string matching of `pg_policies.qual` such as exact `(SELECT auth.uid()) = user_id` formatting.

Use `pg_catalog.pg_policy` + `pg_get_expr`, following the already accepted Phase 7 verifier style.

Prove exactly one policy on `public.transaction_fx_snapshots`:
- command SELECT only (`polcmd='r'`);
- authenticated role exactly;
- `polqual IS NOT NULL`;
- `polwithcheck IS NULL`;
- expression contains both `auth.uid()` and `user_id` ownership terms;
- zero INSERT/UPDATE/DELETE policies.

This proof must feed `99_OVERALL`.

## Structural Semantics Preservation

Keep and do not weaken the current good checks from baseline `1ec6e704...`:
- exact 12-column total + exact set;
- exact types/nullability/precision/scale/default semantics;
- eight exact CHECK semantics;
- ordered transaction unique;
- ordered snapshot version unique;
- exact composite FK + ON DELETE RESTRICT;
- RLS enabled;
- snapshot view exact 12 columns and money/rate text casts;
- `security_invoker=true` and included in `99_OVERALL`;
- `auto_fx_enabled boolean NOT NULL DEFAULT true`;
- Phase 2–7 RLS non-regression using `recurring_items`;
- Phase 2–7 derived views remain `security_invoker=true`;
- Phase 5 same-currency transfer schema unchanged.

## Mandatory Source Verifier Hardening

File: `scripts/verify-phase8-source.mjs`

The baseline `1ec6e7042d760742ba35a3d04727d2f297889852` MUST fail source verification for at least:

- `assert()` containing `process.exit(1)` in the runtime verifier;
- cleanup path capable of process termination before finally completes;
- use of `role_table_grants` / `role_column_grants` as PUBLIC privilege proof;
- fragile `pg_policies.qual` ownership string matching instead of `pg_policy + pg_get_expr`;
- non-deterministic `JSON.stringify` comparison of unsorted snapshot arrays, if still present.

The source verifier itself MUST change blob SHA. No unconditional checks.

## Blob SHA Reporting

Report exact Git blob SHAs, exactly 40 lowercase hex characters.

The previous semantic-closure report demonstrated malformed SHA rendering:
- runtime blob omitted a leading `0`;
- structural blob had an extra trailing character.

Use Git-native proof, e.g. `git rev-parse HEAD:<path>` or `git hash-object <path>`, and validate against regex `^[0-9a-f]{40}$` before reporting.

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

Do NOT execute either Phase 8 live verifier.

Then commit, push, fetch, and prove:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
git rev-parse HEAD:scripts/verify-phase8-source.mjs
git rev-parse HEAD:scripts/verify-phase8-db.sql
git rev-parse HEAD:scripts/verify-phase8-rls.mjs
```

Require:
- `HEAD == origin/main`;
- clean worktree;
- every reported blob SHA is exactly 40 lowercase hex chars.

## Required Report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A Verifier Final Runtime + Grants Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
1ec6e7042d760742ba35a3d04727d2f297889852

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
<40-hex>

PHASE_8_MIGRATION_BLOB_SHA
<40-hex>

SOURCE_VERIFIER_BLOB_SHA
<40-hex>

STRUCTURAL_VERIFIER_BLOB_SHA
<40-hex>

RUNTIME_VERIFIER_BLOB_SHA
<40-hex>

RUNTIME_ASSERT_THROWS_NOT_EXITS
PASS / FAIL

RUNTIME_FINALLY_ALWAYS_REACHED
PASS / FAIL

RUNTIME_CLEANUP_ALL_ATTEMPTED
PASS / FAIL

RUNTIME_CANONICAL_MUTATION_READBACK
PASS / FAIL

STRUCTURAL_PUBLIC_GRANTS_AUTHORITATIVE
PASS / FAIL

STRUCTURAL_AUTHENTICATED_EXACT_SELECT_ONLY
PASS / FAIL

STRUCTURAL_COLUMN_GRANT_EXACT
PASS / FAIL

STRUCTURAL_RLS_POLICY_CATALOG_PROOF
PASS / FAIL

BLOB_SHA_FORMAT_EXACT_40_HEX
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
