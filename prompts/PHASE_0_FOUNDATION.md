# Google AI Studio Task — Finora Phase 0: Foundation

## Governing Instruction

You are working inside the existing GitHub repository `thanhtuyen662002/finora`.

Before changing anything:

1. Read `AGENTS.md` completely.
2. Read `docs/PROJECT_STATUS.md`.
3. Read `docs/ARCHITECTURE.md`.
4. Read `docs/DATABASE.md`.
5. Read `docs/DECISIONS.md`.
6. Inspect the full current repository tree.

`AGENTS.md` is authoritative. This prompt narrows the task to **Phase 0 only** and does not override its safety, architecture, security, or scope rules.

## Objective

Bootstrap the repository into a clean, production-capable **Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase foundation** that can support later Finora phases.

Do not build finance features yet.

Do not build AI product features yet.

Do not create speculative database tables yet.

## Required Implementation

### 1. Initialize the application

Create a current stable Next.js App Router application in the repository root with:

- TypeScript;
- App Router;
- `src/` directory;
- Tailwind CSS;
- ESLint;
- package manager lockfile committed.

Do not replace or delete the existing governance/documentation files.

Before selecting package versions or initialization commands, verify the current official Next.js and Supabase guidance available to you. Pin dependencies through the lockfile and do not use remembered obsolete setup patterns.

### 2. TypeScript quality baseline

Use strict TypeScript.

Avoid `any` unless there is a documented reason.

Add a script so the repository can run a non-emitting type check, for example through a `typecheck` package script appropriate to the generated project.

### 3. shadcn/ui foundation

Initialize shadcn/ui using the current supported method.

Add only the minimal components needed to prove the design-system setup works. Do not install a large component catalog.

Keep the visual baseline clean, neutral, modern, and suitable for a personal finance application.

### 4. Supabase client architecture

Add the current supported Supabase JavaScript/SSR dependencies and create the minimum browser/server client helpers appropriate for the current Next.js App Router model.

Requirements:

- browser client uses only public/publishable configuration;
- server client follows current official cookie/session guidance;
- no `service_role` or secret key appears in browser code;
- do not implement Auth screens or database tables in Phase 0;
- do not disable security controls merely to make a connection work.

If current Supabase documentation differs from old examples, follow current official guidance and record the architectural consequence in `docs/DECISIONS.md` only if it is meaningful.

### 5. Environment validation

Use `.env.example` as the committed template.

Do not add real credentials.

Add a small, maintainable environment-access strategy that:

- clearly separates browser-safe configuration from server-only secrets;
- fails clearly when a required runtime variable is missing in code paths that require it;
- does not force Gemini or FX credentials to exist in Phase 0 because those integrations are not active yet.

### 6. Source structure

Create only directories/files that have actual Phase 0 responsibility.

Target architecture from `AGENTS.md` should guide naming, but do not create dozens of empty placeholder modules.

At minimum, establish sensible locations for:

- app routing;
- shared UI;
- Supabase helpers;
- configuration/validation.

Future finance/AI modules can be added when their phase starts.

### 7. Foundation UI

Replace the default starter screen with a minimal Finora foundation page that proves:

- Tailwind works;
- shadcn/ui works;
- typography/layout baseline works;
- responsive layout behaves sensibly.

This is **not** Phase 1 UI design.

Keep it intentionally minimal. It may show:

- Finora name;
- short project description;
- `Foundation ready` development status.

Do not create dashboard charts, transaction forms, accounts, budgets, reports, admin screens, or navigation shells yet.

### 8. Package scripts

Provide working scripts for at least:

- development;
- lint;
- typecheck;
- production build.

Do not add scripts that are not actually usable.

### 9. Documentation updates

After implementation, update:

- `docs/PROJECT_STATUS.md` with exact completed/pending work and verification results;
- `docs/ARCHITECTURE.md` only if implementation establishes details that should be recorded;
- `docs/DECISIONS.md` only for genuine architectural decisions;
- `README.md` with exact local setup commands once they are known.

Do not claim Supabase database/Auth integration is complete merely because client helpers exist.

## Explicitly Out of Scope

Do **not** implement any of the following in Phase 0:

- login or signup screens;
- Supabase Auth flows;
- database schema or migrations for finance data;
- RLS policies;
- accounts;
- categories;
- transactions;
- transfers;
- dashboard;
- charts;
- budgets;
- goals;
- recurring transactions;
- reports;
- multi-currency business logic;
- exchange-rate provider calls;
- Gemini API calls;
- AI router;
- AI key management;
- admin panel;
- import/export;
- PWA install/offline implementation beyond preserving architectural compatibility;
- native Android/iOS code.

Do not jump to Phase 1.

## Required Verification

Before declaring Phase 0 complete, execute the repository's real commands and verify:

1. dependency installation succeeds;
2. lint passes;
3. TypeScript typecheck passes;
4. production build passes;
5. the development page renders without relevant runtime/console errors;
6. no real secret or credential was committed;
7. server-only environment variables are not referenced from client components;
8. existing project governance files remain present.

If browser/visual verification is available, verify the foundation page at approximately:

- 390px;
- 768px;
- 1024px;
- 1440px.

If a verification cannot be executed in the environment, mark it `NOT_RUN` with the exact reason. Never report an unexecuted check as PASS.

## Completion Gate

Phase 0 may be marked `COMPLETE` only when:

```text
Application initialized           PASS
Dependencies installed            PASS
Lint                              PASS
TypeScript                        PASS
Production build                  PASS
Minimal Finora page               PASS
Supabase client foundation        PASS
Secrets exposure review           PASS
Documentation updated             PASS
```

Visual viewport checks may be `PASS` or explicitly `NOT_RUN` if the environment cannot perform them, but that limitation must be recorded.

If any required executable gate fails, keep Phase 0 as `IN_PROGRESS` or `BLOCKED`.

## Git Scope

Keep changes limited to Phase 0.

Do not perform unrelated rewrites of `AGENTS.md`.

Prefer one coherent Phase 0 implementation commit if the environment/workflow supports it.

Use a clear commit message such as:

```text
feat(foundation): bootstrap Finora application
```

Do not force-push or rewrite existing repository history.

## Final Report

At the end, report exactly:

```text
TASK
Finora Phase 0 — Foundation

STATUS
PASS / PARTIAL / BLOCKED

HEAD
<commit SHA if available>

CHANGED
<important files and modules>

DEPENDENCIES
<important packages added and why>

SUPABASE
<what was configured and what remains intentionally unimplemented>

SECURITY
<secret/client boundary review>

VERIFICATION
Install: PASS/FAIL/NOT_RUN
Lint: PASS/FAIL/NOT_RUN
TypeScript: PASS/FAIL/NOT_RUN
Build: PASS/FAIL/NOT_RUN
Runtime: PASS/FAIL/NOT_RUN
390px: PASS/FAIL/NOT_RUN
768px: PASS/FAIL/NOT_RUN
1024px: PASS/FAIL/NOT_RUN
1440px: PASS/FAIL/NOT_RUN

KNOWN ISSUES
<issues or NONE>

PROJECT STATUS
<updated phase/status and exact next action>
```

Do not start Phase 1 after producing this report.
