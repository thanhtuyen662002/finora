# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS (Corrective Pass Completed)
- **Phase status:** CODE_CORRECTED / AWAITING_REMOTE_E2E_CONFIRMATION
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Source-controlled migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql` (Hardened)
- **Verification Tooling:**
  - `scripts/verify-phase2-auth.mjs`: Strict assertion-based anonymous RLS validation without hardcoded credentials.
  - `scripts/verify-phase2-rls.mjs`: Dynamic two-user cross-tenant isolation and RLS authorization testing script.
- **AI integration:** Mock presentation preserved. Real Gemini integration and credential storage remain deferred.
- **PWA:** Deferred to Phase 15.

## Corrective Pass Implementation Summary

1. **Removed Hard-Coded Credentials:**
   - Stripped fallback publishable key from `scripts/verify-phase2-auth.mjs`.
   - Script strictly uses `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and fails non-zero if missing.

2. **Assertion-Based Anonymous Verification (`scripts/verify-phase2-auth.mjs`):**
   - Asserts anonymous SELECT on `public.profiles` returns 0 rows or is rejected.
   - Asserts anonymous SELECT on `public.user_settings` returns 0 rows or is rejected.
   - Asserts anonymous UPDATE on `public.profiles` and `public.user_settings` modifies 0 rows or is rejected.
   - Exits non-zero (`process.exit(1)`) on any assertion violation or table missing error.

3. **Two-User RLS Verification Tooling (`scripts/verify-phase2-rls.mjs`):**
   - Tests User A reading/updating own data (allowed).
   - Tests User A attempting to read/update User B's profile and user_settings (asserted 0 rows / blocked).
   - Tests User B attempting to read/update User A's data (asserted 0 rows / blocked).
   - Exits non-zero on any isolation breach.

4. **Sanitized Login and Callback Redirects:**
   - Implemented centralized `getSafeRedirectUrl()` in `src/lib/auth/redirect.ts` with strict relative-path, control-character, backslash, and protocol-relative (`//`) checks.
   - Integrated into `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, and `src/lib/supabase/proxy.ts`.

5. **Enforced Onboarding Routing After Email Login:**
   - In `src/app/login/page.tsx`, successful password authentication queries `getCurrentProfile()`.
   - If `profile.onboarding_completed === false`, user is routed to `/onboarding` regardless of raw `next` destination.

6. **Truthful Settings Persistence:**
   - In `src/app/settings/page.tsx`, database update errors from `updateCurrentProfile` or `updateCurrentUserSettings` immediately halt execution, display error feedback, and suppress success notifications.

7. **Onboarding Persistence Error Handling:**
   - In `src/app/onboarding/page.tsx`, database update errors prevent redirect to `/dashboard`, display actionable error alerts, and allow the user to retry.

8. **Migration Hardening:**
   - `handle_updated_at()`: Changed to `SECURITY INVOKER`, `SET search_path = ''`, uses `pg_catalog.now()`.
   - `handle_new_user()`: Configured with `SECURITY DEFINER`, `SET search_path = ''`, and all schema functions (`pg_catalog.coalesce`, `pg_catalog.split_part`, `pg_catalog.now()`, `public.profiles`, `public.user_settings`) fully qualified.
   - Applied column-level UPDATE grants on `public.profiles` and `public.user_settings` to authenticated users to protect immutable system columns (`id`, `user_id`, `created_at`).

9. **Documentation Alignment:**
   - Updated `docs/DATABASE.md` to exactly match SQL migration tables, columns, constraints, triggers, privileges, and RLS policies.

## Verification State

| Check | Status | Notes |
|---|---|---|
| Redirect safety & sanitization | PASS | `getSafeRedirectUrl` tested across login, callback, and proxy |
| Onboarding routing enforcement | PASS | Incomplete profile check added to password login flow |
| Settings persistence truthfulness | PASS | Failure stops success feedback and displays error banner |
| Onboarding persistence safety | PASS | Failure prevents navigation to dashboard and surfaces error |
| Anonymous lockdown script | PASS | Assertion-based script without hardcoded secrets |
| Two-user RLS script | PASS | Automated two-user cross-tenant test script implemented |
| Migration hardening | PASS | Invoker permissions, empty search_path, column grants applied |
| Database documentation | PASS | Matches migration SQL exactly |
| TypeScript verification | PASS | `npm run typecheck` passes with zero errors |
| Lint verification | PASS | ESLint passes with zero errors |
| Production build | PASS | `npm run build` succeeds |

## Blockers

- Remote live database execution on target Supabase project `qibfitbnlfgiqctntufr` requires direct project database access or running the hardened migration via Supabase SQL Editor.
- When test users are provisioned, run `FINORA_TEST_USER_A_EMAIL=... FINORA_TEST_USER_A_PASSWORD=... FINORA_TEST_USER_B_EMAIL=... FINORA_TEST_USER_B_PASSWORD=... node scripts/verify-phase2-rls.mjs`.

## Next Recommended Action

1. Apply the hardened migration `supabase/migrations/20260828000000_phase_2_auth_rls.sql` to Supabase project `qibfitbnlfgiqctntufr`.
2. Run `node scripts/verify-phase2-auth.mjs` against the remote project.
3. Run `scripts/verify-phase2-rls.mjs` with two test accounts.
4. Proceed to Phase 3 (Accounts + Categories) only after remote verification is confirmed.
