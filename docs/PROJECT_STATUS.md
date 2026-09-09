# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 13B-1 — Debt & Liability Management
- **Phase status:** Phase 12A: CLOSED / PASS | Phase 12B-1/2/3: CLOSED / PASS | Phase 12C: IMPLEMENTED / PRODUCTION DEPLOYED | Phase 13A: CLOSED / PASS WITH FOLLOW-UPS | Phase 13B-1: CLOSED / PASS
- **Phase 12B contract:** `docs/PHASE_12B_CONTRACT_DISCOVERY.md`
- **Phase 12B status:** CLOSED / PASS (`PHASE_12B_1_2_3_STATUS = COMPLETE_RUNTIME_VERIFIED`)
- **Phase 12B runtime closure receipt:** `docs/receipts/PHASE_12B_RUNTIME_CLOSURE.md`
- **Post-test production data reset:** PASS (test financial/planning rows cleared; current owner accounts and recurring items retained; auth identities and default categories preserved)
- **Phase 12C implementation:** COMPLETE / PRODUCTION_DEPLOYED
- **Phase 13A closure receipt:** `docs/receipts/PHASE_13A_CLOSURE.md`
- **Phase 13A status:** CLOSED / PASS WITH FOLLOW-UPS (production readiness audit complete; no code or database mutation)
- **Next recommended phase:** Continue product QA and UX follow-ups after Phase 13B-1 closure
- **Accepted Phase 12A implementation SHA:** `8430212af02417a79dcc0a2f048437b719d0d186`
- **Accepted Phase 12A implementation tree:** `0d6369fae0fa23485e6e371ade7ec36a8551bf1a`
- **Phase 12A production deployment:** `dpl_3cajAVrkUEtNcWfSYAzEgoSAjYwt`
- **Phase 12A closure receipt:** `docs/receipts/PHASE_12A_CLOSURE.md`
- **Phase 12A test suite:** `tests/phase12a-transaction-draft.test.ts` (36/36 PASS)
- **Phase 12A source verifier:** `scripts/verify-phase12a-source.mjs` (110/110 PASS)
- **Phase 12A functional / runtime gate:** PASS
- **Phase 12A parser model:** `gemini-3.5-flash-lite` (exact stable ID fallback)
- **Phase 11 migration status:** APPLIED (`supabase/migrations/20260903110000_phase_11_ai_credentials.sql`)
- **Phase 11 remote database:** PASS
- **Phase 11 structural gate:** PASS
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 11 completion SHA:** `8e5e8c56e583516e9d5008e3c2f658349f94cb80`
- **Phase 11 closure receipt:** `docs/receipts/PHASE_11_CLOSURE.md`
- **Phase 11 structural receipt:** `docs/receipts/PHASE_11_STRUCTURAL_GATE.md`
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

# Phase 10 — AI Foundation
Status: **CLOSED (PASS)**

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
- **Formal Phase 10 Closure Receipt:** `docs/receipts/PHASE_10_CLOSURE.md`

## Phase 11 — AI Credentials
Status: **CLOSED (PASS)**
- **Contract Discovery Document:** `docs/PHASE_11_CONTRACT_DISCOVERY.md`
- **Selected Storage Architecture:** `PRIVATE_SCHEMA_APPLICATION_AES_256_GCM_SERVICE_ROLE_RPC`
- **Migration `20260903110000_phase_11_ai_credentials.sql`:** APPLIED in production database
- **Structural Verifier:** `scripts/verify-phase11-structural.sql` (Comprehensive production assertion script verifying full migration contract)
- **Runtime Verifier:** `scripts/verify-phase11-runtime.mjs` (Automated deterministic checks PASS)
- **Source Gate Verifier:** `scripts/verify-phase11-source.mjs` (Hardened static gate with 99 checks PASS)
- **UI & Server Actions Verifier:** `scripts/verify-phase11-ui.mjs` (56 security, UI layout, and architecture checks PASS)
- **Test Suite:** `tests/phase11-ai-credentials.test.ts` (79/79 tests PASS, async runner fail-closed)
- **Actions Test Suite:** `tests/phase11-ai-credential-actions.test.ts` (21/21 unit tests PASS, verifying strict deferred repository factory ordering and chronological event execution)
- **Pass B Implementation:**
  - Authenticated Personal Credential Management via `'use server'` action layer (`src/features/ai/credentials/actions.ts`) with deferred repository factory instantiation
  - Admin-Assigned Credential Management with strict `verifyAdminActor` checks and exact email resolution
  - Safe Metadata DTO (`AiCredentialSafeMetadata`) exposing zero cryptographic material or secrets
  - Settings UI (`src/app/settings/page.tsx`) integrated with real server actions and password-masked inputs
  - Admin UI (`src/app/admin/page.tsx`) with admin verification banner, target lookup, neutral server-side system key presentation, and credential assignment/revocation
  - Phase 11 Structural Gate Receipt: `docs/receipts/PHASE_11_STRUCTURAL_GATE.md`
- **Key Hint Handling:** Bounded length 1..4, ASCII printable only, never equals plaintext, fail-closed rejection at wire/database validation, defensive fallback in metadata DTO.
- **Production Runtime & Live Persistence Evidence:**
  - `PHASE_11_PERSONAL_LIVE_PERSISTENCE=PASS` (Authenticated personal credential encryption and database persistence verified)
  - `PHASE_11_PERSONAL_REVOKE_ZEROIZATION=PASS` (Cryptographic material zeroization and revocation verified)
  - `PHASE_11_NON_ADMIN_DENY_RUNTIME=PASS` (Non-admin access strictly denied at runtime)
  - `PHASE_11_ADMIN_AUTHORITY_RUNTIME=PASS` (Admin authority verified via environment allowlist)
  - `PHASE_11_ADMIN_LOOKUP_RUNTIME=PASS` (Admin exact user lookup verified)
  - `PHASE_11_ADMIN_ASSIGNED_STORAGE=PASS` (Admin-assigned credential encrypted envelope storage verified)
  - `PHASE_11_ADMIN_ASSIGNED_USER_RESOLUTION=PASS` (Target user credential resolution verified)
  - `PHASE_11_ADMIN_ASSIGNED_REVOKE_ZEROIZATION=PASS` (Admin-assigned credential revocation and zeroization verified)
  - `PHASE_11_TWO_USER_RUNTIME=PASS` (Two-user runtime isolation and resolution verified)
  - `PHASE_11_ADMIN_ASSIGNED_RUNTIME=PASS` (Full admin-assigned workflow verified in production)
