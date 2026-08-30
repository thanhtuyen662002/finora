# Finora Phase 8 — Pass A UX + Performance Hardening

## Authority

- Repository: `thanhtuyen662002/finora`
- Expected baseline HEAD before this prompt: `6674ad0126b2656483c5ac195e8d0f3d17c41f9e`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Phase 8 source gate: PASS_CODE_ONLY
- Phase 8 structural gate: PASS
- Phase 8 two-user RLS gate: PASS
- This pass is application/query/UX hardening only.
- Do NOT modify remote Supabase.
- Do NOT modify Phase 7 or Phase 8 migrations.
- Do NOT weaken RLS or exact-money rules.
- Do NOT start Phase 8 Pass B or Phase 9.

## Context

Live screenshots and source audit show four user-facing problems:

1. Dashboard and Reports are noticeably slower than other pages.
2. User-facing text leaks implementation terminology and English labels (`user_settings`, `RLS`, `Appearance`, `Light`, `Dark`, `Auto`, `BASE`, `FX Engine`, `snapshot`, `Credential Source`, raw account enums such as `BANK`/`CASH`).
3. Settings content is visually left-anchored on large screens because the form uses `max-w-4xl` without centering; the page also becomes unnecessarily tall.
4. Long account/transaction lists render too many cards and create excessive vertical scrolling.

A concrete source audit also found:

- `getTransactions()` selects the complete `transaction_details` history with `select('*')` and no date/row bound.
- `getDashboardReportData()` loads the complete transaction history even though the dashboard only needs current-month, six-month and recent data.
- `getDetailedReportData()` loads complete transaction history and then requests historical FX snapshots for the whole transaction set before date-range filtering.
- `fetchSnapshots()` processes 200-row chunks sequentially.
- Reports initial state can perform a second fetch when `selectedCurrency` changes from `null` to the resolved currency.
- Dashboard and Reports include archived accounts in rendered account lists/counts. This exposes old verifier/test fixture accounts even though archived accounts are excluded from current balance totals.
- `TransactionList` has only a `limit` slice and no real pagination.
- Accounts page renders the full filtered account grid.
- `package.json` / `package-lock.json` reproducibility must be rechecked because `npm ci` was observed failing due to an out-of-sync lock file.
- All tracked imports must use canonical lowercase package spelling `@supabase/supabase-js`; reject `@Supabase/...` anywhere in tracked source.

## Mission

Make Finora feel like an end-user product rather than a development build, while preserving all accepted financial semantics, exact-money behavior, FX fail-closed behavior, migration blobs and RLS guarantees.

The implementation must solve root causes, not merely add spinners or cosmetic truncation.

---

## 1. Dashboard Performance

### Required data-boundary changes

The dashboard MUST NOT depend on an unbounded all-history transaction fetch.

Provide explicit bounded query primitives in the transaction feature layer, for example equivalent to:

- transactions in a date range;
- recent N transactions;
- optional deterministic ordering;
- optional currency filtering where appropriate.

Do not break existing mutation APIs.

For Dashboard:

- fetch accounts, balances and settings in parallel;
- compute the required six-month/current-month date window from the resolved timezone;
- query only transactions required for the six-month/current-month dashboard analytics;
- query only the latest 6 recent transactions if they are not already guaranteed by the bounded dashboard window;
- deduplicate if combining result sets;
- NEVER request historical FX snapshots for unrelated older transactions;
- current-rate and historical-snapshot work that is independent SHOULD run concurrently with `Promise.allSettled` or an equivalent fail-isolated mechanism;
- preserve separate `baseValuation` and `baseHistorical` fail-closed authority;
- native financial data must remain usable if FX fails.

### Archived accounts

Dashboard account counts and visible account cards MUST include active accounts only.

Archived accounts may remain available on the dedicated Accounts page when the user explicitly chooses the archived view.

Do not delete or mutate archived verifier fixtures as part of this pass.

### Dashboard list density

The Dashboard "Tài khoản & Ví" card must not render every active account indefinitely.

Use a compact dashboard preview:

- default maximum: 6 active accounts;
- deterministic ordering;
- if more exist, show a user-facing `Xem tất cả` / `+ N tài khoản khác` affordance linking to `/accounts`;
- recent transactions remain a compact preview (6 maximum) linking to `/transactions`.

