# Finora Phase 8 — Multi-Currency + FX — Pass A: FX Core, Historical Snapshots, Base-Currency Valuation

## 0. Authority and execution mode

Repository: `thanhtuyen662002/finora`

Authoritative baseline before this contract:

- `main`: `03c33b0c15879719dd3d138b23d443aa3e48e232`
- Phase 7 closure receipt exists and Phase 8 is authorized.
- Phase 7 migration blob MUST remain unchanged: `5da681f7c66fdd85acda79172d1ad305496c6313`

This is **Phase 8 Pass A**. It introduces the FX engine, immutable historical transaction FX snapshots, current base-currency valuation, and base-currency historical reporting.

This pass is **SOURCE / MIGRATION PREPARATION ONLY**.

DO NOT:

- apply any migration to remote Supabase;
- modify the remote Supabase database;
- run live structural or two-user RLS verification against remote Supabase;
- weaken any Phase 2–7 RLS/grant/finance invariant;
- begin Phase 9;
- implement cross-currency transfers in this pass.

Phase 5 same-currency transfer behavior remains authoritative during Pass A. Cross-currency transfers are explicitly reserved for a later Phase 8 Pass B after this FX core is accepted.

---

## 1. Non-negotiable financial invariants

1. No floating-point arithmetic for authoritative money or FX conversion.
2. PostgreSQL monetary values remain `numeric` and client authoritative reads remain exact strings.
3. JavaScript `Number()`, `parseFloat()`, unary `+`, multiplication/division of JS numbers, or tolerance-based money/rate comparisons are forbidden in the Phase 8 money/FX path.
4. Existing native-currency reports remain correct and available if FX is unavailable.
5. Never produce a partial/fake base-currency total when one or more required FX rates are missing.
6. Historical FX used for a transaction must become immutable once snapshotted.
7. Current account valuation uses current/latest provider rates and is intentionally allowed to change over time.
8. Historical transaction reporting and current asset valuation are separate concepts and must not share mutable authority.
9. Transfers remain excluded from income/expense reporting.
10. Phase 5 same-currency transfer neutrality and Cartesian-safe account balance derivation must not regress.
11. Changing the user's base currency must not rewrite or mutate old historical snapshots.
12. AI/LLMs have no authority over exchange rates or conversion calculations.

---

## 2. Provider architecture

Create `src/lib/exchange-rate/` as a provider abstraction.

Required public contract must represent all rate data as strings, never JavaScript floating-point numbers.

Suggested shape:

```ts
export interface ExchangeRateQuote {
  sourceCurrency: string;
  targetCurrency: string;
  rate: string;
  requestedDate: string | null;
  effectiveDate: string;
  provider: string;
  fetchedAt: string;
}

export interface ExchangeRateProvider {
  getCurrentRate(sourceCurrency: string, targetCurrency: string): Promise<ExchangeRateQuote>;
  getHistoricalRate(sourceCurrency: string, targetCurrency: string, requestedDate: string): Promise<ExchangeRateQuote>;
}
```

Names may vary but semantics may not.

### Default provider

Use **Frankfurter v2** as the default provider abstraction implementation.

Provider base URL:

```text
https://api.frankfurter.dev
```

Frankfurter requires no API key and supports current/historical rates including VND.

### Exact-rate transport requirement

Do **not** make authoritative conversion depend on `JSON.parse()` turning a provider rate into a JS number.

Prefer the provider's CSV representation and parse the decimal rate from response text as a string. Validate the decimal string before use.

Historical requests must be deterministic:

- request the target transaction calendar date;
- when the requested date has no market/provider observation (weekend/holiday), use a bounded lookback of at most 7 calendar days;
- select the latest provider `effectiveDate` such that `effectiveDate <= requestedDate`;
- never use a future rate for a historical transaction;
- return both `requestedDate` and actual `effectiveDate`.

Same-currency conversion is an identity operation:

```text
source == target -> rate = 1.000000000000
```