- **UI Governance & Smoke Acceptance:**
  - `PHASE_11_UI_GOVERNANCE_CORRECTIVE=PASS` (System Key state-neutral card, zero-leak boundary verified)
  - `PHASE_11_FINAL_UI_SMOKE=PASS` (Independent production UI smoke accepted on deployed source SHA `50d9cd1ba40d48e34ffa1982d18c58e2a37c16a1`)
  - `PHASE_11_CLOSURE_RECEIPT=docs/receipts/PHASE_11_CLOSURE.md`
- **Historical Audit Record:** Pass B interim state prior to final UI smoke and closure was `PHASE_11_OVERALL=PARTIAL`.

## Phase 12A — Natural-Language Transaction Draft & Smart Category Suggestion
Status: **IMPLEMENTATION_COMPLETE / OFFLINE_VERIFIED**
- **Test Suite:** `tests/phase12a-transaction-draft.test.ts` (25/25 PASS)
- **Scope Implemented:**
  - Authenticated server action `parseTransactionDraftAction(promptText)` (`import 'server-only'`).
  - Read candidate context via authenticated RLS client with overflow failsafe caps (`accounts: 30`, `categories: 50`, `incomeSources: 20`, `incomeStreams: 30`, max label length: 50 chars).
  - Model boundary opaque tokenization (`ACC_n`, `CAT_n`, `SRC_n`, `STR_n`); database UUIDs are never sent to model.
  - Strict 11-property exact keyset schema validation (`AiTransactionParseOutputValidator`) with zero coercion (`PHASE_12A_OUTPUT_VALIDATOR_EXACT_KEYSET=true`, `PHASE_12A_OUTPUT_VALIDATOR_COERCION=false`).
  - Server domain cross-validation (`crossValidateTransactionDraft`) for exact string decimal amount, type safety, token-to-UUID resolution, currency precedence, category type alignment, stream parent alignment, and deterministic warning code generation.
  - Client component `AiTransactionDraftInput` integrated into `AddTransactionModal`, providing text input, draft preview, and "Áp dụng vào biểu mẫu" action.
  - Zero financial write capability in AI layer (`PHASE_12A_AI_FINANCIAL_WRITE_CAPABILITY=false`).
  - Applying draft sets form state only, zero automatic database mutations (`PHASE_12A_UI_APPLY_MUTATION=false`).
  - Human-readable Vietnamese localized error messages for all AI failure codes.
  - Offline test suite with 25 unit/integration assertions (`REAL_GEMINI_NETWORK_CALL=false`).

## Next Recommended Action
Independent audit and live smoke testing of Phase 12A Natural-Language Transaction Draft before proceeding to Phase 12B.

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

PHASE_10_SOURCE_GATE=PASS
PHASE_10_SERVER_BOUNDARY_GATE=PASS
PHASE_10_STRUCTURED_RESULT_GATE=PASS
PHASE_10_PROVIDER_ROUTER_TEST_GATE=PASS
PHASE_10_NON_REGRESSION_GATE=PASS

PHASE_10_REMOTE_DATABASE=NOT_APPLICABLE
PHASE_10_STRUCTURAL_DB_GATE=NOT_APPLICABLE
PHASE_10_TWO_USER_RLS=NOT_APPLICABLE
PHASE_10_LIVE_PERSISTENCE_SMOKE=NOT_APPLICABLE

PHASE_10_OVERALL=PASS
FINORA_PHASE_10=PASS

PHASE_11_AUTHORIZED=true
PHASE_11_SCOPE=AI_CREDENTIALS
PHASE_11_STORAGE_ARCHITECTURE=PRIVATE_SCHEMA_APPLICATION_AES_256_GCM_SERVICE_ROLE_RPC
PHASE_11_CONTRACT=PASS
PHASE_11_IMPLEMENTATION_AUTHORIZED=true

PHASE_11_MIGRATION_STATUS=APPLIED
PHASE_11_REMOTE_DATABASE=PASS
PHASE_11_STRUCTURAL_GATE=PASS
PHASE_11_PRODUCTION_CREDENTIAL_ROW_COUNT_AT_LAST_AUDIT=0
PHASE_11_SOURCE_GATE=PASS
PHASE_11_TEST_SUITE=PASS
PHASE_11_TYPECHECK=PASS
PHASE_11_LINT=PASS
PHASE_11_BUILD=PASS

PHASE_11_PERSONAL_LIVE_PERSISTENCE=PASS
PHASE_11_PERSONAL_REVOKE_ZEROIZATION=PASS

PHASE_11_NON_ADMIN_DENY_RUNTIME=PASS
PHASE_11_ADMIN_AUTHORITY_RUNTIME=PASS
PHASE_11_ADMIN_LOOKUP_RUNTIME=PASS

PHASE_11_ADMIN_ASSIGNED_STORAGE=PASS
PHASE_11_ADMIN_ASSIGNED_USER_RESOLUTION=PASS
PHASE_11_ADMIN_ASSIGNED_REVOKE_ZEROIZATION=PASS

PHASE_11_TWO_USER_RUNTIME=PASS
PHASE_11_ADMIN_ASSIGNED_RUNTIME=PASS

PHASE_11_UI_GOVERNANCE_CORRECTIVE=PASS
PHASE_11_FINAL_UI_SMOKE=PASS
PHASE_11_OVERALL=PASS
FINORA_PHASE_11=PASS

