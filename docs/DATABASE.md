# Finora — Database

## Status

**Database implementation:** PHASE_2_AUTH_RLS_ACTIVE

This document records the data model, tables, relationships, and invariants implemented in Finora. Executable Supabase migrations under `supabase/migrations/` are the authoritative schema source of truth.

## Database Platform

- PostgreSQL via Supabase (Project ID: `qibfitbnlfgiqctntufr`)
- Supabase Auth for user identity (`auth.users`)
- Supabase Storage for future user-owned files (receipts/imports)

## Implemented Tables (Phase 2 — Auth + RLS)

### `public.profiles`

Stores user profile information associated with the Supabase Auth user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Auth user ID |
| `display_name` | `text` | `NULL` | User's chosen display name |
| `avatar_url` | `text` | `NULL` | Profile avatar URL |
| `onboarding_completed` | `boolean` | `NOT NULL DEFAULT false` | Whether user finished initial onboarding |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT timezone('utc'::text, now())` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT timezone('utc'::text, now())` | Last update timestamp |

**Triggers:**
- `set_profiles_updated_at`: Executes `handle_updated_at()` `BEFORE UPDATE`.

**RLS Policies on `public.profiles`:**
- `Users can view own profile`: `FOR SELECT USING (auth.uid() = id)`
- `Users can update own profile`: `FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`

---

### `public.user_settings`

Stores user-specific localization, default currency, and appearance preferences.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Auth user ID |
| `base_currency` | `text` | `NOT NULL DEFAULT 'VND'` | Base currency for reporting |
| `locale` | `text` | `NOT NULL DEFAULT 'vi-VN'` | Locale formatting identifier |
| `timezone` | `text` | `NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'` | Timezone identifier |
| `theme` | `text` | `NOT NULL DEFAULT 'system'` | Theme choice (`light`, `dark`, `system`) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT timezone('utc'::text, now())` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT timezone('utc'::text, now())` | Last update timestamp |

**Triggers:**
- `set_user_settings_updated_at`: Executes `handle_updated_at()` `BEFORE UPDATE`.

**RLS Policies on `public.user_settings`:**
- `Users can view own settings`: `FOR SELECT USING (auth.uid() = user_id)`
- `Users can update own settings`: `FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

---

### Automated User Provisioning Trigger

- Function: `public.handle_new_user()` (`SECURITY DEFINER`, `SET search_path = public`)
- Trigger: `on_auth_user_created` on `auth.users` `AFTER INSERT FOR EACH ROW`
- Action: Automatically creates matching row in `public.profiles` (using `raw_user_meta_data->>'full_name'`) and `public.user_settings` (with defaults `VND`, `vi-VN`, `Asia/Ho_Chi_Minh`, `system`).

---

## Planned Core Tables for Future Phases

- Phase 3: `accounts`, `categories`
- Phase 4: `transactions`
- Phase 5: `transfers`
- Phase 7: `budgets`, `goals`, `recurring_rules`
- Phase 8: `exchange_rates`
- Phase 9: `income_sources`
- Phase 10+: `ai_usage`, encrypted credentials (server-only schema)

## Ownership Model

Every user-owned record has an explicit foreign key to `auth.users(id)`.

RLS enforces data isolation at the database level. Frontend filters are not authorization.

**Invariant 1:**
```text
User A cannot SELECT, UPDATE, or DELETE User B's financial records.
```

## Migration Ledger

1. `supabase/migrations/20260828000000_phase_2_auth_rls.sql` — Phase 2: Profiles, user_settings, auth triggers, RLS policies.
