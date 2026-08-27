# FINORA — PHASE 2 AUTHENTICATION + RLS

## TASK

Implement **Finora Phase 2 — Authentication + RLS** on the existing repository:

`thanhtuyen662002/finora`

Authoritative Phase 1 completion baseline:

`372e145be61679b03801dbcbc9ca311bf55ecb98`

Target Supabase project:

- Project ref: `qibfitbnlfgiqctntufr`
- Project URL: `https://qibfitbnlfgiqctntufr.supabase.co`

Use environment variables for credentials. Never hard-code the publishable key or any private credential in source control.

This phase is the first phase that introduces real authentication, database schema, migrations, and Row Level Security.

Do not begin Phase 3.

---

## 1. Mandatory Pre-Work

Before changing code:

1. Sync latest remote `main`.
2. Confirm remote HEAD.
3. Read `AGENTS.md` completely.
4. Read completely:
   - `docs/PROJECT_STATUS.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DATABASE.md`
   - `docs/DECISIONS.md`
5. Inspect the existing Supabase SSR implementation:
   - `src/lib/supabase/client.ts`
   - `src/lib/supabase/server.ts`
   - `src/lib/supabase/proxy.ts`
   - `src/proxy.ts`
6. Inspect current auth-related UI:
   - `/login`
   - `/onboarding`
   - `/settings`
   - `AppShell`
7. Treat current repository behavior as authoritative.
8. Consult current official Supabase SSR/Auth guidance where implementation details may have changed.

Preserve the approved Next.js 16 + `@supabase/ssr` foundation unless a current official API requires a bounded correction.

---

## 2. Phase 2 Objective

By the end of Phase 2, Finora must support real Supabase-backed identity and user isolation for the identity/settings layer.

Required capabilities:

- Email/password sign up;
- Email/password sign in;
- Google OAuth sign in;
- Auth callback / PKCE code exchange;
- Password reset request + reset flow;
- Session persistence;
- Real sign out;
- Protected application routes;
- `profiles` table;
- `user_settings` table;
- automatic profile/settings initialization for new Auth users;
- real persistence of profile/settings fields used in Phase 2;
- RLS on every exposed Phase 2 table;
- User A cannot read/update User B's profile/settings;
- anonymous users cannot read profile/settings rows;
- source-controlled Supabase migration;
- documentation updated from planned schema to implemented schema.

Core finance modules must continue to use mock data until their later phases.

---

## 3. Strict Scope Boundary

Allowed in Phase 2:

- Supabase Auth;
- auth routes/components;
- route protection;
- session handling;
- profiles;
- user settings;
- auth/user helper functions;
- RLS policies for Phase 2 tables;
- migration scripts;
- database types for Phase 2 schema;
- real persistence for profile/base currency/locale/timezone/theme/onboarding state;
- RLS verification tooling;
- documentation.

Forbidden in Phase 2:

- accounts table;
- categories table;
- transaction persistence;
- transfers;
- budgets table;
- goals table;
- recurring table;
- income sources table;
- real FX engine;
- Gemini integration;
- AI credential storage;
- admin RBAC implementation;
- family workspace;
- receipt storage;
- import/export backend;
- Phase 3 work.

Do not create finance tables prematurely.

---

## 4. Environment Contract

Phase 2 application code continues to require only browser-safe Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not add to browser/client configuration:

- `SUPABASE_SECRET_KEY`;
- legacy service-role key;
- database password;
- Google OAuth client secret;
- Gemini keys.

Google OAuth client secret belongs in the Supabase Auth provider configuration, not in the Finora browser bundle.

Do not commit real `.env.local` files.

---

## 5. Database Migration

Create a source-controlled migration under:

`supabase/migrations/`

The migration must implement only the Phase 2 identity/settings schema.

### `public.profiles`

Required shape:

- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text null`
- `avatar_url text null`
- `onboarding_completed boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Do not duplicate sensitive Auth credentials.
Do not use duplicated email as an authorization source.

### `public.user_settings`

