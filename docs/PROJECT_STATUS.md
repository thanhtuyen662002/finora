# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS
- **Phase status:** REMOTE_DB_STRUCTURAL_PASS / ANON_RLS_PASS / TWO_USER_RLS_PASS / AUTH_CORE_E2E_PASS / EMAIL_AND_GOOGLE_EXTERNAL_CONFIG_BLOCKED
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Source-controlled migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
- **Strict structural verifier:** `scripts/verify-phase2-db.sql`
- **Runtime verification tools:**
  - `scripts/verify-phase2-auth.mjs`
  - `scripts/verify-phase2-rls.mjs`
  - `scripts/verify-phase2-redirect.mjs`

## Phase 2 Code Gate

Phase 2 implementation, corrective pass, and final-gate hardening are complete and published.

Confirmed code-level properties include:

- Supabase SSR request-boundary identity validation uses `supabase.auth.getClaims()`.
- Redirect paths are sanitized centrally.
- Callback origin does not trust arbitrary `x-forwarded-host` input.
- SSR/PKCE email confirmation and password recovery routes are implemented.
- Settings and onboarding persistence stop and surface errors instead of reporting false success.
- Anonymous and two-user RLS verification scripts are assertion-based and exit non-zero on blocked/failed mandatory checks.
- TypeScript, lint, production build, and redirect-sanitization checks were reported PASS for the final-gate implementation.

## Remote Database Structural Receipt

The Phase 2 migration has been manually applied to Supabase project `qibfitbnlfgiqctntufr`.

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

`node scripts/verify-phase2-rls.mjs` was executed against the actual target project with two distinct authenticated test users and exited `0`.

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

This proves Phase 2 ownership isolation against the live Supabase project without a service-role bypass.

## Live Auth E2E Receipt

A bounded live Auth E2E pass was executed against the actual target project with no code changes.

| Auth Gate | Status | Evidence / Blocker |
|---|---|---|
| Email/password signup | BLOCKED | Supabase default mailer returned `email rate limit exceeded`; custom SMTP is required for reliable confirmation delivery |
| Email confirmation | BLOCKED_CONFIG | Requires working outbound email delivery and access to the confirmation email/token-hash link |
| Email/password login | PASS | Existing confirmed user successfully authenticated |
| Onboarding routing | PASS | Incomplete authenticated user routed to `/onboarding` |
| Onboarding persistence | PASS | Phase 2 onboarding fields persisted successfully |
| Settings persistence | PASS | Allowed profile/settings values persisted successfully |
| Real sign out | PASS | Supabase session sign-out completed |
| Protected route after sign out | PASS | Protected route redirected to `/login` after sign-out |
| Password reset E2E | BLOCKED_CONFIG | Default mailer rate limit prevents reliable recovery email delivery; requires custom SMTP and live recovery-link completion |
| Google OAuth E2E | BLOCKED_CONFIG | Supabase Google provider is disabled; Auth returned `Unsupported provider: provider is not enabled` |

No application defect was identified by the live Auth E2E run. Remaining blockers are external hosted Auth configuration.

## External Configuration Required to Close Phase 2

### Email Auth / Password Recovery

Configure a custom SMTP provider in the Supabase project so confirmation and password-recovery emails can be delivered reliably. Then complete one real signup confirmation and one real password reset/recovery flow.

The hosted Supabase email templates must remain compatible with the implemented SSR/PKCE confirmation route:

- signup confirmation should deliver a token-hash link to Finora `/auth/confirm` with the correct email OTP type;
- password recovery should deliver a token-hash link to Finora `/auth/confirm?type=recovery&next=/reset-password`.

### Google OAuth

Enable Google under Supabase Authentication Providers using a valid Google OAuth Client ID and Client Secret. Google must authorize the Supabase provider callback URI for project `qibfitbnlfgiqctntufr`. After provider setup, perform one real Google login and verify a valid Finora session and onboarding routing.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2 Code:** PASS
- **Phase 2 Remote DB Structure:** PASS
- **Phase 2 Anonymous RLS:** PASS
- **Phase 2 Two-User Runtime RLS:** PASS
- **Phase 2 Core Auth E2E:** PASS
- **Phase 2 Email Confirmation / Password Recovery:** BLOCKED_CONFIG
- **Phase 2 Google OAuth:** BLOCKED_CONFIG
- **Phase 2 Overall:** PARTIAL / EXTERNAL_CONFIG_BLOCKED
- **Phase 3:** NOT AUTHORIZED

## Next Recommended Action

Configure custom SMTP and Google OAuth in the hosted Supabase project, then rerun only the blocked Email Signup/Confirmation, Password Recovery, and Google OAuth E2E gates. Do not rerun database/RLS gates and do not begin Phase 3 until those externally blocked Phase 2 gates are resolved truthfully.
