# Finora — Database

## Status
**Database implementation:** PHASE_13B-2_CROSS_CURRENCY_REPAYMENT_APPLIED / VERIFIED (Phase 13B-1 remote migration `20260909020803`; Phase 13B-2 remote migration `20260909071009`)

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

### `public.transfers` (Phase 5 / Phase 8 Pass B Corrective)
User financial transfers (Same-Currency and Cross-Currency Account-to-Account movements) managed under RLS.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null)
- `from_account_id` (uuid, not null)
- `to_account_id` (uuid, not null, check `from_account_id <> to_account_id`)
- `amount` (numeric(20,4), not null, check > 0)
- `currency_code` (text, not null, check format `^[A-Z]{3,5}$`, check `currency_code = source_currency_code`)
- `source_currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `destination_currency_code` (text, not null, check format `^[A-Z]{3,5}$`)
- `destination_amount` (numeric(20,4), not null, check > 0, check `destination_amount = ROUND(amount * exchange_rate, 4)`)
- `exchange_rate` (numeric(30,12), not null, default 1.000000000000, check > 0)
- `note` (text, nullable, max length 1000)
- `occurred_on` (date, not null, default CURRENT_DATE)
- `is_voided` (boolean, not null, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**DB Integrity Constraints:**
- `chk_transfers_currency_compatibility`: `currency_code = source_currency_code`
- `chk_transfers_same_currency_invariant`: `(source_currency_code <> destination_currency_code) OR (destination_amount = amount AND exchange_rate = 1.000000000000)`
- `chk_transfers_cross_currency_conversion`: `destination_amount = ROUND(amount * exchange_rate, 4)`
- `trg_check_transfer_accounts_active`: Trigger on BEFORE INSERT OR UPDATE ensuring neither source nor destination account is archived (`is_archived = false`).

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
6. `supabase/migrations/20260829000001_phase_8_fx.sql` — Phase 8 Pass A: FX snapshots and exchange rates infrastructure.
7. `supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql` — Phase 8 Pass B: Cross-currency transfer columns, composite FKs, and exact math check constraints.
8. `supabase/migrations/20260831142135_phase_8_cross_currency_transfer_integrity_corrective.sql` — Phase 8 Pass B Integrity Corrective: Currency compatibility constraint, same-currency rate/amount invariant, cross-currency exact rounding conversion constraint, and active-account trigger.
9. `supabase/migrations/20260831144154_phase_8_transfer_trigger_security_hardening.sql` — Phase 8 Pass B Trigger Security Hardening: Replaces `check_transfer_accounts_active` function with `SECURITY INVOKER`.
10. `supabase/migrations/20260903110000_phase_11_ai_credentials.sql` — Phase 11: Application-level AES-256-GCM AI credentials in private schema, least-privilege service-role table grants, service-role-only public RPC facade (`ai_credentials_read_for_service`, `ai_credentials_write_for_service`, `ai_credentials_revoke_for_service`), and baseline security advisor revokes.

## Phase 11: AI Credentials Storage (`private` Schema)

### `private.ai_credentials`
Encrypted AI API credentials (application-level AES-256-GCM envelope encryption). Schema is entirely hidden from the PostgREST API layer.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `owner_user_id` (uuid, not null, references `auth.users(id)` ON DELETE CASCADE)
- `source` (text, not null, check in ('PERSONAL', 'ADMIN_ASSIGNED'))
- `provider` (text, not null, check in ('GEMINI'))
- `assigned_by_user_id` (uuid, nullable, references `auth.users(id)` ON DELETE SET NULL)
- `envelope_version` (smallint, not null, check in (1))
- `key_id` (text, nullable)
- `nonce` (bytea, nullable)
- `ciphertext` (bytea, nullable)
- `auth_tag` (bytea, nullable)
- `key_hint` (text, nullable)
- `is_active` (boolean, not null, default true)
- `created_at` (timestamptz, not null, default now())
- `updated_at` (timestamptz, not null, default now())
- `revoked_at` (timestamptz, nullable)

**DB Constraints:**
- `uq_ai_credentials_slot`: `UNIQUE (owner_user_id, provider, source)` (one slot per owner/provider/source).
- `chk_ai_credentials_provenance`: Enforces `PERSONAL` has null `assigned_by_user_id`, and active `ADMIN_ASSIGNED` requires non-null `assigned_by_user_id`.
- `chk_ai_credentials_crypto_material`: Enforces active credentials have 12-byte nonce, 16-byte auth tag, and bounded `key_hint` (1..4 printable ASCII characters, matching `^[ -~]{1,4}$`); revoked credentials have null crypto material and non-null `revoked_at`.

**Privilege Model:**
- Schema `private`: `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT USAGE TO service_role`.
- Table `private.ai_credentials`: `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT SELECT, INSERT, UPDATE TO service_role`. (No `DELETE`, no `TRUNCATE`).
- Public RPCs: `ai_credentials_read_for_service`, `ai_credentials_write_for_service`, `ai_credentials_revoke_for_service` (`SECURITY INVOKER`, `SET search_path = ''`). Browser execution revoked; granted exclusively to `service_role`.

## Phase 8: Multi-Currency FX
- **transaction_fx_snapshots**: Stores immutable point-in-time exact-decimal FX records for transactions.
  - `rate`: `numeric(30,12)` exact exchange rate.
  - `source_amount`, `converted_amount`: `numeric(20,4)`.
  - Composite unique key ensuring a single snapshot per transaction per target currency.
  - RLS restricted to owner.
  - Reads exposed via exact-text view `transaction_fx_snapshot_details`.


## Phase 13B-1: Debt & Liability Management

### public.debts

User-owned liability records. The stored outstanding_amount is the authoritative principal balance remaining.

- id, user_id
- name, lender_name, debt_type
- principal_amount, outstanding_amount, currency_code
- interest_rate, minimum_payment
- payment_frequency, first_due_date, due_day
- note, is_archived, timestamps

Constraints prevent negative balances, overpayment of initial principal, invalid currency codes, unsupported debt types/frequencies, and oversized text.

### public.debt_payments

Append-only repayment ledger owned by the same user.

- debt_id, transaction_id, account_id
- amount, principal_amount, interest_amount, currency_code
- paid_on, note, created_at

Every payment is linked to an expense transaction and the exact breakdown satisfies amount = principal_amount + interest_amount.

### Debt views and RPC

- debt_details exposes exact text amounts, paid principal/interest totals, and payment count.
- debt_payment_details joins debt, account, and expense-category labels.
- record_debt_payment is a security-definer RPC that validates auth.uid(), same-user ownership, matching account currency, active expense category, and principal availability before atomically creating the transaction, ledger row, and balance reduction.
- Browser clients receive SELECT access only for payment rows; repayment mutation is RPC-only.

### Phase 13B-1 production verification

- Migration applied successfully to Supabase project `qibfitbnlfgiqctntufr`; the failed pre-apply attempt rolled back and left no partial schema.
- `public.debts` and `public.debt_payments` both have RLS enabled with authenticated owner policies.
- `record_debt_payment` is SECURITY DEFINER with an empty `search_path`; its RPC is the only repayment mutation path.
- Production verification found zero debt rows and zero debt-payment rows, so no owner financial data was created, deleted, or rewritten by deployment.

## Phase 13B-2: Cross-Currency Debt Repayment

Phase 13B-2 preserves the Phase 13B-1 cash-flow boundary while adding explicit
dual-currency provenance to `public.debt_payments`:

- `amount` / `currency_code`: cash debited from the selected account;
- `debt_amount` / `debt_currency_code`: liability reduction;
- `principal_amount` / `interest_amount`: debt-currency allocation;
- `exchange_rate`: exact account-currency → debt-currency rate (`numeric(30,12)`);
- `exchange_rate_source` and `exchange_rate_effective_date`: explicit audit provenance.

The additive migration `phase_13b2_cross_currency_repayments` was applied as
remote version `20260909071009`. It backfills existing same-currency rows with
rate `1` and `SAME_CURRENCY`, then enforces six exact constraints including
`round(account_amount * rate, 4) = debt_amount` at the RPC boundary.

`record_debt_payment_v2` is `SECURITY DEFINER`, uses `SET search_path = ''`,
locks the debt row, validates owner/account/category and precision, creates one
expense transaction, appends one payment row, writes one
`transaction_fx_snapshots` row only for cross-currency payments, and reduces
outstanding principal atomically. The original `record_debt_payment` remains a
strict same-currency compatibility wrapper.

The `debt_payment_details` security-invoker view exposes the new provenance
fields. Reports group repayments by account/debt currency pair and never add
different currencies together. Production verification found zero debt rows,
zero payment rows, and zero debt-linked transactions after migration.