PHASE_12A_AUTHORIZED=true
PHASE_12A_SCOPE=NATURAL_LANGUAGE_TRANSACTION_DRAFT_AND_SMART_CATEGORY
PHASE_12A_STATUS=PERFORMANCE_AND_MONEY_CORRECTIVE_PENDING_INDEPENDENT_AUDIT
PHASE_12A_CORRECTIVE_PASS_1=PASS
PHASE_12A_CORRECTIVE_PASS_2=PASS
PHASE_12A_LIVE_SMOKE_ATTEMPT_1=AI_STRUCTURED_OUTPUT_INVALID
PHASE_12A_LIVE_SMOKE_ATTEMPT_1_FINANCIAL_MUTATION=false
PHASE_12A_TRANSACTION_PARSER_MODEL=gemini-3.5-flash-lite
PHASE_12A_MODEL_POLICY_CORRECTIVE=PASS
PHASE_12A_PERFORMANCE_AND_MONEY_CORRECTIVE=PENDING_INDEPENDENT_AUDIT
PHASE_12A_LIVE_GEMINI_PARSE=PASS
PHASE_12A_PARSE_APPLY_ZERO_MUTATION=PASS
PHASE_12A_OVERALL=PARTIAL
PHASE_12B_IMPLEMENTATION_AUTHORIZED=false
PHASE_12C_IMPLEMENTATION_AUTHORIZED=false
PHASE_12A_TEST_SUITE=23_OF_23_PASS
PHASE_12A_SOURCE_VERIFIER=83_OF_83_PASS
PHASE_12A_TYPESCRIPT=PASS
PHASE_12A_LINT=PASS
PHASE_12A_BUILD=PASS
PHASE_12A_SCHEMA_MUTATION=NONE
PHASE_12A_FINANCIAL_MUTATION_AUTHORITY=ZERO
```

## Phase 12A — Natural-Language Transaction Draft (Performance & Money Presentation Corrective)

### Status: PERFORMANCE_AND_MONEY_CORRECTIVE / PENDING_INDEPENDENT_AUDIT (Overall: PARTIAL)

- **Production Live Evidence Analysis:**
  - In production real Gemini smoke on `gemini-3.5-flash-lite`, the model returned a valid transaction draft (`PHASE_12A_LIVE_GEMINI_PARSE=PASS`).
  - Database verification confirmed `PRE_PARSE_TRANSACTION_COUNT=14` and `AFTER_PARSE_AND_APPLY_TRANSACTION_COUNT=14` (`PHASE_12A_PARSE_APPLY_ZERO_MUTATION=PASS`).
  - Explicit save smoke remains pending.
- **Correctives Applied:**
  1. **Money Preview Presentation**:
     - Created `formatMoneyWithCode` in `src/lib/money/format.ts` and exported via `src/lib/money/index.ts`.
     - Uses string-based integer/fractional separation and `groupThousands` without `Number` or `parseFloat` floating-point conversions.
     - Updated `AiTransactionDraftInput.tsx` preview badge: VND displays as `85.000 VND` (eliminating raw storage `.0000`), USD displays as `4.50 USD`.
     - Preserves existing money input behavior (`MONEY_INPUT_VND_GROUPING_UNCHANGED=true`).
  2. **Latency Reduction via Parallel Concurrency**:
     - Refactored `readCandidateContext` in `src/features/ai/transaction-draft/candidates.ts` to query `accounts`, `categories`, and `income_sources` concurrently via `Promise.all`.
     - Refactored `parseTransactionTextCore` in `src/features/ai/transaction-draft/action-core.ts` to query `user_settings` and candidate context concurrently via `Promise.all`.
     - Refactored `revalidateResolvedCandidates` in `src/features/ai/transaction-draft/domain.ts` to query accounts, categories, sources, and streams concurrently via `Promise.all`.
     - Preserved all fail-closed invariants via `ContextLoadError` checks on query errors.
  3. **Privacy-Safe Structured Timing Telemetry**:
     - Defined `AiTimingTelemetry` in `src/features/ai/transaction-draft/types.ts`.
     - Added `emitTimingTelemetry` helper in `src/features/ai/transaction-draft/action-core.ts`.
     - Captures `context_ms`, `ai_provider_ms`, `revalidation_ms`, and `total_ms`.
     - Emits structured `FINORA_AI_TIMING` telemetry event.
     - Strict privacy guarantees: zero prompts, zero user IDs, zero merchant names, zero notes, zero emails, zero raw responses, zero API keys, zero credentials.
  4. **Strict Architectural Invariants Preserved**:
     - Kept exact model `gemini-3.5-flash-lite`.
     - Post-AI cross-validation, currency matching, and candidate revalidation fully preserved.
     - Zero financial mutations, zero migrations, zero third-party dependencies added.

### Verification Results (Performance & Money Presentation Corrective)
- **Phase 12A Test Suite (`tests/phase12a-transaction-draft.test.ts`)**: 23/23 PASS
  - Added Test 21: Money formatting boundary verified (eliminates raw `.0000`, exact locale formatting).
  - Added Test 22: Concurrent query fail-closed resilience verified across all parallel branches.
  - Added Test 23: Privacy-safe timing instrumentation verified (structured timing present, zero sensitive leakage).
- **Phase 12A Source Verifier (`scripts/verify-phase12a-source.mjs`)**: 83/83 PASS
  - Verified `MONEY_WITH_CODE_EXPORTED`, `EXACT_MONEY_NO_FLOAT_CONVERSION`, `AI_PREVIEW_NO_RAW_EXACT_MONEY`.
  - Verified `CONCURRENT_CANDIDATE_READS`, `CONCURRENT_PRE_AI_READS`, `CONCURRENT_POST_AI_REVALIDATION`.
  - Verified `TIMING_INSTRUMENTATION_PRESENT` and `PRIVACY_SAFE_TELEMETRY`.
- **Phase 10 Test Suite (`tests/phase10-ai-foundation.test.ts`)**: 50/50 PASS
- **Phase 10 Source Verifier (`scripts/verify-phase10-source.mjs`)**: 38/38 PASS
- **Phase 11 Test Suite (`tests/phase11-ai-credentials.test.ts`)**: 79/79 PASS
- **Phase 11 Action Core Test Suite (`tests/phase11-ai-credential-actions.test.ts`)**: 21/21 PASS
- **Phase 11 Source Verifier (`scripts/verify-phase11-source.mjs`)**: 99/99 PASS
- **TypeScript Check (`npm run typecheck`)**: PASS
- **Lint Check (`npm run lint`)**: PASS
- **Production Build (`compile_applet`)**: PASS
- **Database Schema**: 0 migrations added, schema strictly unchanged

### Next Recommended Step
- Independent audit of the Performance & Money Presentation Corrective prior to live explicit-save smoke test.

## Phase 12A — Natural-Language Transaction Draft & Deterministic Fast Path

### Status: CLOSED / PASS (Phase 12 Overall: PARTIAL)

- **Phase 12A Closure Receipt:** `docs/receipts/PHASE_12A_CLOSURE.md`
- **Accepted Phase 12A Implementation SHA:** `8430212af02417a79dcc0a2f048437b719d0d186`
- **Accepted Phase 12A Implementation Tree:** `0d6369fae0fa23485e6e371ade7ec36a8551bf1a`
- **Production Deployment:** `dpl_3cajAVrkUEtNcWfSYAzEgoSAjYwt` (Status: `READY`)
- **Live Origin:** `https://finora-orpin-nu.vercel.app`

