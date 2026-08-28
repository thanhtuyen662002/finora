# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 4 — Transactions — CORRECTIVE REQUIRED
- **Phase status:** PARTIAL
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Initial Phase 3 implementation SHA:** `8ebe887ed1e5aee8416dd084bad74a575b8d082d`
- **First Phase 3 corrective remote SHA audited:** `7c841ea4702ac191573e40ac2b4308913fd1daeb`
- **AI Studio Phase 3 final-cleanup SHA audited:** `7159363a2d0a20fac9f9621ee531b2d131517d66`
- **Phase 3 code verification SHA:** `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5`
- **Accepted Phase 3 migration-source SHA:** `529d1d42ab50d62b2327fadc7a9ac0b2122798fa`
- **Phase 3 structural receipt SHA:** `1422dcd5e9c67028d1c33006d5d61f7037827dff`
- **Phase 3 runtime RLS receipt SHA:** `2b09f494344a3f6d84bb374ad5bdba0512f7f459`
- **Phase 3 closure SHA:** `935a806c15d28b8de412631f48cf2ee067a3af2f`
- **Phase 4 implementation contract SHA:** `75dd85d4a7b062fb3f8cc2a25570a75c057838ac`
- **Phase 4 implementation SHA under corrective audit:** `399f96327111ebf9abeb7c95d445ce0174f91e6f`
- **Phase 4 corrective prompt:** `prompts/PHASE_4_CORRECTIVE.md`

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

- User A/B authentication: PASS
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

Owner-attested live smoke on `https://finora-orpin-nu.vercel.app`:

- account create + edit + persistence: PASS
- account archive + unarchive: PASS
- category create + edit + persistence: PASS
- category archive + unarchive: PASS
- refresh + logout/login persistence: PASS
- unexpected live errors: NONE

**PHASE_3_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 3 final authorization

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

## Phase 4 — Transactions — Source Audit

Phase 4 implementation was published to `main` at `399f96327111ebf9abeb7c95d445ce0174f91e6f`. The agent report stated Git push was blocked, but actual GitHub inspection proved the commit was already present on remote `main` with parent `75dd85d4a7b062fb3f8cc2a25570a75c057838ac`.

Positive direction confirmed:

- real transaction feature module exists;
- transaction migration is source-controlled and transaction type is limited to INCOME/EXPENSE;
- ownership-safe composite account/category FK intent exists;
- RLS/grant intent exists;
- `account_balances` security-invoker view intent exists;
- transaction UI is partially wired to real Phase 3 accounts/categories;
- transfer tab was removed from the real transaction modal;
- TypeScript/lint/build/script syntax were reported PASS by the implementation agent.

However, repository audit found mandatory blockers. Therefore the code gate is NOT accepted yet and the Phase 4 migration must not be applied remotely in this revision.

### Mandatory corrective findings

1. `scripts/verify-phase4-db.sql` is only a minimal existence/column probe and does not implement the strict structural verifier contract or final `99_OVERALL`.
2. `scripts/verify-phase4-rls.mjs` is not a valid full runtime verifier: setup omits required Phase 3 `user_id`, uses invalid `#000` colors, lacks full bidirectional A↔B transaction matrix, void/restore balance proof, integrity tests, view isolation, and cleanup assertions.
3. `/transactions` uses `parseFloat()` and native-number accumulation/subtraction for monetary summaries.
4. `AddTransactionModal` uses `parseFloat()` for monetary validation/mutations.
5. Transaction filters hardcode August/July 2026 and a fixed date instead of current runtime dates.
6. Amount sorting compares monetary values as JS numbers and is not currency-safe.
7. CSV UI reports success without creating a real export.
8. Void/restore feature functions exist but the real transaction UI has no complete void/restore controls/flow.
9. New transaction selection includes archived accounts/categories instead of active-only choices.
10. Summary cards aggregate all active history rather than the actual current month.
11. Derived balances are consumed as JS numbers and `AccountCard` uses `Number(...)` for money.
12. Phase 4 transaction migration lacks sensible maximum-length bounds for merchant/note.
13. `docs/DATABASE.md` was not updated with Phase 4 database/security truth.
14. `docs/PROJECT_STATUS.md` was destructively shortened and lost detailed accepted Phase 2/3 receipts; this ledger restores them.
15. Dashboard compatibility edits must remain bounded and must not silently implement/claim Phase 6 or provide a false transfer action.

The exact corrective contract is source-controlled in `prompts/PHASE_4_CORRECTIVE.md`.

## Remote Phase 4 Database State

The Phase 4 migration has **not** been accepted or authorized for application.

Required order after corrective code PASS:

1. audit the corrected exact remote source;
2. run exact-head typecheck/lint/build and runtime verifier syntax;
3. only then authorize the corrected Phase 4 migration for manual Supabase application;
4. run strict `scripts/verify-phase4-db.sql` and require every mandatory row plus `99_OVERALL = PASS`;
5. run hardened two-user `scripts/verify-phase4-rls.mjs` and require exit code `0`;
6. perform live transaction create/edit/void/restore/refresh/re-login smoke and derived-balance proof;
7. only then close Phase 4 and authorize Phase 5.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** PASS
- **Phase 3:** PASS
- **Phase 4 Code Gate:** PASS_CODE_ONLY
- **Phase 4 Remote Database:** BLOCKED_NOT_APPLIED
- **Phase 4 Structural Gate:** NOT_RUN
- **Phase 4 Two-User Runtime RLS:** NOT_RUN
- **Phase 4 Live Persistence Smoke:** NOT_RUN
- **Phase 4 Overall:** PARTIAL
- **Phase 5 — Transfers:** NOT AUTHORIZED

## Next Recommended Action

Manual verify remote migration and tests.
