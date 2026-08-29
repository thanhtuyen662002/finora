# Finora — Database

## Status
**Database implementation:** PHASE_4_TRANSACTIONS (Schema defined, corrective pass ready)

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

### `public.transactions` (Phase 4)
User financial transactions (Income/Expense) managed under RLS.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null)
- `account_id` (uuid, not null)
- `category_id` (uuid, not null)
- `type` (text, not null, check in ('INCOME', 'EXPENSE'))
- `amount` (numeric(20,4), not null, check > 0)
- `currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `merchant` (text, not null, length 1..200)
- `note` (text, nullable, max length 1000)
- `occurred_on` (date, not null, default CURRENT_DATE)
- `is_voided` (boolean, not null, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.transfers` (Phase 5)
User financial transfers (Same-Currency Account-to-Account movements) managed under RLS.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null)
- `from_account_id` (uuid, not null)
- `to_account_id` (uuid, not null, check `from_account_id <> to_account_id`)
- `amount` (numeric(20,4), not null, check > 0)
- `currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `note` (text, nullable, max length 1000)
- `occurred_on` (date, not null, default CURRENT_DATE)
- `is_voided` (boolean, not null, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.budgets` (Phase 7)
Monthly category expense budgets managed under RLS.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null, references `auth.users(id)` ON DELETE CASCADE)
- `category_id` (uuid, not null)
- `category_type` (text, not null, default 'EXPENSE', check in ('EXPENSE'))
- `limit_amount` (numeric(20,4), not null, check > 0)
- `currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `period_month` (date, not null)
- `is_archived` (boolean, not null, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.goals` (Phase 7)
Saving and investment target goals managed under RLS.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null, references `auth.users(id)` ON DELETE CASCADE)
- `name` (text, not null, check length 1..200)
- `target_amount` (numeric(20,4), not null, check > 0)
- `current_amount` (numeric(20,4), not null, default 0, check >= 0)
- `currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `target_date` (date, nullable)
- `monthly_contribution` (numeric(20,4), not null, default 0, check >= 0)
- `category` (text, not null, default 'An toàn tài chính')
- `icon` (text, not null, default 'Target')
- `color` (text, not null, default '#10b981')
- `is_archived` (boolean, not null, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `public.recurring_items` (Phase 7)
Recurring income and expense schedules/templates managed under RLS.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null, references `auth.users(id)` ON DELETE CASCADE)
- `account_id` (uuid, not null)
- `category_id` (uuid, not null)
- `transaction_type` (text, not null, check in ('INCOME', 'EXPENSE'))
- `name` (text, not null, check length 1..200)
- `amount` (numeric(20,4), not null, check > 0)
- `currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `frequency` (text, not null, check in ('WEEKLY', 'MONTHLY', 'YEARLY'))
- `anchor_date` (date, not null)
- `end_date` (date, nullable)
- `note` (text, nullable, max length 1000)
- `is_paused` (boolean, not null, default false)
- `is_archived` (boolean, not null, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Views

### `public.account_balances` (Phase 4 / Phase 5 Updated)
A `security_invoker = true` view aggregating exact decimal totals per account, protected against Cartesian multiplication via pre-aggregated subqueries.
- `account_id` (uuid)
- `user_id` (uuid)
- `currency_code` (text)
- `current_balance` (text) — Exact string cast: `opening_balance + sum(active INCOME) - sum(active EXPENSE) + sum(active incoming TRANSFERS) - sum(active outgoing TRANSFERS)`.

### `public.transaction_details` (Phase 4)
A `security_invoker = true` view providing exact decimal string reads and joined metadata.
- `id` (uuid)
- `user_id` (uuid)
- `account_id` (uuid)
- `category_id` (uuid)
- `type` (text)
- `amount` (text) — Cast from `numeric(20,4)` to prevent JS IEEE 754 precision loss at the JSON boundary.
- `currency_code` (text)
- `merchant` (text)
- `note` (text)
- `occurred_on` (date)
- `is_voided` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `account_name` (text)
- `category_name` (text)
- `category_icon` (text)
- `category_color` (text)

### `public.transfer_details` (Phase 5)
A `security_invoker = true` view providing exact decimal string reads and joined account metadata.
- `id` (uuid)
- `user_id` (uuid)
- `from_account_id` (uuid)
- `to_account_id` (uuid)
- `amount` (text) — Cast from `numeric(20,4)` to text for lossless client communication.
- `currency_code` (text)
- `note` (text)
- `occurred_on` (date)
- `is_voided` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `from_account_name` (text)
- `from_account_color` (text)
- `to_account_name` (text)
- `to_account_color` (text)

### `public.budget_progress` (Phase 7)
A `security_invoker = true` view providing exact spent calculations and joined category metadata.
- `id` (uuid)
- `user_id` (uuid)
- `category_id` (uuid)
- `category_type` (text)
- `limit_amount` (text) — Exact string representation of budget limit.
- `spent_amount` (text) — Exact string sum of non-voided expense transactions for the category in the budget month.
- `remaining_amount` (text) — Exact limit minus spent.
- `currency_code` (text)
- `period_month` (date)
- `is_archived` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `category_name` (text)
- `category_icon` (text)
- `category_color` (text)

### `public.goal_details` (Phase 7)
A `security_invoker = true` view providing exact remaining calculation for saving goals.
- `id` (uuid)
- `user_id` (uuid)
- `name` (text)
- `target_amount` (text)
- `current_amount` (text)
- `monthly_contribution` (text)
- `remaining_amount` (text)
- `currency_code` (text)
- `target_date` (date)
- `category` (text)
- `icon` (text)
- `color` (text)
- `is_archived` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### `public.recurring_details` (Phase 7)
A `security_invoker = true` view joining recurring templates with account and category names.
- `id` (uuid)
- `user_id` (uuid)
- `account_id` (uuid)
- `category_id` (uuid)
- `transaction_type` (text)
- `name` (text)
- `amount` (text)
- `currency_code` (text)
- `frequency` (text)
- `anchor_date` (date)
- `end_date` (date)
- `note` (text)
- `is_paused` (boolean)
- `is_archived` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `account_name` (text)
- `account_color` (text)
- `category_name` (text)
- `category_icon` (text)
- `category_color` (text)

## Ownership Model & Security Design

Every user-owned record has an explicit foreign key to `auth.users(id)`.
RLS enforces data isolation at the database level. Frontend filters are not authorization.

**Invariant 1:** User A cannot SELECT, INSERT, UPDATE, or DELETE User B's financial records.

**Invariant 2:** Transfers are net-worth neutral. A transfer decrements source account balance and increments destination account balance by the exact same amount.

**Ownership-Safe Composite Foreign Keys:**
- `transactions_account_fkey` on `(account_id, user_id, currency_code)` references `accounts(id, user_id, currency_code)`
- `transactions_category_fkey` on `(category_id, user_id, type)` references `categories(id, user_id, type)`
- `transfers_from_account_fkey` on `(from_account_id, user_id, currency_code)` references `accounts(id, user_id, currency_code)`
- `transfers_to_account_fkey` on `(to_account_id, user_id, currency_code)` references `accounts(id, user_id, currency_code)`

### Hardened Privileges (Zero-Trust Defaults)
By default, Supabase grants excessive privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) to `anon`, `authenticated`, and `PUBLIC` roles. In Finora:
- Default table grants (`anon`, `authenticated`, `PUBLIC`) are revoked.
- `SELECT` is granted to `authenticated` only on specific tables and views with strict RLS (`security_invoker = true`).
- `INSERT` is granted to `authenticated` ONLY for exact allowed columns.
- `UPDATE` is granted to `authenticated` ONLY for exact allowed columns (immutable columns like `id`, `user_id`, `created_at` cannot be updated).
- `DELETE` is completely withheld. Logical deletion (`is_archived` / `is_voided`) is enforced.
- Security Definer functions use `search_path = ''` and `EXECUTE` is revoked.