- **Implementation Summary:**
  1. **AI-Assisted, Never AI-Dependent:** Full drafting workflow creates interactive drafts only. Zero financial mutation authority during parse/preview/apply. Explicit user save required to persist.
  2. **Deterministic Fast Path:** Bypasses LLM network calls entirely for high-confidence Vietnamese & multi-currency inputs with 0 credential resolution, 0 router calls, and canonical string-based `numeric(20,4)` exact money formatting.
  3. **Atomic Monetary Token Parsing:** Correctly parses and binds attached ISO codes, names, and symbols (`4.50USD`, `4.50EUR`, `120.000d`, `$4.50`, `€100`).
  4. **Adversarial & Ambiguity Fail-Safes:** Fails closed to the single-call `gemini-3.5-flash-lite` fallback on conflicting currencies, multiple amounts, ranges, corrections, multi-transactions, partial dates, or conflicting date claims.
  5. **Post-Parse Authenticated Revalidation:** Validates all candidate accounts, categories, and income streams against active RLS-scoped user data.

### Verification Results (Phase 12A Closure Baseline)
- **Phase 12A Test Suite (`tests/phase12a-transaction-draft.test.ts`)**: 36/36 PASS
- **Phase 12A Source Verifier (`scripts/verify-phase12a-source.mjs`)**: 110/110 PASS
- **Phase 10 Test Suite (`tests/phase10-ai-foundation.test.ts`)**: 50/50 PASS
- **Phase 11 Test Suite (`tests/phase11-ai-credentials.test.ts`)**: 79/79 PASS
- **TypeScript Check (`npm run typecheck`)**: PASS
- **Lint Check (`npm run lint`)**: PASS
- **Production Build (`compile_applet`)**: PASS
- **Live Gemini Production Smoke:** `PHASE_12A_LIVE_GEMINI_PARSE=PASS`, `PHASE_12A_PARSE_APPLY_ZERO_MUTATION=PASS`
- **Deterministic Production Smoke:** `PHASE_12A_FAST_PATH_REAL_SMOKE=PASS` (~81.8% server latency reduction, 0 AI calls, 0 mutations)
- **Explicit Save Production Smoke:** `PHASE_12A_EXPLICIT_SAVE_SMOKE=PASS` (1 created row, 0 duplicates)
- **Phase 12A Functional / Runtime Gate:** PASS
- **Phase 12A Overall:** PASS (CLOSED)

### Next Recommended Step
- Execute the separately authorized Phase 12B-Runtime production gates; do not close Phase 12B before all three runtime receipts pass.

## Phase 12B — Receipt Vision (Foundation & Corrective Implementation)

### Status: PENDING_RUNTIME (`PHASE_12B_1_2_3_STATUS = IMPLEMENTED_AUDITED_PENDING_RUNTIME`)

- **Phase 12B Contract Document:** `docs/PHASE_12B_CONTRACT_DISCOVERY.md`
- **Current Phase:** Phase 12B-3 Corrective Pass 7 — Runtime-Safe Telemetry, Fixed Public Errors, Delimiter Collision Defense, and Exact Contract Verifier
- **Branch:** `review/phase12b-1-receipt-vision`
- **Audit State:** Independent exact-head audit PASS at implementation SHA `e08a88e1e4fb8e161de73f38e8fefb3c494231bf`, tree `13dbdccc3c0581b68ed90a79562acdb20999dd37`; Pass 12B-Runtime remains pending

- **Correctives Completed in Pass 7:**
  1. **Exact fixed public errors:** `ReceiptVisionError` accepts only an exact code and derives its browser-safe message from an immutable map. The exact taxonomy is `AUTH_REQUIRED`, `RECEIPT_FILE_REQUIRED`, `RECEIPT_FILE_TOO_LARGE`, `RECEIPT_FILE_TYPE_UNSUPPORTED`, `RECEIPT_FILE_INVALID`, `RECEIPT_IMAGE_TOO_LARGE`, `RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED`, `RECEIPT_IMAGE_NORMALIZED_TOO_LARGE`, and `RECEIPT_IMAGE_DECODE_FAILED`.
  2. **Delimiter collision defense:** Category labels containing either reserved prompt delimiter are neutralized before JSON serialization; opaque tokens remain the only identifiers exposed to the provider.
  3. **Runtime-safe telemetry:** The Section 17.3 schema is reconstructed from runtime-validated enums and finite non-negative integer timings. Unknown keys are discarded, invalid allowed-key values fail closed, pre-decode formats/dimensions are omitted, and `document_kind` is emitted only for validated success events.
  4. **Request-scoped telemetry isolation:** Removed the mutable process-global sink. Synchronous and asynchronous sink failures are caught and cannot alter receipt-analysis results or produce unhandled rejections.
  5. **Same-user category defense in depth:** Candidate loading and post-parse revalidation now require the authenticated `userId` predicate in addition to database RLS.
  6. **Exact verifier coverage:** `scripts/verify-phase12b-source.mjs` maps and reports every one of the 91 names in Contract Section 19.2. Runtime closure remains explicitly pending rather than being represented as complete.

