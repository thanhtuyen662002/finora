# FINORA — PHASE 3 ACCOUNTS + CATEGORIES

## TASK

Implement **Finora Phase 3 — Accounts + Categories** on the existing repository:

`thanhtuyen662002/finora`

Authoritative Phase 2 completion baseline:

`c4248e5be9884bb2402e74900daf16909735c641`

Target Supabase project:

- Project ref: `qibfitbnlfgiqctntufr`
- Project URL: `https://qibfitbnlfgiqctntufr.supabase.co`
- Live Finora origin: `https://finora-orpin-nu.vercel.app`

Phase 2 is accepted complete. Preserve its Auth/SSR/RLS behavior exactly unless a real regression is discovered.

Do not begin Phase 4. Do not create transactions or transfers.

---

## 1. Mandatory pre-work

Before changing code:

1. Sync latest `origin/main` and confirm the exact remote HEAD.
2. Read completely:
   - `AGENTS.md`
   - `docs/PROJECT_STATUS.md`
   - `docs/DATABASE.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `prompts/PHASE_3_ACCOUNTS_CATEGORIES.md`
3. Inspect the current implementations of:
   - `src/app/accounts/page.tsx`
   - `src/components/finance/AddAccountModal.tsx`
   - `src/components/finance/AccountCard.tsx`
   - `src/components/finance/AccountDetailModal.tsx`
   - `src/app/settings/page.tsx`
   - `src/types/finance.ts`
   - `src/types/database.ts`
   - `src/lib/mock/accounts.ts`
   - `src/lib/mock/transactions.ts`
   - `src/lib/supabase/client.ts`
   - `src/lib/supabase/server.ts`
   - `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
   - `scripts/verify-phase2-db.sql`
   - `scripts/verify-phase2-rls.mjs`
4. Treat the repository as authoritative. Preserve working Phase 2 behavior.
5. Use only browser-safe Supabase configuration from the client. No service-role key.

---

## 2. Phase 3 objective

By the end of Phase 3, Finora must have real Supabase-backed persistence and user isolation for:

- financial accounts;
- income/expense categories.

Required user-facing capabilities:

### Accounts

- list the authenticated user's real accounts;
- create an account;
- edit an account;
- archive/unarchive an account;
- filter active accounts by account type;
- support multiple account currencies from the beginning;
- persist all account changes in Supabase;
- truthful loading, empty, success, and error states.

### Categories

- list the authenticated user's real categories;
- seed useful default categories for every user;
- create a custom category;
- edit a category;
- archive/unarchive a category;
- separate `INCOME` and `EXPENSE` categories;
- persist all category changes in Supabase.

The existing mock transaction system remains Phase 1 presentation only until Phase 4.

---

## 3. Strict scope boundary

Allowed in Phase 3:

- `accounts` table;
- `categories` table;
- source-controlled migration;
- updated-at triggers;
- user ownership;
- RLS policies;
- explicit grants;
- account/category domain types and data access helpers;
- account/category UI persistence;
- category management UI;
- structural DB verifier;
- live two-user Phase 3 RLS verifier;
- documentation updates.

Forbidden in Phase 3:

- `transactions` table;
- `transfers` table;
- budgets persistence;
- goals persistence;
- recurring persistence;
- exchange-rate table/provider integration;
- current FX API calls;
- income sources persistence;
- Gemini/AI integration;
- storage uploads;
- admin RBAC;
- family workspace;
- bank integrations.

Do not silently expand scope.

---

## 4. Account database model

Create one new source-controlled migration under `supabase/migrations/` after the Phase 2 migration.

Create `public.accounts` with this semantic model:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null`
- `type text not null`
- `currency_code text not null`
- `opening_balance numeric(20,4) not null default 0`
- `institution text null`
- `color text not null default '#005a3c'`
- `is_archived boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Required validation:

- trimmed account name must be non-empty and reasonably bounded, e.g. <= 100 chars;
- `type` must be one of:
  - `CASH`
  - `BANK`
  - `EWALLET`
  - `SAVINGS`
  - `CREDIT_CARD`
  - `INVESTMENT`
  - `OTHER`
