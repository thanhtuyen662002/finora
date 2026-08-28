# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 4 — Transactions — FINAL CORRECTIVE REQUIRED
- **Phase status:** PARTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Phase 3 code verification SHA:** `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5`
- **Accepted Phase 3 migration-source SHA:** `529d1d42ab50d62b2327fadc7a9ac0b2122798fa`
- **Phase 3 structural receipt SHA:** `1422dcd5e9c67028d1c33006d5d61f7037827dff`
- **Phase 3 runtime RLS receipt SHA:** `2b09f494344a3f6d84bb374ad5bdba0512f7f459`
- **Phase 3 closure SHA:** `935a806c15d28b8de412631f48cf2ee067a3af2f`
- **Phase 4 implementation contract SHA:** `75dd85d4a7b062fb3f8cc2a25570a75c057838ac`
- **Phase 4 initial implementation SHA:** `399f96327111ebf9abeb7c95d445ce0174f91e6f`
- **Phase 4 corrective prompt:** `prompts/PHASE_4_CORRECTIVE.md`
- **Phase 4 corrective remote SHA audited:** `89a2e720ea011c342ed0ae2b2d420092ae2b0967`
- **Phase 4 final corrective prompt:** `prompts/PHASE_4_FINAL_CORRECTIVE.md`

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

## Phase 3 — Accounts + Categories — Final Receipt

Phase 3 is accepted COMPLETE and is the immutable baseline for Phase 4.

### Source gate

The Phase 3 application/runtime source was verified with matching local/remote HEAD and clean worktree.

- TypeScript: PASS
- Lint: PASS
- Production build: PASS
- Runtime verifier script syntax: PASS
- Verification code changes: NONE

A later SQL-only correction fixed invalid PostgreSQL function-privilege syntax without changing application runtime code.

### Remote database structural gate

The corrected Phase 3 migration was manually applied to the target Supabase project. Strict verification returned every mandatory check PASS and `99_OVERALL = PASS`.

Accepted facts:

- `accounts` and `categories` exist with RLS enabled;
- exactly six authenticated ownership policies are present;
- account/category updated-at triggers are present;
- category provisioning trigger on `auth.users` is present;
- Phase 3 SECURITY DEFINER helpers use empty `search_path` and client EXECUTE is revoked;
- `anon` and `PUBLIC` have no table or column privileges on Phase 3 tables;
- authenticated has table-level SELECT only with exact column-level INSERT/UPDATE allowlists;
- `opening_balance` is PostgreSQL `numeric(20,4)`;
- baseline categories were complete for all current auth users;
- no seeded transfer category exists.

**PHASE_3_REMOTE_DATABASE = PASS**
**PHASE_3_STRUCTURAL_GATE = PASS**

### Two-user runtime RLS gate

The hardened two-user runtime verifier exited `0`.

Accepted runtime facts:

- User A/B authentication: PASS
- own account INSERT/SELECT/UPDATE: PASS
- cross-user account INSERT/SELECT/UPDATE blocked: PASS
- account ownership mutation blocked: PASS
- category baseline visibility/isolation: PASS
- own category INSERT/SELECT/UPDATE: PASS
- cross-user category INSERT/SELECT/UPDATE blocked: PASS
- category ownership mutation blocked: PASS
- deliberate non-RLS database error distinction: PASS
- verifier cleanup/archive: PASS

**PHASE_3_TWO_USER_RLS = PASS**

### Live application persistence smoke

Owner-attested live smoke on the Finora Vercel application:

- account create + edit + persistence: PASS
- account archive + unarchive: PASS
- category create + edit + persistence: PASS
- category archive + unarchive: PASS
- refresh + logout/login persistence: PASS
- unexpected live errors: NONE

