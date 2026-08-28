# Finora — Database

## Status
**Database implementation:** PHASE_3_ACCOUNTS_CATEGORIES

This document records the data model, tables, relationships, and invariants implemented in Finora. Executable Supabase migrations under `supabase/migrations/` are the authoritative schema source of truth.

## Database Platform
- PostgreSQL via Supabase (Project ID: `qibfitbnlfgiqctntufr`)
- Supabase Auth for user identity (`auth.users`)
- Supabase Storage for future user-owned files (receipts/imports)

## Implemented Tables (Phase 2 & 3)

### `public.profiles`
Stores user profile information associated with the Supabase Auth user.
- `id` (uuid)
- `display_name` (text)
- `avatar_url` (text)
- `onboarding_completed` (boolean)
- `created_at`, `updated_at` (timestamptz)

### `public.user_settings`
Stores user-specific localization, default currency, and appearance preferences.
- `user_id` (uuid)
- `base_currency` (text)
- `locale` (text)
- `timezone` (text)
- `theme` (text)
- `created_at`, `updated_at` (timestamptz)

### `public.accounts`
User financial accounts managed under RLS.
- `id` (uuid)
- `user_id` (uuid)
- `name` (text)
- `type` (text: CASH, BANK, EWALLET, SAVINGS, CREDIT_CARD, INVESTMENT, OTHER)
- `currency_code` (text)
- `opening_balance` (numeric)
- `institution` (text)
- `color` (text)
- `is_archived` (boolean)
- `created_at`, `updated_at` (timestamptz)

### `public.categories`
User financial categories managed under RLS.
- `id` (uuid)
- `user_id` (uuid)
- `name` (text)
- `type` (text: INCOME, EXPENSE)
- `icon` (text)
- `color` (text)
- `is_archived` (boolean)
- `created_at`, `updated_at` (timestamptz)

## Ownership Model
Every user-owned record has an explicit foreign key to `auth.users(id)`.
RLS enforces data isolation at the database level. Frontend filters are not authorization.

**Invariant 1:**
```text
User A cannot SELECT, INSERT, UPDATE, or DELETE User B's financial records.
```

## Migration Ledger
1. `supabase/migrations/20260828000000_phase_2_auth_rls.sql` — Phase 2: Profiles, user_settings, auth triggers, hardened search path & invoker permissions, explicit removal of Supabase default table grants, minimum column-level update grants, and RLS policies.
2. `supabase/migrations/20260828000001_phase_3_accounts_categories.sql` — Phase 3: Accounts, Categories, seeding triggers, RLS policies.