- currency must be extensible, not an enum limited to six mock currencies; validate an uppercase currency-code shape such as `^[A-Z]{3,5}$`;
- color must be a normal six-digit hex color if a DB check is used.

Add useful ownership/list indexes, at minimum on `user_id` and active/archive lookup.

### Critical account-balance rule

Do **not** add a persisted `current_balance`, `converted_balance_vnd`, `monthly_inflow`, or `monthly_outflow` column in Phase 3.

`opening_balance` is the only persisted money amount for an account in Phase 3.

Reason:

- current balance becomes a deterministic derived value once Phase 4 transactions and Phase 5 transfers exist;
- storing derived balances now would create synchronization debt;
- FX conversion is Phase 8 and must not be faked.

The UI may show `opening_balance` as the presently known balance while no real transactions exist, but wording must not claim transaction-derived calculations exist.

Use PostgreSQL `numeric`, never float/double for stored money.

---

## 5. Category database model

Create `public.categories` with:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null`
- `type text not null check (type in ('INCOME', 'EXPENSE'))`
- `icon text not null`
- `color text not null`
- `is_archived boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Validation:

- trimmed name non-empty and reasonably bounded, e.g. <= 80 chars;
- hex color validation if used;
- prevent accidental duplicate active/user categories where practical without introducing complex taxonomy infrastructure.

Categories are **user-owned records**, not globally writable shared records.

---

## 6. Default category seeding

Every current and future Auth user should receive a useful baseline category set.

Seed user-owned defaults approximately matching the existing Phase 1 presentation categories:

### EXPENSE

- Ăn uống — `Utensils` — `#f97316`
- Di chuyển — `Car` — `#0ea5e9`
- Mua sắm — `ShoppingBag` — `#8b5cf6`
- Hóa đơn & Nhà cửa — `Home` — `#ef4444`
- Giải trí — `Film` — `#ec4899`
- Sức khỏe — `HeartPulse` — `#10b981`
- Khác — `MoreHorizontal` — `#64748b`

### INCOME

- Lương — `Briefcase` — `#22c55e`
- YouTube & AdSense — `Video` — `#dc2626`
- Freelance — `Laptop` — `#3b82f6`
- Đầu tư — `TrendingUp` — `#14b8a6`
- Khác — `MoreHorizontal` — `#64748b`

Do **not** seed `Chuyển tiền` as an income/expense category. Transfers are a separate neutral finance concept and belong to Phase 5.

Implementation requirements:

- backfill defaults for Auth users already present when the migration runs;
- seed defaults for future `auth.users` inserts;
- if a SECURITY DEFINER trigger function is used, keep it narrowly scoped, set a safe empty `search_path`, fully qualify table names, and revoke direct execute rights from normal client roles if not required;
- do not modify the accepted Phase 2 profile/settings provisioning logic unless necessary. Prefer a separate bounded category-seeding function/trigger.

---

## 7. Updated-at handling

Reuse the existing reviewed `public.handle_updated_at()` function for both new tables.

Create:

- `set_accounts_updated_at`
- `set_categories_updated_at`

Do not create a second generic timestamp framework.

---

## 8. RLS ownership contract

Enable RLS on both new tables before exposing them to the Data API.

### Accounts

Authenticated users may operate only on rows where:

`(select auth.uid()) = user_id`

Required policies:

- SELECT own accounts;
- INSERT only rows owned by self (`WITH CHECK`);
- UPDATE own accounts with both `USING` and `WITH CHECK`.

### Categories

Same ownership contract:

`(select auth.uid()) = user_id`

Required policies:

- SELECT own categories;
- INSERT only rows owned by self;
- UPDATE own categories with `USING` + `WITH CHECK`.

### Hard delete

The normal Finora UI should use `is_archived` instead of physical delete so later transaction history can retain stable references.

Do not grant broad client DELETE merely because it is easy.

If no client hard-delete use case is implemented in Phase 3, keep DELETE ungranted and do not create a DELETE policy.

