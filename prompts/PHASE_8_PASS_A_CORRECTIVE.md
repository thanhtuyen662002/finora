# Finora Phase 8 — Pass A Corrective: FX Authority, Migration, Verifiers, and Ledger Recovery

## 0. Authority and execution mode

Repository: `thanhtuyen662002/finora`

Corrective baseline / rejected implementation SHA:

```text
9671d2877e4fdc63e23a02d299a76ad39d81053e
```

Original Phase 8 contract:

```text
prompts/PHASE_8_MULTI_CURRENCY_FX.md
47ca9a227e59c95fa1f460d490d5cf0a93697434
```

Phase 7 remains CLOSED and immutable.

Phase 7 migration blob MUST remain byte-for-byte:

```text
5da681f7c66fdd85acda79172d1ad305496c6313
```

This corrective is **SOURCE / MIGRATION PREPARATION ONLY**.

DO NOT:

- apply any Phase 8 migration to remote Supabase;
- modify the remote Supabase database;
- run the Phase 8 structural verifier against live Supabase;
- run the Phase 8 two-user RLS verifier against live Supabase;
- begin Phase 8 Pass B cross-currency transfers;
- begin Phase 9;
- rewrite accepted Phase 2–7 migrations or finance logic.

The Phase 8 migration has NOT been applied, therefore it MAY and MUST be corrected where required.

Required final status remains:

```text
PHASE_7_OVERALL=PASS
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

## 1. Why `9671d287...` is rejected

Do not merely make the previous report green. Correct the actual defects.

### 1.1 Missing mandatory verification artifacts

The rejected implementation omitted all three mandatory files:

```text
scripts/verify-phase8-source.mjs
scripts/verify-phase8-db.sql
scripts/verify-phase8-rls.mjs
```

They MUST be implemented and meaningful.

### 1.2 Migration FK order is unsafe

Current migration creates `transaction_fx_snapshots` with:

```text
FOREIGN KEY (transaction_id, user_id)
REFERENCES transactions(id, user_id)
```

before it guarantees a UNIQUE key on `transactions(id,user_id)`.

Accepted Phase 4/5 migrations do not establish that transaction unique key.

Fix migration ordering so the referenced unique key exists BEFORE the snapshot table/FK is created.

The whole Phase 8 migration MUST be atomic:

```sql
BEGIN;
...
COMMIT;
```

No partial `auto_fx_enabled` or partial snapshot schema may remain if a later statement fails.

### 1.3 Exact-text authority is violated in snapshot route

The rejected route reads authoritative transaction money from:

```text
public.transactions.amount
```

through a normal PostgREST numeric response and converts it using `String(...)`.

This is forbidden because PostgreSQL numeric JSON may already have crossed a JavaScript number boundary.

For authoritative transaction money reads, use the existing exact-text boundary:

```text
public.transaction_details.amount
```

Likewise, existing/new snapshot money and rate reads returned to authoritative application code MUST come from:

```text
public.transaction_fx_snapshot_details
```

where `source_amount`, `rate`, and `converted_amount` are text.

Do not depend on `.insert(...).select('*')` numeric values as the returned authoritative snapshot representation. Insert via the admin client, then re-read the exact winning/current-version row through the exact-text view.

### 1.4 Current valuation is not fail-closed

The rejected implementation contains logic equivalent to:

```text
rates[c]?.rate || '1.000000000000'
```

A missing non-identity rate must NEVER silently become identity.

Required behavior:

- source currency == base currency: explicit local identity rate;
- otherwise the exact rate MUST be present and valid;
- if any required non-identity rate is absent or invalid, converted net worth is unavailable;
- native per-currency balances remain available;
- do not emit a partial base-currency scalar.

### 1.5 Frankfurter v2 contract is not actually implemented

The class labels itself `FRANKFURTER_V2` but calls `/v1/...` endpoints.

Use the actual Frankfurter v2 CSV interface.

Required transport:

```text
https://api.frankfurter.dev/v2/rates.csv
```

Current pair example semantics:

```text
/v2/rates.csv?base=USD&quotes=VND
```

Historical lookup MUST use a bounded seven-calendar-day range ending on the requested date, for example semantically:

```text
/v2/rates.csv?base=USD&quotes=VND&from=<requested-7d>&to=<requested>
```

Parse CSV as exact strings. Expected v2 rate rows are semantically:

```text
date,base,quote,rate
```

For historical lookup:

- validate every returned row;
- retain only requested base/quote rows;
- require `effectiveDate <= requestedDate`;
- require the effective date to be inside the bounded seven-day lookback window;
- select the latest valid row;
- if no valid observation exists in the window, fail explicitly;
- never use a future row;
- do not accept provider JSON numeric rates as authoritative fallback.

Same-currency conversion remains local identity with no network call.

### 1.6 Exact rate normalization silently truncates

The rejected `toExactRate()` accepts `string | number` and silently slices fractional precision to 12 digits.

Fix it:

- authoritative rate input is `string` only;
- valid rate grammar is positive decimal with at most 12 fractional digits;
- maximum 18 integer digits for `numeric(30,12)`;
- extra fractional precision must FAIL, never silently truncate;
- zero/negative/malformed values fail;
- normalize accepted values to exactly 12 fractional digits.

`convertExactAmount()` must validate its final 4-decimal result against the existing `numeric(20,4)` exact-money precision so conversion overflow fails before persistence/display authority.

Keep round-half-away-from-zero and negative-balance support.

### 1.7 Historical snapshot version matching/race handling is too weak

For each requested transaction, match a snapshot ONLY when all current version fields match semantically:

```text
user_id
transaction_id
target_currency_code
source_currency_code
source_amount
requested_date
```

Use exact decimal normalization for source amount comparisons, not raw representation equality.

On unique race:

- re-read exact-text snapshot rows;
- select only the exact current transaction version;
- never return stale prior-version rows;
- return exactly one authoritative result per requested owned transaction.

Old version snapshots remain immutable evidence.

### 1.8 `auto_fx_enabled` is not actually persisted from Settings

The rejected diff did not wire `src/app/settings/page.tsx` to the new field.

Required:

- load `auto_fx_enabled` from `user_settings` into the existing `autoFx` switch;
- save `auto_fx_enabled` through the existing authenticated settings update path;
- update types/contracts as needed;
- when disabled, Dashboard/Reports native modes must make no FX provider/API calls merely to render;
- changing base currency must not mutate account/transaction currencies or old snapshots.

### 1.9 FX failure state is hidden from the UI

The rejected implementation catches BASE failures, logs to console, and silently removes BASE mode.

Current valuation/report failures must be represented truthfully.

At minimum expose typed status/provenance in report data, e.g. semantically:

```text
baseValuationStatus: AVAILABLE | UNAVAILABLE | DISABLED
baseValuationError: string | null
baseValuationQuotes: exact quote metadata
historicalBaseStatus: AVAILABLE | UNAVAILABLE | DISABLED
historicalBaseError: string | null
```

Names may vary.

Dashboard/Reports UI requirements:

- native finance remains usable;
- if converted BASE state is unavailable, show a visible compact explanation instead of a fake/partial scalar;
- provide a retry/reload action;
- when BASE is available, show compact provider/effective-date freshness/provenance;
- never imply current valuation is historical immutable truth.

### 1.10 BASE CSV provenance is malformed/incomplete

The rejected exporter appends extra BASE values without adding matching headers.

For BASE mode, header count and row count MUST match and provenance MUST include explicit columns for at least:

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

Same-currency rows use identity metadata.

Keep RFC 4180 + UTF-8 BOM.

Native CSV schema/behavior must remain unchanged.

Do not use untyped `_fx_*` fields via `as any`; introduce a typed converted-transaction/provenance contract.

### 1.11 Documentation/ledger regression

`docs/PROJECT_STATUS.md` was destructively shortened by hundreds of lines.

Restore the full historical ledger from:

```text
47ca9a227e59c95fa1f460d490d5cf0a93697434:docs/PROJECT_STATUS.md
```

Then update it in-place truthfully:

- preserve all prior Phase 2–7 history;
- record Phase 7 CLOSED/PASS and closure receipt;
- record Phase 8 Pass A as source/migration preparation only;
- remote DB blocked/not applied;
- Phase 9 false.

Do NOT replace the living ledger with a short summary.

Also implement documentation required by the original contract:

- append ADR-013 to `docs/DECISIONS.md` without rewriting old ADR history;
- update `docs/DATABASE.md` for `transaction_fx_snapshots`, exact view, transaction composite unique key, and `user_settings.auto_fx_enabled`.

### 1.12 Temporary patch scripts must not remain

Delete all implementation scratch files added by the rejected pass matching:

```text
scripts/patch_*.mjs
```

Do not commit codemod scratch files as product artifacts.

---

## 2. Migration corrective requirements

Correct exactly:

```text
supabase/migrations/20260829000001_phase_8_fx.sql
```

Do not create a second Phase 8 Pass A migration.

Migration has NOT been applied remotely, so its blob SHA is expected to change from rejected blob:

```text
912d85854f39f17037a82a2bdaa75de9e1d8afc3
```

Required ordering inside one transaction:

1. `BEGIN`;
2. add exact UNIQUE `(id,user_id)` to `public.transactions` before any FK references it;
3. add `user_settings.auto_fx_enabled boolean NOT NULL DEFAULT true` and minimum update grant;
4. create `transaction_fx_snapshots` exact schema/constraints/version unique/FK RESTRICT;
5. enable RLS;
6. revoke broad privileges from anon/PUBLIC/authenticated;
7. grant authenticated SELECT only;
8. create exactly one authenticated SELECT ownership policy using `(SELECT auth.uid()) = user_id`;
9. create `transaction_fx_snapshot_details WITH (security_invoker=true)` with all three numeric authority fields exposed as text;
10. restrict view grants to authenticated SELECT;
11. `COMMIT`.

There must be no client INSERT/UPDATE/DELETE grant or policy on snapshots.

No `updated_at` on immutable snapshots.

Do not modify Phase 5 transfer schema.

---

## 3. Server-only boundary hardening

`src/lib/supabase/admin.ts` must be structurally server-only.

Prefer a Next.js server-only marker such as:

```ts
import 'server-only';
```

if compatible with this codebase/build.

Regardless, source verification must prove it is not imported by any Client Component/client-side finance module.

Rules remain:

- service-role key is `SUPABASE_SERVICE_ROLE_KEY` only;
- never `NEXT_PUBLIC_`;
- user_id derived from authenticated cookie session;
- browser cannot supply authoritative rate/amount/source currency/date/provider/converted amount;
- external responses must not echo raw DB/provider exception messages that may expose internals; log details server-side and return bounded public errors.

---

## 4. Typed FX/report contracts

Remove Phase 8 `any` shortcuts from authoritative snapshot/report conversion paths.

Create explicit types for:

- exact FX quote;
- exact snapshot detail;
- current valuation quote map/status;
- base-converted transaction with provenance;
- historical BASE availability/error state.

The UI and CSV exporter must consume typed provenance.

The literal pseudo selector `BASE` may remain presentation state, but actual target currency provenance must always contain the user's real base currency code (e.g. VND), never pretend `BASE` is an ISO currency.

---

## 5. Required deterministic Phase 8 tests

The rejected `verify-fx-*.mjs` scripts import nonexistent compiled `.js` modules and are not acceptable as the only tests.

Implement tests that actually import and exercise the production TypeScript modules.

You may add a minimal dev-only TypeScript execution dependency such as `tsx` if necessary. Do not add a large test framework merely for this pass.

Tests must be deterministic and provider network MUST be mocked.

Required minimum cases:

1. v2 current CSV URL/path and exact CSV parsing;
2. USD->VND and VND->USD exact rate strings;
3. historical bounded lookback chooses latest valid row <= requested date;
4. observation older than seven calendar days rejected;
5. future effective date rejected;
6. malformed CSV/header/rate rejected;
7. missing pair rejected;
8. identity pair performs no fetch;
9. rate with >12 fractional digits rejected, not truncated;
10. zero and negative rate rejected;
11. positive exact conversion;
12. negative balance conversion;
13. zero conversion;
14. rate below 1;
15. half-away-from-zero rounding boundary;
16. conversion output overflow rejected;
17. complete current-rate set yields BASE total;
18. missing one non-identity current rate yields NO BASE scalar;
19. per-transaction historical conversion, not subtotal conversion;
20. transaction amount/date/currency edit resolves a new snapshot version and does not mutate old version;
21. changing base currency resolves target-specific snapshots without rewriting old target snapshots;
22. provider failure leaves native report data usable;
23. BASE CSV header/row column counts match and all required provenance fields exist;
24. `auto_fx_enabled=false` path performs no FX fetch for native rendering.

Test process MUST exit nonzero on any uncaught error or failed assertion.

Remove or replace obsolete broken `verify-fx-math.mjs` / `verify-fx-provider.mjs`; do not leave misleading green-looking test files that do not execute production modules.

---

## 6. Mandatory verification artifacts

### 6.1 `scripts/verify-phase8-source.mjs`

Must meaningfully reject the rejected implementation `9671d287...`.

At minimum prove statically:

- all required Phase 8 files exist;
- no `scripts/patch_*.mjs` remain;
- Phase 7 migration blob/source is unchanged;
- Phase 5 transfer migration/source remains same-currency-only;
- Phase 8 migration is atomic and transaction `(id,user_id)` unique is created before snapshot FK/table dependency;
- exact snapshot schema/version unique/RLS/grants/view semantics are present;
- provider uses `/v2/` CSV and no `/v1/` endpoint in authoritative provider;
- no JSON numeric-rate authority fallback;
- exact rate API is string-only and no silent >12 precision truncation exists;
- snapshot route reads transaction money from exact-text view and returns snapshot numerics from exact-text view;
- browser snapshot request cannot supply authoritative amount/rate/source/date/provider/user_id;
- service-role secret is server-only;
- no missing-rate identity fallback for non-identity current valuation;
- `auto_fx_enabled` is loaded AND saved by Settings;
- disabled auto-FX path does not fetch provider for native mode;
- explicit BASE unavailable/error state + retry/provenance UI exists;
- historical aggregation converts each transaction from its own snapshot;
- BASE CSV exact provenance headers and typed data exist;
- ADR-013 exists;
- DATABASE.md updated;
- PROJECT_STATUS retains historical markers from earlier accepted phases and records truthful Phase 8 state;
- Phase 8 Pass B is NOT started;
- Phase 9 is NOT authorized.

Do not claim this static verifier executes PostgreSQL or proves live RLS.

### 6.2 `scripts/verify-phase8-db.sql`

Create a strict READ-ONLY structural verifier for later manual execution.

It must prove every original contract requirement, including:

- transaction `(id,user_id)` unique key;
- `user_settings.auto_fx_enabled` exact boolean / NOT NULL / default true / authenticated UPDATE grant;
- snapshot exact 11 columns, types, nullability/defaults;
- numeric precisions `source_amount(20,4)`, `rate(30,12)`, `converted_amount(20,4)`;
- every named/domain constraint semantically;
- exact version unique key in correct column order;
- exact `(transaction_id,user_id)->transactions(id,user_id)` FK with RESTRICT;
- RLS enabled;
- exactly one authenticated SELECT policy and zero INSERT/UPDATE/DELETE policies;
- ownership expression `(SELECT auth.uid()) = user_id` semantically;
- anon/PUBLIC zero table/column privileges;
- authenticated snapshot table SELECT only;
- snapshot exact view exists and `security_invoker=true`;
- source_amount/rate/converted_amount in view are `text`;
- authenticated SELECT-only view access;
- Phase 2–7 user-owned RLS remains enabled;
- accepted Phase 4 transaction and Phase 5 transfer RLS/grants/views are not regressed;
- Phase 5 transfer schema still enforces same-currency accounts;
- Phase 7 tables/views/RLS remain present;
- every mandatory result participates in `99_OVERALL`.

Do not execute this SQL in the source pass.

### 6.3 `scripts/verify-phase8-rls.mjs`

Prepare a later LIVE verifier, but run syntax check only now.

Later verifier must use only:

- public Supabase URL/publishable key;
- Test User A credentials;
- Test User B credentials.

No service-role key.

It must later prove:

- A/B own snapshot SELECT isolation;
- direct authenticated INSERT denied;
- UPDATE denied;
- DELETE denied;
- cross-user snapshot SELECT denied;
- snapshot view isolation;
- `auto_fx_enabled` own update/persistence and A/B isolation;
- Phase 4 transaction RLS regression;
- Phase 5 transfer RLS + balance-neutrality regression;
- deliberate non-RLS DB error distinction;
- deterministic cleanup for mutable fixtures.

It must fail closed when credentials are missing.

Do not execute it live in this corrective source pass.

---

## 7. Required source verification commands

Run all of these on the final corrective source:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
git diff --check
```

