# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 9 — Income Sources & Revenue Attribution
- **Phase status:** PASS / CLOSED
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 9 completion SHA:** `0043b543efdbfd02756d80c6a93d4e6c0c745d42`
- **Phase 9 closure receipt:** `docs/receipts/PHASE_9_CLOSURE.md`
- **Phase 10 contract discovery:** `docs/PHASE_10_CONTRACT_DISCOVERY.md`
- **Phase 9 closure / discovery commit SHA:** `edcd5ffe1f0afe95d008d2946f104084cb191aa7`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Phase 3 code verification SHA:** `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5`
- **Accepted Phase 3 migration-source SHA:** `529d1d42ab50d62b2327fadc7a9ac0b2122798fa`
- **Phase 3 structural receipt SHA:** `1422dcd5e9c67028d1c33006d5d61f7037827dff`
- **Phase 3 runtime RLS receipt SHA:** `2b09f494344a3f6d84bb374ad5bdba0512f7f459`
- **Phase 3 closure SHA:** `935a806c15d28b8de412631f48cf2ee067a3af2f`
- **Phase 4 implementation contract SHA:** `75dd85d4a7b062fb3f8cc2a25570a75c057838ac`
- **Phase 4 initial implementation SHA:** `399f96327111ebf9abeb7c95d445ce0174f91e6f`
- **Phase 4 first corrective baseline SHA:** `7a57a27029ffe86185b67bcceeddaac826e4985d`
- **Phase 4 final-corrective agent SHA audited:** `890184010434e7b88ff8f4050dc6a1d54aae577e`
- **Accepted Phase 4 exact-head source SHA:** `13287e773eeaa65460bd0980d502bd8885c45f9c`
- **Phase 4 structural-verifier syntax-fix SHA:** `bb6744692f786a0a86602971ee788567c2d44797`
- **Phase 4 structural receipt SHA:** `182787e142c2cdec4fd4f2bbc94bce2140fcc2fb`
- **Phase 4 runtime RLS receipt SHA:** `802addec082d0aa4366b2f70d1e6e20f5432827b`
- **Accepted Phase 5 exact-head source SHA:** `27215b99484938ff25879a412449a591fe6bb9dc`
- **Phase 5 structural-verifier fix SHA:** `897883f98ec4df0e94b5b96d6c69ab78d0f08d3e`
- **Phase 5 structural receipt SHA:** `0411e952b04d831ea440a1707b600b9bf006d3e0`
- **Phase 5 runtime RLS receipt SHA:** `cfb352460dfc05fc2ea79815eabf6664580d15fc`
- **Phase 5 closure receipt SHA:** `2794812af0367487247ce30520e62bcd9a29353b`
- **Phase 5 closure receipt:** `docs/receipts/PHASE_5_CLOSURE.md`
- **Accepted Phase 6 exact-head source SHA:** `4c5df491256d07550ee8d2bd2d92eb8b6c7f3056`
- **Phase 6 source receipt SHA:** `2eb63266e2a8210db940410aceea339536172da0`
- **Phase 6 source receipt:** `docs/receipts/PHASE_6_SOURCE_GATE.md`
- **Phase 6 closure receipt SHA:** `d10b541e66c5dd950d1dde3e84d8922c07d695fe`
- **Phase 6 closure receipt:** `docs/receipts/PHASE_6_CLOSURE.md`
- **Accepted Phase 8 pre-closure implementation SHA:** `0294c5faaa751b950aae152e1ec1789ff5b32891`
- **Phase 8 closure receipt:** `docs/receipts/PHASE_8_CLOSURE.md`

## Phase 2 Accepted Baseline

Phase 2 remains accepted PASS and must not be regressed.

Accepted gates:

- Auth/SSR code hardening: PASS
- Remote Phase 2 database structure and least-privilege grants: PASS
- Anonymous RLS isolation: PASS
- Bidirectional two-user RLS isolation: PASS
- Email/password signup/login/confirmation: PASS
- Onboarding routing and persistence: PASS
- Settings persistence: PASS
- Sign out and protected-route enforcement: PASS
- Password recovery: PASS
- Google OAuth: PASS

**PHASE_2 = PASS**

## Phase 3 — Accounts + Categories — Final Receipt

Phase 3 is accepted COMPLETE and remains the immutable baseline for later phases.

### Source gate

The Phase 3 application/runtime source was verified with matching local/remote HEAD and clean worktree.

- TypeScript: PASS
- Lint: PASS
- Production build: PASS
- Runtime verifier script syntax: PASS
- Verification code changes: NONE

### Remote database structural gate

The corrected Phase 3 migration was manually applied to the target Supabase project. Strict verification returned every mandatory check PASS and `99_OVERALL = PASS`.

Accepted facts:

- `accounts` and `categories` exist with RLS enabled;
- exactly six authenticated ownership policies are present;
- account/category updated-at triggers are present;
- category provisioning trigger on `auth.users` is present;
- Phase 3 SECURITY DEFINER helpers use empty `search_path` and client EXECUTE is revoked;
- `anon` and `PUBLIC` have no table or column privileges on Phase 3 tables;
- authenticated has table-level SELECT only with exact column-level INSERT/UPDATE allowlists;
- `opening_balance` is PostgreSQL `numeric(20,4)`;
- baseline categories were complete for all current auth users;
- no seeded transfer category exists.

**PHASE_3_REMOTE_DATABASE = PASS**
**PHASE_3_STRUCTURAL_GATE = PASS**

### Two-user runtime RLS gate

The hardened two-user runtime verifier exited `0`.

Accepted runtime facts:

- User A/B authentication: PASS
- own account INSERT/SELECT/UPDATE: PASS
- cross-user account INSERT/SELECT/UPDATE blocked: PASS
- account ownership mutation blocked: PASS
- category baseline visibility/isolation: PASS
- own category INSERT/SELECT/UPDATE: PASS
- cross-user category INSERT/SELECT/UPDATE blocked: PASS
- category ownership mutation blocked: PASS
- deliberate non-RLS database error distinction: PASS
- verifier cleanup/archive: PASS

**PHASE_3_TWO_USER_RLS = PASS**

### Live application persistence smoke

Owner-attested live smoke on the Finora Vercel application:

- account create + edit + persistence: PASS
- account archive + unarchive: PASS
- category create + edit + persistence: PASS
- category archive + unarchive: PASS
- refresh + logout/login persistence: PASS
- unexpected live errors: NONE

