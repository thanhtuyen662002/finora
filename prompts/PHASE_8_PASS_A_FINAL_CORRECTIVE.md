# Finora Phase 8 — Multi-Currency + FX — Pass A Final Corrective

## 0. Authority / execution mode

Repository: `thanhtuyen662002/finora`

Authoritative rejected implementation baseline:

```text
e2c353f6b8796a6884fd43e24bf79cf47ebae591
```

Parent contracts:

```text
prompts/PHASE_8_MULTI_CURRENCY_FX.md
prompts/PHASE_8_PASS_A_CORRECTIVE.md
```

This is a **SOURCE / MIGRATION PREPARATION corrective only**.

DO NOT:

- apply `20260829000001_phase_8_fx.sql` to remote Supabase;
- modify the remote Supabase database;
- execute `verify-phase8-db.sql` against live Supabase;
- execute `verify-phase8-rls.mjs` against live Supabase;
- begin Phase 8 Pass B cross-currency transfers;
- begin Phase 9.

Phase 7 migration must remain byte-for-byte:

```text
5da681f7c66fdd85acda79172d1ad305496c6313
```

The Phase 8 migration has NOT been applied and may be corrected in place.

---

## 1. Why `e2c353f6...` is rejected

The following are concrete blockers and MUST all be corrected in one pass.

### 1.1 Verifiers are placeholders / shallow

Current rejected artifacts:

- `scripts/verify-phase8-source.mjs` only performs a few regex/file-presence checks;
- `scripts/verify-phase8-db.sql` only checks existence of a few objects and has no exhaustive schema/RLS/grant/non-regression proof or `99_OVERALL`;
- `scripts/verify-phase8-rls.mjs` only prints that verification is skipped.

These cannot authorize a financial/database phase.

### 1.2 Deterministic tests are stale and are not executing current production TypeScript correctly

Current scripts import non-existent `.js` siblings such as:

```text
../src/lib/exchange-rate/fx-math.js
../src/lib/exchange-rate/frankfurter.js
```

and stale tests still expect truncation of >12 rate decimals and mock Frankfurter v1 paths.

Tests MUST execute the real current production modules and MUST agree with current contracts.

### 1.3 Settings persistence is incomplete

`auto_fx_enabled` is saved but not loaded back into the `autoFx` state. Refresh/relogin may therefore display `true` even when persisted `false`.

### 1.4 BASE mode can misrepresent unavailable data

Do not expose a scalar as converted BASE truth when the required capability is unavailable.

Current rejected behavior can:

- add pseudo currency `BASE` if only current valuation OR only historical snapshots succeeded;
- let Reports select `BASE` while historical data is unavailable and then render zeros;
- let Reports use native base-currency account totals as if they were complete converted BASE totals when current rates are unavailable.

Required semantics:

- Historical BASE reports are selectable only when historical snapshot conversion for that report state is complete.
- Current converted account/net-worth totals exist only when every required current rate is complete.
- If BASE historical is available but current valuation is unavailable, historical report analytics may remain available, but the account/net-worth section MUST visibly show `UNAVAILABLE`; it must not substitute native-base-only balances.
- If current valuation is available but historical BASE is unavailable, Dashboard/Reports must not present historical BASE income/expense/cash-flow zeros as valid converted totals.
- Native currency modes always remain available.
- Provide visible error/freshness/provenance and Retry for failed BASE capability.

### 1.5 Dashboard synthetic BASE duplicates real accounts

The account list must be built from native account groups only. Never flatten synthetic `BASE` account copies into the normal account list. No duplicate account IDs / React keys.

The native per-currency balance list must also exclude pseudo currency `BASE`.

Remove stale text claiming consolidated FX “will be activated in Phase 8”.

### 1.6 Reports currency presentation defect

When selected currency is pseudo `BASE`, every money formatter must receive the actual `baseCurrency`, never literal `BASE`.

This includes net savings and all report money surfaces.

### 1.7 BASE CSV provenance is still incomplete

BASE CSV must have explicit aligned headers and data for at least:

- transaction date;
- original amount;
- original currency;
- converted amount;
- actual target/base currency code;
- exact rate;
- requested FX date;
- effective FX date;
- provider.

Do not treat pseudo value `BASE` as the actual target currency provenance.

Same-currency identity rows must truthfully emit:

```text
rate=1.000000000000
provider=IDENTITY
requested FX date = transaction date
effective FX date = transaction date
```

RFC 4180 + UTF-8 BOM remains required.

### 1.8 Batch/current API input validation

Do not silently filter malformed source currencies and return a partial request as success.

Reject malformed `sourceCurrencies` explicitly with 4xx.

Deduplicate valid sources and enforce max 20.

Only currencies actually required for active account valuation should block current converted valuation. Archived-only account currencies must not make active net worth unavailable.

### 1.9 Snapshot API input / exact authority

Keep the accepted exact-text improvements:

- authoritative transaction amount must come from `transaction_details`;
- snapshot readback must come from `transaction_fx_snapshot_details`;
- user identity is derived from authenticated session, never request JSON;
- service-role write remains server-only.

Also harden:

- validate/deduplicate transaction IDs;
- maximum 200 requested IDs;
- do not accept browser-supplied authoritative amount/source/date/rate/provider/converted amount;
- after insert/race, require an exact version match for every required foreign transaction; missing readback is failure, not silent omission.

### 1.10 Provider / exact rate

Keep Frankfurter **v2 CSV** only:

```text
https://api.frankfurter.dev/v2/rates.csv
```

CSV format is `date,base,quote,rate`.

Required:

- exact string rate extraction;
- no JSON numeric authority;
- max 7-calendar-day historical lookback;
- choose latest row `effectiveDate <= requestedDate`;
- reject malformed rows, missing pair, future effective row, out-of-window row;
- same-currency identity performs no network request;
- `toExactRate(rate: string)` only;
- >12 fractional digits must throw, never truncate;
- zero/negative/malformed rate throws;
- exact BigInt round-half-away-from-zero remains authoritative.

### 1.11 Type truth

Correct `src/types/database.ts` Phase 8 relationships to match the actual migration constraint.

The composite FK is:

```text
fk_snapshot_transaction
(transaction_id, user_id) -> transactions(id, user_id)
```

Do not describe a fake single-column FK name/shape.

Exact view money/rate fields remain strings.

### 1.12 Project ledger / docs

Preserve all old history.

`docs/PROJECT_STATUS.md` top-level Current State must no longer claim Phase 7 migration pending. It must truthfully state Phase 8 Pass A source corrective, remote migration NOT applied, structural/runtime NOT run, Pass B not started, Phase 9 unauthorized.

Keep the full historical ledger below it.

Format ADR-013 consistently with existing ADR headings/status/decision/reason/consequences. Do not leave it as an unstructured note.

`docs/DATABASE.md` must document exact Phase 8 table/view/settings column and browser/server write boundary.

### 1.13 Scratch scripts

Delete all temporary development patch files:

```text
scripts/patch_*.mjs
```

No patch helper created only to mutate source may remain committed.

---

## 2. Mandatory source verifier

Rewrite `scripts/verify-phase8-source.mjs` as a real fail-closed source audit.

It must report named checks and a truthful passed/total count.

At minimum prove/reject:

1. Phase 7 migration SHA unchanged.
2. Phase 5 transfer migration/schema remains same-currency-only; no Pass B implementation.
3. Phase 8 migration path exists and is atomic `BEGIN/COMMIT`.
4. transaction `(id,user_id)` unique appears before snapshot FK creation.
5. exact snapshot table columns/types/precisions are represented in migration.
6. authenticated snapshot privileges are SELECT-only; no browser INSERT/UPDATE/DELETE policy/grant.
7. exact `security_invoker` snapshot view text-casts source_amount/rate/converted_amount.
8. service-role key is non-public and admin client imports `server-only`.
9. no Client Component imports admin/service-role module.
10. provider uses v2 `rates.csv`; reject `/v1/` and provider JSON-number authority.
11. exact rate is string-only and >12 decimals rejected.
12. authoritative FX conversion contains no JS float money/rate multiplication/division, `Number()`, `parseFloat()`, or unary `+` coercion.
13. snapshot route reads transactions from `transaction_details` and reads snapshots from exact details view.
14. browser body cannot supply authoritative snapshot financial fields.
15. current valuation has no non-identity `1.0` fallback.
16. BASE historical report conversion is per transaction snapshot, not subtotal conversion.
17. BASE unavailable states cannot become zero/native-base masquerading totals.
18. dashboard native account list excludes synthetic BASE copies.
19. Settings both LOADS and SAVES `auto_fx_enabled`.
20. BASE CSV contains all required provenance headers/fields and actual target base currency.
21. no `scripts/patch_*.mjs` remain.
22. deterministic tests target v2 and current reject-not-truncate behavior.
23. all three Phase 8 verifiers are substantive, not placeholder/skip-only.
24. PROJECT_STATUS retains historical ledger and truthful current Phase 8 state.
25. ADR-013 and DATABASE docs exist with required semantics.
26. Phase 9 remains unauthorized.

The rejected `e2c353f6...` implementation MUST fail this new source verifier for multiple independent reasons.

Do not claim static verification executes PostgreSQL.

---

## 3. Mandatory structural DB verifier

Rewrite `scripts/verify-phase8-db.sql` as strict read-only verification with rows:

```text
check_name | passed | detail
...
99_OVERALL | true/false | ...
```

`99_OVERALL` must aggregate every mandatory check.

Prove at minimum:

- exact 12 snapshot columns, order/names if contract chooses exact order;
- exact nullability/defaults;
- numeric(20,4) source/converted and numeric(30,12) rate;
- exact currency/positive/date/provider CHECK semantics robust to PostgreSQL formatting;
- exact version unique key columns/order;
- exact composite FK `(transaction_id,user_id)->transactions(id,user_id)` with RESTRICT;
- required `(id,user_id)` unique on transactions;
- RLS enabled;
- exactly one authenticated SELECT policy and zero INSERT/UPDATE/DELETE policies;
- ownership expression semantically `(SELECT auth.uid()) = user_id`;
- anon/PUBLIC zero privileges;
- authenticated table SELECT only and no snapshot write column privileges;
- snapshot details view exists, security_invoker=true, exact source_amount/rate/converted_amount text types;
- view authenticated SELECT only, anon/PUBLIC none;
- `user_settings.auto_fx_enabled` boolean NOT NULL default true and minimum authenticated UPDATE grant;
- Phase 2–7 user-owned tables remain RLS enabled;
- transactions/transfers/account_balances non-regression;
- Phase 5 transfers remain same-currency-only and accepted account_balances formula remains intact;
- Phase 7 planning objects remain intact.

Do NOT run this remotely in this corrective pass.

---

## 4. Mandatory two-user runtime verifier

Rewrite `scripts/verify-phase8-rls.mjs` into a real public-key/two-user verifier.

Missing live credentials must exit non-zero and clearly report BLOCKED/FAIL, never PASS.

It must use only:

- public Supabase URL;
- publishable/anon public key;
- User A credentials;
- User B credentials.

The verifier itself must NEVER use a service-role key.

Prepare coverage for later live execution:

- A/B authenticate as distinct users;
- auto_fx_enabled own read/update/persistence and cross-user isolation;
- direct browser snapshot INSERT denied;
- UPDATE denied;
- DELETE denied;
- own snapshot SELECT and view isolation when an owned snapshot fixture is available through the trusted application path;
- bidirectional cross-user snapshot/table/view access blocked;
- spoof user ownership blocked;
- Phase 4 transaction RLS regression;
- Phase 5 transfer RLS/neutrality regression;
- deliberate non-RLS error distinction;
- deterministic cleanup for mutable transaction/account/category fixtures it creates.

If a positive snapshot fixture requires the trusted live app API, make the verifier explicitly require a configured live app origin and ordinary authenticated user session/token path; do not weaken snapshot table grants merely to make testing easy.

Do NOT execute this live in this corrective pass.

---

## 5. Deterministic executable tests

Replace stale FX scripts with tests that actually execute current production modules.

You may add a lightweight dev-only TypeScript runner such as `tsx` if needed. Do not duplicate production finance algorithms inside tests.

Required test cases include at least:

- current v2 CSV exact parsing;
- USD/VND and VND/USD;
- identity without network call;
- historical 7-day bounded window;
- weekend/holiday latest <= requested date;
- future effective row rejected;
- out-of-window/no observation rejected;
- malformed CSV/header/rate rejected;
- missing pair rejected;
- provider HTTP failure rejected;
- exact rate pads <=12 decimals;
- >12 decimals rejected, not truncated;
- zero/negative/malformed rate rejected;
- positive/negative/zero conversion;
- rate below/above 1;
- 12-decimal precision;
- half-away-from-zero boundaries positive and negative;
- numeric(20,4) result overflow rejected;
- transaction version edit amount/date/currency selects a new snapshot identity;
- base currency change does not mutate old snapshot identity;
- per-transaction historical aggregation;
- provider outage leaves native reporting usable;
- missing one current rate yields no converted net-worth scalar;
- dashboard native account list cannot duplicate synthetic BASE accounts;
- BASE CSV header/data column counts and provenance.

Network calls must be mocked.

---

## 6. Required verification commands

Before final commit run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
git diff --check
```

Also run every dedicated deterministic Phase 8 test command and report exact count.

Do NOT execute live DB/RLS verifier.

Then:

```text
git status --short
git rev-parse HEAD
git fetch origin
git rev-parse origin/main
```

Push and require:

```text
HEAD == origin/main
worktree clean
```

No `PASS_CODE_ONLY` is allowed unless every required source command passes and all verifier/test blobs exist on exact remote main.

---

## 7. Required end state

Exactly:

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

## 8. Exact report format

Return exactly, with no prose before or after:

```text
TASK
Finora Phase 8 — Pass A Final Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
e2c353f6b8796a6884fd43e24bf79cf47ebae591

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
<number>/<number>

PHASE_8_RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_TESTS
PASS <number>/<number> / FAIL

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

FX_PROVIDER_BLOB_SHA
<sha>

FX_MATH_BLOB_SHA
<sha>

PATCH_SCRIPTS_REMAINING
0 / <number>

SETTINGS_AUTO_FX_LOAD_SAVE
PASS / FAIL

BASE_FAIL_CLOSED_UI
PASS / FAIL

DASHBOARD_NATIVE_ACCOUNT_DEDUP
PASS / FAIL

BASE_CSV_PROVENANCE
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
