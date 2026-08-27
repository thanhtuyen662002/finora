# Google AI Studio Task — Finora Phase 0 Corrective Pass

## Governing Instruction

You are working inside the existing GitHub repository:

`thanhtuyen662002/finora`

Before changing anything:

1. Read `AGENTS.md` completely.
2. Read `docs/PROJECT_STATUS.md` completely.
3. Read `docs/ARCHITECTURE.md`.
4. Read `docs/DECISIONS.md`.
5. Read `docs/DATABASE.md`.
6. Read the existing Phase 0 implementation and lockfile.
7. Inspect the current remote `main` HEAD before coding.

This task is a **corrective pass for Phase 0 only**.

Do not start Phase 1.

## Why This Corrective Pass Exists

The first Phase 0 implementation built and rendered successfully, but repository audit found foundation drift:

- final report SHA did not match the pushed GitHub HEAD;
- the project uses Next.js 15-era middleware conventions for a new project;
- `@supabase/ssr` is pinned to an old `0.5.2` implementation;
- current Supabase SSR guidance uses Proxy + `getClaims()` and propagates cache headers returned by cookie writes;
- `.env.example` reintroduced future secrets that Phase 0 intentionally removed;
- shadcn-style files exist without a normal `components.json` project configuration;
- Node runtime requirements are not explicit even though the resolved Supabase SDK requires Node.js 22+.

The objective is to repair the foundation now, before Auth, RLS, or finance features depend on it.

## Required Corrective Work

### 1. Reconcile the real repository HEAD

At the beginning, record:

```bash
git rev-parse HEAD
git status --short
git branch --show-current
```

The previous report claimed SHA:

`8ff5cf0efb81840623cefb6f074de0f391c40a15`

but GitHub did not contain that commit. The audited implementation commit on `main` was:

`e23f17696ad9b4b9e347ca9924efab8ddf70f5a4`

Do not assume either is still current. Use the actual repository state you receive.

At completion, the report must contain the exact pushed remote HEAD, not a temporary/local SHA.

### 2. Move the new application foundation to the current patched Active LTS Next.js line

Before changing versions, verify the latest official Next.js security/release guidance available to you.

As of the audit on 2026-08-27, Next.js `16.3.3` is the patched **Active LTS** release and Next.js `15.5.24` is the patched **Maintenance LTS** release.

This is a new application with no production feature code yet, so prefer the current patched Active LTS rather than intentionally starting on the maintenance line.

Requirements:

- upgrade Next.js to the current patched Active LTS (at minimum `16.3.3` unless a newer official patched Active LTS exists when executing);
- keep React/React DOM on versions compatible with that Next.js release;
- regenerate/update the lockfile through the package manager, never hand-edit dependency resolution;
- do not use prerelease/canary/RC versions;
- preserve existing minimal foundation behavior.

### 3. Use the current Next.js Proxy convention

Next.js 16 renamed/deprecated the `middleware` file convention in favor of `proxy`.

Replace the stale foundation naming:

```text
src/middleware.ts
src/lib/supabase/middleware.ts
```

with the current convention, for example:

```text
src/proxy.ts
src/lib/supabase/proxy.ts
```

Use the named export:

```ts
export async function proxy(request: NextRequest) { ... }
```

Do not keep duplicate middleware and proxy entrypoints.

### 4. Upgrade and correct the Supabase SSR boundary

Verify current official Supabase documentation before implementation.

Upgrade `@supabase/ssr` from the stale `0.5.2` baseline to the current stable compatible release. At audit time the current stable line is `0.12.x`.

Use a current stable `@supabase/supabase-js` version compatible with the selected SSR package.

Do not use prerelease versions.

The Next.js SSR foundation must follow these current rules:

#### Browser client

Use only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No secret/service-role key may be reachable from browser code.

#### Server client

Use a request-specific `createServerClient` with cookie access through current `next/headers` semantics.

#### Proxy/session refresh

The proxy session boundary must:

1. create a request-scoped Supabase server client;
2. immediately validate/refresh using `supabase.auth.getClaims()` according to current official guidance;
3. avoid inserting unrelated logic between client creation and `getClaims()`;
4. update request cookies as required;
5. update response cookies as required;
6. propagate response/cache headers supplied by the current `setAll(cookiesToSet, headers)` callback onto the outgoing response;
7. return the Supabase response without accidentally dropping cookies or headers.

Do not use `getSession()` for authorization.

Do not use `getUser()` merely as a substitute for the current documented Proxy `getClaims()` flow.

### 5. Restore Phase 0 environment scope

