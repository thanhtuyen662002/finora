# Finora — Database

## Status

**Database implementation:** PHASE_2_AUTH_RLS_ACTIVE (Hardened)

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
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

**Triggers:**
- `set_profiles_updated_at`: Executes `handle_updated_at()` (`SECURITY INVOKER`, `SET search_path = ''`) `BEFORE UPDATE`.

**RLS Policies on `public.profiles`:**
- `Users can select own profile`: `FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id)`
- `Users can update own profile`: `FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id)`

**Privileges:**
- `REVOKE ALL ON TABLE public.profiles FROM anon, public;`
- `GRANT SELECT ON TABLE public.profiles TO authenticated;`
- `GRANT UPDATE (display_name, avatar_url, onboarding_completed) ON TABLE public.profiles TO authenticated;`

---

### `public.user_settings`

Stores user-specific localization, default currency, and appearance preferences.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Auth user ID |
| `base_currency` | `text` | `NOT NULL DEFAULT 'VND' CHECK (char_length(base_currency) >= 3 AND char_length(base_currency) <= 5)` | Base currency for reporting |
| `locale` | `text` | `NOT NULL DEFAULT 'vi-VN' CHECK (char_length(locale) >= 2 AND char_length(locale) <= 10)` | Locale formatting identifier |
| `timezone` | `text` | `NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'` | Timezone identifier |
| `theme` | `text` | `NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'))` | Theme choice (`light`, `dark`, `system`) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

**Triggers:**
- `set_user_settings_updated_at`: Executes `handle_updated_at()` (`SECURITY INVOKER`, `SET search_path = ''`) `BEFORE UPDATE`.

**RLS Policies on `public.user_settings`:**
- `Users can select own settings`: `FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)`
- `Users can update own settings`: `FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)`

**Privileges:**
- `REVOKE ALL ON TABLE public.user_settings FROM anon, public;`
- `GRANT SELECT ON TABLE public.user_settings TO authenticated;`
- `GRANT UPDATE (base_currency, locale, timezone, theme) ON TABLE public.user_settings TO authenticated;`

---

### Automated User Provisioning Trigger

- Function: `public.handle_new_user()` (`SECURITY DEFINER`, `SET search_path = ''`)
- Trigger: `on_auth_user_created` on `auth.users` `AFTER INSERT FOR EACH ROW`
- Action: Automatically creates matching row in `public.profiles` (extracting `display_name` via `pg_catalog.coalesce` from `full_name`, `name`, `display_name`, or email prefix) and `public.user_settings` (with defaults `VND`, `vi-VN`, `Asia/Ho_Chi_Minh`, `system`).

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

1. `supabase/migrations/20260828000000_phase_2_auth_rls.sql` — Phase 2: Profiles, user_settings, auth triggers, hardened search path & invoker permissions, column-level update grants, RLS policies.