**PHASE_3_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 3 authorization receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3_SOURCE=PASS
PHASE_3_REMOTE_DATABASE=PASS
PHASE_3_STRUCTURAL_GATE=PASS
PHASE_3_TWO_USER_RLS=PASS
PHASE_3_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_3=PASS
PHASE_4_AUTHORIZED=true
```

## Phase 4 — Transactions — Source Receipt

The final-corrective agent revision `890184010434e7b88ff8f4050dc6a1d54aae577e` materially improved Phase 4. A bounded repository audit then corrected residual issues directly on `main`.

Accepted source behavior includes:

1. transaction reads fail closed on `public.transaction_details`; there is no fallback to direct numeric table reads;
2. public transaction mutation contracts accept monetary `amount` as string only;
3. create/update/void/restore read back through the exact text view;
4. exact decimal normalization rejects invalid precision instead of silently truncating extra fractional digits;
5. a new transaction never falls back to an archived account when no active account exists;
6. monthly summaries use the actual current calendar month and exact per-currency decimal accumulation;
7. transaction filters derive runtime dates and do not perform cross-currency amount sorting;
8. truthful RFC 4180 CSV export is implemented;
9. void/restore UI is implemented with visible error handling;
10. the runtime verifier contains the full two-user integrity/isolation matrix.

Exact-head verification against source SHA `13287e773eeaa65460bd0980d502bd8885c45f9c` returned:

- local HEAD = remote main: PASS
- worktree clean: PASS
- git diff check: PASS
- TypeScript: PASS
- lint: PASS
- production build: PASS
- runtime RLS script syntax: PASS
- money coercion scan: PASS
- `as any` mutation-path scan: PASS
- exact read fail-closed: PASS
- active/historical selection behavior: PASS
- strict structural verifier inspection: PASS
- runtime full-matrix inspection: PASS

**PHASE_4_SOURCE_GATE = PASS**

## Phase 4 — Remote Database Structural Receipt

The Phase 4 migration `supabase/migrations/20260828000002_phase_4_transactions.sql` was applied to the target Supabase database.

The strict read-only structural verifier was executed after a verifier-only PostgreSQL type-cast correction at `bb6744692f786a0a86602971ee788567c2d44797`.

All 26 mandatory checks returned PASS and `99_OVERALL = PASS`.

Accepted remote facts:

- `public.transactions` exists and RLS is enabled;
- exactly three authenticated ownership policies exist with the expected SELECT/INSERT/UPDATE semantics;
- no DELETE policy exists;
- `amount` is PostgreSQL `numeric(20,4)`;
- positive-amount, INCOME/EXPENSE, merchant/note-length and currency-code constraints are present;
- no transfer or FX persistence columns exist;
- account FK is exactly `(account_id,user_id,currency_code) -> accounts(id,user_id,currency_code)` with RESTRICT delete action;
- category FK is exactly `(category_id,user_id,type) -> categories(id,user_id,type)` with RESTRICT delete action;
- required composite unique keys exist on accounts and categories;
- the transaction updated-at trigger is wired to `public.handle_updated_at()`;
- anon/PUBLIC have no transaction table or column privileges;
- authenticated has table-level SELECT only plus exact INSERT/UPDATE column allowlists;
- identity, ownership, and timestamps are not client-mutable;
- `account_balances` and `transaction_details` both use `security_invoker=true`;
- `account_balances.current_balance` and `transaction_details.amount` are exposed as text;
- authenticated has SELECT-only access to the views while anon/PUBLIC are excluded;
- no persisted `accounts.current_balance` exists;
- Phase 2/3 RLS remains enabled on profiles, user_settings, accounts, and categories.

**PHASE_4_REMOTE_DATABASE = PASS**
**PHASE_4_STRUCTURAL_GATE = PASS**

## Phase 4 — Two-User Runtime RLS / Integrity Receipt

The hardened runtime verifier was executed against the target Supabase database using only the public Supabase URL/publishable key plus two disposable test-user credentials. It exited with code `0` and made no source changes.

Accepted runtime results:

- User A authentication: PASS
- User B authentication: PASS
- User A own transaction lifecycle: PASS
- User B own transaction lifecycle: PASS
- cross-user owned-row INSERT blocked: PASS
- cross-user account/category references blocked: PASS
- cross-user SELECT blocked: PASS
- cross-user UPDATE blocked: PASS
- ownership change blocked: PASS
- domain integrity constraints: PASS
- DELETE blocked: PASS
- `security_invoker` view isolation: PASS
- deliberate non-RLS database-error distinction: PASS
- test-record cleanup: PASS

**PHASE_4_TWO_USER_RLS = PASS**
**PHASE_4_RUNTIME_PROCESS_EXIT_CODE = 0**

## Phase 4 — Live Application Persistence Receipt

Owner-attested live smoke on the deployed Finora application returned PASS for every required Phase 4 behavior:

- transaction create: PASS
- transaction edit: PASS
- transaction void: PASS
- voided transaction excluded from derived account balance: PASS
- transaction restore: PASS
- restored transaction included in derived account balance: PASS
- exact decimal persistence: PASS
- refresh persistence: PASS
- logout/login persistence: PASS
- current-month summary: PASS
- real CSV export: PASS
- unexpected live errors: NONE

**PHASE_4_LIVE_PERSISTENCE_SMOKE = PASS**

## Phase 4 — Final Authorization Receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4_SOURCE_GATE=PASS
PHASE_4_REMOTE_DATABASE=PASS
PHASE_4_STRUCTURAL_GATE=PASS
PHASE_4_TWO_USER_RLS=PASS
PHASE_4_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_4=PASS
PHASE_5_AUTHORIZED=true
```

Phase 4 is CLOSED. Reopen it only if a regression is found.

## Phase 5 — Same-Currency Transfers — Final Receipt

Phase 5 is accepted COMPLETE. Full closure evidence is preserved in `docs/receipts/PHASE_5_CLOSURE.md`.

### Source gate

Accepted application/source exact-head SHA: `27215b99484938ff25879a412449a591fe6bb9dc`.

Exact-head verification established:

- local HEAD = remote main: PASS;
- worktree clean: PASS;
- TypeScript: PASS;
- lint: PASS;
- production build: PASS;
- runtime verifier syntax: PASS;
- git diff check: PASS;
- money-path scan: PASS;
- string-only exact-decimal transfer mutation boundary: PASS;
- same-currency-only transfer design: PASS;
- transfer/net-worth neutrality design: PASS;
- Cartesian-safe account balance derivation: PASS.

**PHASE_5_SOURCE_GATE = PASS**

### Remote database + structural gate

The Phase 5 migration `supabase/migrations/20260828000003_phase_5_transfers.sql` was applied to the target Supabase project.

The strict read-only verifier was rerun after verifier-only correction SHA `897883f98ec4df0e94b5b96d6c69ab78d0f08d3e`.

All 38 mandatory checks returned PASS and `99_OVERALL = PASS`.

Accepted facts include:

- `public.transfers` exists with RLS enabled;
- exact authenticated ownership policies exist for SELECT/INSERT/UPDATE;
- DELETE is not exposed to authenticated clients;
- transfer amount is `numeric(20,4)` with positive constraint;
- source/destination must differ;
- composite ownership/currency FKs enforce own-account same-currency transfers;
- no Phase 5 FX persistence exists;
- `transfer_details` and `account_balances` are `security_invoker=true`;
- exact money view boundaries remain text;
- account balances independently pre-aggregate transaction totals, incoming transfers, and outgoing transfers;
- formula is opening balance + transaction net + incoming - outgoing;
- voided transactions/transfers are excluded;
- Phase 4 transaction RLS, grants, view semantics, and exact-money contract remain intact.

