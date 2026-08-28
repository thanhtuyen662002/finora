# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 2 — Authentication + RLS
- **Phase status:** REMOTE_DB_STRUCTURAL_PASS / RUNTIME_RLS_E2E_PENDING
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Source-controlled migration:** `supabase/migrations/20260828000000_phase_2_auth_rls.sql`
- **Strict structural verifier:** `scripts/verify-phase2-db.sql`
- **Runtime verification tools:**
  - `scripts/verify-phase2-auth.mjs`
  - `scripts/verify-phase2-rls.mjs`
  - `scripts/verify-phase2-redirect.mjs`

## Phase 2 Code Gate

Phase 2 implementation and corrective/final-gate code are complete and published. The following code-level gates are confirmed:

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
| `10_auth_backfill_complete` | PASS | `auth_users=0, profiles=0, user_settings=0` at verification time |
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

## Remaining Mandatory Gate

Phase 2 is not yet COMPLETE because runtime user-isolation has not been proven against two distinct authenticated users.

Required live verification:

1. Create two distinct disposable authenticated users (User A and User B) on the target Supabase project.
2. Confirm the `on_auth_user_created` trigger provisions one `profiles` row and one `user_settings` row for each user.
3. Run `node scripts/verify-phase2-auth.mjs` against the live project.
4. Run `node scripts/verify-phase2-rls.mjs` with User A/B credentials supplied only through environment variables.
5. Required runtime invariant:
   - A can SELECT/UPDATE allowed fields on A.
   - A cannot SELECT/UPDATE B.
   - B can SELECT/UPDATE allowed fields on B.
   - B cannot SELECT/UPDATE A.
   - anonymous access remains blocked.

Do not commit or share test-user passwords.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** STRUCTURAL PASS / RUNTIME RLS E2E PENDING
- **Phase 3:** NOT AUTHORIZED

## Next Recommended Action

Create two disposable confirmed test users, run the anonymous and two-user runtime verification scripts against `qibfitbnlfgiqctntufr`, and record the output. Phase 3 — Accounts + Categories may start only after those runtime gates PASS.
