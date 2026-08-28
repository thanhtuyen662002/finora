# FINORA — PHASE 2 CORRECTIVE PASS

## TASK

Correct the existing **Finora Phase 2 — Authentication + RLS** implementation only.

Repository:

`thanhtuyen662002/finora`

Audited Phase 2 implementation commit:

`c5ef559f85a1587076f48861d90e2603710cd2ed`

Target Supabase project:

- Project ref: `qibfitbnlfgiqctntufr`
- Project URL: `https://qibfitbnlfgiqctntufr.supabase.co`

Do not rebuild Phase 2 from scratch.
Do not begin Phase 3.

---

## 1. Mandatory Pre-Work

Before changing implementation:

1. Sync latest remote `main`.
2. Read `AGENTS.md` completely.
3. Read:
   - `docs/PROJECT_STATUS.md`
   - `docs/DATABASE.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `prompts/PHASE_2_AUTH_RLS.md`
4. Inspect the existing Phase 2 implementation and migration.
5. Preserve approved Phase 1 behavior and Phase 0 Next.js 16 + Supabase SSR architecture.

This is a bounded corrective pass.

---

## 2. Strict Scope

Allowed:

- Phase 2 auth flow corrections;
- redirect safety;
- onboarding routing;
- settings/onboarding persistence error handling;
- RLS verification tooling;
- Phase 2 migration hardening;
- documentation accuracy;
- remote Phase 2 verification.

Forbidden:

- accounts/categories schema;
- transaction persistence;
- budgets/goals schema;
- FX engine;
- Gemini implementation;
- admin RBAC;
- family workspace;
- Phase 3 implementation.

---

## 3. Remove Hard-Coded Project Credential From Verification Script

Current `scripts/verify-phase2-auth.mjs` contains a fallback actual publishable key.

Remove all actual key values from repository source.

The verification script must require runtime environment values such as:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

If required configuration is absent:

- print a clear error;
- exit non-zero;
- do not silently use a committed fallback key.

A project ref/URL may be documented as the intended target, but actual credential values must not be embedded.

Do not add service-role credentials.

---

## 4. Replace False-PASS Verification Logic

The existing verification script prints PASS regardless of whether individual operations actually prove the invariant.

Replace it with assertion-based verification.

A verification script must:

- distinguish expected empty result from unexpected API/schema errors;
- fail if anonymous access exposes rows;
- fail if expected tables do not exist;
- fail if authentication fails;
- fail if cross-user SELECT/UPDATE is possible;
- exit with non-zero status on any failed invariant;
- only print PASS after every required assertion passes.

Do not treat generic API errors as proof of RLS correctness.

---

## 5. Implement Real Two-User RLS Verification

Create or replace verification tooling with a script such as:

`scripts/verify-phase2-rls.mjs`

It must use the normal publishable key, never service role.

Read disposable test-user credentials only from environment variables, for example:

- `FINORA_TEST_USER_A_EMAIL`
- `FINORA_TEST_USER_A_PASSWORD`
- `FINORA_TEST_USER_B_EMAIL`
- `FINORA_TEST_USER_B_PASSWORD`

Do not commit passwords.

Required assertions:

### User A

- signs in successfully;
- SELECT own profile succeeds;
- SELECT own settings succeeds;
- UPDATE own allowed field succeeds;
- SELECT User B profile returns no accessible row;
- SELECT User B settings returns no accessible row;
- UPDATE User B profile affects zero rows / is denied;
- UPDATE User B settings affects zero rows / is denied.

### User B

Run the symmetric checks against User A.

### Anonymous

- cannot read private profile rows;
- cannot read private settings rows;
- cannot update rows.

Restore any modified test display/settings value where practical.
Sign out test clients after verification.

If two disposable test users are unavailable, the script/tooling may still be committed, but runtime gate must be reported BLOCKED rather than PASS.

---

## 6. Sanitize Login Redirects

Current `/login` reads the `next` query parameter and passes it directly to `router.push()` after password login.

Create/reuse one small redirect sanitizer.

A valid target must be an internal relative application path.

Reject at minimum:

- absolute URLs;
- protocol-relative URLs (`//host`);
- malformed values;
- control-character based values;
- targets that could leave the Finora origin.

Default to `/dashboard` when invalid.