`.env.example` must contain only the environment variables required by Phase 0:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Remove from the Phase 0 template:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
FX_API_KEY
GEMINI_API_KEY
```

Those variables belong to later phases when their server-only code actually exists.

Do not add real values.

Do not make AI Studio ask the user for future credentials.

Simplify `src/config/env.ts` accordingly. Do not keep unused future secret accessors solely as placeholders.

### 6. Make the Node runtime contract explicit

Inspect the engines required by the final dependency graph.

The Supabase JS SDK resolved during audit requires Node.js 22+.

Unless current compatible packages have changed that requirement, standardize Finora Phase 0 on Node.js 22+.

Add an explicit project runtime contract using appropriate project files, for example:

- `package.json` `engines.node`;
- `.nvmrc` or equivalent if useful;
- README setup requirements.

Use one coherent runtime target across local development, AI Studio, CI, and future deployment documentation.

### 7. Properly initialize shadcn/ui

The repository currently contains shadcn-style component source files but lacks normal project configuration.

Verify current official shadcn setup guidance and initialize the project using the supported method.

Requirements:

- create/maintain the normal `components.json` configuration expected by the shadcn CLI;
- preserve the existing `@/*` path alias unless current setup requires a safe equivalent;
- keep only minimal UI primitives needed by Phase 0;
- do not install a large component catalog;
- do not begin Phase 1 design work;
- if current shadcn guidance requires a Tailwind configuration adjustment or migration, perform the smallest clean supported migration and document it.

### 8. Update linting for the selected Next.js version

If moving to Next.js 16, do not use the removed/deprecated `next lint` workflow.

Use the ESLint CLI with a working flat configuration, for example a package script equivalent to:

```text
eslint .
```

Use the actual supported setup for the selected Next.js release.

### 9. Do not introduce database/Auth scope

This corrective pass must NOT create:

- finance tables;
- profiles/user settings tables;
- migrations for product data;
- RLS policies;
- Auth screens;
- login/signup flows;
- Storage buckets;
- Edge Functions;
- admin clients using secret/service-role keys.

Supabase remains a client/session foundation only in Phase 0.

### 10. Documentation corrections

Update:

- `docs/PROJECT_STATUS.md`;
- `docs/DECISIONS.md` ADR-007 so it describes **Proxy**, `getClaims()`, and current cookie/cache-header behavior;
- `docs/ARCHITECTURE.md` if it names stale middleware conventions;
- `README.md` with the actual Node/runtime and setup commands.

Do not erase the fact that a corrective pass occurred.

## Required Verification

After all changes, execute the real commands from a clean dependency state where practical.

Verify at least:

1. `npm install` or `npm ci` succeeds;
2. selected Node version satisfies all package engine requirements;
3. lint passes using the final lint script;
4. TypeScript typecheck passes;
5. production build passes;
6. development runtime returns the foundation page successfully;
7. no real secrets are committed;
8. `.env.example` contains only the two public Phase 0 Supabase variables;
9. no `middleware.ts` / stale Supabase middleware helper remains if the project is on Next.js 16;
10. Proxy calls `getClaims()`;
11. Proxy preserves cookie and cache/header output from current Supabase SSR `setAll` behavior;
12. `components.json` exists and matches the real shadcn setup;
13. no database/Auth/product feature work was added.

Also run package/security verification available in the environment. If `npm audit` or another check cannot run because of network/tooling limitations, record `NOT_RUN` rather than claiming PASS.

If browser verification is available, re-check:

- 390px;
- 768px;
- 1024px;
- 1440px.

## Completion Gate

Do NOT mark Phase 0 complete unless all of these are true:

```text
Remote HEAD receipt correct             PASS
Patched Active LTS Next.js foundation   PASS
Current Next.js Proxy convention        PASS
Current Supabase SSR package/pattern    PASS
Proxy getClaims boundary                PASS
Cookie/cache headers preserved          PASS
Phase 0 env scope restored              PASS
Node runtime contract explicit          PASS
shadcn project configuration valid      PASS
Lint                                    PASS
TypeScript                              PASS
Production build                        PASS
Runtime                                 PASS
Secrets review                          PASS
Documentation                           PASS
Scope discipline                        PASS
```

If any mandatory gate fails, leave:

```text
Phase 0 — Foundation
CORRECTIVE_REQUIRED
```

## Git Rules

- Do not rewrite history.
- Do not force-push.
- Keep this corrective pass focused on foundation repair.
- Review the final diff before committing.
- Push the resulting commit to `main` only if that is the connected workflow already in use.

Suggested commit message:

```text
fix(foundation): align Finora with current Next.js and Supabase SSR
```

## Final Report

Return:

```text
TASK
Finora Phase 0 — Corrective Pass

STATUS
PASS / PARTIAL / BLOCKED

START_HEAD
<actual starting SHA>

FINAL_LOCAL_HEAD
<actual final local SHA>

REMOTE_MAIN_HEAD
<actual pushed remote main SHA if push is available>

HEAD_MATCH
YES / NO / NOT_VERIFIED

CHANGED
<important files>

VERSIONS
Node:
Next.js:
React:
@supabase/ssr:
@supabase/supabase-js:

SUPABASE SSR
Proxy convention:
getClaims:
Cookie propagation:
Cache/header propagation:

ENVIRONMENT
<exact committed .env.example variable names only; never values>

SHADCN
components.json:
configuration verification:

SECURITY
<secret boundary and package/security results>

VERIFICATION
Install:
Lint:
TypeScript:
Build:
Runtime:
390px:
768px:
1024px:
1440px:
Package/security audit:

DATABASE CHANGES
NONE / <explain unexpected changes>

KNOWN ISSUES
NONE / <list>

PROJECT STATUS
Phase 0 — Foundation: COMPLETE / CORRECTIVE_REQUIRED
Next Action: <exact next action>
```

Then stop.

Do not begin Phase 1.