### Verification Results (Pass 7)
- **Phase 12B Source Verifier (`scripts/verify-phase12b-source.mjs`)**: 91/91 PASS
- **Receipt Vision & Verifier Tests (`npm test`)**: 31/31 tests PASS (0 failed)
- **TypeScript (`npm run typecheck`)**: PASS (0 errors)
- **Lint (`npm run lint`)**: PASS (0 errors)
- **Production Build (`compile_applet` / `npm run build`)**: PASS
- **Full Repository Regression:** PASS (Phase 10, Phase 11, Phase 12A, Phase 12B, Phase 8, and Phase 9 suites; 0 failures)
- **Lockfiles & Dependencies:** `package-lock.json` and `bun.lock` unchanged; `sharp` remains pinned to `0.35.4`; zero direct `zod` dependency.
- **Database / Storage / Live AI:** Zero database mutations, zero storage writes, and zero real Gemini calls.

### Independent Exact-Head Audit Receipt
- **Audited implementation SHA:** `e08a88e1e4fb8e161de73f38e8fefb3c494231bf`
- **Audited implementation tree:** `13dbdccc3c0581b68ed90a79562acdb20999dd37`
- **Audit environment:** Fresh single-branch clone from GitHub; clean worktree; `npm ci` installed 495 packages without lockfile mutation.
- **Scope verification:** Exactly 11 declared Pass 7 files changed; no package, lockfile, Next.js configuration, or migration changes.
- **Independent gates:** `npm test` 31/31 PASS; full repository regression 0 failures; typecheck, lint, and production build PASS; Phase 10/11/12A/12B source verifiers PASS at 38/38, 99/99, 110/110, and 91/91.
- **Supabase security review:** Server-side `auth.getUser()` precedes file processing and privileged factories; category reads and revalidation use the request-scoped authenticated client, RLS, and an explicit authenticated `user_id` predicate.
- **Deployment check:** Vercel status SUCCESS for the audited implementation SHA.
- **Audit verdict:** PASS with no open static findings. Runtime acceptance is intentionally not inferred from static or mocked tests.

### Mandatory Runtime Gates Still Pending
- Authenticated near-4-MiB Vercel Server Action transport smoke.
- Live receipt-analysis verification with zero financial mutations.
- Explicit standard Save verification proving exactly one transaction mutation and zero duplicates.

### Next Recommended Step
- Execute the separately authorized Pass 12B-Runtime. Do not mark Phase 12B complete until near-limit transport, zero-mutation Analyze, and exactly-one-mutation explicit Save all pass.

## Phase 12B — Receipt Vision UI Corrective Pass 8

### Status: IMPLEMENTED / PRODUCTION_DEPLOYED / PENDING_RUNTIME_VERIFICATION

- Replaced the low-emphasis text/receipt controls in `AddTransactionModal` with a mobile-first, icon-labelled `Nhập nhanh` / `Quét hóa đơn` selector. The receipt entry point is now visible immediately below the modal header and exposes its selected state through `aria-pressed`.
- Added mode-specific helper copy so users know that receipt mode accepts a camera capture or an existing image before opening the picker.
- Added a global scrollbar treatment for the full application and every nested scroll container: thin rounded thumb, transparent track, horizontal-scroll support, hover feedback, Firefox support, and a stable document gutter. The transaction modal additionally contains overscroll so mobile scrolling does not pull the page behind it.
- Added a deterministic source test covering the visible receipt entry point, accessible mode state, global WebKit/Firefox scrollbar rules, and stable document gutter.
- Verification: Phase 12B tests `32/32 PASS`; full repository regression `41/41 PASS`; Phase 12B exact source verifier `91/91 PASS`; TypeScript, ESLint, and production build `PASS`.
- Promoted via PR #1 squash merge to `main`: production commit `e63af217d351009744383b35cfaadde42fd8dcdf`.
- Vercel production deployment `dpl_CbT5D3fP1i82fmfP3bnoAfQ31nMa` reached `READY`; aliases include `https://finora-orpin-nu.vercel.app` and `https://finora-thanhtuyen662002s-projects.vercel.app`.
- Post-deploy Vercel runtime error check: no runtime errors found in the selected window.
- Phase 12B remains `PENDING_RUNTIME`; this UI corrective does not infer completion of the near-limit transport, zero-mutation Analyze, or exactly-one-mutation Save gates.

### Pre-Corrective Runtime Data Baseline (provided 2026-09-07)

- Transactions: `transaction_count=11`, `marker_count=0`, `transaction_fingerprint=b3ba24d1163cb88d3d311bceac98f70e`, `latest_created_at=2026-09-04 11:45:33.751761+00`.
- Accounts: `account_count=17`, `balance_fingerprint=11d14119ead920ebabdb6df4dc704b25`.
- Database/storage/live AI mutation during this corrective: `NONE`.

## Phase 12B — Receipt Vision UI Corrective Pass 9

### Status: PRODUCTION_DEPLOYED / PENDING_RUNTIME_VERIFICATION