Use the same redirect-safety logic consistently across login/callback/proxy where practical without over-engineering.

---

## 7. Enforce Onboarding Routing After Email Login

After a successful email/password login:

1. determine the current user's `profiles.onboarding_completed` state;
2. if false or missing because provisioning has not completed correctly, route to `/onboarding` rather than `/dashboard`;
3. if true, use the safe requested `next` target or `/dashboard`.

Do not rely only on signup flow to send users to onboarding.

Google callback should preserve the same invariant.

Avoid redirect loops.

---

## 8. Correct Settings Persistence Truthfulness

Current `/settings` logs database errors and still shows success.

Correct this.

When saving the Phase 2 persistent fields:

- profile update errors must be treated as save failure;
- user_settings update errors must be treated as save failure;
- do not display success unless all required writes succeed;
- display an actionable user-facing error;
- do not expose sensitive/internal details unnecessarily.

Phase 1-only mock preferences must remain non-persistent and clearly separated.

Do not create extra columns for them.

---

## 9. Correct Onboarding Persistence Failure Handling

Current onboarding redirects to `/dashboard` in `finally`, even if Supabase writes fail.

Correct this.

On final onboarding completion:

- update the allowed Phase 2 settings;
- update `profiles.onboarding_completed = true`;
- verify both operations returned success;
- only redirect to `/dashboard` after persistence succeeds;
- on failure, remain on onboarding and show an actionable retryable error;
- do not silently swallow the failure with `console.debug`.

Account/goal choices remain preview-only and must not create Phase 3 rows.

---

## 10. Sign-Out Error Handling

Where real sign-out is exposed:

- handle Supabase sign-out errors truthfully;
- do not claim sign-out completed before the call succeeds;
- after success redirect to `/login` and refresh authenticated UI.

Keep implementation simple.

---

## 11. Harden Phase 2 Migration

Review `supabase/migrations/20260828000000_phase_2_auth_rls.sql` before remote application.

### `handle_new_user()`

`SECURITY DEFINER` is acceptable/expected for the narrow `auth.users` trigger boundary, but harden it:

- prefer a non-user-writable search path such as `SET search_path = ''`;
- schema-qualify referenced objects (`public.profiles`, `public.user_settings`);
- keep metadata use non-authoritative;
- keep function scope minimal.

### `handle_updated_at()`

It does not require elevated privileges.

Prefer normal invoker behavior unless there is a demonstrated reason otherwise.

### Client UPDATE privileges

Review whether full-table UPDATE privilege exposes system-managed fields unnecessarily.

Prefer allowing authenticated clients to update only intended mutable columns where practical, for example:

`profiles`:
- `display_name`
- `avatar_url`
- `onboarding_completed`

`user_settings`:
- `base_currency`
- `locale`
- `timezone`
- `theme`

Do not allow normal clients to modify primary ownership keys or creation timestamps merely because RLS restricts the row.

Keep RLS `USING` + `WITH CHECK` ownership predicates.

Do not introduce INSERT/DELETE client grants.

If changing the already-created migration before it has been applied remotely, edit the migration directly.
If evidence shows it has already been applied remotely, create an additive corrective migration instead of rewriting applied history.

Determine which case is true before choosing.

---

## 12. Remote Database Application and Verification

Overall Phase 2 cannot be PASS until the actual target project is verified.

Target:

`qibfitbnlfgiqctntufr`

After code/migration correction:

1. apply the migration(s) to the actual target Supabase project;
2. confirm `public.profiles` exists;
3. confirm `public.user_settings` exists;
4. confirm RLS is enabled on both;
5. confirm exact SELECT/UPDATE policies;
6. confirm grants/column privileges;
7. confirm new-user trigger exists;
8. create/use two disposable test users;
9. run two-user RLS verification;
10. run anonymous lockdown verification.

If the environment cannot apply or inspect the remote database, do NOT report PASS.
Report `REMOTE_DATABASE=BLOCKED` and the exact user action needed.

Do not substitute another project.

---

## 13. Google OAuth Gate

Code presence is not E2E proof.

To report Google OAuth PASS, verify on the correct Supabase project:

- Google provider enabled;
- provider Client ID/Secret configured in Supabase;
- Google Authorized Redirect URI correctly points to the Supabase callback endpoint;
- Finora development app callback/redirect is allowed;
- one actual Google login completes and produces an authenticated Finora session.