Invariant:

`User A must never read, insert-for, update, archive, or otherwise mutate User B's accounts/categories.`

---

## 9. Explicit least-privilege grants

Do not rely on Supabase default grants.

For each new table:

1. Explicitly `REVOKE ALL` from:
   - `anon`
   - `authenticated`
   - `PUBLIC`
2. Grant only the capabilities used by the Phase 3 browser client.

Expected model:

### `accounts`

- table-level SELECT to `authenticated`;
- column-level INSERT only for intended creation fields, including `user_id` but excluding DB-generated `id` and timestamps;
- column-level UPDATE only for mutable fields:
  - `name`
  - `type`
  - `currency_code`
  - `opening_balance`
  - `institution`
  - `color`
  - `is_archived`
- no client UPDATE of `id`, `user_id`, `created_at`, `updated_at`;
- no anon/PUBLIC access;
- no client hard DELETE unless the implementation has a reviewed need.

### `categories`

- table-level SELECT to `authenticated`;
- column-level INSERT only for intended creation fields, including `user_id`;
- column-level UPDATE only for:
  - `name`
  - `type`
  - `icon`
  - `color`
  - `is_archived`
- no client UPDATE of identity/ownership/timestamps;
- no anon/PUBLIC access;
- no client hard DELETE unless reviewed and justified.

Remember: grants and RLS are separate security layers. Both must pass.

---

## 10. TypeScript database/domain types

Update `src/types/database.ts` to match the new migration exactly if generated remote types are not available yet.

Expose useful aliases for Account/Category Row/Insert/Update.

Keep presentation/mock types separate where still needed by future-phase mock pages.

Do not pretend Phase 1 mock transactions are real database transaction types.

Do not hard-code the database currency type to only VND/USD/EUR/JPY/CNY/KRW.

---

## 11. Account application layer

Create a small bounded account feature module under `src/features/accounts/` or the closest existing project convention.

Provide typed operations for:

- list current user's accounts;
- create account;
- update account;
- archive/unarchive account.

Use the normal publishable-key Supabase client under RLS.

Do not add a service-role backend simply to bypass ownership policies.

Always surface Supabase errors truthfully.

For creation, obtain the authenticated user ID from Supabase Auth and set `user_id` explicitly. RLS must remain the authority even if frontend code is wrong.

---

## 12. Real Accounts UI

Convert `/accounts` from `MOCK_ACCOUNTS` local state to real `public.accounts` persistence.

Preserve the existing overall visual language where practical.

Required behavior:

- initial loading state;
- real empty state for a user with no accounts;
- real create flow;
- real edit flow;
- archive/unarchive flow;
- filter by account type;
- optionally include archived view/filter without cluttering the default screen;
- clear API/database error feedback;
- changes survive refresh and re-login.

Refactor `AddAccountModal`, `AccountCard`, and `AccountDetailModal` only as needed.

Do not keep account CRUD as local `useState` mock mutations.

### Truthful Phase 3 finance presentation

Remove/avoid claims such as:

- hard-coded `1 USD ≈ 26.200 VND` as a live rate;
- `convertedBalanceVND` for real foreign accounts;
- real monthly inflow/outflow from nonexistent persisted transactions;
- a cross-currency total net worth based on mock FX.

Until Phase 8 FX exists, show foreign account balances in their original currency.

If a summary is needed, prefer truthful facts such as:

- account count;
- active vs archived count;
- currencies represented;
- separate totals by same currency only if implemented without unsafe arithmetic.

Do not label `opening_balance` as a fully transaction-derived balance once future language could mislead; a label such as `Số dư hiện có / số dư khởi tạo` is acceptable during Phase 3.

Transaction and transfer quick actions on the real account detail must not pretend to persist real finance activity. Hide, disable, or clearly mark them as later-phase preview.

---

## 13. Category application layer + UI

Create a bounded category feature module with typed operations:

- list categories;
- create custom category;
- update category;
- archive/unarchive category.

Create a real management surface without changing the primary navigation architecture unnecessarily.

