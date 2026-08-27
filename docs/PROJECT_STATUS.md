# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 1 — UI Foundation
- **Phase status:** CORRECTIVE_REQUIRED
- **Last audited Phase 1 implementation commit:** `14ffe6ffa2aba010a06a157ff1f79fd0424e8605`
- **Phase 0 baseline:** `9f076d6b1c6b12fcb86cfadacf75698b5eca30c1`
- **Application code:** Next.js 16 App Router with responsive mock-data UI screens for all required top-level routes.
- **UI & Design system:** Tailwind CSS, shadcn/ui primitives, Lucide React icons, mobile bottom navigation and desktop sidebar.
- **Supabase integration:** Phase 0 SSR foundation preserved. Real Auth, tables, migrations, and RLS remain deferred to Phase 2.
- **AI integration:** Mock/admin presentation only. Real Gemini integration remains deferred to Phase 10-12.
- **PWA:** Deferred to Phase 15.

## Confirmed Completed

- All required Phase 1 top-level routes exist: `/login`, `/onboarding`, `/dashboard`, `/accounts`, `/transactions`, `/budgets`, `/goals`, `/recurring`, `/reports`, `/settings`, `/admin`.
- Typed presentation models and organized mock datasets exist under `src/types/finance.ts` and `src/lib/mock/`.
- Multi-currency presentation exists for VND, USD, EUR, JPY, CNY, and KRW.
- YouTube multi-channel income is represented in reports with original USD values and VND approximations.
- Desktop sidebar and mobile bottom navigation exist, including a local-only Quick Add transaction action.
- Local-only modal workflows exist for adding transactions, accounts, budgets, and goals.
- Phase 1 introduced no database migrations and did not modify the approved Supabase SSR foundation.
- New UI dependencies are limited to Radix/shadcn primitives; no additional state-management or large chart framework was introduced.

## Phase 1 Audit Findings Requiring Correction

### 1. Transactions filter UI is incomplete

The Phase 1 specification requires search plus date, account, category, type, and amount/direction filtering.

Current `TransactionList` only exposes search and transaction type controls. It contains internal category/account filter state, but no UI to change those filters, and no date filter or amount/direction sorting/filter control.

Required correction:
- expose account filter;
- expose category filter;
- add date/period filter suitable for desktop and mobile;
- add amount/direction sorting or filtering control;
- preserve mobile usability without a wide desktop-style toolbar.

### 2. Settings route is incomplete relative to the Phase 1 contract

Current `/settings` implements profile, currency/region, privacy/data export, and a few local switches, but the Phase 1 contract also requires visible settings concepts for:
- Appearance;
- Notifications;
- AI;
- Security.

`docs/PROJECT_STATUS.md` previously claimed `/settings` included AI key preferences, but the audited implementation does not contain an AI settings section. Documentation must match code.

Required correction:
- add lightweight mock sections/tabs/cards for Appearance, Notifications, AI, and Security;
- AI remains visual-only and must not persist credentials;
- no real Auth, Gemini, or secret handling may be introduced.

### 3. Mandatory loading-state coverage is missing

A reusable `Skeleton` primitive exists, but the required key screens do not currently expose reusable loading-state UI for:
- Dashboard;
- Transactions;
- Accounts;
- Reports.

Required correction:
- add reusable page/module skeleton components or route-level loading UI for these four screens;
- do not add artificial loading delays.

### 4. Empty-state coverage is incomplete

`TransactionList` has an empty state, but account and goal workflows do not yet provide the required user-friendly empty-state behavior when their local datasets/filter results are empty.

Required correction:
- Accounts empty state;
- Goals empty state;
- keep existing transaction empty state;
- use actionable Vietnamese copy rather than generic `No Data` text.

### 5. Admin visibility and mock-state wording need tightening

The normal `AppShell` exposes an Admin entry in the standard user's sidebar footer. Phase 1 requires `/admin` to be separate from normal standard-user navigation.

The admin shell also contains wording that can read as if RLS, realtime FX synchronization, and encrypted server credential storage are already operational, even though those capabilities are deferred.

Required correction:
- remove the Admin entry from normal user navigation;
- keep `/admin` directly reachable for Phase 1 preview;
- clearly label RLS, FX synchronization, AI secret storage, and related controls as planned/mock/not active in Phase 1;
- do not imply Phase 2+ backend security is already implemented.

### 6. Mock money conversion is inconsistent for newly created foreign accounts/transactions

The mock add-account and add-transaction handlers only convert USD correctly while the UI allows EUR, JPY, CNY, and KRW.

Required correction:
- centralize Phase 1 mock conversion through the existing mock FX-rate map/helper;
- do not create live FX calls;
- keep the logic clearly mock-only.

### 7. Type-safety cleanup

Phase 1 introduced `any` callback payloads in mock account/transaction creation paths.

Required correction:
- replace these with small presentation DTO/input types;
- avoid over-modeling the future database schema.

### 8. Documentation contains claims not supported by current code

The previous status file referenced money helpers such as `formatExchangeRate`, `getCurrencySymbol`, and `getCurrencyName`, but the audited implementation currently exports `formatMoney`, `formatConverted`, and `formatDateVN` instead.

Required correction:
- either implement only genuinely needed helpers or remove unsupported claims;
- documentation must describe the code that actually exists.

## Non-Blockers / Accepted Phase 1 Choices

- Using local React state for mock interactions is correct.
- No LocalStorage persistence is required.
- Dialog-based mock entry flows are acceptable for the corrective pass if they remain usable at 390px.
- Hard-coded mock exchange rates are acceptable only inside the mock presentation layer; no external FX provider should be added in Phase 1.
- Real Auth, RLS, database writes, Gemini, AI key storage, and PWA work remain out of scope.

## Verification State

| Check | Status | Notes |
|---|---|---|
| Remote Phase 1 commit | PASS | `14ffe6ffa2aba010a06a157ff1f79fd0424e8605` is on `main` and is one commit ahead of the Phase 0 baseline |
| Required top-level routes | PASS | All 11 required routes are present |
| Database scope | PASS | No migrations/database changes in the Phase 1 diff |
| Supabase Phase 0 preservation | PASS | Approved SSR foundation was not changed by Phase 1 |
| Multi-currency presentation | PASS | Original/converted values are represented in mock UI |
| YouTube income presentation | PASS | Multi-channel USD income is represented in reports |
| Transaction filter completeness | FAIL | Missing exposed account/category/date/amount-direction controls |
| Settings completeness | FAIL | Missing Appearance, Notifications, AI, Security presentation sections |
| Required loading states | FAIL | Skeleton primitive exists but required screen coverage is absent |
| Empty states | PARTIAL | Transactions covered; Accounts/Goals need coverage |
| Admin separation / wording | FAIL | Admin is linked from standard AppShell and some mock wording overstates backend readiness |
| Mock multi-currency creation | FAIL | New foreign entries only handle USD conversion correctly |
| Type-safety cleanup | FAIL | `any` remains in local mock creation callbacks |
| Documentation accuracy | FAIL | Status claims do not fully match current implementation |

## Blockers

Phase 1 must complete the bounded corrective pass above before Phase 2 is authorized.

## Known Issues

See the Phase 1 audit findings above.

## Next Recommended Action

Execute **Phase 1 — Corrective Pass** only. Do not begin Phase 2.

## Update Rule

After every meaningful implementation session, update this file with:

- current phase and status;
- completed work;
- pending work;
- blockers;
- verification results;
- known issues;
- next recommended action.
