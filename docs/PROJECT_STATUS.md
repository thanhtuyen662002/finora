# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS
- **Phase status:** COMPLETED (Code & Architecture Complete; Remote SQL Ready)
- **Application code:** Next.js 16 App Router with Supabase Auth, RLS integration, and SSR Proxy route protection.
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Remote database migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
- **AI integration:** Mock presentation preserved. Real Gemini integration and credential storage remain deferred to Phase 10-12.
- **PWA:** Deferred to Phase 15.

## Confirmed Completed in Phase 2

1. **Source-Controlled Database Migration:**
   - `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
   - Created `public.profiles` (`id`, `display_name`, `avatar_url`, `onboarding_completed`, `created_at`, `updated_at`).
   - Created `public.user_settings` (`user_id`, `base_currency`, `locale`, `timezone`, `theme`, `created_at`, `updated_at`).
   - Trigger `handle_new_user()` with `SECURITY DEFINER` and `SET search_path = public` on `auth.users` `AFTER INSERT` for automated profile & settings provisioning.
   - Trigger `handle_updated_at()` on `public.profiles` and `public.user_settings`.
   - Enabled Row Level Security (RLS) on both tables with strict `auth.uid() = id` / `auth.uid() = user_id` ownership policies for SELECT and UPDATE.
   - Revoked all permissions from `anon` and `public`; granted SELECT and UPDATE to `authenticated` role.
   - Safe backfill query for existing users.

2. **TypeScript Database Typing:**
   - Created `src/types/database.ts` representing `Database['public']['Tables']['profiles']` and `user_settings`.
   - Strongly typed `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, and `src/lib/supabase/proxy.ts`.

3. **Auth & Profile Layer:**
   - Created `src/lib/auth/index.ts` providing typed helpers: `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `requestPasswordReset`, `updatePassword`, `signOut`, `getCurrentProfile`, `updateCurrentProfile`, `getCurrentUserSettings`, `updateCurrentUserSettings`.

4. **Authentication Routes:**
   - `/login`: Real email/password authentication, Google OAuth button, redirect handling, and error presentation.
   - `/signup`: Real registration with display name metadata, minimum 8-char validation, and email confirmation dispatch feedback.
   - `/forgot-password`: Real password reset email dispatch.
   - `/reset-password`: Real `updatePassword` handler for recovery sessions.
   - `/auth/callback/route.ts`: Server Route Handler exchanging PKCE auth code for session via `@supabase/ssr`, validating relative `next` redirect target to prevent open redirects, and routing to `/onboarding` or `/dashboard`.

5. **Route Protection Boundary (Next.js 16 SSR Proxy):**
   - Enforced session validation via `getUser()` in `src/lib/supabase/proxy.ts`.
   - Protected application routes (`/dashboard`, `/accounts`, `/transactions`, `/budgets`, `/goals`, `/recurring`, `/reports`, `/settings`, `/onboarding`, `/admin`).
   - Unauthenticated visitors redirected to `/login?next=...`.
   - Authenticated users on auth routes (`/login`, `/signup`, `/forgot-password`) redirected to `/dashboard`.

6. **Profile & Settings Persistence:**
   - `/settings`: Real-time loading and saving of `profiles.display_name` and `user_settings` (`base_currency`, `locale`, `timezone`, `theme`) under RLS.
   - `/settings`: Real password update via `updatePassword` and real `signOut`.
   - `/onboarding`: Step 5 completion saves `user_settings.base_currency` and marks `profiles.onboarding_completed = true`.
   - `AppShell`: Dynamically reflects authenticated user display name/initials, currency, and locale with a real sign-out action.

7. **Verification & Testing:**
   - `scripts/verify-phase2-auth.mjs` verifying anonymous access lockdown and client architecture.

## Verification State

| Check | Status | Notes |
|---|---|---|
| Required auth routes | PASS | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` |
| Route protection | PASS | SSR proxy verifies server session & redirects unauthenticated users |
| Migration source-control | PASS | `supabase/migrations/20260828000000_phase_2_auth_rls.sql` |
| RLS Ownership Policies | PASS | `auth.uid() = id` / `auth.uid() = user_id` for SELECT and UPDATE |
| TypeScript definitions | PASS | Strongly typed `Database` schema in `src/types/database.ts` |
| Settings & Profile persistence | PASS | Real queries/updates to `profiles` and `user_settings` |
| Onboarding persistence | PASS | Saves base currency and sets `onboarding_completed = true` |
| AppShell dynamic user state | PASS | Fetches authenticated user & provides real sign-out |
| TypeScript check (`npm run typecheck`) | PASS | Zero type errors |
| ESLint check (`npm run lint`) | PASS | Zero lint warnings/errors |
| Production build (`npm run build`) | PASS | Production compilation succeeds |

## Remote Database Migration Application Instruction

To apply the Phase 2 migration to the remote Supabase project `qibfitbnlfgiqctntufr`:
1. Open the Supabase Dashboard: [https://supabase.com/dashboard/project/qibfitbnlfgiqctntufr/sql/new](https://supabase.com/dashboard/project/qibfitbnlfgiqctntufr/sql/new)
2. Copy and paste the contents of `supabase/migrations/20260828000000_phase_2_auth_rls.sql`.
3. Click **Run** to execute the migration.

## Next Recommended Action

Proceed to **Phase 3 — Accounts + Categories** upon user approval.
