# Finora Phase 6 — Dashboard + Reports

## Mission

Implement the first real-data Dashboard and Reports experience for Finora using the already accepted Phase 3–5 account, transaction, transfer, exact-money, and RLS foundations.

This is a **CODE-ONLY gate**.

Do NOT modify the remote Supabase database. Do NOT create or apply a migration. Do NOT begin Phase 7.

## Authoritative baseline

Expected baseline before implementation:

`47cb246ea0a7de61a1ae9bc0780c0a805d7559e7`

Phase 5 is CLOSED and accepted. Preserve its source/database/runtime/live receipts.

## Phase 6 goals

Replace the current Dashboard and Reports mock/preview behavior with truthful real-user financial data while preserving strict pre-FX multi-currency semantics.

The user must be able to answer:

1. What balances do I currently hold, by currency?
2. How much did I earn this month, by currency?
3. How much did I spend this month, by currency?
4. How much did I save this month, by currency?
5. What is my saving rate within each currency?
6. How has income/expense changed over the selected calendar period for one selected currency?
7. Which categories consumed the most spending for one selected currency?
8. What are my most recent real transactions?
9. Can I export the currently selected report data truthfully?

## Non-goals

Phase 6 MUST NOT implement or pretend to implement:

- FX conversion;
- current or historical exchange-rate providers;
- base-currency valuation of foreign assets;
- cross-currency net-worth totals;
- historical FX snapshots;
- cross-currency transfers;
- budgets;
- goals;
- recurring bills;
- income-source / YouTube channel tracking;
- AI summaries;
- PDF/Excel generation;
- new database tables/views/policies/migrations.

Those belong to later phases.

---

# 1. Critical financial invariant — no fake cross-currency totals

Phase 8 FX does not exist yet.

Therefore Phase 6 MUST NOT add values with different `currency_code` values.

Forbidden examples:

```text
100 USD + 1,000,000 VND = 1,100,000
```

```text
Net worth = 315,450,000 VND
"Đã quy đổi đa tệ sang VND"
```

unless a real accepted FX engine/rate exists, which it does not in Phase 6.

Required behavior:

```text
Current assets
VND  12,500,000.0000
USD  820.2500
EUR  100.0000
```

Monthly summary must also remain grouped by currency.

If a view/chart needs one scalar series, require an explicit selected currency and only include rows of that currency.

The user's `base_currency` is only a display/default-selection preference in Phase 6. It is NOT permission to convert other currencies.

---

# 2. Transfer semantics

Transfers remain separate from income/expense.

Phase 6 income, expense, savings, saving-rate, category, and cash-flow reports MUST derive from `transaction_details` only and MUST NOT count transfers as income or expense.

Current account balances MUST continue to come from `account_balances`, which already includes active transfers neutrally.

A same-currency transfer must therefore:

- change the two account balances;
- leave the combined balance in that currency unchanged;
- leave income/expense/savings report totals unchanged.

Do not add `TRANSFER` to `transactions.type`.

---

# 3. Exact-money boundary

Authoritative monetary values remain decimal strings.

Use the existing exact money helpers in `src/lib/money` and extend them only when needed.

Do NOT use the following for financial aggregation:

- `Number(amount)`;
- `parseFloat(amount)`;
- unary numeric coercion on monetary strings;
- native floating-point addition/subtraction of money;
- lossy casts;
- `as any` to bypass money typing.

Required authoritative operations include exact string/BigInt-based:

- addition;
- subtraction;
- grouping by currency;
- monthly income/expense/savings;
- account-balance totals by currency;
- category totals by currency;
- saving-rate ratio calculation.

### Presentation-only chart geometry

Charts may ultimately require numeric pixel heights/percent coordinates.

It is acceptable to convert a **non-monetary bounded ratio** (for example integer basis points already computed from BigInt) to a JS number for presentation geometry.

It is NOT acceptable to convert raw monetary amounts to JS numbers and then calculate financial totals or percentages from those numbers.

Tooltips/labels must render exact monetary strings.

---

# 4. Report application module

Create/complete a real reports feature boundary, preferably under:

```text
src/features/reports/
```

Keep database reads separate from deterministic aggregation.