Run the dedicated deterministic Phase 8 test command(s) and report the exact passed/total count.

DO NOT run:

```text
scripts/verify-phase8-db.sql against remote Supabase
scripts/verify-phase8-rls.mjs against live Supabase
```

DO NOT apply the migration.

Before reporting:

```text
git fetch origin
git status --short --untracked-files=all
git rev-parse HEAD
git rev-parse origin/main
```

Required:

```text
HEAD == origin/main
worktree clean
```

Commit and push all corrective changes to `main`.

---

## 8. Required report format

Return exactly this block with no prose before or after:

```text
TASK
Finora Phase 8 — Pass A Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
9671d2877e4fdc63e23a02d299a76ad39d81053e

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

PHASE_8_MIGRATION_PATH
supabase/migrations/20260829000001_phase_8_fx.sql

PHASE_8_MIGRATION_BLOB_SHA
<sha>

FX_SOURCE_VERIFIER_BLOB_SHA
<sha>

FX_STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

FX_RUNTIME_VERIFIER_BLOB_SHA
<sha>

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PATCH_SCRIPTS_REMAINING
0 / <number>

FRANKFURTER_API_VERSION
V2

PROVIDER_RATE_TRANSPORT
EXACT_STRING_CSV

FX_RATE_AUTHORITY_TYPE
STRING_ONLY

SNAPSHOT_TRANSACTION_MONEY_READ
EXACT_TEXT_VIEW

SNAPSHOT_RETURN_AUTHORITY
EXACT_TEXT_VIEW

CURRENT_VALUATION_MISSING_RATE_POLICY
FAIL_CLOSED_NO_PARTIAL_TOTAL

AUTO_FX_SETTINGS_PERSISTENCE
PASS / FAIL

BASE_FAILURE_UI
PASS / FAIL

BASE_CSV_PROVENANCE
PASS / FAIL

ADR_013
PASS / FAIL

DATABASE_DOC
PASS / FAIL

PROJECT_STATUS_HISTORY_PRESERVED
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