## Migration Ledger
1. `supabase/migrations/20260828000000_phase_2_auth_rls.sql` — Phase 2: Profiles, user_settings, auth triggers, hardened search path & invoker permissions, explicit removal of Supabase default table grants, minimum column-level update grants, and RLS policies.
2. `supabase/migrations/20260828000001_phase_3_accounts_categories.sql` — Phase 3: Accounts, Categories, seeding triggers, hardened `INSERT`/`UPDATE` column grants, explicit `EXECUTE` revocation, atomic transaction block.
3. `supabase/migrations/20260828000002_phase_4_transactions.sql` — Phase 4: Transactions table, composite FKs, updated_at trigger, derived `account_balances` and `transaction_details` views with `security_invoker = true`, RLS policies, least-privilege column grants.
4. `supabase/migrations/20260828000003_phase_5_transfers.sql` — Phase 5: Transfers table, composite source and destination FKs, distinct accounts constraint, updated derived `account_balances` view with pre-aggregation, `transfer_details` view with `security_invoker = true`, RLS policies, least-privilege column grants.
5. `supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql` — Phase 7: Budgets, Goals, and Recurring items tables, exact money constraints, composite FKs, derived `budget_progress`, `goal_details`, `recurring_details` views with `security_invoker = true`, 9 exact RLS policies (no delete), least-privilege column grants.