Recommended structure:

```text
src/features/reports/
  reports.ts
  engine.ts
  types.ts
  index.ts
```

Equivalent clean structure is acceptable.

The deterministic engine should accept typed rows and return structured report results without directly manipulating UI state.

## Required real-data inputs

Use accepted user-isolated Supabase sources:

- `public.transaction_details` for INCOME/EXPENSE history and category/account labels;
- `public.account_balances` for exact current balances;
- `public.accounts` for account metadata/archive state;
- `public.user_settings` / existing auth helper for `base_currency` and timezone preference when needed.

Do NOT read raw `transactions.amount` numeric values for report money if `transaction_details.amount` text is available.

Do NOT use service-role credentials.

Do NOT add a fallback from exact views to raw numeric reads.

---

# 5. Calendar period semantics

Remove all hard-coded August 2026 / `2026` assumptions.

Use dynamic calendar ranges.

The existing period selector values may remain:

```text
1M
3M
6M
1Y
ALL
```

Required meaning:

- `1M`: current calendar month from day 1 through today;
- `3M`: current calendar month plus previous 2 calendar months;
- `6M`: current calendar month plus previous 5 calendar months;
- `1Y`: current calendar month plus previous 11 calendar months;
- `ALL`: all available transaction history.

Use `occurred_on` DATE semantics.

Prefer the user's configured timezone when resolving "today". If the existing timezone helper is insufficient, add a small deterministic date helper; do not introduce a heavy date library for this phase.

Monthly chart buckets must be generated dynamically from the selected range and include zero-value months when appropriate.

---

# 6. Dashboard — replace all mock finance data

`src/app/dashboard/page.tsx` currently contains mock metrics/accounts/budgets/goals, hard-coded month text, an empty `any[]` recent-transaction list, and false FX-conversion copy.

Replace all authoritative mock finance data with real user data.

## Required dashboard content

### A. Current balances by currency

Display current account balances grouped by `currency_code`.

Use exact `account_balances.current_balance` strings.

Do not combine currencies.

Dashboard must truthfully state that consolidated base-currency net worth will arrive with FX support in Phase 8 when multiple currencies exist.

If the user has only one currency, a single-currency total is allowed, but the implementation must still use the same grouped-by-currency model.

### B. Current-month income

Real active (`is_voided=false`) INCOME totals grouped by currency.

### C. Current-month expense

Real active EXPENSE totals grouped by currency.

### D. Current-month savings + saving rate

For each currency:

```text
savings = income - expense
```

Saving rate is computed within the same currency only.

When income is zero, show an explicit unavailable/neutral state rather than divide-by-zero or fake 0% semantics if misleading.

### E. Six-month cash-flow chart

Use real transaction data for current month + previous 5 months.

Provide a currency selector when more than one currency is present.

Default selected currency:

1. user's `base_currency` if present in available report currencies;
2. otherwise first available currency in deterministic order.

The selector does NOT perform conversion.

### F. Recent transactions

Show real recent transactions from `transaction_details`.

Do not use `any[]`.

Recommended limit: 5–10.

Voided rows must be visually truthful if included; alternatively active-only is acceptable if clearly labeled. Do not silently mix semantics.

### G. Real account snapshot

Replace `MOCK_ACCOUNTS` with real accounts + exact current balances.

Prefer active accounts for the main dashboard snapshot. Link to Accounts for archived history.

### H. Phase 7 modules

Remove mock Budget and Goal cards from the Dashboard authoritative area.

Do not present future Phase 7 mock values as live finance data.

A small truthful "Coming in Phase 7" navigation card is allowed but not required.

---

# 7. Reports page — real period + real selected-currency analysis

`src/app/reports/page.tsx` currently uses mock hard-coded values, fake YouTube income sources, and a fake PDF/Excel alert.

Replace them.

## Required report controls

- real `PeriodSelector`;
- explicit currency selector;
- loading state;
- empty state;
- visible error state;
- truthful selected date-period label.

## Required report summary for selected currency

- total income;
- total expense;
- net savings;
- saving rate.

All exact.

## Required cash-flow history

For selected currency and selected period:

- monthly income;
- monthly expense;
- monthly savings.