- Replaced low-contrast amber warning chips in `ReceiptPicker` with an accessible warning panel: high-contrast light/dark surfaces, explicit border, warning icon, count badge, and one wrapped row per server-derived warning.
- Hardened the receipt error panel with a bordered red surface and dark-mode text/icon colors that remain readable against the background.
- Kept warning codes, server taxonomy, draft eligibility, and all receipt-analysis behavior unchanged; this is presentation-only.
- Added source assertions for the warning panel role/label, high-contrast classes, and long-message wrapping.
- Promoted to `main` in commit `dd19849e0afa78461b36fe9b7f22c0b0896a2962`. Vercel production deployment `dpl_7yrqR6ChQZWRwnurqYxrasNGdMXb` reached `READY` and serves `https://finora-orpin-nu.vercel.app`.
- Post-deploy verification: production returned HTTP `200`; Vercel reported no runtime errors in the selected verification window. Runtime Phase 12B acceptance remains separate and is not inferred from this visual patch.

## Phase 12B — Application Notification Theme Corrective Pass 10

### Status: IMPLEMENTED / PENDING_PRODUCTION_DEPLOYMENT

- Added shared `finora-notice-error`, `finora-notice-warning`, and `finora-notice-success` palettes with explicit light/dark foreground, background, and border pairs.
- Applied the palette to receipt analysis errors/warnings, transaction draft notices, authentication forms, account/budget/goal/recurring/transfer modals, dashboard/report fallbacks, settings, income sources, and admin feedback surfaces.
- Added alert/status semantics to dynamically rendered messages and removed dark-theme-incompatible hardcoded light surfaces such as the dashboard unavailable-rate card.
- Receipt-analysis behavior, warning taxonomy, draft-only semantics, authentication ordering, database/storage boundaries, and live AI-call policy are unchanged.
- Verification: TypeScript, ESLint, Phase 12B deterministic/source tests, and production build all pass locally. Production deployment and runtime verification remain separate follow-up gates.

## Phase 12C — Read-Only Financial Assistant & Report Summaries

### Status: IMPLEMENTED / PRODUCTION_DEPLOYED

- Added an authenticated server action for explicit financial questions and report summaries using the existing Phase 10 router and Phase 11 credential resolver.
- The model boundary receives only a bounded deterministic report snapshot: no raw transaction rows, database UUIDs, credentials, or mutation tools.
- Added prompt-injection isolation, context byte limits, UUID rejection, output sanitization, and explicit Vietnamese read-only disclosure in the Reports screen.
- No migrations, database writes, storage uploads, or automatic AI execution were introduced. Financial mutations remain exclusively behind the standard explicit Save flow.
- Verification: Phase 12C contract tests 5/5, source verifier 14/14, TypeScript, ESLint, and production build PASS.
- Production commit: `ae5d89d737f10e3b79adf29f32f6a3b63f427a84`; Vercel deployment: `dpl_F7a8zGRaxcjxj9PhQHaXu6gAciuG`.


## Phase 12B — Final Runtime Closure and Production Data Reset (2026-09-08)

### Status: CLOSED / PASS

The separately pending production gates are now closed with authenticated live evidence:

- Near-limit receipt upload: PASS (`4,108,479` bytes, `2048 × 3072` JPEG, below the `4,194,304` byte file cap and `4,350,000` byte body budget).
- Live receipt analysis: PASS; the production draft returned `85000.0000 VND`, `2026-09-08`, `FINORA TEST MART`, and `Coffee, Sandwich`.
- Analyze/application mutation boundary: PASS; persistence occurred only through the standard explicit Save path.
- Explicit Save cardinality: PASS; each of two deliberate Save actions created exactly one row. The resulting two equal rows were intentional separate saves, not automatic duplication.
- Production Vercel login route: HTTP `200`.
- Vercel runtime errors in the latest 24-hour window: none.

Full evidence: `docs/receipts/PHASE_12B_RUNTIME_CLOSURE.md`.

### Authorized post-test reset

After runtime verification, the owner-authorized reset cleared all financial/test rows across all users:

- `accounts`, `transactions`, `transfers`, `budgets`, `goals`, `recurring_items`, `income_sources`, `income_source_streams`, and `transaction_fx_snapshots`: `0` rows.
- `categories`: `60` clean default rows (`12` per user).
- `auth.users`, `profiles`, and `user_settings`: preserved (`5` each).
- `storage.objects`: `0` rows.

No schema or source-code changes were made by the reset.

```text
PHASE_12B_NEAR_LIMIT_TRANSPORT=PASS
PHASE_12B_LIVE_ANALYZE=PASS
PHASE_12B_ANALYZE_FINANCIAL_MUTATION=false
PHASE_12B_EXPLICIT_SAVE_CARDINALITY=PASS
PHASE_12B_RUNTIME=PASS
PHASE_12B_DATABASE_RESET=PASS
PHASE_12B_OVERALL=CLOSED_PASS
```

## Phase 13A — Production Readiness Audit Closure

### Status: CLOSED / PASS WITH FOLLOW-UPS

Phase 13A is closed against the authoritative GitHub `main` head after a read-only production readiness audit. The audit did not modify source code, dependencies, migrations, Supabase data, Vercel configuration, or user-owned records.

- **Authoritative main SHA:** `a9fc465a3233a9d7f0436e6e73755eaeb1f51d9d`
- **Production deployment:** `dpl_CArAT7ydfutHLE8W7ExnstbUdTX7` (`READY`), source SHA matches `main`
- **Production origin:** `https://finora-orpin-nu.vercel.app`
- **Supabase project:** `qibfitbnlfgiqctntufr` (`ACTIVE_HEALTHY`)

### Closure evidence

- GitHub repository default branch is `main`; no open pull requests or issues were present at audit time.
- GitHub commit status for the authoritative head is successful through Vercel.
- Vercel production deployment is `READY`; `/`, `/login`, and protected `/reports` returned HTTP `200`.
- Vercel reported no runtime errors in the latest 24-hour window.
- All public user-owned tables have RLS enabled and ownership policies; all seven public derived views use `security_invoker=true`.
- The private credential schema has no grants to `anon`, `authenticated`, or `PUBLIC`.
- Supabase migration catalog contains 12 applied migrations through Phase 11.
- Current owner data is retained intentionally: `accounts=5` and `recurring_items=4`. These are not classified as test residue.
- Test/financial rows remain empty: `transactions=0`, `transfers=0`, `budgets=0`, `goals=0`, `income_sources=0`, `income_source_streams=0`, `transaction_fx_snapshots=0`, and `storage.objects=0`.
- Default categories remain intact: `categories=60` (`12` per authenticated user). Auth identities, profiles, and settings remain `5` each.