and should not require a network request.

Provider/network errors must fail explicitly. No invented rate and no fallback constant.

---

## 3. Exact FX arithmetic

Add an exact deterministic FX conversion module under `src/lib/money/` or `src/lib/exchange-rate/`.

Rate precision contract:

```text
numeric(30,12)
```

Money precision contract remains:

```text
numeric(20,4)
```

Implement exact decimal-string multiplication using `BigInt` scaling.

Required behavior:

```text
convertExactAmount("20.0000", "26316.250000000000")
```

returns a canonical 4-decimal money string using a documented deterministic rounding rule.

Use **round half away from zero** when reducing the exact product to the 4-decimal money scale.

The converter must support negative balances for current account valuation.

Required tests include:

- positive conversion;
- negative conversion;
- zero;
- identity rate;
- rates below 1;
- rates above 1;
- 12-decimal rate precision;
- half-round boundary;
- values near numeric precision limits;
- malformed rate rejection;
- rate <= 0 rejection;
- no silent truncation of invalid source precision.

Do not reuse presentation-only floating calculations for authority.

---

## 4. Phase 8 migration

Create exactly one new migration for Pass A:

```text
supabase/migrations/20260829000001_phase_8_fx.sql
```

Do not edit old migrations.

### 4.1 `public.transaction_fx_snapshots`

Create an immutable user-owned historical FX snapshot table.

Required columns:

```text
id                    uuid          PK default gen_random_uuid()
user_id               uuid          NOT NULL
transaction_id        uuid          NOT NULL
source_currency_code  text          NOT NULL
target_currency_code  text          NOT NULL
source_amount          numeric(20,4) NOT NULL
rate                   numeric(30,12) NOT NULL
converted_amount       numeric(20,4) NOT NULL
requested_date         date          NOT NULL
effective_date         date          NOT NULL
provider               text          NOT NULL
created_at             timestamptz   NOT NULL default now()
```

There is intentionally **no `updated_at`**. Historical snapshots are immutable.

Required constraints:

- currency codes match `^[A-Z]{3,5}$`;
- source and target currency must differ;
- `source_amount > 0`;
- `rate > 0`;
- `converted_amount > 0`;
- `effective_date <= requested_date`;
- provider trimmed length 1..100;
- composite ownership FK `(transaction_id, user_id)` -> `transactions(id, user_id)` with `ON DELETE RESTRICT`;
- add the exact required unique key on `transactions(id, user_id)` if PostgreSQL needs it for the composite FK;
- snapshot version uniqueness must allow a transaction to be edited later without mutating old snapshots.

Use this exact version identity or a semantically equivalent stricter one:

```text
UNIQUE (
  user_id,
  transaction_id,
  target_currency_code,
  source_currency_code,
  source_amount,
  requested_date
)
```

This deliberately allows a new immutable snapshot when transaction amount/date/currency changes. Old snapshots remain historical audit evidence and are ignored when they no longer match the current transaction version.

### 4.2 RLS and grants

Enable RLS.

The browser must be able to read only its own snapshots.

Create exactly one authenticated `SELECT` ownership policy:

```sql
(SELECT auth.uid()) = user_id
```

There must be **no authenticated INSERT, UPDATE, or DELETE policy** for this table.

Revoke table/column privileges from `anon`, `PUBLIC`, and default broad authenticated privileges before granting the minimum.

Authenticated role receives SELECT only.

Historical snapshot writes are server-controlled through a server-only trusted path defined below.

### 4.3 Exact view

Create:

```text
public.transaction_fx_snapshot_details
```

with `security_invoker = true`.

Expose at least:

- id
- user_id
- transaction_id
- source_currency_code
- target_currency_code
- `source_amount` as text
- `rate` as text
- `converted_amount` as text
- requested_date
- effective_date
- provider
- created_at

Authenticated SELECT only. `anon`/`PUBLIC` must not receive access.

### 4.4 Persist the existing FX preference

