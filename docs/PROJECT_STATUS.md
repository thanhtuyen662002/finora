# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 4 — Transactions — AUTHORIZED
- **Phase status:** PHASE_3_COMPLETE
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Initial Phase 3 implementation SHA:** `8ebe887ed1e5aee8416dd084bad74a575b8d082d`
- **First corrective remote SHA audited:** `7c841ea4702ac191573e40ac2b4308913fd1daeb`
- **AI Studio final-cleanup SHA audited:** `7159363a2d0a20fac9f9621ee531b2d131517d66`
- **Phase 3 code verification SHA:** `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5`
- **Accepted Phase 3 migration-source SHA:** `529d1d42ab50d62b2327fadc7a9ac0b2122798fa`
- **Phase 3 structural receipt SHA:** `1422dcd5e9c67028d1c33006d5d61f7037827dff`
- **Phase 3 runtime RLS receipt SHA:** `2b09f494344a3f6d84bb374ad5bdba0512f7f459`

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

Phase 3 is accepted COMPLETE.

### Source gate

The application/runtime source at `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5` was verified with matching local/remote HEAD and a clean worktree.

- TypeScript: PASS
- Lint: PASS
- Production build: PASS
- Runtime RLS script syntax: PASS
- Temporary corrective files removed: PASS
- Verification code changes: NONE

A later SQL-only correction at `529d1d42ab50d62b2327fadc7a9ac0b2122798fa` fixed PostgreSQL function-privilege syntax from invalid `REVOKE ALL EXECUTE` to valid `REVOKE EXECUTE`; no application runtime code changed.

### Remote database structural gate

The corrected Phase 3 migration was manually applied to the target Supabase project. The strict structural verifier returned PASS for every mandatory check and `99_OVERALL = PASS`.

Accepted facts:

- `accounts` and `categories` exist with RLS enabled;
- exactly six authenticated ownership policies are present;
- account/category updated-at triggers are present;
- category provisioning trigger on `auth.users` is present;
- Phase 3 SECURITY DEFINER helpers use empty `search_path` and direct client EXECUTE is revoked;
- `anon` and `PUBLIC` have no table or column privileges on Phase 3 tables;
- authenticated has table-level SELECT only, with exact column-level INSERT/UPDATE allowlists;
- `opening_balance` is PostgreSQL `numeric(20,4)`;
- all current auth users had all 12 baseline categories (`auth_users=3`, `categories=36`);
- no seeded transfer category exists.

**PHASE_3_REMOTE_DATABASE = PASS**
**PHASE_3_STRUCTURAL_GATE = PASS**

### Two-user runtime RLS gate

The hardened two-user runtime verifier executed against remote main `1422dcd5e9c67028d1c33006d5d61f7037827dff` and exited `0`.

Accepted runtime facts:

- User A authentication: PASS
- User B authentication: PASS
- own account INSERT/SELECT/UPDATE: PASS
- cross-user account INSERT/SELECT/UPDATE blocked: PASS
- account ownership mutation blocked: PASS
- own category baseline visibility/isolation: PASS
- own category INSERT/SELECT/UPDATE: PASS
- cross-user category INSERT/SELECT/UPDATE blocked: PASS
- category ownership mutation blocked: PASS
- deliberate non-RLS database error distinction: PASS
- verifier cleanup/archive: PASS

**PHASE_3_TWO_USER_RLS = PASS**

### Live application persistence smoke

Owner-attested live smoke was performed on `https://finora-orpin-nu.vercel.app` after the remote database/runtime gates passed.

Accepted evidence:

- account create + edit + persistence: PASS
- account archive + unarchive: PASS
- category create + edit + persistence: PASS
- category archive + unarchive: PASS
- refresh + logout/login persistence: PASS
- unexpected live errors: NONE

**PHASE_3_LIVE_PERSISTENCE_SMOKE = PASS**

## Phase 3 Final Authorization

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

## Phase 4 Boundary — Transactions

Phase 4 is now authorized. Phase 4 must implement real user-owned income/expense transaction persistence on top of the accepted Phase 2/3 Auth, Accounts, Categories, RLS, and least-privilege contracts.

Phase 4 must **not** implement transfers (Phase 5), dashboard/reporting expansion (Phase 6), budgets/goals/recurring (Phase 7), FX conversion/rate history (Phase 8), income-source integrations (Phase 9), or AI infrastructure/features (Phase 10+).

Transfers remain a separate neutral-to-net-worth domain object and must not be represented as an income/expense category or normal transaction during Phase 4.

## Next Recommended Action

Create and execute a source-controlled Phase 4 Transactions implementation contract. Preserve all accepted Phase 2/3 invariants and require exact-head source verification, remote migration verification, strict structural checks, two-user runtime RLS isolation, and live persistence smoke before Phase 5 is authorized.