**PHASE_5_REMOTE_DATABASE = PASS**
**PHASE_5_STRUCTURAL_GATE = PASS**

### Two-user runtime RLS / integrity gate

The hardened public-key/two-user verifier exited `0` with no source changes.

Accepted runtime results:

- User A authentication: PASS;
- User B authentication: PASS;
- schema readiness: PASS;
- User A create/edit/void/restore lifecycle + net-worth neutrality: PASS;
- User B create/edit/void/restore lifecycle + net-worth neutrality: PASS;
- bidirectional cross-user isolation/spoofing blocked: PASS;
- domain/integrity rejection cases: PASS;
- Phase 4 transaction non-regression/co-derivation: PASS;
- deterministic fail-closed cleanup: PASS.

**PHASE_5_TWO_USER_RLS = PASS**
**PHASE_5_RUNTIME_PROCESS_EXIT_CODE = 0**

### Live application persistence smoke

Owner-attested live smoke returned PASS for every required Phase 5 behavior:

- transfer create: PASS;
- source balance decreases exactly: PASS;
- destination balance increases exactly: PASS;
- net-worth neutrality after create: PASS;
- transfer edit: PASS;
- net-worth neutrality after edit: PASS;
- transfer void: PASS;
- void reverses both balance effects: PASS;
- transfer restore: PASS;
- restore reapplies both balance effects: PASS;
- exact decimal persistence: PASS;
- refresh persistence: PASS;
- logout/login persistence: PASS;
- cross-currency transfer blocked truthfully: PASS;
- unexpected live errors: NONE.

**PHASE_5_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 5 final authorization receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4=PASS
PHASE_5_SOURCE_GATE=PASS
PHASE_5_REMOTE_DATABASE=PASS
PHASE_5_STRUCTURAL_GATE=PASS
PHASE_5_TWO_USER_RLS=PASS
PHASE_5_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_5=PASS
PHASE_6_AUTHORIZED=true
PHASE_6_SOURCE_GATE=PASS_CODE_ONLY
PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_6_OVERALL=PARTIAL
PHASE_7_AUTHORIZED=false
```

Phase 5 is CLOSED. Reopen it only if a concrete regression is found.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** PASS
- **Phase 3 — Accounts + Categories:** PASS
- **Phase 4 — Transactions:** PASS
- **Phase 5 — Same-Currency Transfers:** PASS
- **Phase 6 — Dashboard + Reports:** PASS
- **Phase 7 — Budget + Goals + Recurring:** AUTHORIZED

## Phase 6 — Dashboard + Reports — Final Receipt

Phase 6 is accepted COMPLETE. Full closure evidence is preserved in `docs/receipts/PHASE_6_CLOSURE.md`.

### Source gate

Accepted exact-head source SHA: `4c5df491256d07550ee8d2bd2d92eb8b6c7f3056`.

Exact-head verification established:

- local HEAD = remote main: PASS;
- worktree clean: PASS;
- TypeScript: PASS;
- lint: PASS;
- production build: PASS;
- Phase 6 verifier syntax: PASS;
- Phase 6 source verifier: 71/71 PASS;
- git diff check: PASS;
- verification code changes: NONE;
- migration created: false;
- remote database modified: false.

Accepted implementation behavior includes:

- real user-isolated Dashboard and Reports data;
- authoritative `transaction_details` exact-money reads;
- authoritative fail-closed `account_balances` current balances;
- exact decimal / BigInt finance aggregation;
- timezone-aware calendar semantics with invalid configured timezone rejected;
- dynamic 1M/3M/6M/1Y/ALL reporting;
- ALL-history zero-month bucket continuity;
- deterministic pre-FX multi-currency isolation;
- transfer-neutral income/expense reporting;
- synchronous stale-report invalidation during period/currency transitions;
- real selected-period/selected-currency CSV export.

**PHASE_6_SOURCE_GATE = PASS_CODE_ONLY**

### Live Dashboard / Reports smoke

Owner-attested live verification returned PASS for all required Phase 6 behaviors:

- real Dashboard balances: PASS;
- monthly income: PASS;
- monthly expense: PASS;
- monthly savings: PASS;
- no fake cross-currency total: PASS;
- transfer report neutrality: PASS;
- transaction create refresh: PASS;
- transaction edit refresh: PASS;
- transaction void refresh: PASS;
- transaction restore refresh: PASS;
- report 1M: PASS;
- report 3M: PASS;
- report 6M: PASS;
- report 1Y: PASS;
- report ALL: PASS;
- ALL zero-month buckets: PASS;
- currency switching: PASS;
- no stale report data: PASS;
- CSV export: PASS;
- CSV period/currency scope: PASS;
- CSV exact decimals: PASS;
- refresh persistence: PASS;
- logout/login persistence: PASS;
- unexpected live errors: NONE.

**PHASE_6_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 6 final authorization receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4=PASS
PHASE_5=PASS
PHASE_6_SOURCE_GATE=PASS_CODE_ONLY
PHASE_6_LIVE_PERSISTENCE_SMOKE=PASS
PHASE_6_OVERALL=PASS
FINORA_PHASE_6=PASS
PHASE_7_AUTHORIZED=true
```

Phase 6 is CLOSED. Reopen it only if a concrete regression is found.

## Phase 7 — Budgets + Goals + Recurring — Implementation Status

Phase 7 implementation contract was executed in full:

### 1. Database Migration & Schema Baseline
- Created source migration `supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql` (not applied to remote Supabase per instructions).
- Tables:
  - `budgets`: Monthly category expense limit (`numeric(20,4)`), composite FK to `categories (id, type)`, `check_budget_category_type` ensuring EXPENSE only, `check_budget_limit_positive`, `check_budget_period_month_first_day`.
  - `goals`: Long-term saving/investment targets (`numeric(20,4)`), target/current amounts, monthly contribution, completion tracking.
  - `recurring_items`: Scheduled templates for recurring income/expense items with frequencies `WEEKLY`, `MONTHLY`, `YEARLY`, `anchor_date`, `end_date`, `is_paused`, `is_archived`.
- Views (all with `security_invoker = true`):
  - `budget_progress`: Computes exact spent amount from non-voided transactions for the budget month, remaining amount, and basis points progress.
  - `goal_details`: Computes remaining target amount and basis points.
  - `recurring_details`: Computes template details joined with account and category names.
- RLS Policies:
  - 9 exact authenticated ownership policies (3 per table: SELECT, INSERT, UPDATE).
  - No DELETE policy (soft delete only via `is_archived`).
  - Column-level privileges granted strictly to `authenticated`.