Required shape:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `base_currency text not null default 'VND'`
- `locale text not null default 'vi-VN'`
- `timezone text not null default 'Asia/Ho_Chi_Minh'`
- `theme text not null default 'system'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Use sensible validation without hard-coding Finora permanently to only six currencies.
For example, validate the currency code shape rather than enumerating the Phase 1 mock list as the only legal future currencies.

Theme may be constrained to:

- `light`;
- `dark`;
- `system`.

---

## 6. New User Initialization

Every newly created `auth.users` record must automatically receive:

- one `profiles` row;
- one `user_settings` row.

Use a narrowly scoped database trigger/function suitable for Supabase Auth user creation.

If a `SECURITY DEFINER` trigger function is required for the `auth.users` boundary:

- keep the function minimal;
- use an explicitly safe `search_path`;
- do not use it as a generic RLS bypass mechanism;
- do not expose arbitrary mutation capabilities;
- document why it exists.

User metadata may be used only for non-authoritative display values such as initial display name/avatar.
Never use editable user metadata for authorization.

The migration must also safely backfill `profiles` and `user_settings` for Auth users who already exist before the migration, using `ON CONFLICT DO NOTHING` or an equivalent idempotent pattern.

---

## 7. Updated-At Handling

Implement a simple reviewed database trigger for maintaining `updated_at` on Phase 2 tables.

Do not introduce a large auditing framework.

---

## 8. RLS Requirements

Enable Row Level Security on:

- `public.profiles`;
- `public.user_settings`.

RLS is mandatory before exposing these tables through the Data API.

### Profiles

Authenticated user may:

- SELECT only their own row;
- UPDATE only their own row.

Ownership predicate:

`(select auth.uid()) = id`

UPDATE must use both:

- `USING`;
- `WITH CHECK`.

Do not create a broad policy such as only `TO authenticated` without an ownership predicate.

### User Settings

Authenticated user may:

- SELECT only their own row;
- UPDATE only their own row.

Ownership predicate:

`(select auth.uid()) = user_id`

UPDATE must use both `USING` and `WITH CHECK`.

### INSERT / DELETE

Do not grant normal clients unnecessary direct INSERT/DELETE access if rows are initialized by the Auth trigger and account deletion is not yet implemented.

Review Data API grants separately from RLS.

Anonymous users must have no profile/settings read access.

Do not disable RLS as a workaround.

---

## 9. Database Grants

Explicitly review table privileges.

Preferred Phase 2 client privilege model:

- `anon`: no profile/settings access;
- `authenticated`: SELECT + UPDATE only on the user's own rows, with RLS enforcing ownership;
- no normal client INSERT/DELETE unless implementation proves it is required.

Do not confuse grants with RLS. Both layers must be correct.

---

## 10. Database Types

Add typed database definitions for the implemented Phase 2 schema.

Preferred:

- generate Supabase TypeScript types from the actual target project after the migration is applied;
- otherwise create a tightly scoped type definition matching the exact migration and clearly document generation as pending remote tooling.

Use the database type with browser/server Supabase clients where practical.

Do not prematurely define future finance tables in generated/manual Phase 2 database types.

---

## 11. Authentication Routes

Implement real routes for:

- `/login`;
- `/signup`;
- `/forgot-password`;
- `/reset-password`;
- `/auth/callback`.

An auth-code error route or clear error redirect is allowed if useful.

Preserve Finora's existing visual design.

---

## 12. Email / Password Signup

Convert the Phase 1 signup concept into real Supabase Auth.

Required behavior:

- validate email/password locally for obvious invalid input;
- call Supabase Auth;
- handle email-confirmation-required state truthfully;
- do not claim a session exists when confirmation is pending;
- use a valid redirect/callback flow for SSR/PKCE;
- never log passwords or tokens.

After confirmed signup/sign-in, direct a new/incomplete user to `/onboarding`.

---

## 13. Email / Password Login

Convert `/login` to real authentication.

Required:

- real `signInWithPassword`;
- visible loading state;
- actionable error messages without exposing internals;
- no hard-coded test account;
- successful login redirects to `/dashboard` or `/onboarding` based on onboarding state.

---

## 14. Google OAuth

Implement Google sign-in with Supabase Auth using the current SSR/PKCE flow.

Use `signInWithOAuth({ provider: 'google', options: { redirectTo } })` or the current official equivalent.

Callback route must exchange the authorization code for a Supabase session.

The Finora repository must not contain the Google OAuth client secret.

External provider configuration is expected in Supabase Dashboard / Google Auth Platform.

For project ref `qibfitbnlfgiqctntufr`, the Google OAuth provider redirect endpoint is expected to be the Supabase project callback endpoint shown by the provider configuration, typically:

`https://qibfitbnlfgiqctntufr.supabase.co/auth/v1/callback`

Do not guess production app origins. Use runtime origin for application redirect targets and document required Supabase redirect allow-list values.

If Google provider configuration is not available in the execution environment, implementation may still be committed, but the final report must mark Google end-to-end verification as BLOCKED rather than PASS.

---

## 15. Auth Callback Safety

Create a server Route Handler for the OAuth/PKCE callback.

Requirements:

- exchange code for session server-side;
- validate any `next` query parameter so it remains a relative application path;
- avoid open redirects;
- support proxy/load-balancer host forwarding safely when needed;
- redirect failures to a clear auth error state.

---

## 16. Password Reset

Implement:

1. forgot-password form;
2. Supabase reset email request;
3. callback/session establishment as required by current Supabase SSR flow;
4. reset-password page using the supported Auth API to set a new password;
5. success redirect to login/dashboard as appropriate.

Do not build a custom password token system.