Preferred current placement:

- route: `/settings/categories`;
- add a small clear link/card from `/settings` to `Quản lý danh mục`.

The category page should:

- have INCOME / EXPENSE sections or tabs;
- show icon, color, name;
- support create/edit/archive/unarchive;
- identify no fake usage counts because transactions are not persisted yet;
- be responsive.

Do not add a top-level sidebar item solely for categories unless the existing product navigation clearly requires it.

---

## 14. Phase 1 mock compatibility

Other pages such as Dashboard, Transactions, Budgets, Goals, Recurring, and Reports may continue using mock data until their own phases.

Do not force a repository-wide conversion in Phase 3.

However:

- `/accounts` must no longer source data from `MOCK_ACCOUNTS`;
- category management must no longer use `MOCK_CATEGORIES` as its source of truth;
- do not accidentally make Phase 4 transaction UI appear persisted merely because account/category persistence now exists.

If shared components are refactored, preserve compatibility with still-mocked pages where practical.

---

## 15. Structural verification tooling

Add a strict SQL verifier, e.g.:

`scripts/verify-phase3-db.sql`

It must return explicit PASS/FAIL rows and a final overall gate.

At minimum verify:

1. `accounts` and `categories` exist;
2. RLS enabled on both;
3. expected ownership policy names/commands/roles are present and no accidental broad policies exist;
4. updated-at triggers exist;
5. category provisioning trigger/function exists and function security/search_path is safe;
6. anon/PUBLIC have no table/column privileges;
7. authenticated table privileges are exactly the intended table-level privileges;
8. authenticated INSERT column privileges are exactly the intended fields;
9. authenticated UPDATE column privileges are exactly the intended mutable fields;
10. there is no broad authenticated table-level INSERT/UPDATE if column-level grants are the contract;
11. existing auth users have the required seeded baseline categories after migration;
12. `opening_balance` is numeric/decimal and there is no Phase 3 `current_balance`/fake FX derived column;
13. `99_OVERALL` fails if any mandatory check fails.

Do not repeat the Phase 2 verifier false-positive pattern. Exact privilege checks must reject extra privileges.

---

## 16. Live two-user verification tooling

Add an assertion-style runtime script, e.g.:

`scripts/verify-phase3-rls.mjs`

Use the same environment contract as the existing Phase 2 two-user verifier:

- `FINORA_TEST_USER_A_EMAIL`
- `FINORA_TEST_USER_A_PASSWORD`
- `FINORA_TEST_USER_B_EMAIL`
- `FINORA_TEST_USER_B_PASSWORD`

No service-role key.

The script must exit non-zero on any mandatory failure or missing credential.

Required live assertions after migration application:

### Accounts

- A can INSERT an account for A;
- A can SELECT own account;
- A can UPDATE/archive own account and verify persisted result;
- A cannot SELECT B account;
- A cannot UPDATE/archive B account;
- A cannot INSERT an account whose `user_id` is B;
- same relevant checks B → A.

### Categories

- seeded categories exist for A and B;
- A can SELECT own categories;
- A can update an allowed own category field and restore it;
- A cannot SELECT/update B category;
- A cannot INSERT a category owned by B;
- same relevant checks B → A;
- custom category create/archive behavior succeeds for the owner.

If cleanup cannot hard-delete because DELETE is intentionally not granted, leave any script-created test records archived with a clearly recognizable test name and avoid creating duplicates on repeated runs.

Treat arbitrary query errors deliberately; do not interpret every error as proof of RLS isolation.

---

## 17. Remote migration gate

Phase 3 code can be committed before the migration is applied remotely, but Phase 3 overall cannot be declared PASS until the migration is applied and verified on the actual project:

`qibfitbnlfgiqctntufr`

If your environment lacks remote DB permission:

- commit the migration and verification tooling;
- report `REMOTE_DATABASE=BLOCKED`;
- do not fake PASS;
- provide the exact source-controlled migration file for manual application through Supabase SQL Editor.

Do not alter unrelated hosted Auth/SMTP/Google configuration.

---