### 2. Feature & Application Services
- `src/features/budgets`: Exact-money queries, creation, archive, basis points calculation, deterministic single-currency summary, active-category budget validation.
- `src/features/goals`: Exact-money queries, creation, update, archive, completion tracking, deterministic single-currency summary, strict calendar ISO target date validation.
- `src/features/recurring`: Deterministic date engine (`engine.ts`) supporting leap-year calculations, month-end clamping (e.g. Jan 31 -> Feb 28), next due date calculation, days until due, pause/resume lifecycle, and monthly cash flow projection.

### 3. User Interface Integration
- `/src/app/budgets/page.tsx`: Connects to `getBudgets`, category breakdown, overall monthly budget card, progress bars, month period selector with previous/next navigation, `AddBudgetModal` with active expense category selection.
- `/src/app/goals/page.tsx`: Connects to `getGoals`, saving progress cards, target deadlines, `AddGoalModal` with dynamic currency detection from user settings.
- `/src/app/recurring/page.tsx`: Connects to `getRecurringItems`, pause/resume toggle, days-until-due badges, `AddRecurringModal` with active accounts/categories selection and timezone-aware default anchor date.
- **Mobile Navigation Corrective**: Replaced desktop-only bottom tab navigation with a fully accessible global Mobile Navigation Drawer (`Sheet` component) inside `AppShell`, opening on `Menu` click, providing mobile users access to Budgets, Goals, Recurring, and Settings.
- **Money Input Form UX Corrective**: Migrated all 11 monetary form inputs (Transactions, Transfers, Accounts, Budgets, Goals, Recurring) to the unified `MoneyInput` component which prevents mobile keyboard locale issues (e.g., Vietnam localized numeric keypad emitting commas), provides deterministic string-based decimal parsing for BigInt safety, and standardizes visual display formatting (thousand separators).
- Completely eradicated all mock data imports across all Phase 7 views and components.

### 4. Verification Suite
- `scripts/verify-phase7-source.mjs`: Complete source, exact-money arithmetic, and recurring date engine verifier (163/163 checks PASS).
- `scripts/verify-phase7-db.sql`: Comprehensive 51-check + 99_OVERALL read-only database structural SQL verifier auditing tables, columns, constraints, triggers, RLS, grants, views, and Phase 4–6 non-regressions.
- `scripts/verify-phase7-rls.mjs`: Full two-user runtime contract test suite verifying complete budget, goal, and recurring lifecycles, cross-user isolation, domain constraint rejections, and financial neutrality.

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4=PASS
PHASE_5=PASS
PHASE_6=PASS
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=PASS
PHASE_7_STRUCTURAL_GATE=PASS
PHASE_7_TWO_USER_RLS=PASS
PHASE_7_LIVE_PERSISTENCE_SMOKE=PASS_CORE_PENDING_FINAL_MOBILE_MONEY_UX
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