### Follow-ups carried into Phase 13B / maintenance

| ID | Finding | Priority | Disposition |
| --- | --- | --- | --- |
| F13A-SEC-01 | Supabase Leaked Password Protection is disabled. | P1 | Enable in Supabase Auth settings before broader user onboarding. |
| F13A-SEC-02 | `private.ai_credentials` has RLS enabled without a policy. The schema is not granted to client roles. | P2 | Add defense-in-depth policy or document the intentional private-schema boundary. |
| F13A-OPS-01 | No GitHub Actions workflow is present; release verification currently relies on Vercel status and recorded gates. | P2 | Add a minimal CI release gate for typecheck, lint, tests, and build. |
| F13A-OPS-02 | `.nvmrc` is `22`, package engines are `>=22`, while Vercel currently reports Node `24.x`. | P2 | Pin one supported major consistently and remove the build warning. |
| F13A-DOC-01 | `docs/ARCHITECTURE.md` and `docs/DATABASE.md` contain historical “not initialized/remote pending” status text. | P2 | Normalize documentation during the next docs pass. |
| F13A-PERF-01 | Supabase performance advisor reports 12 unindexed foreign keys and 9 unused indexes. | P3 | Defer index tuning until real usage justifies changes; no migration added in this audit. |
| F13A-HIST-01 | Older deployments recorded missing `SUPABASE_SERVICE_ROLE_KEY` errors on `/settings` and `/api/fx/transaction-snapshots`. | P3 | Recheck those routes during the next authenticated production smoke; latest 24h is clean. |

### Final constants

PHASE_13A_AUDIT=PASS
PHASE_13A_STATUS=CLOSED_PASS_WITH_FOLLOWUPS
PHASE_13A_CODE_MUTATION=NONE
PHASE_13A_DATABASE_MUTATION=NONE
PHASE_13A_DATA_RESET=PASS_OWNER_DATA_RETAINED
PHASE_13A_PRODUCTION_HEALTH=PASS
PHASE_13B_STATUS=CLOSED_PASS_PRODUCTION_DEPLOYED

### Next recommended action

Continue product QA and UX follow-ups after the Phase 13B-1 debt module deployment. Cross-currency repayment and separate principal/interest report classification remain explicitly deferred.


## Phase 13B-1 — Debt & Liability Management

### Status: COMPLETE / PRODUCTION DEPLOYED

This feature branch adds the first dedicated liability module. It does not alter existing owner data and does not require AI.

- Navigation: New Khoản nợ entry in the desktop and mobile application shell.
- Money input UX: Debt principal, minimum payment, and repayment fields use the shared exact `MoneyInput`; VND values group thousands with dots while canonical form values remain exact decimal strings.
- Debt records: Name, lender, debt type, principal, outstanding balance, currency, annual interest rate, minimum payment, due date, frequency, notes, and archive state.
- Payment ledger: Append-only debt_payments rows linked to one cash-flow transaction.
- Atomic repayment: record_debt_payment locks the debt, validates ownership/currency/category, creates the expense transaction, appends the payment event, and reduces principal outstanding in one database transaction.
- Exact money: PostgreSQL numeric(20,4) plus the existing exact-decimal client layer; no floating-point calculations.
- Isolation: RLS is enabled on debts and debt_payments; all views use security_invoker = true; payment mutation is RPC-only.
- Multi-currency boundary: A repayment account must match the debt currency in this first version. Cross-currency repayment remains a follow-up.
- Files: supabase/migrations/20260909000000_phase_13b_debt_management.sql, src/features/debts/, src/app/debts/page.tsx.

### Verification complete

- TypeScript: PASS (Vercel production build for main `eb194ab1c458e88bb5e3d79db1ff7a0f391adf00`).
- Migration: PASS — `phase_13b_debt_management` applied to Supabase project `qibfitbnlfgiqctntufr` (remote migration version `20260909020803`).
- Remote schema: PASS — `debts`, `debt_payments`, `debt_details`, `debt_payment_details`, and `transaction_details` exist; RLS is enabled on both debt tables; debt/payment row counts are 0.
- Production route: PASS — `/debts` returned HTTP 200 on `https://finora-orpin-nu.vercel.app`.
- Vercel production deployment: READY — `dpl_HmndHgqLmgvbHmmA6Vw9G4EqZGoR`.
- Owner financial data mutation: NONE. No test debt or payment rows were inserted; authenticated owner CRUD/payment smoke is reserved for the owner’s first real debt entry.

## Phase 13C — In-App Notification & Reminder Center

### Status: COMPLETE / PRODUCTION_DEPLOYED

Phase 13C turns the previous Settings placeholders into user-controlled, in-app financial notifications. The first release is deliberately on-demand: it derives a digest from the authenticated user's current budget and recurring-item views when the Notification Center is opened or refreshed. It does not run cron/queue jobs, send email or push notifications, or create transactions automatically.

- **Budget alerts:** enabled by default and shown at or above 80% of the active monthly category limit; over-budget categories use the critical presentation.
- **Recurring reminders:** enabled by default for active expense templates whose next due date is today through the next three calendar days.
- **Preferences:** `public.notification_preferences` stores only `budget_alerts_enabled` and `recurring_reminders_enabled`, with RLS and ownership checks for select/insert/update. No delete policy is exposed.
- **Navigation:** added `/notifications` to the desktop sidebar and mobile menu; Settings now exposes live switches and a shortcut to the center.
- **Data boundary:** all source queries remain authenticated and user-scoped through existing RLS views. Amounts remain exact decimal strings and are formatted only at presentation time.
- **Explicit non-goals:** no email/push channel, background scheduler, automatic transaction creation, read/unread persistence, or debt reminder channel in this first increment.