If configuration cannot be completed in the environment, report:

`GOOGLE_OAUTH_E2E=BLOCKED_CONFIG`

Do not block source-code corrective work on this external configuration.

---

## 14. Email/Password and Password Reset Runtime Gates

Against the actual Supabase target, verify when possible:

- signup;
- confirmation-required state if enabled;
- confirmed login;
- incomplete user redirected to onboarding;
- completed user redirected to safe target/dashboard;
- forgot-password request;
- recovery link/session establishment;
- new password update;
- sign-out;
- protected route redirect after sign-out.

If email delivery or external configuration prevents a full test, report the precise blocked gate.

---

## 15. Documentation Accuracy

Update:

- `docs/PROJECT_STATUS.md`;
- `docs/DATABASE.md`;
- `docs/DECISIONS.md` only if a new architectural decision is actually made.

Requirements:

- migration status must distinguish source-controlled vs applied remotely;
- docs must match exact SQL names/defaults/policies;
- never say RLS runtime PASS based only on policy source text;
- never say persistence PASS if runtime was not verified;
- record the exact audited remote implementation SHA.

---

## 16. Required Verification

Run:

- dependency install as needed;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- relevant app runtime checks;
- redirect-safety checks;
- corrected anonymous verification;
- two-user RLS verification when credentials are available.

Do not mark unexecuted checks PASS.

---

## 17. Completion Gate

Phase 2 may be marked PASS only when all mandatory gates are proven:

- corrected source code pushed to GitHub;
- no hard-coded actual publishable key in verification source;
- safe login redirect handling;
- onboarding redirect invariant correct;
- settings does not false-report save success;
- onboarding does not redirect after failed persistence;
- migration hardened/reviewed;
- migration actually applied to `qibfitbnlfgiqctntufr`;
- tables and RLS verified remotely;
- two authenticated users prove isolation;
- anonymous lockdown proves no access;
- email/password core E2E proven;
- Google OAuth either proven PASS or explicitly BLOCKED_CONFIG (if external config remains unavailable, overall status should reflect that according to the original Phase 2 gate);
- documentation accurate.

Do not begin Phase 3.

---

## 18. Git

Review the complete diff.

Suggested corrective commit:

`fix(auth): harden Phase 2 auth and RLS verification`

Publish the corrective work to remote `main` if the connected workflow allows it.

Remote GitHub SHA is authoritative, not a local-only SHA.

---

## 19. Final Report

Return exactly:

```text
TASK
Finora Phase 2 — Corrective Pass

STATUS
PASS / PARTIAL / BLOCKED

START_HEAD
<remote SHA>

FINAL_LOCAL_HEAD
<local SHA>

REMOTE_MAIN_HEAD
<actual GitHub main SHA>

HEAD_MATCH
YES / NO

CODE_CORRECTIONS
<summary>

MIGRATION
<file(s) and hardening summary>

REMOTE_DATABASE
PASS / BLOCKED

MIGRATION_APPLIED
YES / NO

REMOTE_SCHEMA
profiles: PASS / BLOCKED
user_settings: PASS / BLOCKED
RLS enabled: PASS / BLOCKED
policies: PASS / BLOCKED
grants: PASS / BLOCKED
trigger: PASS / BLOCKED

RLS_TWO_USER_TEST
PASS / BLOCKED

ANON_LOCKDOWN
PASS / BLOCKED

EMAIL_PASSWORD_E2E
PASS / BLOCKED

ONBOARDING_ROUTING
PASS / BLOCKED

SETTINGS_PERSISTENCE
PASS / BLOCKED

PASSWORD_RESET_E2E
PASS / BLOCKED

GOOGLE_OAUTH_E2E
PASS / BLOCKED_CONFIG

ROUTE_PROTECTION
PASS / BLOCKED

REDIRECT_SAFETY
PASS / BLOCKED

SECURITY
<summary>

VERIFICATION
Lint:
TypeScript:
Build:
Runtime:
RLS script:

KNOWN_BLOCKERS
<NONE or exact blockers>

PROJECT STATUS
<state>

REMOTE COMMIT
<actual pushed SHA or BLOCKED>
```

Then stop.

Do not begin Phase 3.
