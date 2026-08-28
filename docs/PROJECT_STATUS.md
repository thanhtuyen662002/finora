# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS — COMPLETE
- **Phase status:** PASS
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Source-controlled migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
- **Strict structural verifier:** `scripts/verify-phase2-db.sql`
- **Runtime verification tools:**
  - `scripts/verify-phase2-auth.mjs`
  - `scripts/verify-phase2-rls.mjs`
  - `scripts/verify-phase2-redirect.mjs`

## Phase 2 Completion Receipt

Phase 2 is accepted complete. Code-level hardening, remote database structure, least-privilege grants, anonymous isolation, bidirectional two-user RLS isolation, and live authentication workflows have all been verified.

### Code Gate

Confirmed code-level properties:

- Supabase SSR request-boundary identity validation uses `supabase.auth.getClaims()`.
- Redirect paths are sanitized centrally.
- Callback origin does not trust arbitrary `x-forwarded-host` input.
- SSR/PKCE email confirmation and password recovery routes are implemented.
- Settings and onboarding persistence fail truthfully instead of reporting false success.
- Anonymous and two-user RLS verification scripts are assertion-based and exit non-zero on blocked/failed mandatory checks.
- TypeScript, lint, production build, and redirect-sanitization checks were reported PASS for the final-gate implementation.

## Remote Database Structural Receipt

The Phase 2 migration is applied to Supabase project `qibfitbnlfgiqctntufr`.

The strict structural verifier returned PASS on every mandatory check:

| Check | Status | Evidence |
|---|---|---|
| `01_tables_exist` | PASS | `profiles=profiles, user_settings=user_settings` |
| `02_rls_enabled` | PASS | RLS enabled on both Phase 2 tables |
| `03_rls_policies_exact` | PASS | Exactly four expected ownership SELECT/UPDATE policies |
| `04_auth_user_trigger` | PASS | `on_auth_user_created` |
| `05_updated_at_triggers` | PASS | Updated-at trigger exists on both tables |
| `06_function_security` | PASS | `handle_new_user` definer; `handle_updated_at` invoker; both empty search path |
| `07_anon_public_no_privileges` | PASS | No anon/public table privileges |
| `08_authenticated_table_privileges_exact` | PASS | `profiles:SELECT | user_settings:SELECT` |
| `09_authenticated_update_columns_exact` | PASS | Only seven approved mutable columns have authenticated UPDATE privilege |
| `10_auth_backfill_complete` | PASS | No missing profile/settings rows at verification time |
| `99_OVERALL` | PASS | Least-privilege structural gate passed |

### Least-Privilege Contract

`authenticated` has table-level `SELECT` only on `public.profiles` and `public.user_settings`.

Column-level `UPDATE` is limited to:

- `profiles.avatar_url`
- `profiles.display_name`
- `profiles.onboarding_completed`
- `user_settings.base_currency`
- `user_settings.locale`
- `user_settings.theme`
- `user_settings.timezone`

No authenticated `INSERT`, `DELETE`, broad table-level `UPDATE`, or UPDATE privilege on immutable identifiers/timestamps is part of the Phase 2 contract.

## Live Anonymous RLS Receipt

`node scripts/verify-phase2-auth.mjs` was executed against the actual target project and exited `0`.

Confirmed:

- anonymous SELECT on `profiles` rejected;
- anonymous SELECT on `user_settings` rejected;
- anonymous UPDATE on `profiles` rejected;
- anonymous UPDATE on `user_settings` rejected.

**ANON_LOCKDOWN = PASS**

## Live Two-User RLS Receipt

`node scripts/verify-phase2-rls.mjs` was executed against the actual target project with two distinct authenticated users and exited `0`.

Confirmed runtime invariant:

- User A can SELECT own profile/settings;
- User A can UPDATE and restore an allowed own profile field;
- User A cannot SELECT User B profile/settings;
- User A cannot UPDATE User B profile/settings;
- User B can SELECT own profile/settings;
- User B can UPDATE and restore an allowed own settings field;
- User B cannot SELECT User A profile/settings;
- User B cannot UPDATE User A profile/settings.

**RLS_TWO_USER_TEST = PASS**

## Live Auth E2E Receipt

The following live workflows are accepted PASS against the Vercel deployment and target Supabase project. Automated/code verification is combined with direct owner-observed manual E2E where an interactive inbox/browser step is inherently required.

| Auth Gate | Status | Evidence |
|---|---|---|
| Email/password signup | PASS | Live signup completed successfully |
| Email confirmation | PASS | Owner-observed live signup/confirmation flow completed successfully |
| Email/password login | PASS | Confirmed user successfully authenticated |
| Onboarding routing | PASS | Incomplete authenticated user routed to `/onboarding` |
| Onboarding persistence | PASS | Phase 2 onboarding fields persisted successfully |
| Settings persistence | PASS | Allowed profile/settings values persisted successfully |
| Real sign out | PASS | Supabase sign-out completed |
| Protected route after sign out | PASS | Protected route redirected to `/login` after sign-out |
| Password reset E2E | PASS | Owner-observed live recovery/reset flow completed successfully |
| Google OAuth E2E | PASS | Owner-observed real Google OAuth round-trip completed successfully and produced a Finora authenticated identity/session |

No application defect remains open from the Phase 2 Auth E2E gate.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2 Code:** PASS
- **Phase 2 Remote DB Structure:** PASS
- **Phase 2 Anonymous RLS:** PASS
- **Phase 2 Two-User Runtime RLS:** PASS
- **Phase 2 Email/Password Signup:** PASS
- **Phase 2 Email Confirmation:** PASS
- **Phase 2 Email/Password Login:** PASS
- **Phase 2 Onboarding Routing/Persistence:** PASS
- **Phase 2 Settings Persistence:** PASS
- **Phase 2 Sign Out / Route Protection:** PASS
- **Phase 2 Password Recovery:** PASS
- **Phase 2 Google OAuth:** PASS
- **Phase 2 Overall:** PASS
- **Phase 3 — Accounts + Categories:** AUTHORIZED

## Next Recommended Action

Begin Phase 3 — Accounts + Categories only. Preserve the accepted Phase 2 Auth/RLS contract. Phase 3 must introduce real account/category persistence with source-controlled migrations, user ownership, explicit least-privilege grants, RLS, and live isolation verification. Do not create transactions yet.
