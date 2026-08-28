# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 3 — Accounts + Categories — FINAL SOURCE VERIFICATION
- **Phase status:** PARTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Initial Phase 3 implementation SHA:** `8ebe887ed1e5aee8416dd084bad74a575b8d082d`
- **First corrective remote SHA audited:** `7c841ea4702ac191573e40ac2b4308913fd1daeb`
- **AI Studio final-cleanup SHA audited:** `7159363a2d0a20fac9f9621ee531b2d131517d66`
- **Final source hardening through:** `cbb7b5eb8a2865d03d2d4a01c0e41d56dd7531fe`
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

## Phase 3 Source State

The Phase 3 source now contains:

- atomic `BEGIN` / `COMMIT` migration for `accounts` and `categories`;
- idempotent 12-category provisioning for existing and future auth users;
- explicit RLS ownership policies and least-privilege grants;
- direct EXECUTE revocation for Phase 3 SECURITY DEFINER helpers;
- strict structural verifier for schema/RLS/grants/category provisioning;
- bidirectional two-user runtime RLS verifier for accounts and categories;
- real account create/edit/archive/unarchive persistence UI;
- real category create/edit/archive/unarchive persistence UI;
- extensible 3-5 letter currency codes without mock FX conversion;
- account opening-balance input preserved as decimal text until PostgREST/PostgreSQL ingestion;
- temporary corrective helper scripts removed from repository source.

The final runtime verifier has been syntax-checked with `node --check`. The exact current remote HEAD still requires one final `typecheck`, `lint`, and production `build` execution after the last source hardening commits before the code gate is accepted.

## Remote Phase 3 Database State

The Phase 3 migration has **not** been applied to the target Supabase project yet.

Required order:

1. run exact-head `npm run typecheck`, `npm run lint`, `npm run build`, and `node --check scripts/verify-phase3-rls.mjs`;
2. require all code checks PASS;
3. apply the exact accepted Phase 3 migration to Supabase;
4. run `scripts/verify-phase3-db.sql` and require every row plus `99_OVERALL = PASS`;
5. run `node scripts/verify-phase3-rls.mjs` with the two disposable test users and require exit code `0`;
6. smoke-test account/category create/edit/archive/unarchive persistence on the live Vercel application;
7. only then close Phase 3 and authorize Phase 4.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2 Overall:** PASS
- **Phase 3 Source Audit:** CLEANUP_COMPLETE_VERIFICATION_PENDING
- **Phase 3 Exact-Head TypeScript/Lint/Build:** NOT_RUN_AFTER_FINAL_HARDENING
- **Phase 3 Remote Database:** BLOCKED_NOT_APPLIED
- **Phase 3 Structural Gate:** NOT_RUN
- **Phase 3 Two-User Runtime RLS:** NOT_RUN
- **Phase 3 Live Persistence Smoke:** NOT_RUN
- **Phase 3 Overall:** PARTIAL
- **Phase 4 — Transactions:** NOT AUTHORIZED

## Next Recommended Action

Run the exact-head code verification only. Do not apply the Supabase migration until those checks pass. Do not begin Phase 4.