## Phase 7 final authorization receipt
Phase 7 is accepted COMPLETE.

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_LIVE_PERSISTENCE_SMOKE=PASS
PHASE_7_OVERALL=PASS
FINORA_PHASE_7=PASS
PHASE_8_AUTHORIZED=true
```

## Phase 8 — Multi-Currency + FX (Pass A Corrective)
Pass A Corrective has been successfully prepared in the source repository.
All rejected implementations from the prior flawed run have been purged or corrected.

Implemented fixes:
- Atomic migration `supabase/migrations/20260829000001_phase_8_fx.sql` containing UNIQUE(id, user_id) on transactions table.
- Exact-money Frankfurter V2 CSV CSV reader with strict `<= 7` days backward fallback via `date,base,quote,rate` parsing.
- `transaction_fx_snapshots` constraints ensuring exact `rate numeric(30,12)` without silent floating-point truncation.
- Base snapshot generation reads transaction source money purely from `transaction_details` text boundary.
- Base valuation explicitly fails-closed on missing non-identity rates rather than defaulting to 1.
- Detailed report CSV export embeds FX provenance `fx_original_amount, fx_original_currency, fx_rate, fx_provider, fx_effective_date`.
- `auto_fx_enabled` is successfully persisted in `user_settings` UI.
- UI Dashboards/Reports present `UNAVAILABLE` / `DISABLED` alerts when BASE currency conversion is requested but provider/snapshots cannot fulfill it exactly.
- Added `ADR-013` to `docs/DECISIONS.md` to preserve this boundary.
- **IMPORTANT**: The source codebase remains fully Phase-7-DB-compatible before the Phase 8 migration is actually applied. Settings writes and reads gracefully handle missing `auto_fx_enabled` columns.

Verification:
- `verify-phase8-source.mjs`: PASS
- Math deterministic checks: PASS
- `typecheck`: PASS
- `build`: PASS

## Phase 8 — Pass A UX + Performance Hardening & Final Corrective
Pass A UX, Performance Hardening, and Final Corrective updates have been successfully implemented and verified in the source repository:

Implemented UX + Performance Final Corrective optimizations:
- Restored persisted theme loading and saving in `SettingsPage` with runtime DOM theme class management (`light`/`dark`/`system`).
- Mask balance switch disabled with "Sắp hỗ trợ" badge in Settings.
- Centered and balanced `SettingsPage` desktop grid layout (`max-w-6xl`) with User Profile, Theme, Currency & Region, Categories navigation, Notifications (disabled with "Sắp hỗ trợ"), AI (disabled with "Sắp hỗ trợ"), and Security cards.
- Complete eradication of internal developer jargon (`user_settings`, `Row Level Security`, `Credential Source`, `(Light)`, `(Dark)`, `(Auto)`, `Base Currency`, `Phase 7`, `Phase 8`) from user-facing Settings interface.
- Friendly, localized labels: "Cài đặt", "Tiền tệ cơ sở", "Tiền tệ & khu vực", "Sáng", "Tối", "Theo hệ thống", IANA timezones mapped to friendly labels.
- Non-blocking Dashboard rendering: Native Dashboard balances, current-month summaries, 6M native cash flow, and recent transactions return immediately without awaiting historical FX snapshots or current rates.
- Progressive background enrichment (`enrichDashboardBaseFx`) hydrates BASE valuation and 6M historical snapshots asynchronously without blocking the UI or blanking native data.
- Historical snapshot scope for Dashboard is strictly restricted to the 6M `periodTxList` transaction IDs, ignoring out-of-scope recent transactions.
- Optimized native report mode in `getDetailedReportData`: selecting native ISO currencies skips FX current rates and FX snapshot API requests entirely.
- Exact active account filtering across Dashboard, Reports, and BASE synthetic account group: archived accounts are excluded from current-position account lists/counts and BASE total balances, while historical transactions of archived accounts remain fully preserved in report calculations.
- Fixed Reports initial duplicate fetch by preventing redundant `selectedCurrency` state updates when `selectedCurrency` is null.
- `TransactionList` pagination resets to page 1 on every filter and sort state change.
- Added `scripts/verify-phase8-ux-performance.mjs` verifying all UX and performance requirements.

Verification:
- `scripts/verify-phase8-ux-performance.mjs`: PASS
- `scripts/verify-phase8-source.mjs`: PASS
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Pass B — Remote-Gate Readiness Final Corrective
Remote-Gate Readiness Final Corrective has been completed in source code and fully verified:

Implemented Corrective Features:
- Additive security hardening migration `supabase/migrations/20260831144154_phase_8_transfer_trigger_security_hardening.sql`:
  - Replaces `check_transfer_accounts_active` function with `SECURITY INVOKER` (removing `SECURITY DEFINER`).
  - Preserved original historical migrations byte-identical: `20260829000002` (`fbe5fefed202fcdc9f9bc48fb590aa11deba4e79`) and `20260831142135` (`5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18`).
- Created pure domain module `src/features/transfers/domain.ts` containing transfer validation and exact math normalization logic.
- Cleaned public type contract in `src/features/transfers/transfers.ts`: `TransferInsertInput` and `TransferUpdateInput` omit caller `currency_code`, `source_currency_code`, `destination_currency_code`, and `destination_amount` authority.
- Refactored executable domain test suite `tests/phase8-cross-currency-transfers.test.ts` executing 24 production domain scenarios and 2 pending remote gate markers.
- Hardened structural DB verifier `scripts/verify-phase8-pass-b-db.sql` auditing `prosecdef`, `relrowsecurity`, `auth.uid() = user_id`, table privileges for `anon`, composite FKs, `security_invoker` views, and `pg_get_constraintdef`.
- Comprehensive source verifier `scripts/verify-phase8-pass-b-source.mjs` verifying all 19 source, migration SHA, security, and brand asset constraints (19/19 PASS).
- Updated `docs/DECISIONS.md` (ADR-014) and `docs/DATABASE.md`.

Verification:
- `scripts/verify-phase8-pass-b-source.mjs`: PASS (19/19 checks)
- `tests/phase8-cross-currency-transfers.test.ts`: PASS (24 domain tests + 2 pending markers)
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Pass B — Failed Remote Migration View Compatibility Corrective
Remote deployment attempt failed with SQLSTATE `42P16` (`ERROR: cannot change name of view column "note" to "source_currency_code"`) due to columns inserted between columns 6 and 7 in `CREATE OR REPLACE VIEW public.transfer_details`.

Implemented Corrective:
- Modified unapplied migration `supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql` (blob SHA `e046ea3f62aaa76f00295e68126ca29a48bfaa9b`):
  - Preserves exact 17-column Phase 5 prefix for `public.transfer_details` in exact order.
  - Appends new Phase 8 columns (`source_currency_code`, `destination_currency_code`, `destination_amount`, `exchange_rate`, `from_account_currency`, `to_account_currency`) strictly after the legacy prefix.
- Preserved historical migrations: `20260829000000` (`5da681f7c66fdd85acda79172d1ad305496c6313`), `20260829000001` (`69e3ff637c0430fa701794aff497f81eb875443e`), `20260831142135` (`5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18`), `20260831144154`.
- Added deterministic view projection regression checks in `scripts/verify-phase8-pass-b-source.mjs` verifying exact 17-column Phase 5 prefix match and `account_balances` view compatibility (21/21 PASS).

Verification:
- `scripts/verify-phase8-pass-b-source.mjs`: PASS (21/21 checks)
- `scripts/verify-phase8-source.mjs`: PASS
- `scripts/verify-phase8-ux-performance.mjs`: PASS
- `tests/phase8-math.test.ts`: PASS
- `tests/phase8-base-mode.test.ts`: PASS
- `tests/phase8-cross-currency-transfers.test.ts`: PASS (24 domain tests + 2 pending markers)
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Pass B — Structural Gate Final Hardening Corrective
Hardened public.check_transfer_accounts_active() trigger function and modernized structural database verifier with robust catalog semantics.

Implemented Corrective:
- Created additive migration `supabase/migrations/20260831150000_phase_8_transfer_trigger_search_path_hardening.sql`:
  - `ALTER FUNCTION public.check_transfer_accounts_active() SET search_path TO '';`
  - Eliminates `function_search_path_mutable` advisor finding while preserving `SECURITY INVOKER` execution mode.
- Preserved applied historical migrations intact:
  - `20260829000002` (`e046ea3f62aaa76f00295e68126ca29a48bfaa9b`)
  - `20260831142135` (`5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18`)
  - `20260831144154` (`3ee23b513bcd65182afa613084dda8fbf5b40293`)
- Modernized `scripts/verify-phase8-pass-b-db.sql`:
  - Validates function configuration: `prosecdef=false`, `security_invoker=true`, empty `search_path` (`proconfig`), archive guard body.
  - Replaced fragile string matching for RLS policies with catalog semantics on `public.transfers` validating separate SELECT (USING), INSERT (WITH CHECK), and UPDATE (USING + WITH CHECK) policies for `auth.uid() = user_id`, while asserting absence of DELETE policy.
  - Validates trigger semantics: `trg_check_transfer_accounts_active` configured as `BEFORE INSERT OR UPDATE FOR EACH ROW`.
  - Audits composite FKs with `ON DELETE RESTRICT`, column numeric precision, constraint definitions, anon privileges, and view `security_invoker`.
- Updated comprehensive source verifier `scripts/verify-phase8-pass-b-source.mjs` with 30 deterministic assertions (30/30 PASS).

Verification:
- `scripts/verify-phase8-pass-b-source.mjs`: PASS (30/30 checks)
- `scripts/verify-phase8-source.mjs`: PASS
- `scripts/verify-phase8-ux-performance.mjs`: PASS
- `tests/phase8-math.test.ts`: PASS
- `tests/phase8-base-mode.test.ts`: PASS
- `tests/phase8-cross-currency-transfers.test.ts`: PASS (24 domain tests + 2 pending markers)
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Pass B — Trigger Bitmask Verifier Final Corrective
Corrected trigger bitmask assertion in `scripts/verify-phase8-pass-b-db.sql` and updated regression checks.

Implemented Corrective:
- Fixed PostgreSQL trigger bitmask assertion in `scripts/verify-phase8-pass-b-db.sql`:
  - `AND (tgtype & 2) = 2 -- BEFORE` (correcting `(tgtype & 2) = 0` which falsely failed valid BEFORE triggers).
  - Preserved `(tgtype & 1) = 1` (FOR EACH ROW), `(tgtype & 4) = 4` (INSERT), and `(tgtype & 16) = 16` (UPDATE).
- Updated regression test in `scripts/verify-phase8-pass-b-source.mjs`:
  - Enforces `(tgtype & 2) = 2` and explicitly rejects `(tgtype & 2) = 0`.
- Preserved pending additive migration `supabase/migrations/20260831150000_phase_8_transfer_trigger_search_path_hardening.sql` intact.
- Preserved historical applied migration locks:
  - `20260829000002` (`e046ea3f62aaa76f00295e68126ca29a48bfaa9b`)
  - `20260831142135` (`5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18`)
  - `20260831144154` (`3ee23b513bcd65182afa613084dda8fbf5b40293`)

Verification:
- `scripts/verify-phase8-pass-b-source.mjs`: PASS (30/30 checks)
- `scripts/verify-phase8-source.mjs`: PASS (35/35 checks)
- `scripts/verify-phase8-ux-performance.mjs`: PASS (34/34 checks)
- `tests/phase8-math.test.ts`: PASS
- `tests/phase8-base-mode.test.ts`: PASS
- `tests/phase8-cross-currency-transfers.test.ts`: PASS (24 domain tests + 2 pending markers)
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Pass B — Authenticated Two-User Runtime Gate Harness
Created transactional SQL verification harness `scripts/verify-phase8-pass-b-runtime.sql` and updated source verifiers to validate RLS policies, dual-currency balances, void/restore lifecycle, and negative constraints under authenticated PostgreSQL roles.

Implemented:
- Transactional test harness `scripts/verify-phase8-pass-b-runtime.sql` wrapped in `BEGIN; ... ROLLBACK;`:
  - Dynamically discovers 2 real users from `auth.users` without hardcoding UUIDs or leaking PII.
  - Provisions fixture accounts with `__PHASE8_RUNTIME_GATE__` prefix for USER_A and USER_B.
  - Simulates authenticated role sessions using `SET LOCAL ROLE authenticated` and `request.jwt.claim.sub`.
  - Asserts same-currency transfer persistence and `public.transfer_details` view querying.
  - Asserts cross-currency transfer persistence (USD -> VND) and verifies exact dual-currency balance deductions and additions in `public.account_balances`.
  - Asserts voiding (`is_voided = true`) and restoring (`is_voided = false`) with exact balance rollbacks and immutable historical FX preservation.
  - Enforces cross-user isolation: proves USER_B cannot SELECT or UPDATE USER_A transfers, and cannot create transfers referencing USER_A accounts.
  - Enforces absence of DELETE authority on `public.transfers` for authenticated users.
  - Evaluates complete negative integrity matrix (bad same-currency rate, inconsistent destination amount, account currency mismatch, same account, archived account).
  - Confirms transfers do not alter `public.transactions` table.
- Updated `scripts/verify-phase8-pass-b-source.mjs` with 44 deterministic checks validating runtime harness structure and governance status (44/44 PASS).

Verification:
- `scripts/verify-phase8-pass-b-source.mjs`: PASS (44/44 checks)
- `tests/phase8-cross-currency-transfers.test.ts`: PASS (24 domain tests + 2 pending markers)
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Pass B — Runtime Harness Exact-Catalog Corrective
Updated `scripts/verify-phase8-pass-b-runtime.sql` and `scripts/verify-phase8-pass-b-source.mjs` to match exact production database catalog facts and eliminate potential false PASS conditions:

Implemented:
- `public.account_balances` access corrected: Replaced non-existent `id` and `balance` column references with `WHERE account_id = <account>` and `SELECT current_balance::numeric`.
- Authenticated `INSERT INTO public.transfers` corrected: Omitted `is_voided` from all authenticated INSERT statements (respecting column ACL permissions and default value), and asserted `is_voided = false` on successful positive transfers.
- Negative test matrix precision: Handled specific SQLSTATE error classes (`23514` for CHECK violations, `23503` for FK violations, `P0001` for archive trigger exceptions, `42501` for DELETE permission denial) and re-raised unexpected exceptions (`RAISE;`) to prevent false PASS results from unrelated errors.
- Hardened source verification: Added 12 deterministic assertions to `scripts/verify-phase8-pass-b-source.mjs` (56/56 PASS).

Verification:
- `scripts/verify-phase8-pass-b-source.mjs`: PASS (56/56 checks)
- `scripts/verify-phase8-source.mjs`: PASS (35/35 checks)
- `scripts/verify-phase8-ux-performance.mjs`: PASS (34/34 checks)
- `tests/phase8-cross-currency-transfers.test.ts`: PASS (24 domain tests + 2 pending markers)
- `tests/phase8-math.test.ts`: PASS (31/31 checks)
- `tests/phase8-base-mode.test.ts`: PASS (10/10 checks)
- `typecheck`: PASS
- `lint`: PASS
- `build`: PASS

## Phase 8 — Multi-Currency + FX — Final Closure Receipt

Phase 8 is CLOSED.
Reopen Phase 8 only if a concrete regression is found.

Accepted pre-closure implementation SHA: `0294c5faaa751b950aae152e1ec1789ff5b32891`
Closure receipt: `docs/receipts/PHASE_8_CLOSURE.md`

```text
PHASE_8_PASS_A=PASS
PHASE_8_PASS_B_SOURCE=PASS_CODE_ONLY
PHASE_8_PASS_B_REMOTE_MIGRATIONS=PASS
PHASE_8_PASS_B_SEARCH_PATH_CORRECTIVE=PASS
PHASE_8_PASS_B_CATALOG_STRUCTURAL_ASSERTIONS=PASS
PHASE_8_PASS_B_STRUCTURAL_REMOTE_GATE=PASS
PHASE_8_PASS_B_SECURITY_ADVISOR_PASS_B_SCOPE=PASS
PHASE_8_PASS_B_TWO_USER_RLS_RUNTIME=PASS
PHASE_8_PASS_B_VOID_RESTORE_RUNTIME=PASS
PHASE_8_PASS_B_LIVE_PERSISTENCE_SMOKE=PASS
PHASE_8_PASS_B=PASS
PHASE_8_OVERALL=PASS
FINORA_PHASE_8=PASS
PHASE_9_AUTHORIZED=true
```

## Phase 9 — Income Sources & Revenue Attribution — Implementation Pass A & Pre-Deployment Correctives

Phase 9 Pass A and its pre-deployment security and ACL correctives have been implemented and verified in the source repository:

### 1. Database Security, ACLs & Migration Hardening
- Migration `supabase/migrations/20260901100000_phase_9_income_sources_revenue_attribution.sql` (not applied to remote Supabase):
  - Tables `public.income_sources` and `public.income_source_streams` with `user_id uuid NOT NULL DEFAULT auth.uid()`.
  - Composite foreign keys:
    - `income_source_streams (income_source_id, user_id) -> income_sources (id, user_id) ON DELETE RESTRICT`
    - `transactions (income_source_id, user_id) -> income_sources (id, user_id) ON DELETE RESTRICT`
    - `transactions (income_source_stream_id, income_source_id, user_id) -> income_source_streams (id, income_source_id, user_id) ON DELETE RESTRICT`
  - Constraint creation guards scoped using `conrelid = 'public.transactions'::regclass`.
  - Fail-closed security ACLs: `REVOKE ALL ON TABLE ... FROM anon, authenticated, PUBLIC;` before rebuilding exact authenticated column allowlists (INSERT: `name, type`, UPDATE: `name, type, is_archived` on sources; INSERT: `income_source_id, name`, UPDATE: `name, is_archived` on streams). No DELETE grant on either table.
  - Transaction attribution column mutation grants: Explicit column `INSERT` and `UPDATE` on `public.transactions(income_source_id, income_source_stream_id)` granted to `authenticated`. Table-level mutation authority remains fail-closed (`INSERT=false`, `UPDATE=false`, `DELETE=false`).
  - Active attribution trigger: `check_transaction_attribution_active_trigger` on `transactions` executing `SECURITY INVOKER` function with `SET search_path = ''`.
  - View `transaction_details` updated with `security_invoker = true`, preserving exact 17 legacy prefix columns and appending columns 18-22.

### 2. Domain & Application Logic Hardening
- `src/features/income-sources/domain.ts`:
  - Enforced string-only monetary inputs (`RealizedTransactionForAttribution.amount: string`).
  - Strict currency code validation (`validateAttributionCurrencyCode`) that fails closed with clear error on invalid/missing currency (no silent VND fallback).
  - Exact-decimal revenue attribution sorting using `compareExactDecimals`.
  - Pure exact decimal math (`toExactDecimal`, `addExactDecimals`) with zero floating-point accumulation.
- `src/features/income-sources/income-sources.ts`:
  - CRUD operations strictly exclude client `user_id` injection and prevent stream parent mutation.

### 3. Verification Suite
- `scripts/verify-phase9-db.sql`: Hardened fail-closed structural assertion gate with `DO $$ ... $$` verifying table schemas, exact column counts, effective table and column ACLs (including full anon rejection, table-level fail-closed mutation on `transactions`, and column-level `INSERT`/`UPDATE` on attribution columns), exact RLS policy command matrix (SELECT, INSERT, UPDATE, no DELETE/ALL) with authenticated role OID binding and strict normalized ownership expressions without extraneous predicates, exact composite unique/FK local and referenced column order via `conkey`/`confkey` unnest with ordinality, exact 5-element source type constraint set matching (`FREELANCE`, `INVESTMENT`, `OTHER`, `SALARY`, `YOUTUBE`), trigger function bindings (`handle_updated_at`, `check_transaction_attribution_active`), `SECURITY INVOKER` function configurations with exact empty `search_path`, and 22-column view order.
- `scripts/verify-phase9-source.mjs`: Automated source verifier checking all Phase 9 security contracts, migration locks, DB verifier catalog mechanics, and TypeScript definitions.
- `tests/phase9-income-sources.test.ts`: Unit test suite testing name validation, attribution constraints, fail-closed currency behavior, exact decimal aggregation, large decimal boundary (`numeric(20,4)`), and archive neutrality.

## Phase 9 — Income Sources & Revenue Attribution — Authenticated Two-User Runtime Gate

The strict authenticated two-user runtime gate harness `scripts/verify-phase9-runtime.sql` was constructed and executed with full rollback protection:

### Runtime Verification Points
- **User Discovery**: Dynamically discovers 2 distinct authenticated users from `auth.users` without hardcoded UUIDs.
- **Database-Derived Ownership**: Asserts `INSERT` without `user_id` on `public.income_sources` and `public.income_source_streams` automatically sets `user_id = auth.uid()` and defaults `is_archived = false`.
- **Column Privilege Injection Denial**: Asserts attempts to explicitly provide `user_id` on `income_sources` or `income_source_streams` `INSERT` are rejected with `insufficient_privilege` (SQLSTATE `42501`).
- **RLS Read & Update Isolation**: Proves USER_B cannot `SELECT` or `UPDATE` USER_A income sources or streams.
- **Stream Hierarchy & Cross-User Attachment**: Proves streams inherit ownership correctly and USER_B cannot attach a stream to USER_A's income source (SQLSTATE `23503`).
- **Stream Parent Immutability**: Proves authenticated users cannot mutate `income_source_id` on existing streams (SQLSTATE `42501`).
- **Transaction Attribution**: Verifies source-only, source+stream, and unattributed `INCOME` transactions, correctly resolved via `public.transaction_details` (22 columns).
- **Attribution Constraints**: Asserts `EXPENSE` attribution is rejected (SQLSTATE `23514`) and stream-without-source is rejected (SQLSTATE `23514`).
- **Composite Ownership & Parent Enforcement**: Asserts cross-user source/stream attribution and stream/source parent mismatch on transactions are rejected with FK violations (SQLSTATE `23503`).
- **Active Attribution Enforcement & Historical Realization**: Asserts new transaction attribution or existing transaction attribution updates to archived sources/streams are rejected by the active-attribution trigger (SQLSTATE `P0001`), while historical realized income transactions referencing archived sources/streams remain fully visible and unrelated fields (e.g. `note`) can be updated.
- **Hard DELETE Denial**: Asserts authenticated users cannot `DELETE` rows from `income_sources` or `income_source_streams` (SQLSTATE `42501`).
- **View RLS Isolation**: Proves USER_B cannot query USER_A transactions through `public.transaction_details`.
- **Metadata Financial Neutrality**: Verifies that creating, updating, and archiving sources/streams has zero delta on account balances or transaction counts.
- **Transaction-Scoped Rollback**: Proves 0 runtime fixtures remain after transaction rollback.

## Phase 9 — Income Sources & Revenue Attribution — Implementation Pass B (UI / UX)

Phase 9 Pass B (real user-facing experience & reporting integration) has been implemented and verified:

### 1. Income Sources & Streams Management (`/income-sources`)
- Main management interface created at `/src/app/income-sources/page.tsx` using `AppShell` and `PageHeader`.
- Real-time data loading via `getIncomeSourcesWithStreams({ includeArchived: true })`.
- Summary metric cards displaying active income source count, active child stream count, and revenue diversification distribution (5 distinct source categories).
- Source creation and editing modal supporting names up to 200 characters and 5 supported categories (`SALARY`, `YOUTUBE`, `FREELANCE`, `INVESTMENT`, `OTHER`).
- Stream creation and renaming modal adhering strictly to immutable parent source constraints (no stream migration across parent sources).
- Archive and restore controls for sources and streams without hard-delete actions.
- Tabs and search filters to toggle between active and archived sources.
- Dedicated loading skeleton at `/src/app/income-sources/loading.tsx`.
- Sidebar navigation updated in `AppShell` with `Coins` icon.

### 2. Transaction Attribution UX, Differential Mutation & Reporting Integration
- `AddTransactionModal`: Single canonical metadata loader `loadIncomeSources` calling `getIncomeSourcesWithStreams({ includeArchived: true })` on both initial open and retry, ensuring historical archived source and stream attributions resolve and display (`<name> (Đã lưu trữ)`) while excluding archived items for new transactions.
- `buildTransactionUpdatePayload`: Differential mutation builder strictly omits trigger-sensitive columns (`type`, `income_source_id`, `income_source_stream_id`) when unchanged, preventing trigger violations on historical edits of transactions with archived sources. Also fail-closed normalizes stale stream IDs when income source changes.
- Loading/Error/Retry state handling in `AddTransactionModal` for income source metadata.
- `TransactionItem`: Displays revenue attribution badges showing income source name and child stream name when present.
- `IncomeSourcesBreakdown`: Interactive visual breakdown component mounted in `/reports`, `/dashboard`, and `/income-sources` displaying revenue contributions, percentage of total income, transaction counts, and child stream drill-downs.
- `/income-sources`: Realized Income Analytics section with period selection (`1M`, `3M`, `6M`, `1Y`, `ALL`) and currency toggles, backed by the deterministic reporting engine.
- `/dashboard`: Mounted `IncomeSourcesBreakdown` component showing 6-month realized income structure by currency.
- `exportTransactionsToCSV`: Includes Income Source and Stream columns for comprehensive audit exports.
- `tests/phase9-transaction-attribution-ui.test.ts`: 25 unit tests verifying differential mutation payloads, attribution rules, and stale stream normalization.
- `scripts/verify-phase9-ui.mjs`: Fail-closed automated verifier confirming all 41 UI/UX contract assertions pass (`PHASE_9_UI_GATE=PASS`).

### 3. Phase 9 Final Production Closure
Phase 9 is formally closed following human-authenticated production persistence smoke and independent database verification (`docs/receipts/PHASE_9_CLOSURE.md`).

---

# Phase 10 — AI Foundation (Pass A Implementation)
Status: **IN_PROGRESS (PASS_CODE_ONLY)**

### Completed Implementation:
- **Provider-Neutral Abstraction (`src/lib/ai/`):** Implemented core contracts `AiProvider`, `AiRequest` (discriminated union for text vs structured), `AiProviderExecutionRequest`, `AiExecutionContext`, `AiUsage`, and `AiProviderResponse`.
- **AI Router (`src/lib/ai/router.ts`):** Central dispatch engine with strict fail-closed unknown operation handling, single source of truth for model identifiers, central generation config propagation (temperature, maxOutputTokens, timeoutMs), caller `AbortSignal` and timeout orchestration, duplicate provider rejection, and runtime schema validation without unvalidated generic casts.
- **Central Model Configuration (`src/lib/ai/config.ts`):** Single authority for operation mappings (`transaction_parser`, `categorization`, `financial_assistant`, `receipt_vision`, `report_summary`), default model `gemini-2.5-flash`, and operational parameters including `maxOutputTokens`.
- **Gemini Provider Architecture (`src/lib/ai/providers/`):** Split into `gemini-core.ts` (100% testable, zero-network logic with injectable client factory and responseJsonSchema mapping) and `gemini.ts` (strict build-time `server-only` production adapter wrapping `@google/genai` pinned to `2.19.0`).
- **Fail-Closed Structured Output Validation (`src/lib/ai/structured-result.ts`):** Deterministic runtime validation using `AiOutputValidator<T>`, markdown code block unwrapping, fail-closed empty response detection, and exact string decimal validation for money types.
- **Error Taxonomy & Sanitization (`src/lib/ai/errors.ts`):** Comprehensive error classification (`AI_NOT_CONFIGURED`, `AI_PROVIDER_UNAVAILABLE`, `AI_AUTH_FAILED`, `AI_RATE_LIMITED`, `AI_TIMEOUT`, `AI_ABORTED`, `AI_INVALID_REQUEST`, `AI_INVALID_RESPONSE`, `AI_STRUCTURED_OUTPUT_INVALID`, `AI_PROVIDER_ERROR`) with automatic redaction of API keys, Bearer tokens, and auth headers.
- **Server Boundary Enforcement (`src/lib/ai/server.ts`, `src/features/ai/server.ts`):** Uses build-time `import 'server-only'` boundary, while `src/features/ai/index.ts` remains 100% client-safe.
- **Deterministic Unit Test Suite (`tests/phase10-ai-foundation.test.ts`):** 47 automated unit tests passing across all foundation modules without real network calls or environment credentials.
- **Static Source Verifier (`scripts/verify-phase10-source.mjs`):** 38 automated architecture checks passing.

## Next Recommended Action
Independent audit of Phase 10 source, verifier, and test assertions before Phase 10 receipt and closure.

```text
PHASE_8_OVERALL=PASS
FINORA_PHASE_8=PASS

