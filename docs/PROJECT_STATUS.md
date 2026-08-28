# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 3 — Accounts + Categories — REMOTE DATABASE VERIFICATION
- **Phase status:** PARTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Initial Phase 3 implementation SHA:** `8ebe887ed1e5aee8416dd084bad74a575b8d082d`
- **First corrective remote SHA audited:** `7c841ea4702ac191573e40ac2b4308913fd1daeb`
- **AI Studio final-cleanup SHA audited:** `7159363a2d0a20fac9f9621ee531b2d131517d66`
- **Accepted Phase 3 source SHA:** `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5`
- **Phase 3 implementation prompt:** `prompts/PHASE_3_ACCOUNTS_CATEGORIES.md`
- **Phase 3 corrective prompt:** `prompts/PHASE_3_CORRECTIVE.md`
- **Phase 3 final cleanup prompt:** `prompts/PHASE_3_FINAL_CLEANUP.md`

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

## Phase 3 Accepted Source Gate

The exact remote source at `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5` was verified with a clean worktree and matching local/remote HEAD.

Accepted exact-head verification:

- TypeScript: PASS
- Lint: PASS
- Production build: PASS
- `node --check scripts/verify-phase3-rls.mjs`: PASS
- Temporary corrective files removed: PASS
- Code changes during verification: NONE

The accepted Phase 3 source contains:

- atomic `BEGIN` / `COMMIT` migration for `accounts` and `categories`;
- idempotent 12-category provisioning for existing and future auth users;
- explicit RLS ownership policies and least-privilege grants;
- direct EXECUTE revocation for Phase 3 SECURITY DEFINER helpers;
- strict structural verifier for schema/RLS/grants/category provisioning;
- bidirectional two-user runtime RLS verifier for accounts and categories;
- real account create/edit/archive/unarchive persistence UI;
- real category create/edit/archive/unarchive persistence UI;
- extensible 3-5 letter currency codes without mock FX conversion;
- account opening-balance input preserved as decimal text until PostgREST/PostgreSQL ingestion.

## Remote Phase 3 Database State

The Phase 3 migration is now **AUTHORIZED FOR MANUAL APPLICATION** to the target Supabase project, but it has not yet been accepted as applied.

Required order:

1. apply `supabase/migrations/20260828000001_phase_3_accounts_categories.sql` from the accepted Phase 3 source;
2. run `scripts/verify-phase3-db.sql` and require every mandatory row plus `99_OVERALL = PASS`;
3. run `node scripts/verify-phase3-rls.mjs` with the two disposable test users and require exit code `0`;
4. smoke-test account/category create/edit/archive/unarchive persistence on the live Vercel application;
5. only then close Phase 3 and authorize Phase 4.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2 Overall:** PASS
- **Phase 3 Source Audit:** PASS
- **Phase 3 Exact-Head TypeScript/Lint/Build:** PASS
- **Phase 3 Migration Application:** AUTHORIZED_PENDING_OWNER_EXECUTION
- **Phase 3 Remote Database:** NOT_APPLIED_OR_NOT_YET_ATTESTED
- **Phase 3 Structural Gate:** NOT_RUN
- **Phase 3 Two-User Runtime RLS:** NOT_RUN
- **Phase 3 Live Persistence Smoke:** NOT_RUN
- **Phase 3 Overall:** PARTIAL
- **Phase 4 — Transactions:** NOT AUTHORIZED

## Next Recommended Action

Apply the accepted Phase 3 migration in the Supabase SQL Editor, then run the strict structural verifier. Do not begin Phase 4 until all remote Phase 3 gates pass.