Transfers do not participate.

## Required expense-by-category analysis

For selected currency and selected period:

- active EXPENSE transactions only;
- exact amount per category;
- category percentage computed from exact totals;
- no cross-currency category percentages.

Category labels/colors may come from `transaction_details`.

## Replace premature Income Sources / YouTube section

Remove `MOCK_INCOME_SOURCES` and `IncomeSourcesBreakdown` from the authoritative Phase 6 report.

Income-source tracking belongs to Phase 9.

Replace that space with a useful Phase 6 real-data panel, for example:

- account balances in the selected currency;
- top expense categories;
- selected-period transaction summary.

Do not invent new persisted data.

---

# 8. Chart components

Refactor chart types away from Phase 1 mock numeric finance contracts.

`CashFlowChart` and category visualization must support exact financial values.

Requirements:

- monetary fields in report/chart domain types are strings;
- tooltip values use `formatExactMoney` or equivalent exact formatter;
- visual heights/angles may use bounded non-monetary ratios derived from exact BigInt calculations;
- chart rendering must handle all-zero data without `NaN`, `Infinity`, divide-by-zero, or hidden errors;
- mobile layouts remain readable.

Do not add a chart library unless genuinely necessary. Existing lightweight components are preferred.

---

# 9. CSV report export

Replace the fake:

```text
alert('Xuất báo cáo tài chính PDF/Excel')
```

with a real CSV export.

Do NOT claim PDF or Excel support in Phase 6.

Export must reflect the currently selected:

- report period;
- currency.

Use real `transaction_details` rows.

Minimum columns:

```text
Date
Type
Category
Account
Merchant
Amount
Currency
Status
Note
```

Requirements:

- RFC 4180-style escaping for commas, quotes, and line breaks;
- UTF-8-friendly output for Vietnamese;
- exact amount string preserved;
- only rows matching selected period + currency;
- truthful filename including period/currency or current date;
- no transfer rows presented as income/expense.

Reuse an existing safe CSV helper if appropriate instead of duplicating broken escaping logic.

---

# 10. Data refresh behavior

After a user creates/edits/voids/restores a transaction from a Dashboard modal, Dashboard values must refresh without requiring a full browser reload.

If Dashboard opens the existing transaction modal, wire `onSuccess` or equivalent reload behavior.

Navigating away and back, browser refresh, and logout/login must all reproduce the same persisted results.

Phase 6 itself does not mutate reports; it reflects the accepted transaction/account state.

---

# 11. Error/loading/empty truthfulness

Dashboard and Reports must not fail silently.

Required:

- loading indicators or skeleton/clear loading copy;
- user-visible load error state;
- meaningful empty state when no accounts/transactions exist;
- no mock fallback if Supabase read fails;
- no stale mock data displayed after a real-data query error.

Fail closed on finance data.

---

# 12. No database migration

Phase 6 must use the already accepted Phase 3–5 schema.

Required final state:

```text
MIGRATION_CREATED=false
REMOTE_DATABASE_MODIFIED=false
```

If implementation discovers that a schema change is truly required, STOP and report the blocker instead of silently creating/applying one.

---

# 13. Source verification / anti-regression

Create a small fail-closed source verifier:

```text
scripts/verify-phase6-source.mjs
```

It must at minimum prove the final Dashboard/Reports authoritative paths do not contain/import:

- `MOCK_DASHBOARD_METRICS`;
- `MOCK_CASH_FLOW` / `MOCK_CASH_FLOW_6M`;
- `MOCK_ACCOUNTS`;
- `MOCK_BUDGETS`;
- `MOCK_GOALS`;
- `MOCK_CATEGORY_EXPENSES`;
- `MOCK_INCOME_SOURCES`;
- fake PDF/Excel export alert;
- hard-coded `Tháng 8/2026` / `08/2026` reporting copy;
- false "đã quy đổi đa tệ sang VND" claims.

It must also scan the Phase 6 report-engine authoritative money path for forbidden monetary coercion patterns, including:

- `Number(` on monetary values;
- `parseFloat(`;
- `parseInt(` used for monetary values;
- `as any` in report money paths.

