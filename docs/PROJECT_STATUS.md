# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 3 — Accounts + Categories — CORRECTIVE REQUIRED
- **Phase status:** PARTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Phase 3 implementation SHA under audit:** `8ebe887ed1e5aee8416dd084bad74a575b8d082d`
- **Phase 3 implementation prompt:** `prompts/PHASE_3_ACCOUNTS_CATEGORIES.md`
- **Phase 3 corrective prompt:** `prompts/PHASE_3_CORRECTIVE.md`

## Phase 2 Accepted Baseline

Phase 2 remains accepted PASS and must not be regressed.

Accepted gates:

- Auth/SSR code hardening: PASS
- Remote Phase 2 database structure and least-privilege grants: PASS
- Anonymous RLS isolation: PASS
- Bidirectional two-user RLS isolation: PASS
- Email/password signup/login/confirmation: PASS
- Onboarding routing and persistence: PASS
- Settings persistence: PASS
- Sign out and protected-route enforcement: PASS
- Password recovery: PASS
- Google OAuth: PASS

**PHASE_2 = PASS**

## Phase 3 Source Audit

The initial Phase 3 implementation was published to `main`, but it is **not accepted complete**.

Positive direction confirmed:

- `accounts` and `categories` migration source exists;
- `opening_balance` is PostgreSQL `numeric(20,4)` and no persisted `current_balance`/mock FX balance columns were introduced;
- account/category data-access modules use the normal Supabase publishable client under RLS;
- `/accounts` no longer sources records from `MOCK_ACCOUNTS`;
- `/settings/categories` is backed by the Phase 3 category feature module;
- source includes RLS/grant intent, structural verifier, and two-user runtime verifier;
- TypeScript, lint, and build were reported PASS for the initial implementation.

Mandatory defects found during repository audit:

1. `supabase/migrations/20260828000001_phase_3_accounts_categories.sql` attaches `SECURITY DEFINER SET search_path` attributes to a PostgreSQL `DO` block; that syntax is invalid, so the migration must not be run in this revision.
2. Default-category backfill/idempotency is weaker than the Phase 3 contract; an existing user with any category can skip missing baseline defaults.
3. `scripts/verify-phase3-db.sql` does not prove policy command/role/ownership semantics, anon/PUBLIC column privileges, or the complete 12-category baseline strictly enough.
4. `scripts/verify-phase3-rls.mjs` incorrectly treats a forbidden UPDATE that affects zero rows without an error as an RLS violation and does not yet cover the required bidirectional full matrix for both tables.
5. Account UI lacks required edit and unarchive flows and a usable archived view.
6. Category UI lacks required edit and unarchive flows and currently labels archive as `Xóa`.
7. Account/category create modals invoke async persistence callbacks without awaiting them, can close before Supabase completes, and swallow failures.
8. The initial Phase 3 ledger incorrectly marked Phase 3 COMPLETE/PASS and authorized Phase 4 before remote Phase 3 gates had run.

The corrective contract is source-controlled in `prompts/PHASE_3_CORRECTIVE.md`.

## Remote Phase 3 Database State

The Phase 3 migration has **not** been accepted as applied to the target Supabase project.

**Do not run the currently defective migration revision manually.**

Required order after the corrective source pass:

1. audit the corrected exact-head migration and verifiers;
2. apply the corrected Phase 3 migration to the target Supabase project;
3. run the strict Phase 3 structural verifier and require `99_OVERALL = PASS`;
4. run the hardened two-user Phase 3 RLS verifier and require exit code `0`;
5. verify real account/category create/edit/archive/unarchive persistence on the live application;
6. only then close Phase 3 and authorize Phase 4.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2 Overall:** PASS
- **Phase 3 Initial Implementation Source:** CORRECTIVE_REQUIRED
- **Phase 3 Corrective Code Gate:** PENDING
- **Phase 3 Remote Database:** BLOCKED_NOT_APPLIED
- **Phase 3 Structural Gate:** NOT_RUN
- **Phase 3 Two-User Runtime RLS:** NOT_RUN
- **Phase 3 Overall:** PARTIAL
- **Phase 4 — Transactions:** NOT AUTHORIZED

## Next Recommended Action

Execute `prompts/PHASE_3_CORRECTIVE.md` against the latest `origin/main`. Do not apply the Phase 3 migration and do not begin Phase 4 until the corrected source is published and audited.