The Settings UI currently has an in-memory `autoFx` switch. Make it real by adding to `public.user_settings`:

```text
auto_fx_enabled boolean NOT NULL default true
```

Preserve existing user_settings RLS. Add only the minimum authenticated UPDATE column grant needed for this field.

Do not change unrelated mock preference fields in this phase.

---

## 5. Trusted server-side snapshot write boundary

Historical snapshot rows affect authoritative historical base-currency reports. They must not be directly forgeable through the browser Supabase Data API.

Add a server-only Supabase admin client using:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Rules:

- it must never use a `NEXT_PUBLIC_` name;
- it must never be imported into a Client Component;
- it must never be serialized or returned to the browser;
- environment validation must clearly distinguish public Supabase config from server secret config;
- missing server secret must fail closed only for trusted snapshot persistence, not crash native-currency finance features.

Before any service-role write, authenticate the requesting user using the ordinary cookie-bound Supabase server client.

The service-role path must derive `user_id` from the authenticated server session, never from request JSON.

The server must derive source amount, source currency, and requested date from the user's authoritative `transaction_details` / transaction row. The browser must never supply authoritative amount, rate, source currency, requested date, effective date, provider, or converted amount.

---

## 6. FX HTTP/server endpoints

Implement server-side endpoints or equivalent server actions with the following semantics.

### 6.1 Current/historical single rate

An authenticated endpoint such as:

```text
GET /api/fx/rate?from=USD&to=VND
GET /api/fx/rate?from=USD&to=VND&date=2026-08-29
```

must return exact strings and provenance.

Example response shape:

```json
{
  "sourceCurrency": "USD",
  "targetCurrency": "VND",
  "rate": "26316.250000000000",
  "requestedDate": "2026-08-29",
  "effectiveDate": "2026-08-28",
  "provider": "FRANKFURTER",
  "fetchedAt": "..."
}
```

For current rates, `requestedDate` may be null.

Validate all currency/date inputs. Return explicit 4xx for malformed input and 502/503 class response for provider failures.

### 6.2 Batch current rates

Provide a bounded authenticated batch endpoint/helper for Dashboard current valuation.

Required semantics:

- target = user's base currency or an explicitly validated target;
- source currencies deduplicated;
- maximum 20 distinct source currencies per request;
- same-currency rate handled locally as identity;
- return complete success only when all required non-identity rates are available;
- do not silently omit a failed currency.

### 6.3 Batch historical transaction snapshots

Provide a bounded authenticated endpoint/helper, e.g.:

```text
POST /api/fx/transaction-snapshots
```

Input may contain only:

```text
targetCurrency
transactionIds[]
```

Maximum 200 transaction IDs per request.

Server behavior:

1. authenticate user;
2. read only that user's transactions;
3. ignore/reject IDs not owned by the user;
4. for same-currency transaction, return identity converted amount without inserting a snapshot;
5. for foreign transaction, look for an immutable snapshot matching the CURRENT transaction version fields:
   - transaction_id
   - source currency
   - source amount
   - requested date (`occurred_on`)
   - target currency;
6. reuse an existing matching snapshot if present;
7. otherwise fetch one historical rate per unique source/date/target combination;
8. convert with exact BigInt FX math;
9. insert via the trusted server-only admin client;
10. if a unique-race occurs, re-read the winning snapshot instead of failing or duplicating;
11. return exact-text snapshot data.

Voided transactions remain excluded by report aggregation; snapshots may remain stored as immutable evidence.

---

## 7. Current base-currency account valuation

Extend Dashboard/account summary logic without mutating `account_balances` authority.

`public.account_balances` remains the source of native account balances.

For each active account:

- if account currency == user base currency: identity conversion;
- otherwise obtain the current provider rate and convert exact current balance using the Phase 8 BigInt converter.

Then aggregate converted balances into one current base-currency net-worth total.

Required fail-closed rule:

If ANY required non-identity current rate fails, do not display a partial converted net-worth scalar as if complete.

Instead:

- native per-currency balances remain visible;
- converted net worth shows an unavailable/error state;
- UI explains which currency rate could not be resolved;
- retry is available.

Display rate freshness/provenance in a compact way, e.g. provider + effective date.

Current valuation may change as current rates change. Do not persist it as historical truth.

---

## 8. Historical reports in base currency

Preserve the existing Phase 6 native-currency reporting mode exactly.

Add a clearly separate **base-currency mode** using the user's current `user_settings.base_currency` as the target by default.

Historical base-currency income/expense/savings must convert EACH transaction using its immutable historical snapshot for that transaction date/version.

Never convert only a monthly subtotal using one monthly rate.

Required base-mode calculations:

- income;
- expense;
- savings;
- monthly cash flow series;
- category expense breakdown;
- saving rate;
- ALL/1Y/6M/3M/1M period semantics.

Use the existing deterministic calendar/timezone rules.

Same-currency transactions use identity conversion and require no snapshot row.

If a required historical snapshot cannot be resolved, fail the converted report state closed. Native report mode must remain available.

Changing base currency later may create new snapshots for the new target currency. It must not rewrite old snapshots for the previous target.

### Base-mode CSV

Native CSV behavior remains intact.

When exporting a base-currency converted report, include truthful provenance columns at minimum:

- original amount;
- original currency;
- converted amount;
- target/base currency;
- rate;
- requested transaction date;
- effective FX date;
- provider.

Same-currency rows may use rate `1.000000000000` and provider `IDENTITY`.

Remain RFC 4180 + UTF-8 BOM compatible.

---

## 9. Settings UI

Persist `auto_fx_enabled` from the existing Settings switch.

When enabled:

- Dashboard may request/show current base-currency valuation;
- reports may default to base-currency mode where appropriate.

When disabled:

- native-currency finance remains fully usable;
- do not make provider calls merely to render native views.

Changing `base_currency`:

- must not rewrite account/transaction currency codes;
- must not rewrite historical snapshots;
- must invalidate/reload current converted presentation;
- historical base-mode can lazily create missing snapshots for the new target.

Do not add paid/provider API-key UX in this pass.

---

## 10. Cross-currency transfers are NOT part of Pass A

Do not alter the Phase 5 transfers table or same-currency FK constraints in this pass.

Do not allow cross-currency transfer creation yet.

Phase 8 Pass B will design dual-amount cross-currency transfers using actual source and destination amounts after the FX core is independently proven.

Pass A must keep:

```text
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
```

---

## 11. Documentation

Append a new ADR, suggested identifier `ADR-013`, covering:

- provider abstraction;
- default Frankfurter provider;
- exact-string provider rate transport;
- immutable transaction-version historical FX snapshots;
- current-rate valuation is mutable presentation, not historical authority;
- exact BigInt conversion and rounding rule;
- trusted server-only snapshot writes;
- provider outage fail-closed behavior;
- cross-currency transfers deferred to Phase 8 Pass B.

Update `docs/DATABASE.md` for the new table/view/user_settings column.

Update `docs/PROJECT_STATUS.md` truthfully. Its current top-level Phase 7 text is stale and must be corrected to Phase 8 Pass A source implementation state.

Do not rewrite old ADR history.

---

## 12. Verification artifacts

Create:

```text
scripts/verify-phase8-source.mjs
scripts/verify-phase8-db.sql
scripts/verify-phase8-rls.mjs
```

### 12.1 Source verifier

Must fail if any of these regressions appear:

- authoritative FX path uses JS number multiplication/division;
- `Number()` / `parseFloat()` is used to coerce provider rates or money;
- provider JSON numeric value is accepted as authoritative rate without exact-string preservation;
- historical rate may be later than requested date;
- current valuation silently computes partial totals;
- browser has direct INSERT/UPDATE/DELETE grants/policies on FX snapshots;
- service-role secret appears in client-visible config/imports;
- user_id/rate/amount/date/provider is accepted from browser as authoritative snapshot data;
- historical snapshots are updated/deleted instead of versioned immutably;
- reports convert an aggregate subtotal with one FX rate rather than per-transaction historical snapshots;
- Phase 5 transfers are modified to cross-currency in Pass A;
- Phase 7 migration changes;
- Phase 9 is authorized.

The source verifier must contain meaningful semantic checks, not merely search for one filename/string.

### 12.2 Structural DB verifier

Prepare a strict read-only SQL verifier proving at minimum:

- table exact columns/types/nullability/defaults;
- exact numeric precisions `20,4` and `30,12`;
- exact constraints;
- snapshot version unique key;
- composite transaction ownership FK + RESTRICT;
- RLS enabled;
- exactly one authenticated SELECT ownership policy;
- zero INSERT/UPDATE/DELETE policies;
- anon/PUBLIC no privileges;
- authenticated SELECT only;
- view exists, `security_invoker=true`, exact money/rate text boundaries;
- `user_settings.auto_fx_enabled` exact type/default/nullability and update grant;
- Phase 2–7 RLS non-regression;
- Phase 5 transfers schema remains same-currency-only;
- Phase 7 migration objects remain intact;
- `99_OVERALL` aggregates every mandatory check.

Do not execute this against remote DB in the source pass.

### 12.3 Two-user runtime verifier

Prepare a public-key/two-user verifier that, after the migration is later applied, will prove:

- A/B own snapshot SELECT isolation;
- direct browser INSERT denied;
- UPDATE denied;
- DELETE denied;
- spoof/cross-user access denied;
- snapshot view isolation;
- auto_fx_enabled user-settings persistence/isolation;
- Phase 4 transaction RLS regression;
- Phase 5 transfer RLS/neutrality regression;
- deterministic cleanup of any mutable fixtures it creates;
- deliberate non-RLS error distinction.

The runtime verifier must not require a service-role key.

Do not execute it live in this source pass.

---

## 13. Application tests

Add deterministic tests for the exchange-rate provider parser and FX engine.

Network calls must be mocked in automated tests. Tests must not depend on the live provider being online.

Minimum cases:

- VND/USD and USD/VND exact parsing;
- historical weekend lookback;
- future effective date rejected;
- malformed CSV/rate rejected;
- missing pair rejected;
- exact conversion rounding;
- negative current balance conversion;
- identity conversion;
- batch deduplication;
- base currency change does not mutate prior snapshots;
- transaction edit amount/date/currency resolves a new snapshot version;
- historical aggregation is per transaction;
- provider outage leaves native reporting usable;
- partial current-rate set does not yield a base net-worth scalar.

---

## 14. Required source verification commands

Run all of the following before committing:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
git diff --check
```

Run the dedicated deterministic Phase 8 tests.

Do NOT run:

```text
scripts/verify-phase8-db.sql against Supabase
scripts/verify-phase8-rls.mjs against live Supabase
```

Do not apply the migration.

After implementation:

```text
git status --short
git rev-parse HEAD
git rev-parse origin/main
git fetch origin
git rev-parse origin/main
```

Push to `main` and require a clean worktree and exact local/remote head match.

---

## 15. Required end state

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

## 16. Exact report format

Return exactly this block with no prose before or after:

```text
TASK
Finora Phase 8 — Multi-Currency + FX — Pass A

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
03c33b0c15879719dd3d138b23d443aa3e48e232

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
<number passed>/<number total>

PHASE_8_RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_TESTS
PASS <n> / FAIL

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

EXCHANGE_RATE_PROVIDER
FRANKFURTER_V2

PROVIDER_RATE_TRANSPORT
EXACT_STRING_CSV

FX_MONEY_MATH
BIGINT_EXACT

HISTORICAL_SNAPSHOT_WRITE_BOUNDARY
SERVER_ONLY_SERVICE_ROLE

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