PHASE_9_AUTHORIZED=true
PHASE_9_SCOPE=INCOME_SOURCES_REVENUE_ATTRIBUTION
PHASE_9_CONTRACT=PASS
PHASE_9_IMPLEMENTATION_AUTHORIZED=true

PHASE_9_SOURCE_GATE=PASS
PHASE_9_REMOTE_DATABASE=PASS
PHASE_9_STRUCTURAL_GATE=PASS
PHASE_9_TWO_USER_RLS=PASS
PHASE_9_UI_GATE=PASS
PHASE_9_LIVE_PERSISTENCE_SMOKE=PASS
PHASE_9_PRODUCTION_PERSISTENCE_EVIDENCE_GATE=PASS
PHASE_9_SMOKE_CLEANUP=PASS

PHASE_9_OVERALL=PASS
FINORA_PHASE_9=PASS

PHASE_10_AUTHORIZED=true
PHASE_10_SCOPE=AI_FOUNDATION_PROVIDER_ABSTRACTION_ROUTER_STRUCTURED_RESULTS
PHASE_10_CONTRACT=PASS
PHASE_10_IMPLEMENTATION_AUTHORIZED=true

PHASE_10_FINAL_CORRECTIVE_SOURCE=PASS_CODE_ONLY

PHASE_10_SOURCE_GATE=PENDING_INDEPENDENT_AUDIT
PHASE_10_SERVER_BOUNDARY_GATE=PENDING_INDEPENDENT_AUDIT
PHASE_10_STRUCTURED_RESULT_GATE=PENDING_INDEPENDENT_AUDIT
PHASE_10_PROVIDER_ROUTER_TEST_GATE=PENDING_INDEPENDENT_AUDIT
PHASE_10_NON_REGRESSION_GATE=PENDING_INDEPENDENT_AUDIT

PHASE_10_REMOTE_DATABASE=NOT_APPLICABLE
PHASE_10_STRUCTURAL_DB_GATE=NOT_APPLICABLE
PHASE_10_TWO_USER_RLS=NOT_APPLICABLE
PHASE_10_LIVE_PERSISTENCE_SMOKE=NOT_APPLICABLE

PHASE_10_OVERALL=PARTIAL

PHASE_11_AUTHORIZED=false
PHASE_12_AUTHORIZED=false
```