Do NOT put full pagination controls inside the Dashboard preview.

---

## 2. Reports Performance

### Scope transactions before expensive FX work

For `1M`, `3M`, `6M`, and `1Y`, the report layer MUST query transactions only inside the selected period before aggregation and before historical snapshot requests.

For `ALL`:

- all-history behavior remains supported;
- if an earliest transaction date is needed to build month buckets, prefer a lightweight earliest-date query rather than loading complete rows only to discover the lower bound;
- loading the full selected ALL dataset is allowed because it is explicitly requested by the user.

Historical snapshot requests MUST be limited to transactions actually required by the selected report scope.

Do not request snapshots for out-of-range transactions.

### Avoid duplicate initial fetch

The first Reports page load MUST NOT immediately perform a second identical expensive report fetch only because `selectedCurrency` is initialized from `null` to the server-resolved/default currency.

Preserve race protection and stale-response rejection when the user changes period/currency quickly.

### FX batching

`fetchSnapshots()` currently awaits each 200-ID chunk sequentially.

Implement bounded parallelism for multiple chunks (for example 2–4 chunks concurrently), while preserving:

- maximum 200 IDs per API request;
- deterministic merged result semantics;
- clear failure propagation;
- no provider/API flooding.

### Optional in-session cache

A small in-memory request cache keyed by exact report scope (`period`, currency, relevant base currency/settings state) is allowed and recommended so switching back to a previously loaded period/currency is fast.

It MUST be invalidated after transaction/account/transfer mutations that affect the report.

Do not introduce Redis or any external cache.

---

## 3. Pagination and Long-List UX

Create or reuse a consistent user-facing pagination primitive.

### TransactionList

Extend `TransactionList` to support pagination after filtering/sorting.

Required behavior:

- default page size: 20;
- page resets to 1 when search/filter/sort inputs change;
- show current range and total, e.g. `1–20 / 86 giao dịch`;
- previous/next controls;
- optionally page-number controls when reasonable;
- no inaccessible tiny controls on mobile;
- `limit` preview behavior must remain available for Dashboard or be replaced by an explicit preview mode.

### Reports transaction details

Use paginated TransactionList behavior for report transaction details.

Pagination MUST NOT alter report summary/chart totals; it is presentation-only over the already scoped report transaction set.

### Transactions page

Paginate both income/expense transactions and transfers at 20 items per page after their current filters/sorting.

Do not render hundreds of DOM cards at once.

### Accounts page

Paginate the account grid after active/archived and type filters.

Recommended page size: 12 accounts.

Reset page when filter type or active/archived mode changes.

### Reports account list

Reports should show active accounts only.

Show at most 8 active account rows in the report summary card, with a clear link to `/accounts` when more exist.

Do not show archived verifier/test accounts in current financial position cards.

---

## 4. Settings Layout

The Settings page must look balanced on large desktop screens.

Required:

- replace the current left-anchored `max-w-4xl` form layout with a centered responsive container such as `w-full max-w-6xl mx-auto`;
- use a sensible desktop grid to reduce excessive vertical height;
- related cards may sit in two columns at `xl` widths while important sections such as currency/region or security can span full width where it improves readability;
- mobile remains one column;
- do not create horizontal scrolling at 390/768/1024 widths;
- primary `Lưu thay đổi` action must remain easy to find; a sticky/floating save bar is allowed if accessible and non-obstructive.

Do not simply stretch every card to 100% width if that creates unreadably long form controls.

---

## 5. End-User Language Cleanup

Perform a repository-wide scan of user-visible strings in application UI.

### Forbidden implementation leakage in end-user UI

Remove or replace user-facing occurrences of internal/developer terminology including, where visible to normal users:

- `user_settings`
- `RLS`
- `Row Level Security`
- `Phase 8`, `Phase 7`, or other roadmap phase labels
- `FX Engine`
- raw `BASE` mode wording where `Tổng hợp` or `Quy đổi` is clearer
- `snapshot` / `FX snapshot`
- `Credential Source`
- `Appearance`
- English parenthetical labels such as `(Light)`, `(Dark)`, `(Auto)`
- developer phrases such as `UNAVAILABLE` in normal UI
- raw account enum values such as `BANK`, `CASH`, `EWALLET`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT`, `OTHER`.

Technical terms may remain in developer docs, code identifiers, logs, tests and admin-only technical surfaces where appropriate.

### Required examples

Use friendly Vietnamese equivalents, e.g.:

- `Cài đặt hệ thống` -> `Cài đặt`
- `Giao diện (Appearance)` -> `Giao diện`
- `Sáng (Light)` -> `Sáng`
- `Tối (Dark)` -> `Tối`
- `Hệ thống (Auto)` -> `Theo hệ thống`
- `Tiền tệ & Khu vực (user_settings)` -> `Tiền tệ & khu vực`
- `Tiền tệ cơ sở (Base Currency)` -> `Tiền tệ cơ sở`
- internal table-description text -> user-facing description of what the setting does
- `Historical BASE conversion is UNAVAILABLE due to missing FX snapshots.` -> clear Vietnamese such as `Chưa thể tổng hợp lịch sử vì một số giao dịch chưa có tỷ giá đã lưu.`
- `BANK` -> `Ngân hàng`
- `CASH` -> `Tiền mặt`
- `EWALLET` -> `Ví điện tử`
- `SAVINGS` -> `Tiết kiệm`
- `CREDIT_CARD` -> `Thẻ tín dụng`
- `INVESTMENT` -> `Đầu tư`
- `OTHER` -> `Khác`.

Create a centralized presentation-label helper for account type names rather than duplicating mappings throughout pages.

Currency ISO codes (`VND`, `USD`, `EUR`, etc.) may remain because they are meaningful financial identifiers.

Brand names such as Gemini may remain.

### Timezone / locale presentation

Keep persisted IANA values internally, but user-facing option labels should be friendly, e.g. `Việt Nam (GMT+7)` rather than exposing `Asia/Ho_Chi_Minh` as the primary label.

### Non-functional mock settings

Audit Settings controls that are still local/mock-only (for example notification/AI preferences from old mock phases).

A normal user MUST NOT be misled into believing a toggle is persisted when it is not.

Without adding a new migration in this pass, either:

- hide mock-only settings until their roadmap phase; or
- render them disabled with a clear `Sắp hỗ trợ` indication.

Do not silently leave fake-functional switches.

---

## 6. Current/Archived Financial Semantics

Preserve exact current-balance semantics:

- archived accounts do not participate in current total net worth;
- archived accounts do not appear in Dashboard current-account previews;
- archived accounts do not appear in Reports current-account position lists;
- historical transactions linked to archived accounts MUST still remain in historical transaction/report calculations where applicable;
- the Accounts management page retains an explicit archived-account view.

Do not delete archived accounts or historical transactions.

---

## 7. Loading UX

Do not hide slow logic behind a longer spinner.

Required:

- native-currency data must render without waiting for unrelated historical FX requests;
- if BASE/Tổng hợp enrichment is still loading, show a localized small loading state for that enrichment rather than blocking the entire page where architecture permits;
- failed FX enrichment must not blank native financial information;
- switching period/currency should retain deterministic stale-response prevention;
- no layout jumping that causes controls to move unexpectedly after load.

If fully progressive BASE enrichment would require an unsafe large rewrite, prioritize the bounded transaction/snapshot work first and document the remaining latency source truthfully.

---

## 8. Reproducible Local Install

The repository MUST return to deterministic install health.

Mandatory:

- `package.json` and `package-lock.json` are synchronized;
- a clean `npm ci` succeeds;
- do not introduce unrelated package upgrades;
- canonical tracked import spelling is lowercase `@supabase/supabase-js` everywhere;
- add a source check that rejects tracked `@Supabase/` imports.

If lock-file repair changes transitive package versions only because the lock was stale, document that fact in the report.

---

## 9. Verification

Add deterministic source/unit coverage for the hardening.

At minimum prove:

- bounded dashboard transaction query (no unbounded `getTransactions()` dependency in Dashboard report path);
- selected-period report query happens before historical snapshot requests;
- no out-of-scope transaction IDs passed to historical snapshot API;
- snapshot chunk concurrency remains bounded;
- Reports initial load does not perform duplicate same-scope fetch from null currency resolution;
- archived accounts excluded from Dashboard/Reports visible active-account lists/counts;
- archived transaction history still participates in historical calculations;
- Dashboard account preview maximum is enforced;
- TransactionList pagination boundaries and reset behavior;
- Accounts pagination boundaries/reset behavior;
- report pagination does not change summary totals;
- account-type presentation labels map every known enum;
- forbidden end-user implementation strings are absent from normal user pages;
- mock-only settings are hidden or clearly disabled;
- Settings layout contains centered responsive width semantics;
- no `@Supabase/` tracked import;
- migrations remain exact SHA blobs.

Do not weaken existing Phase 8 tests.

---

## 10. Required Commands

Run from a clean checkout/worktree after implementation:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-rls.mjs
# existing deterministic Phase 8 test command
# new UX/performance deterministic test command(s)
git diff --check
```