**PHASE_3_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 3 authorization receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3_SOURCE=PASS
PHASE_3_REMOTE_DATABASE=PASS
PHASE_3_STRUCTURAL_GATE=PASS
PHASE_3_TWO_USER_RLS=PASS
PHASE_3_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_3=PASS
PHASE_4_AUTHORIZED=true
```

## Phase 4 — Transactions — Audit History

### Initial implementation audit

Initial Phase 4 source was published to `main` at `399f96327111ebf9abeb7c95d445ce0174f91e6f`. Actual GitHub inspection contradicted the agent's stale push-failure report.

Positive direction included real transaction persistence intent, INCOME/EXPENSE-only scope, ownership-safe composite FK intent, RLS/grants, a security-invoker account-balance view, real Phase 3 account/category integration, and removal of real transfer persistence.

The initial implementation was not accepted because money correctness, verifier integrity, void/restore UX, current-date filtering, active-reference selection, documentation, and exact derived-balance handling were incomplete.

### First corrective audit

The corrective agent reported local SHA `3a34d62c95802b79c0acd944730962dd9cfa1151` with code-only PASS but `REMOTE_HEAD_MATCHES_LOCAL=false`. Subsequent actual GitHub inspection found remote `main` had advanced instead to:

`89a2e720ea011c342ed0ae2b2d420092ae2b0967`

with parent `7a57a27029ffe86185b67bcceeddaac826e4985d`.

This remote commit is NOT equivalent to the reported verified local revision and still fails the Phase 4 contract.

### Mandatory residual findings on remote `89a2e720...`

1. `AddTransactionModal.tsx` contains duplicate imports of `createTransaction` / `updateTransaction`, so exact remote source is not accepted as the revision that reportedly passed TypeScript/build.
2. The modal still validates money with `Number(amount) <= 0`.
3. Transaction table reads still expose `amount` as JS `number`; converting to string afterward cannot restore precision already lost at the JSON boundary.
4. `src/features/transactions/transactions.ts` still uses `as any` for void/restore because mutation types are not correctly bounded.
5. `formatExactDecimal()` still uses `parseInt()` on monetary integer parts, which can lose exactness for large `numeric(20,4)` values.
6. Summary cards use exact-string accumulation but still summarize all active transaction history instead of the actual current month.
7. `TransactionList` labels say current periods but filtering still hardcodes `2026-08`, `2026-07`, and `2026-08-27`.
8. New-vs-edit archived account/category selection still needs exact active-only default behavior for new transactions while preserving only the historical selected archived reference during edit.
9. CSV now creates a file, but CSV escaping and dead success-state UI still require cleanup.
10. `scripts/verify-phase4-db.sql` is not a strict structural verifier. It checks only a small subset, does not validate policy predicates/grants/FKs/view security/precision/regressions, and uses an unsafe unsupported nested `PROCEDURE ... IS` pattern in an anonymous `DO` block.
11. `scripts/verify-phase4-rls.mjs` is not a full runnable matrix. Its transaction INSERT omits required `user_id` and it lacks B-own operations, complete bidirectional cross-user/account/category checks, domain-integrity checks, DELETE block, ownership mutation, view isolation, deliberate DB error distinction, and asserted cleanup.
12. The Phase 4 remote database migration remains intentionally unapplied.

The exact final corrective contract is source-controlled in:

`prompts/PHASE_4_FINAL_CORRECTIVE.md`

## Remote Phase 4 Database State

The Phase 4 migration is **NOT AUTHORIZED FOR APPLICATION** at the current source revision.

Required order after final corrective source PASS:

1. audit the exact corrected remote source;
2. require exact local/remote HEAD match and clean worktree;
3. require exact-head typecheck/lint/build/runtime-script syntax PASS;
4. only then authorize the exact Phase 4 migration for manual Supabase application;
5. run strict `scripts/verify-phase4-db.sql` and require every mandatory row plus `99_OVERALL = PASS`;
6. run hardened two-user `scripts/verify-phase4-rls.mjs` and require exit code `0`;
7. perform live transaction create/edit/void/restore/refresh/re-login smoke plus derived-balance proof;
8. only then close Phase 4 and authorize Phase 5.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** PASS
- **Phase 3:** PASS
- **Phase 4 Code Gate:** FINAL_CORRECTIVE_REQUIRED
- **Phase 4 Remote Database:** BLOCKED_NOT_APPLIED
- **Phase 4 Structural Gate:** NOT_RUN
- **Phase 4 Two-User Runtime RLS:** NOT_RUN
- **Phase 4 Live Persistence Smoke:** NOT_RUN
- **Phase 4 Overall:** PARTIAL
- **Phase 5 — Transfers:** NOT AUTHORIZED

## Next Recommended Action

Execute `prompts/PHASE_4_FINAL_CORRECTIVE.md` as a code-only task. Do not apply any Phase 4 migration and do not begin Phase 5 until the exact corrected remote source is audited and accepted.
