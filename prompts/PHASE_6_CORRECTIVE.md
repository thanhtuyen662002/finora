# Finora Phase 6 — Corrective Gate

## Mission

Correct the residual Phase 6 Dashboard + Reports contract violations found during repository audit of implementation SHA `4f2ae9810514eaae8f33e127c1686b552c13c368`.

This is CODE-ONLY.

Do NOT create or apply a migration. Do NOT modify the remote Supabase database. Do NOT begin Phase 7.

## Authoritative corrective baseline

Expected baseline before corrective work:

`4f2ae9810514eaae8f33e127c1686b552c13c368`

Preserve all accepted Phase 2–5 receipts and invariants.

## Mandatory corrections

### 1. Fail closed on `account_balances`

`src/features/reports/engine.ts` currently falls back from a missing `account_balances` row to `accounts.opening_balance`.

That is forbidden for Phase 6 authoritative current-balance reporting.

Required:

- current report balances come from `account_balances.current_balance` only;
- if an account expected in the report has no balance row, fail closed with a visible/reportable error instead of silently substituting `opening_balance`;
- preserve exact decimal string handling;
- no raw numeric balance fallback.

### 2. Respect `user_settings.timezone` for calendar semantics

Current period helpers use the browser/runtime local timezone and the reports read only `base_currency`.

Required:

- read both `base_currency` and `timezone` from `user_settings`;
- resolve the authoritative current calendar date using the configured timezone where available;
- default to the established project timezone only if the setting is genuinely absent, not when the settings query fails;
- use the resolved date consistently for Dashboard current month and Reports 1M/3M/6M/1Y/ALL end date/month buckets;
- use `occurred_on` DATE semantics;
- no heavy date dependency is needed; a small deterministic helper using standard platform APIs is preferred;
- a `user_settings` read error must not be silently treated as successful settings data.

### 3. Make `ALL` truly all available history

`getDateRangeForPeriod('ALL')` currently creates only the latest 12 chart month keys while summary/category/transaction filtering is all-time.

This is internally inconsistent and violates the Phase 6 contract.

Required for selected currency:

- `ALL` summary = all available active transaction history;
- `ALL` transaction table/CSV = all available active transaction history;
- `ALL` category analysis = all available active expense history;
- `ALL` monthly cash-flow buckets span from the earliest matching transaction month through the current month, including zero-value months between them;
- if there is no matching transaction history, render a truthful empty/zero series without fabricating 12 months of history;
- keep chronological month ordering.

### 4. Fix decimal-series max comparison

`aggregateCashFlow` currently determines `maxSeriesDecimal` with JavaScript string comparison (`bucket.income > maxSeriesDecimal`). Decimal strings are not lexicographically sortable as money.

Required:

- use `compareExactDecimals` or equivalent exact BigInt comparison;
- never compare monetary strings with `<` / `>` to derive chart scale;
- basis-point geometry remains presentation-only and bounded after exact comparison.

Add regression cases such as:

- `900.0000` vs `1000.0000`;
- `9999.0000` vs `10000.0000`;
- all-zero series.

### 5. Correct base-currency default selection

Dashboard and Reports currently initialize selection to hard-coded `VND`, which can override a user's configured base currency whenever VND exists.

Required:

- discover actual report currencies from real account/transaction data;
- use `base_currency` as default only when that currency is actually present in available report currencies;
- otherwise select the first available currency in deterministic order;
- only use `base_currency` as the sole available currency fallback when there is no financial currency data at all;
- do not inject an absent base currency into an otherwise non-empty real currency set merely to create a zero-data selector;
- Dashboard and Reports must follow the same default-selection rule;
- do not hard-code VND as initial authoritative selection.

### 6. Reports reload errors must not show stale finance data

`src/app/reports/page.tsx` currently renders the previous `data` when a later period/currency load fails because the blocking error path only triggers when `error && !data`.

This can display stale report values under newly selected controls.

Required:

- a failed authoritative reload must fail closed;
- do not present previous-period/previous-currency monetary data as if it belongs to the new control selection;
- show a visible error state with retry;
- either clear authoritative report data before a new request or track request identity/state so stale results can never be labeled as the current selection;
- handle out-of-order async requests safely when users change period/currency quickly.

### 7. Harden source verifier against the actual residual classes

`scripts/verify-phase6-source.mjs` currently reimplements sample arithmetic instead of proving important semantics in the actual Phase 6 source, and it does not detect the failures above.