Do NOT execute the live RLS verifier during this source pass.
Do NOT modify remote Supabase.

If browser tooling is available, verify at 1440px, 1024px, 768px and 390px. Never claim viewport verification if it was not actually performed.

---

## 11. Documentation

Update `docs/PROJECT_STATUS.md` truthfully with a new subsection for this UX/performance hardening pass.

Do NOT mark Phase 8 Pass A live smoke complete yet.

The expected state after code-only success remains:

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_UX_PERFORMANCE_HARDENING=PASS_CODE_ONLY
PHASE_8_LIVE_PERSISTENCE_SMOKE=PENDING_RETEST
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

---

## 12. Git Discipline

- Work on `main` only if that matches the repository workflow already in use.
- No unrelated refactors.
- No migration changes.
- No database writes.
- Push completed implementation.
- Final worktree clean.
- `HEAD == origin/main`.

---

## Required Final Report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A UX + Performance Hardening

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
6674ad0126b2656483c5ac195e8d0f3d17c41f9e

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

HEAD_MATCH
true / false

WORKTREE_CLEAN
true / false

NPM_CI
PASS / FAIL

TYPECHECK
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

SOURCE_VERIFIER
PASS <n>/<n> / FAIL

PHASE_8_TESTS
PASS <n>/<n> / FAIL

UX_PERFORMANCE_TESTS
PASS <n>/<n> / FAIL

GIT_DIFF_CHECK
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

DASHBOARD_UNBOUNDED_TX_FETCH_REMOVED
PASS / FAIL

REPORT_PERIOD_SCOPED_BEFORE_SNAPSHOTS
PASS / FAIL

SNAPSHOT_BATCHING_BOUNDED_CONCURRENT
PASS / FAIL

REPORT_INITIAL_DUPLICATE_FETCH_REMOVED
PASS / FAIL

ARCHIVED_ACCOUNTS_HIDDEN_CURRENT_VIEWS
PASS / FAIL

DASHBOARD_ACCOUNT_PREVIEW_BOUNDED
PASS / FAIL

TRANSACTION_PAGINATION
PASS / FAIL

TRANSFER_PAGINATION
PASS / FAIL

ACCOUNT_PAGINATION
PASS / FAIL

SETTINGS_CENTERED_RESPONSIVE_LAYOUT
PASS / FAIL

END_USER_TERMINOLOGY_SCAN
PASS / FAIL

MOCK_SETTINGS_NOT_MISLEADING
PASS / FAIL

ACCOUNT_ENUM_LOCALIZATION
PASS / FAIL

LOWERCASE_SUPABASE_IMPORTS
PASS / FAIL

LOCKFILE_SYNCHRONIZED
PASS / FAIL

VIEWPORT_1440
PASS / NOT_RUN / FAIL

VIEWPORT_1024
PASS / NOT_RUN / FAIL

VIEWPORT_768
PASS / NOT_RUN / FAIL

VIEWPORT_390
PASS / NOT_RUN / FAIL

REMOTE_DATABASE_MODIFIED
false

PHASE_8_UX_PERFORMANCE_HARDENING
PASS_CODE_ONLY / FAIL

PHASE_8_LIVE_PERSISTENCE_SMOKE
PENDING_RETEST

PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS
NOT_STARTED

PHASE_8_OVERALL
PARTIAL

PHASE_9_AUTHORIZED
false
```
