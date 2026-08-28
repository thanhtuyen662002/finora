# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS
- **Phase status:** REMOTE_DB_STRUCTURAL_PASS / ANON_RLS_PASS / TWO_USER_RLS_BLOCKED_USER_B_CREDENTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Source-controlled migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
- **Strict structural verifier:** `scripts/verify-phase2-db.sql`
- **Runtime verification tools:**
  - `scripts/verify-phase2-auth.mjs`
  - `scripts/verify-phase2-rls.mjs`
  - `scripts/verify-phase2-redirect.mjs`

## Phase 2 Code Gate

Phase 2 implementation and corrective/final-gate code are complete and published. Confirmed code-level gates include:

- Supabase SSR request-boundary identity validation uses `supabase.auth.getClaims()`.
- Redirect paths are sanitized centrally.
- Callback origin no longer trusts arbitrary `x-forwarded-host` input.
- SSR/PKCE email confirmation and password recovery routes are implemented.
- Settings and onboarding persistence fail truthfully instead of reporting false success.
- Anonymous and two-user RLS verification scripts are assertion-based and exit non-zero on blocked/failed mandatory checks.
- TypeScript, lint and production build were reported PASS for the final-gate implementation.

## Remote Database Structural Receipt

The Phase 2 migration has been manually applied to Supabase project `qibfitbnlfgiqctntufr` and the strict structural verifier returned PASS on every mandatory check.

| Check | Status | Evidence |
|---|---|---|
| `01_tables_exist` | PASS | `profiles=profiles, user_settings=user_settings` |
| `02_rls_enabled` | PASS | `profiles=true, user_settings=true` |
| `03_rls_policies_exact` | PASS | Exactly four expected SELECT/UPDATE ownership policies |
| `04_auth_user_trigger` | PASS | `on_auth_user_created` |
| `05_updated_at_triggers` | PASS | Updated-at trigger exists on both tables |
| `06_function_security` | PASS | `handle_new_user` security definer; `handle_updated_at` invoker; both empty search path |
| `07_anon_public_no_privileges` | PASS | No anon/public table privileges |
| `08_authenticated_table_privileges_exact` | PASS | `profiles:SELECT | user_settings:SELECT` |
| `09_authenticated_update_columns_exact` | PASS | Only 7 approved mutable columns have authenticated UPDATE privileges |
| `10_auth_backfill_complete` | PASS | Structural verifier completed successfully |
| `99_OVERALL` | PASS | `Phase 2 database structural gate passed with least-privilege grants` |

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

No authenticated `INSERT`, `DELETE`, broad table-level `UPDATE`, or update privileges on immutable identifiers/timestamps are part of the Phase 2 contract.

## Live Runtime Verification Receipt

### Anonymous RLS

`node scripts/verify-phase2-auth.mjs` executed against the live Supabase project and exited with code `0`.

Verified live behavior:

- Anonymous SELECT on `public.profiles` rejected with `permission denied for table profiles`.
- Anonymous SELECT on `public.user_settings` rejected with `permission denied for table user_settings`.
- Anonymous UPDATE on `public.profiles` rejected.
- Anonymous UPDATE on `public.user_settings` rejected.

**Anonymous RLS Isolation: PASS.**

### Two-User RLS

`node scripts/verify-phase2-rls.mjs` started against two configured users.

- User A authenticated successfully and received a valid UUID.
- User B authentication failed with `Invalid login credentials`.
- Script exited non-zero (`1`) before any cross-user RLS assertions ran.

This is an external test-credential blocker, not an RLS failure.

**Two-User RLS Isolation: BLOCKED_USER_B_CREDENTIAL.**

## Remaining Mandatory Gate

Phase 2 is not yet COMPLETE because bidirectional runtime isolation has not been proven with two successfully authenticated users.

Required next action:

1. Fix or reset User B credentials in the target Supabase project and ensure the user is confirmed.
2. Keep User A unchanged.
3. Re-run only `node scripts/verify-phase2-rls.mjs` with both users supplied through environment variables.
4. Required invariant:
   - A can SELECT/UPDATE allowed fields on A.
   - A cannot SELECT/UPDATE B.
   - B can SELECT/UPDATE allowed fields on B.
   - B cannot SELECT/UPDATE A.

Do not commit or share test-user passwords.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** STRUCTURAL PASS / ANON RLS PASS / TWO-USER RLS BLOCKED ON USER B CREDENTIAL
- **Phase 3:** NOT AUTHORIZED

## Next Recommended Action

Correct User B login credentials and re-run `node scripts/verify-phase2-rls.mjs`. Phase 3 — Accounts + Categories may start only after that runtime two-user gate passes.