### Implementation files

- `supabase/migrations/20260909024359_phase_13c_notification_preferences.sql`
- `src/features/notifications/`
- `src/app/notifications/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/types/database.ts`

### Remote schema verification

- Migration `phase_13c_notification_preferences` applied to Supabase project `qibfitbnlfgiqctntufr`.
- `public.notification_preferences` exists with RLS enabled and exactly three ownership policies (select/insert/update).
- Existing financial rows were not inserted, updated, or deleted; the new preference table remains empty until an authenticated user opens Settings or the Notification Center.

### Verification complete

- Pull request #13 merged to `main` as implementation commit `25360d49d9f0029c7374286d3bd3e7f7db86b4f5`.
- Vercel production deployment `dpl_7eo8nX7mijoLzudKaeVZsa8fiWDJ` reached `READY`; the canonical aliases include `https://finora-orpin-nu.vercel.app`.
- Production build compiled TypeScript successfully and generated the new `/notifications` route; the public route returned HTTP 200.
- Vercel reported no runtime errors in the selected 24-hour window.
- Supabase migration `phase_13c_notification_preferences` is applied; RLS is enabled with exactly three ownership policies and no preference rows were created during deployment.
- Authenticated Settings persistence and digest rendering remain user smoke-test steps because this environment cannot impersonate the owner session.

### Next gate

Owner smoke test: open **Cài đặt → Thông báo & Cảnh báo**, toggle each switch, save, then open **Thông báo** and refresh.

---

## Phase 13D — Balance Privacy & Data Backup Export

**Status:** COMPLETE — merged to `main` and deployed to production

Verification receipt:
- GitHub PR #14 merged as `58e942be8ef5d13828f5f5e6415260b1ff5fa97b`.
- Vercel production deployment `dpl_HuD5rkiLYqrMe5NHByMXywnZhWSn` is READY and aliases `https://finora-orpin-nu.vercel.app`.
- Supabase migration `20260909025859_phase_13d_balance_privacy_and_backup` is applied; `mask_balance` is boolean, non-null, defaults to false, and authenticated column update privilege is verified.
- Production `/settings` responds successfully; no Vercel runtime errors were found in the verification window.

This phase adds two account-level capabilities:

- **Che số dư công cộng:** the `user_settings.mask_balance` preference is persisted per authenticated user. When enabled, account balances and dashboard/report financial summaries are replaced with a neutral mask (`••••••`) in the UI. Financial values in the database are unchanged, and transaction data remains intact.
- **Xuất bản sao lưu dữ liệu:** Settings can download a JSON backup containing only rows owned by the authenticated user: profile/settings, notification preferences, accounts, categories, transactions, transfers, FX snapshots, budgets, goals, recurring items, income sources/streams, debts, and debt payments. AI credentials and all private credential material are intentionally excluded.

The database change is additive and RLS-safe: `public.user_settings.mask_balance BOOLEAN NOT NULL DEFAULT FALSE` with authenticated-column update permission. The export runs in the browser after a fresh auth check, reads user-scoped rows through the existing Supabase client, creates a local JSON Blob, and revokes the object URL after download. No storage upload, server-side file persistence, or credential read is performed.

## Phase 13C Corrective — Notification Preference Write Grants

**Status:** COMPLETE — production hotfix applied and migration recorded

The Settings save error was traced to the remote Data API permissions for
`public.notification_preferences`. The three ownership RLS policies were
present, but the `authenticated` role had no effective schema/table
`INSERT` or `UPDATE` privilege, so the client upsert was rejected before
the RLS checks could authorize the owner row.

Resolution:

- Applied Supabase migration
  `20260909033350_phase_13c_notification_preferences_grants_fix`.
- Granted `USAGE` on schema `public` and `SELECT, INSERT, UPDATE` on
  `public.notification_preferences` to `authenticated`.
- Kept the existing owner-only RLS policies unchanged; anonymous access and
  cross-user rows remain blocked.
- Reloaded the PostgREST schema cache after the grant change.
- Verified remotely that `authenticated` has schema usage and all three
  required table privileges, while RLS remains enabled with exactly the
  select/insert/update ownership policies.

The source migration is committed at
`supabase/migrations/20260909033350_phase_13c_notification_preferences_grants_fix.sql`.

## Balance Privacy UX — Tap-to-Reveal

**Status:** COMPLETE — local reveal interaction added

When **Che số dư công cộng** is enabled, each masked monetary value can now
be tapped or clicked to reveal that value locally. A second click hides it
again; a double-click also ends in the revealed state. The persisted privacy
setting is never changed by this interaction.

- Reveal state is scoped to the individual value, so revealing one amount does
  not expose every balance on the page.
- Reveal state resets when the component unmounts or the privacy setting
  changes.
- Account cards, account detail, dashboard summaries, currency totals, report
  summaries, and report account previews use the same accessible control.
- No database writes, transaction mutations, or backup/export behavior are
  affected.

## Phase 13A Operations Hardening — Complete

The production smoke gate for the balance privacy and tap-to-reveal release passed on the canonical production origin.

This follow-up added:

- A GitHub Actions quality gate for pull requests and pushes to `main`, running `npm ci`, typecheck, ESLint, the deterministic test suite, and the production build.
- A single Node runtime contract: `.nvmrc`, `package.json`, and `package-lock.json` now pin the supported major to Node `22.x`.
- Historical architecture status text updated to reflect the deployed Phase 13B-1, 13C, and 13D modules.

Supabase Auth leaked-password protection remains an operator setting and is not changed by source-code commits.

```text
PHASE_13A_PRODUCTION_SMOKE=PASS_OWNER_ATTESTED
PHASE_13A_CI_RELEASE_GATE=PASS_MAIN_VERIFIED
PHASE_13A_NODE_RUNTIME=PINNED_22_X
PHASE_13A_LEAKED_PASSWORD_PROTECTION=OPERATOR_ACTION_REQUIRED
PHASE_13B_2=PLANNED
```
