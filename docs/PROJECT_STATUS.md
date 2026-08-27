# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 0 — Foundation
- **Phase status:** CORRECTIVE_REQUIRED
- **Application code:** Initialized, but foundation audit found version/configuration drift that must be corrected before Phase 1.
- **Supabase integration:** SSR client foundation exists, but its request-boundary implementation does not match current Supabase guidance yet.
- **AI integration:** Deferred to Phase 10-12.
- **PWA:** Deferred to Phase 15.
- **Last audited implementation commit:** `e23f17696ad9b4b9e347ca9924efab8ddf70f5a4`

## Completed

- Project repository created with `AGENTS.md` master instruction and architectural guidelines.
- Next.js App Router application foundation created.
- React, TypeScript, Tailwind, and minimal UI primitives added.
- Supabase browser/server client helpers created.
- Minimal Finora foundation page added.
- Package scripts for development, build, lint, and typecheck added.
- AI Studio reported install, lint, typecheck, build, runtime, and viewport checks as passing for its implementation environment.

## Phase 0 Audit Findings

### 1. Remote HEAD receipt mismatch

The AI Studio final report stated:

`8ff5cf0efb81840623cefb6f074de0f391c40a15`

but that SHA is not present in the GitHub repository. The actual `main` implementation commit audited is:

`e23f17696ad9b4b9e347ca9924efab8ddf70f5a4`

Future reports must use the actual pushed remote HEAD.

### 2. Next.js foundation is on Maintenance LTS rather than Active LTS

The lockfile resolves Next.js `15.5.24`, which includes the August 2026 security fixes, so this is not being treated as an unpatched critical-vulnerability state.

However, the project was explicitly bootstrapped as a new application using a stale Next.js 15-era convention. For a new foundation, move to the current patched Active LTS line and current conventions before feature work begins.

### 3. Supabase SSR helper is stale

The lockfile contains `@supabase/ssr` `0.5.2`, while the current SSR package and documentation have materially evolved.

Current Supabase guidance for Next.js uses a request `proxy`, calls `supabase.auth.getClaims()` at the session boundary, and propagates cache-related headers returned by cookie `setAll` onto the response.

The current implementation instead uses:

- `src/middleware.ts`;
- `src/lib/supabase/middleware.ts`;
- `supabase.auth.getUser()`;
- a cookie `setAll` implementation that does not propagate the current response cache headers.

This must be corrected before Auth/RLS work is built on top of it.

### 4. Phase 0 environment scope regressed

`.env.example` currently contains future server variables (`SUPABASE_SECRET_KEY`, `FX_API_KEY`) even though Phase 0 intentionally removed them to prevent AI Studio from requesting unnecessary secrets.

Phase 0 should require only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Future server-only variables will be introduced in the phase that actually uses them.

### 5. shadcn/ui initialization is incomplete

Minimal shadcn-style components exist, but the repository does not contain the normal shadcn project configuration (`components.json`). The corrective pass must initialize shadcn using its current supported project method rather than only copying component source files.

### 6. Runtime version should be explicit

The resolved current Supabase JavaScript SDK requires Node.js 22+. The repository must state and document the supported Node runtime so local, AI Studio, CI, and deployment environments do not silently diverge.

## Blockers

- Phase 0 corrective pass required.
- Do not start Phase 1 until the corrective verification gate passes.

## Verification State

| Check | Status | Notes |
|---|---|---|
| AI Studio reported install | PASS_REPORTED | Must be rerun after corrective changes |
| AI Studio reported TypeScript | PASS_REPORTED | Must be rerun after corrective changes |
| AI Studio reported lint | PASS_REPORTED | Must be rerun after corrective changes |
| AI Studio reported production build | PASS_REPORTED | Must be rerun after corrective changes |
| Remote HEAD receipt | FAIL | Reported SHA is not the pushed GitHub HEAD |
| Next.js current foundation convention | CORRECTIVE_REQUIRED | Move to patched Active LTS/current conventions |
| Supabase SSR current guidance | CORRECTIVE_REQUIRED | Proxy/getClaims/cache-header behavior required |
| Phase 0 environment scope | CORRECTIVE_REQUIRED | Remove future secret variables |
| shadcn project initialization | CORRECTIVE_REQUIRED | Add current supported configuration |
| Node runtime contract | CORRECTIVE_REQUIRED | Declare Node 22+ baseline |
| Supabase database/RLS | NOT_RUN | Intentionally deferred; no Phase 0 schema should be created |

## Known Issues

The audit findings above are the current known issues.

## Next Recommended Action

Execute **Phase 0 Corrective Pass** using `prompts/PHASE_0_CORRECTIVE.md`.

After that pass, audit the pushed GitHub HEAD again. Only then may Phase 0 return to `COMPLETE` and Phase 1 begin.

## Update Rule

After every meaningful implementation session, update this file with:

- current phase and status;
- completed work;
- pending work;
- blockers;
- verification results;
- known issues;
- next recommended action.