---

## 17. Route Protection

Use the approved Next.js 16 `proxy.ts` + Supabase SSR boundary.

Protect application routes such as:

- `/dashboard`;
- `/accounts`;
- `/transactions`;
- `/budgets`;
- `/goals`;
- `/recurring`;
- `/reports`;
- `/settings`;
- `/onboarding`;
- `/admin`.

Public routes include the auth entry/reset/callback routes and any intentionally public root page.

Use a verified Supabase server identity check (`getClaims()` or current official equivalent) for request-boundary protection.

Do not use an unverified client cookie or `getSession()` as server authorization proof.

Avoid redirect loops.

Remember: proxy route protection is UX/access control. **RLS remains the authoritative data security boundary.**

---

## 18. Admin Route in Phase 2

Do not implement real admin RBAC yet.

`/admin` may be restricted to authenticated users only during Phase 2, but the application/documentation must explicitly state that real admin authorization is deferred to the later Admin phase.

Do not invent an insecure email allowlist, client-side role toggle, or editable metadata role.

---

## 19. Real Sign Out

Replace mock logout behavior with real Supabase sign out.

After sign out:

- session cookies must be cleared correctly;
- protected routes must redirect to `/login`;
- no stale authenticated UI should remain.

---

## 20. Real Profile + Settings Persistence

Phase 2 should make these fields real:

### Profile

- display name;
- avatar URL only if already supplied by OAuth metadata or text value; do not build Storage upload yet;
- onboarding completion.

### User settings

- base currency;
- locale;
- timezone;
- theme.

`/settings` should read/update these values through Supabase under RLS.

Other Phase 1 settings such as:

- notification preferences;
- AI preferences;
- active sessions preview;
- feature previews;

must remain clearly non-persistent unless a Phase 2 column is explicitly listed above.

Do not expand schema just to persist every mock switch.

---

## 21. Onboarding Persistence

Use the existing onboarding UI as much as practical.

On completion, persist only Phase 2-owned fields such as:

- display name;
- base currency;
- locale;
- timezone;
- `onboarding_completed = true`.

Do not persist accounts/goals yet.
If the current onboarding UI previews first-account/goal choices, label or handle them as non-persistent Phase 1/Phase 3 previews rather than creating finance tables.

New users should arrive at onboarding until completion.

---

## 22. AppShell Identity

Replace hard-coded mock user identity in the authenticated shell with real signed-in user/profile presentation where practical.

At minimum display a real authenticated email or display name.

Do not add a global state framework solely for this.

A small typed auth/profile hook or server-provided identity is sufficient.

---

## 23. RLS Isolation Verification

Phase 2 cannot be marked PASS solely because SQL policy text looks correct.

Verify the invariant against the actual target Supabase project:

`User A cannot SELECT or UPDATE User B's profile or user_settings.`

Also verify:

`Anonymous client cannot SELECT profiles/user_settings.`

Preferred approach:

- create two disposable test Auth users, or use two explicitly designated test users;
- authenticate independently with the publishable key;
- A can read/update A;
- A cannot read/update B;
- B can read/update B;
- B cannot read/update A;
- anonymous SELECT returns no private rows.

It is acceptable to add a script such as:

`scripts/verify-phase2-rls.mjs`

that reads test credentials from uncommitted environment variables.

Never commit test passwords.
Never use a service-role key to prove end-user RLS isolation, because that would bypass RLS.

If two authenticated test users are unavailable, mark the RLS runtime verification gate BLOCKED. Do not fake PASS.

---

## 24. Remote Migration Gate

The migration must be source controlled regardless of remote tooling.

For Phase 2 overall PASS, the schema must also be applied and verified on the actual Finora Supabase project `qibfitbnlfgiqctntufr`.

If the execution environment lacks Supabase database permissions:

- commit the migration;
- report the exact migration file;
- report the exact user-side action required to apply it;
- mark `REMOTE_DATABASE` as BLOCKED;
- mark overall Phase 2 as PARTIAL/BLOCKED, not PASS.

Do not substitute a different Supabase project.

---

## 25. Google Provider External Configuration Gate

The code implementation and provider configuration are separate.

To claim Google OAuth end-to-end PASS, verify:

- Google provider enabled for the correct Supabase project;
- Google Client ID/Secret configured in Supabase provider settings;
- Google authorized redirect URI uses the Supabase callback URI;
- Supabase Site URL / redirect allow list contains the development application callback URL;
- one real Google login completes and produces a Finora session.

If external provider settings are not available, report `GOOGLE_OAUTH_E2E=BLOCKED_CONFIG` rather than PASS.

---

## 26. Security Requirements

Mandatory:

- no service-role/secret key in browser;
- no credentials in repo;
- no auth tokens logged;
- no password logs;
- no user-editable metadata used for authorization;
- no broad RLS policies;
- no RLS disabled tables in exposed Phase 2 schema;
- safe redirect handling;
- no open redirect through `next` parameters;
- no client-only route guard treated as security;
- no admin role stored only in client state;
- no real finance records added yet.

---

## 27. Documentation

Update:

- `docs/PROJECT_STATUS.md`;
- `docs/DATABASE.md`;
- `docs/ARCHITECTURE.md` if auth/data flow materially changes;
- `docs/DECISIONS.md` only for real architectural decisions.

`docs/DATABASE.md` must change Phase 2 tables from planned to implemented and identify the migration source of truth.

Document:

- auth flow;
- callback flow;
- route protection;
- RLS ownership model;
- initialization trigger;
- exact remote DB application status;
- Google provider configuration status;
- known blockers.

---

## 28. Required Verification

Run all applicable checks:

```text
npm install
npm run lint
npm run typecheck
npm run build
```

Runtime verification:

- `/login`;
- `/signup`;
- `/forgot-password`;
- `/reset-password`;
- `/auth/callback` behavior;
- unauthenticated access to `/dashboard` redirects to login;
- authenticated access to app succeeds;
- sign out works;
- protected route after sign out redirects;
- settings profile/user_settings read/write succeeds for owner;
- onboarding completion persists;
- browser console has no relevant errors.

Database verification:

- migration applied to `qibfitbnlfgiqctntufr`;
- `profiles` exists;
- `user_settings` exists;
- RLS enabled on both;
- required policies exist;
- new-user initialization works;
- existing-user backfill works;
- User A/B isolation verified;
- anonymous isolation verified.

Auth provider verification:

- email/password sign-up/login;
- email confirmation behavior if enabled;
- password reset;
- Google OAuth end-to-end if provider is configured.

Responsive verification:

- 390px;
- 768px;
- 1024px;
- 1440px;

At minimum verify auth screens and settings at mobile + desktop widths.

Never mark an unexecuted gate PASS.

---

## 29. Phase 2 Completion Rules

Phase 2 may be `PASS` only when:

- implementation is committed;
- remote GitHub main contains the implementation;
- remote target Supabase project contains the migration;
- RLS runtime isolation is proven with two authenticated users;
- email/password auth works;
- sign-out/session protection works;
- password reset works;
- Google OAuth works end-to-end OR the project explicitly defines Google provider setup as a separately accepted external blocker.

Default strict interpretation: if Google OAuth was part of the requested Phase 2 scope and cannot be verified, report PARTIAL until configured/tested.

Do not begin Phase 3 automatically.

---

## 30. Git Requirements

Review the entire diff before commit.

Suggested commit:

`feat(auth): implement Supabase authentication and RLS`

Push through the connected GitHub integration.

The final report must distinguish:

- local commit SHA;
- actual remote `main` SHA;
- whether they match.

A local-only commit is not authoritative completion.

---

## 31. Final Report Format

Return exactly:

```text
TASK
Finora Phase 2 — Authentication + RLS

STATUS
PASS / PARTIAL / BLOCKED

START_HEAD
<authoritative remote SHA>

FINAL_LOCAL_HEAD
<local SHA>

REMOTE_MAIN_HEAD
<actual remote main SHA>

HEAD_MATCH
YES / NO

AUTH
Email/password signup:
Email/password login:
Email confirmation:
Google OAuth implementation:
Google OAuth E2E:
Forgot password:
Reset password:
Sign out:
Protected routes:

DATABASE
Target project: qibfitbnlfgiqctntufr
Migration file:
Remote migration applied: YES / NO
profiles: PASS / BLOCKED
user_settings: PASS / BLOCKED
New-user initialization: PASS / BLOCKED
Backfill: PASS / BLOCKED

RLS
profiles RLS:
user_settings RLS:
User A -> User B SELECT blocked:
User A -> User B UPDATE blocked:
User B -> User A SELECT blocked:
User B -> User A UPDATE blocked:
Anonymous SELECT blocked:

PERSISTENCE
Profile:
Base currency:
Locale:
Timezone:
Theme:
Onboarding completed:

SECURITY
<summary>

DATABASE CHANGES
<exact tables/functions/triggers/policies>

VERIFICATION
Install:
Lint:
TypeScript:
Build:
Runtime:
Console:
390px:
768px:
1024px:
1440px:

EXTERNAL CONFIG
Supabase Site URL / Redirect URLs:
Google provider enabled:
Google callback configured:

KNOWN ISSUES
<NONE or exact blockers>

PROJECT STATUS
Phase 2 — Authentication + RLS:
Next Action:

REMOTE COMMIT
<actual GitHub SHA or BLOCKED>
```

Do not report PASS for a remote database or auth-provider gate that was not actually tested.
Do not begin Phase 3.

# END — FINORA PHASE 2 AUTHENTICATION + RLS