Required verifier improvements:

- remain fail-closed and exit nonzero on any failed mandatory check;
- inspect the actual files used by Dashboard/Reports;
- reject account-balance fallback to `opening_balance` in report current-balance derivation;
- prove `account_balances` is authoritative for current balances;
- prove timezone is read and passed into date-resolution semantics;
- prove `ALL` is not fixed to 12 months and is derived from actual selected-currency history;
- reject monetary string relational comparison for cash-flow max calculation;
- prove default selection follows `base_currency if present, otherwise deterministic available currency` and is not hard-coded VND;
- prove report reload error handling cannot render stale old data as current;
- retain existing mock/fake-FX/PDF-Excel/hard-coded-date scans;
- broaden monetary coercion scans across authoritative Phase 6 money paths for `Number(`, `parseFloat(`, monetary `parseInt(`, unary coercion, lossy casts, and `as any`;
- preserve exact CSV and pre-FX multi-currency checks;
- add deterministic regression evidence for ALL-history month buckets, exact max comparison, zero-series behavior, and base-currency selection semantics.

Do not claim the verifier executes the actual engine dynamically unless it genuinely does so. Static source-contract checks plus deterministic helper regression tests are acceptable if truthful and sufficiently specific.

### 8. Documentation truthfulness

Update `docs/PROJECT_STATUS.md` only with truthful source status.

Do not mark Phase 6 overall PASS or live smoke PASS.

Keep:

```text
PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_6_OVERALL=PARTIAL
PHASE_7_AUTHORIZED=false
```

## Preserve already-correct Phase 6 behavior

Do not regress:

- real `transaction_details` reads;
- exact monetary string boundaries;
- pre-FX currency isolation;
- transfer exclusion from income/expense reports;
- `account_balances` transfer-neutral derived balance semantics;
- real CSV export;
- Dashboard transaction/transfer success refresh;
- removal of mock YouTube/Income Sources from authoritative reports;
- no Phase 6 database schema changes.

## Verification

At the final corrective revision run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase6-source.mjs
node scripts/verify-phase6-source.mjs
git diff --check
```

Also scan authoritative Phase 6 paths for:

```text
Number(
parseFloat(
parseInt(
as any
MOCK_
2026
PDF/Excel
opening_balance
> maxSeriesDecimal
< maxSeriesDecimal
```

Interpret findings semantically.

Verify responsive behavior at 390px, 768px, 1024px, and 1440px only if actually exercised. Do not fabricate viewport PASS.

## Git provenance

After implementation:

1. commit corrective changes;
2. push to `main`;
3. fetch ACTUAL `origin/main` after push;
4. final local HEAD must equal final remote main;
5. worktree must be clean;
6. exact remote SHA must be the same revision that passed typecheck/lint/build/source verifier.

## Required final report

Return exactly:

```text
TASK
Finora Phase 6 — Dashboard + Reports Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

AUTHORITATIVE_BASE_SHA
4f2ae9810514eaae8f33e127c1686b552c13c368

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

WORKTREE_CLEAN
true / false

ACCOUNT_BALANCE_FAIL_CLOSED
PASS / FAIL

TIMEZONE_CALENDAR_SEMANTICS
PASS / FAIL

ALL_HISTORY_SEMANTICS
PASS / FAIL

EXACT_CASHFLOW_SCALE_COMPARISON
PASS / FAIL

BASE_CURRENCY_DEFAULT_SELECTION
PASS / FAIL

REPORT_STALE_DATA_FAIL_CLOSED
PASS / FAIL

PRE_FX_MULTI_CURRENCY_ISOLATION
PASS / FAIL

TRANSFER_REPORT_NEUTRALITY
PASS / FAIL

CSV_EXPORT
PASS / FAIL

SOURCE_VERIFIER_HARDENED
PASS / FAIL

TYPESCRIPT
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

SOURCE_VERIFIER_SYNTAX
PASS / FAIL

SOURCE_VERIFIER_RUN
PASS / FAIL

GIT_DIFF_CHECK
PASS / FAIL

MIGRATION_CREATED
false

REMOTE_DATABASE_MODIFIED
false

PHASE_6_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_6_OVERALL
PARTIAL

PHASE_7_AUTHORIZED
false

CODE_CHANGES
<paths>

KNOWN_BLOCKERS
<none or exact blockers>
```