## 18. Verification

Run:

- `npm ci` (or `npm install` only if lockfile/workflow requires it);
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- relevant runtime UI checks;
- Phase 3 structural verifier after remote migration is actually applied;
- Phase 3 two-user RLS verifier after remote migration.

UI verification minimum:

- 390px;
- 768px;
- 1024px;
- 1440px.

Do not claim a viewport PASS unless actually checked.

---

## 19. Documentation

Update:

- `docs/PROJECT_STATUS.md` after implementation;
- `docs/DATABASE.md` with exact `accounts` and `categories` schema, grants, RLS, category seeding, and migration ledger;
- `docs/ARCHITECTURE.md` only if current-state wording is stale or a real module-boundary update is required;
- `docs/DECISIONS.md` only if a genuine new architecture decision is made.

Document explicitly:

- `opening_balance` is persisted;
- current balance is not redundantly stored in Phase 3;
- real FX conversion is deferred to Phase 8;
- transfers are not categories;
- UI lifecycle prefers archive to physical delete.

---

## 20. Git discipline

Keep changes bounded to Phase 3.

Prefer one logical implementation commit plus documentation/test commits where useful.

Do not commit:

- passwords;
- test-user credentials;
- service-role keys;
- SMTP credentials;
- OAuth secrets;
- `.env.local`.

Push the implementation to `main` only after local checks pass, following the repository's current workflow.

---

## 21. Completion gate

Phase 3 is COMPLETE only when all of the following are proven:

- account schema source-controlled;
- category schema source-controlled;
- migration applied to actual Supabase project;
- strict structural verifier PASS;
- user A/B runtime isolation PASS for accounts/categories;
- default categories exist for existing/future users;
- real account create/edit/archive persists through refresh;
- real category create/edit/archive persists through refresh;
- no fake current FX/account totals introduced;
- lint PASS;
- typecheck PASS;
- build PASS;
- docs accurately reflect reality.

Do not authorize Phase 4 until the remote DB + two-user runtime gates pass.

---

## 22. Final report

Return exactly:

TASK
Finora Phase 3 — Accounts + Categories

STATUS
PASS / PARTIAL / BLOCKED

START_HEAD
<remote starting SHA>

FINAL_LOCAL_HEAD
<local SHA>

REMOTE_MAIN_HEAD
<actual GitHub main SHA>

HEAD_MATCH
YES / NO

MIGRATION_FILE
<path>

ACCOUNTS_SCHEMA
PASS / FAIL

CATEGORIES_SCHEMA
PASS / FAIL

CATEGORY_DEFAULT_SEEDING
PASS / BLOCKED / FAIL

ACCOUNT_PERSISTENCE
PASS / BLOCKED / FAIL

CATEGORY_PERSISTENCE
PASS / BLOCKED / FAIL

ARCHIVE_LIFECYCLE
PASS / BLOCKED / FAIL

FAKE_FX_REMOVED_FROM_REAL_ACCOUNTS
PASS / FAIL

REMOTE_DATABASE
PASS / BLOCKED

STRUCTURAL_DB_GATE
PASS / BLOCKED / FAIL

ANON_LOCKDOWN
PASS / BLOCKED / FAIL

RLS_TWO_USER_ACCOUNTS
PASS / BLOCKED / FAIL

RLS_TWO_USER_CATEGORIES
PASS / BLOCKED / FAIL

USER_A_CROSS_USER_BLOCK
PASS / BLOCKED / FAIL

USER_B_CROSS_USER_BLOCK
PASS / BLOCKED / FAIL

LINT
PASS / FAIL

TYPESCRIPT
PASS / FAIL

BUILD
PASS / FAIL

RESPONSIVE
PASS / PARTIAL / NOT_RUN

CODE_CHANGES
<summary>

DATABASE_CHANGES
<summary>

KNOWN_BLOCKERS
<exact blockers or NONE>

PROJECT_STATUS
<exact status>

REMOTE_COMMIT
<actual pushed GitHub SHA or BLOCKED>

Then stop. Do not begin Phase 4.
