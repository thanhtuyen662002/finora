# Finora — Database

## Status
**Database implementation:** PHASE_3_ACCOUNTS_CATEGORIES

This document records the data model, tables, relationships, and invariants implemented in Finora. Executable Supabase migrations under `supabase/migrations/` are the authoritative schema source of truth.

## Database Platform
- PostgreSQL via Supabase
- Supabase Auth for user identity (`auth.users`)
- Supabase Storage for future user-owned files (receipts/imports)

## Implemented Tables

### `public.profiles` (Phase 2)
Stores user profile information associated with the Supabase Auth user. Created automatically via trigger on user signup.
- `id` (uuid, primary key, references `auth.users(id)` ON DELETE CASCADE)
- `display_name` (text, nullable)
- `avatar_url` (text, nullable)
- `onboarding_completed` (boolean, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.user_settings` (Phase 2)
Stores user-specific localization, default currency, and appearance preferences. Created automatically via trigger on user signup.
- `user_id` (uuid, primary key, references `auth.users(id)` ON DELETE CASCADE)
- `base_currency` (text, default 'VND')
- `locale` (text, default 'vi-VN')
- `timezone` (text, default 'Asia/Ho_Chi_Minh')
- `theme` (text, check in ('light', 'dark', 'system'), default 'system')
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.accounts` (Phase 3)
User financial accounts managed under RLS.
- `id` (uuid, primary key)
- `user_id` (uuid, references `auth.users(id)` ON DELETE CASCADE)
- `name` (text, not null)
- `type` (text, check in ('CASH', 'BANK', 'EWALLET', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'OTHER'))
- `currency_code` (text, check length 3-5)
- `opening_balance` (numeric(20,4), default 0)
- `institution` (text, nullable)
- `color` (text, default '#005a3c')
- `is_archived` (boolean, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.categories` (Phase 3)
User financial categories managed under RLS. 12 baseline categories are seeded upon user creation via trigger.
- `id` (uuid, primary key)
- `user_id` (uuid, references `auth.users(id)` ON DELETE CASCADE)
- `name` (text, not null)
- `type` (text, check in ('INCOME', 'EXPENSE'))
- `icon` (text, not null)
- `color` (text, default '#8b5cf6')
- `is_archived` (boolean, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Ownership Model & Security Design

Every user-owned record has an explicit foreign key to `auth.users(id)`.
RLS enforces data isolation at the database level. Frontend filters are not authorization.

**Invariant 1:** User A cannot SELECT, INSERT, UPDATE, or DELETE User B's financial records.

### Hardened Privileges (Zero-Trust Defaults)
By default, Supabase grants excessive privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) to `anon`, `authenticated`, and `PUBLIC` roles for all tables created via the dashboard or default migrations. In Finora, we explicitly revoke these blanket privileges.
- Default table grants (`anon`, `authenticated`, `PUBLIC`) are revoked.
- `SELECT` is granted to `authenticated` only on specific tables with strict RLS.
- `INSERT` is granted to `authenticated` ONLY for exact allowed columns (e.g. users cannot insert arbitrary `id` values for accounts, they are auto-generated).
- `UPDATE` is granted to `authenticated` ONLY for exact allowed columns (e.g. users cannot update `user_id`, `id`, `created_at`).
- `DELETE` is completely withheld from all application roles. Finora uses logical deletion (`is_archived`).
- Security Definer functions (e.g. `handle_new_user`, `seed_default_categories`) are hardened with `search_path = ''` to prevent search path hijacking.
- `EXECUTE` privilege on Security Definer functions is explicitly revoked from `PUBLIC`, `anon`, and `authenticated` so they cannot be invoked manually.

## Migration Ledger
1. `supabase/migrations/20260828000000_phase_2_auth_rls.sql` — Phase 2: Profiles, user_settings, auth triggers, hardened search path & invoker permissions, explicit removal of Supabase default table grants, minimum column-level update grants, and RLS policies.
2. `supabase/migrations/20260828000001_phase_3_accounts_categories.sql` — Phase 3: Accounts, Categories, seeding triggers, hardened `INSERT`/`UPDATE` column grants, explicit `EXECUTE` revocation, atomic transaction block.

## Phase 4 — Transactions

Transactions schema tracks income and expense logic. 

**Table:** `transactions`
- `id` (UUID, primary key)
- `user_id` (UUID, NOT NULL)
- `account_id` (UUID, NOT NULL)
- `category_id` (UUID, NOT NULL)
- `type` (TEXT, NOT NULL) — Limited to `INCOME`, `EXPENSE`.
- `amount` (NUMERIC(20,4), NOT NULL) — Exact monetary storage.
- `currency_code` (TEXT, NOT NULL)
- `merchant` (TEXT, NOT NULL) — Length bounds 1..200.
- `note` (TEXT) — Max length 1000.
- `occurred_on` (DATE, NOT NULL)
- `is_voided` (BOOLEAN, NOT NULL, DEFAULT FALSE)
- `created_at`, `updated_at`

**Ownership-safe composite FKs:**
To prevent cross-user spoofing where User A inserts a transaction referencing User B's account or category:
- `transactions_account_fkey` on `(account_id, user_id, currency_code)`
- `transactions_category_fkey` on `(category_id, user_id, type)`

**Account Balances:**
`public.account_balances` is a `security_invoker=true` view aggregating exact decimal totals per account.
Calculated as: `opening_balance + sum(active INCOME) - sum(active EXPENSE)`.
Returns `current_balance` as exact decimal text to prevent JS native floating point logic.

**Void Semantics:**
Transactions are not hard-deleted. They are marked `is_voided=TRUE` which excludes them from exact view summaries and dashboards. `is_voided` is mutable for authenticated clients.

**Exact Money Strategy:**
Floating point money arithmetic (`parseFloat`) is strictly forbidden in application summary logic. Values are accumulated via the exact database view or using a string-based exact exact `addExactDecimals` bounded library on the client.

**Grants and RLS:**
- RLS enabled on `transactions`.
- INSERT only allows subset of user-provided columns (defaults handles `is_voided`, `id`, `user_id`).
- UPDATE explicitly denies identity/ownership manipulation.
- DELETE is forbidden for normal clients.