Do not make the verifier a trivial keyword-only PASS. It should inspect the actual files used by Dashboard/Reports and fail non-zero when a forbidden authoritative pattern is found.

`node --check scripts/verify-phase6-source.mjs` must pass.

Run the verifier itself locally as part of the code gate:

```text
node scripts/verify-phase6-source.mjs
```

---

# 14. Documentation

Update `docs/PROJECT_STATUS.md` truthfully.

Record Phase 6 as code-complete only after exact-head source verification.

Do NOT mark live smoke PASS before owner verification.

Record a decision in `docs/DECISIONS.md` (next ADR number) covering:

**Pre-FX multi-currency reporting:** until Phase 8, Dashboard and Reports remain currency-scoped/grouped and never manufacture a consolidated cross-currency total.

No DATABASE.md schema changes are required unless documentation needs a short clarification that Phase 6 adds no schema.

---

# 15. Required verification

At the final implementation revision run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase6-source.mjs
node scripts/verify-phase6-source.mjs
git diff --check
```

Also perform repository scans for authoritative Phase 6 paths:

```text
Number(
parseFloat(
parseInt(
as any
MOCK_
2026
PDF/Excel
```

Interpret findings semantically; legitimate non-money UI numeric state or historical documentation is not automatically a failure.

Verify responsive behavior at minimum:

```text
390px
768px
1024px
1440px
```

Do not claim viewport PASS unless actually checked.

---

# 16. Git provenance gate

After implementation:

1. commit all logical Phase 6 changes;
2. push to `main`;
3. query/fetch ACTUAL `origin/main` after push;
4. require final local HEAD == final remote main SHA;
5. require clean worktree;
6. the exact remote SHA must be the same revision that passed typecheck/lint/build/source verifier.

Do not trust a transient push/auth error without checking actual remote state.

---

# 17. Phase 6 code gate status

This implementation session is source-only.

Expected remote-state fields after successful code implementation:

```text
PHASE_6_SOURCE_GATE=PASS_CODE_ONLY
PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_6_OVERALL=PARTIAL
PHASE_7_AUTHORIZED=false
```

There is no Phase 6 database migration/structural/runtime-RLS gate because Phase 6 introduces no new database authorization surface. Existing Phase 3–5 RLS boundaries remain authoritative.

---

# 18. Required final report

Return exactly this structure:

```text
TASK
Finora Phase 6 — Dashboard + Reports

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

AUTHORITATIVE_BASE_SHA
<sha>

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

WORKTREE_CLEAN
true / false

REAL_DASHBOARD_DATA
PASS / FAIL

CURRENT_BALANCES_GROUPED_BY_CURRENCY
PASS / FAIL

CURRENT_MONTH_INCOME_EXPENSE_SAVINGS
PASS / FAIL

SAVING_RATE_EXACT_PER_CURRENCY
PASS / FAIL

TRANSFER_REPORT_NEUTRALITY
PASS / FAIL

NO_CROSS_CURRENCY_TOTALS
PASS / FAIL

REAL_6M_CASHFLOW
PASS / FAIL

REAL_RECENT_TRANSACTIONS
PASS / FAIL

REAL_REPORT_PERIOD_FILTERS
PASS / FAIL

REAL_CATEGORY_BREAKDOWN
PASS / FAIL

REAL_CSV_EXPORT
PASS / FAIL

NO_PREMATURE_INCOME_SOURCES
PASS / FAIL

EXACT_DECIMAL_SAFETY
PASS / FAIL

FAIL_CLOSED_LOADING_ERROR_EMPTY_STATES
PASS / FAIL

SOURCE_VERIFIER
PASS / FAIL

TYPESCRIPT
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

SOURCE_VERIFIER_SYNTAX
PASS / FAIL

GIT_DIFF_CHECK
PASS / FAIL

RESPONSIVE_390
PASS / FAIL / NOT_RUN

RESPONSIVE_768
PASS / FAIL / NOT_RUN

RESPONSIVE_1024
PASS / FAIL / NOT_RUN

RESPONSIVE_1440
PASS / FAIL / NOT_RUN

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
<changed paths>

KNOWN_BLOCKERS
NONE / <exact blockers>
```

Do NOT begin Phase 7.
