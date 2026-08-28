# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS
- **Phase status:** CORRECTIVE_REQUIRED / REMOTE_VERIFICATION_BLOCKED
- **Audited Phase 2 implementation commit:** `c5ef559f85a1587076f48861d90e2603710cd2ed`
- **Phase 1 completion baseline:** `372e145be61679b03801dbcbc9ca311bf55ecb98`
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Source-controlled migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
- **Remote database state:** NOT VERIFIED. Repository documentation currently provides manual migration instructions, which is evidence that remote application was not proven by the implementation receipt.
- **AI integration:** Mock presentation preserved. Real Gemini integration and credential storage remain deferred.
- **PWA:** Deferred to Phase 15.

## Implemented Code Confirmed by Audit

- Real Supabase email/password sign-in and sign-up UI.
- Google OAuth initiation.
- PKCE callback route.
- Forgot/reset password UI and Supabase Auth calls.
- Next.js 16 Proxy protected-route boundary.
- Typed Supabase clients and Phase 2 database types.
- `profiles` and `user_settings` migration with RLS SELECT/UPDATE ownership predicates.
- New-user profile/settings provisioning trigger and backfill SQL.
- Profile/settings/onboarding integration in UI.
- Dynamic AppShell identity and sign-out UI.

## Corrective Findings

1. **Remote database gate is not proven.**
   - Phase 2 requires the migration to be applied and verified on the actual project `qibfitbnlfgiqctntufr`.
   - Current ChatGPT Supabase connection does not have permission to inspect that project.
   - The previous report cannot be accepted as overall PASS until remote schema/RLS is verified.

2. **Two-user RLS invariant is not verified.**
   - The existing `scripts/verify-phase2-auth.mjs` only checks anonymous behavior.
   - It does not prove User A cannot SELECT/UPDATE User B and vice versa.

3. **Verification script can falsely report PASS.**
   - It prints a PASS summary unconditionally instead of failing when exposure/errors violate the expected invariant.
   - It must use explicit assertions and non-zero exit status on failure.

4. **Publishable key is hard-coded in repository verification code.**
   - `scripts/verify-phase2-auth.mjs` includes a fallback real `sb_publishable_...` value.
   - Although a publishable key is browser-safe, project rules require runtime environment configuration rather than hard-coding actual project credentials in source.

5. **Login `next` parameter is not sanitized before client navigation.**
   - `/login` reads `next` directly from URL query parameters and passes it to `router.push()` after successful password login.
   - Redirect targets must be constrained to safe relative application paths, consistent with callback/proxy handling.

6. **Email/password login does not enforce onboarding routing.**
   - A confirmed but incomplete user can log in and be sent to `/dashboard` without checking `profiles.onboarding_completed`.
   - New/incomplete users must be sent to `/onboarding`.

7. **Settings persistence can show success after failed database updates.**
   - Profile/settings update errors are currently logged with `console.debug`, then the page sets success state anyway.
   - Save success must only be shown when required persistence operations succeed.

8. **Onboarding can redirect to dashboard after failed persistence.**
   - Persistence errors are caught/logged, but redirect happens in `finally`.
   - The user must remain on onboarding and receive actionable error feedback if the database update fails.

9. **Migration hardening should be reviewed.**
   - `handle_new_user()` legitimately needs `SECURITY DEFINER` for the `auth.users` boundary, but its `search_path` should be hardened and objects schema-qualified.
   - `handle_updated_at()` does not need elevated privileges.
   - Review UPDATE grants so immutable/system columns are not unnecessarily client-updatable.

10. **Database documentation must exactly match executable migration.**
   - `docs/DATABASE.md` currently contains naming/default details that do not exactly match the SQL migration.

## Verification State

| Check | Status | Notes |
|---|---|---|
| GitHub Phase 2 implementation | PASS | Remote commit `c5ef559f85a1587076f48861d90e2603710cd2ed` exists |
| Required auth routes present | PASS | Login/signup/reset/callback code exists |
| Migration source-control | PASS | Phase 2 migration exists |
| RLS policy source review | PASS_WITH_CORRECTIVE | Ownership predicates exist; hardening/runtime proof still required |
| Remote migration applied | BLOCKED / NOT VERIFIED | Must verify target Supabase project |
| Two-user RLS runtime test | NOT_RUN / NOT PROVEN | Existing script only checks anonymous access |
| Anonymous lockdown runtime test | INSUFFICIENT_RECEIPT | Existing script can print PASS unconditionally |
| Google OAuth E2E | NOT PROVEN | Requires provider configuration + real login |
| Email/password E2E | NOT PROVEN | Code exists; target-project runtime proof required |
| Password reset E2E | NOT PROVEN | Code exists; target-project runtime proof required |
| Settings persistence | CORRECTIVE_REQUIRED | False-success path exists |
| Onboarding persistence | CORRECTIVE_REQUIRED | Redirect-on-error path exists |
| Redirect safety | CORRECTIVE_REQUIRED | Login `next` requires sanitization |
| TypeScript/Lint/Build | REPORTED_PASS | May be rerun during corrective pass |

## Blockers

- ChatGPT's connected Supabase account currently has no permission to inspect project `qibfitbnlfgiqctntufr`.
- Remote migration, two-user RLS, and Google OAuth E2E must be proven before Phase 2 can be marked COMPLETE.

## Next Recommended Action

Execute `prompts/PHASE_2_CORRECTIVE.md`.

Do **not** start Phase 3 until Phase 2 code corrections are complete and the remote Supabase/RLS verification gates are satisfied.
