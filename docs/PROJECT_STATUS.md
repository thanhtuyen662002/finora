# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 3 — Accounts + Categories — CODE CLEANUP COMPLETE
- **Phase status:** PARTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Initial Phase 3 implementation SHA:** `8ebe887ed1e5aee8416dd084bad74a575b8d082d`
- **First corrective remote SHA audited:** `7c841ea4702ac191573e40ac2b4308913fd1daeb`
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

## Phase 3 Audit History

The initial Phase 3 implementation moved `/accounts` and category management to real Supabase-backed modules and added source-controlled migration/verifiers, but it was not accepted because the remote database had not been migrated and code audit found mandatory defects.

A first corrective pass was later published to remote `main`, but its report was stale about the push state. Exact remote inspection confirmed corrective changes existed while also revealing remaining contract violations.

### Remaining mandatory findings at remote SHA `7c841ea4702ac191573e40ac2b4308913fd1daeb`

1. The Phase 3 migration is no longer using the invalid `DO ... SECURITY DEFINER` syntax, but it still lacks the required atomic `BEGIN` / `COMMIT` wrapper.
2. `public.handle_new_user_categories()` is SECURITY DEFINER but direct EXECUTE is not explicitly revoked from all normal client roles.
3. `scripts/verify-phase3-db.sql` can still false-PASS because it does not fully prove policy command/role/ownership expressions, provisioning-trigger wiring, anon/PUBLIC column privileges, both helper EXECUTE surfaces, or exact `numeric(20,4)` precision/scale.
4. `scripts/verify-phase3-rls.mjs` improved foreign UPDATE handling but still does not satisfy the entire required bidirectional matrix and deliberate-error contract strictly enough.
5. `AddAccountModal` and `AddCategoryModal` still contain `initialData?: any` / `catch (...: any)` and initialize edit state only once, which can show stale values when editing different rows.
6. Account opening balance is still converted with `parseFloat` before PostgreSQL `numeric(20,4)`.
7. Real account currency creation UI is still limited to the six Phase 1 mock currencies; AccountCard/CurrencyBadge still rely on `as any` casts for extensible currency codes.
8. Account/category load/archive failures remain console-only in some paths; visible success/error states are incomplete.
9. Account type filtering does not expose all supported account types.
10. `docs/DATABASE.md` still contains the lossy Phase 3 rewrite and has not restored the accepted detailed Phase 2 trigger/RLS/least-privilege contract.
11. One-off helper scripts (`fix-*.js`, `update-status.js`) and `REPORT.txt` were committed into repository source and should be removed.

These requirements are locked in `prompts/PHASE_3_FINAL_CLEANUP.md`.

## Remote Phase 3 Database State

The Phase 3 migration has **not** been accepted as applied to the target Supabase project.

Do not apply the migration until the final-cleanup source is published and exact-head code verification passes.

Required order after final code cleanup:

1. verify exact remote HEAD with `npm run typecheck`, `npm run lint`, `npm run build`, and `node --check scripts/verify-phase3-rls.mjs`;
2. audit the exact-head migration and verifiers;
3. apply the exact accepted Phase 3 migration to the target Supabase project;
4. run `scripts/verify-phase3-db.sql` and require every mandatory row plus `99_OVERALL = PASS`;
5. run `node scripts/verify-phase3-rls.mjs` and require exit code `0`;
6. smoke-test real account/category create/edit/archive/unarchive persistence on the live application;
7. only then close Phase 3 and authorize Phase 4.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2 Overall:** PASS
- **Phase 3 Source:** PASS
- **Phase 3 Remote Database:** BLOCKED_NOT_APPLIED
- **Phase 3 Structural Gate:** NOT_RUN
- **Phase 3 Two-User Runtime RLS:** NOT_RUN
- **Phase 3 Live Persistence Smoke:** NOT_RUN
- **Phase 3 Overall:** PARTIAL
- **Phase 4 — Transactions:** NOT AUTHORIZED

## Next Recommended Action

Review the final code cleanup, apply the exact accepted Phase 3 migration to the target Supabase project, run the verifiers, and test live persistence to fully close Phase 3.