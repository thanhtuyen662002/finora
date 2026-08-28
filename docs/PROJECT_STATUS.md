# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 4 — Transactions — FINAL SOURCE VERIFICATION
- **Phase status:** SOURCE_PATCHED_PENDING_EXACT_HEAD_VERIFICATION
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
- **Phase 4 first corrective baseline SHA:** `7a57a27029ffe86185b67bcceeddaac826e4985d`
- **Phase 4 final-corrective agent SHA audited:** `890184010434e7b88ff8f4050dc6a1d54aae577e`
- **Phase 4 direct residual patch SHA before ledger receipt:** `8655e9cf839966e0bc8beee5c70443773067d814`
- **Phase 4 corrective prompt:** `prompts/PHASE_4_CORRECTIVE.md`
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

## Phase 4 — Transactions — Audited Source State

The final-corrective agent revision `890184010434e7b88ff8f4050dc6a1d54aae577e` materially improved Phase 4: exact-read views, decimal-string handling, current-month summaries, runtime date filters, truthful CSV export, active/historical selection behavior, void/restore UI, and expanded verification scripts were all present.

A repository audit still found bounded residual issues, so that revision was not accepted as the final exact-head source gate. The residuals were corrected directly on `main`:

1. transaction reads now fail closed on `public.transaction_details`; there is no fallback to direct numeric table reads;
2. public transaction mutation contracts accept monetary `amount` as string only;
3. create/update/void/restore read back through the exact text view;
4. exact decimal normalization rejects invalid precision instead of silently truncating extra fractional digits;
5. a new transaction never falls back to an archived account when no active account exists;
6. the structural verifier now checks exact policy role/qual/with-check semantics, ordered composite FK columns, exact grants, security-invoker views, exact text money read columns, and prior-phase RLS regression;
7. the runtime verifier now covers full A/B own lifecycle, bidirectional owned-row insertion denial, bidirectional account/category reference denial, bidirectional select/update isolation, ownership mutation, both category-type mismatch directions, currency mismatch, non-positive amounts, TRANSFER rejection, DELETE denial, bidirectional view isolation, deliberate database-error distinction, and verified cleanup.

These direct changes have not yet been accepted as a source PASS because exact-head TypeScript/lint/build/script-syntax verification has not been rerun after them.

## Remote Phase 4 Database State

The Phase 4 migration has **NOT** been applied to the target Supabase database.

The required order is:

1. exact-head source verification on current remote `main`;
2. only if TypeScript/lint/build/runtime-script syntax all PASS, authorize manual Phase 4 migration application;
3. run `scripts/verify-phase4-db.sql` and require every mandatory row plus `99_OVERALL = PASS`;
4. run `scripts/verify-phase4-rls.mjs` and require exit code `0`;
5. perform live create/edit/void/restore/refresh/re-login persistence and derived-balance smoke;
6. only then close Phase 4 and authorize Phase 5.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** PASS
- **Phase 3:** PASS
- **Phase 4 Code Gate:** PENDING_EXACT_HEAD_VERIFICATION
- **Phase 4 Remote Database:** NOT_APPLIED
- **Phase 4 Structural Gate:** NOT_RUN
- **Phase 4 Two-User Runtime RLS:** NOT_RUN
- **Phase 4 Live Persistence Smoke:** NOT_RUN
- **Phase 4 Overall:** PARTIAL
- **Phase 5 — Transfers:** NOT AUTHORIZED

## Next Recommended Action

Run verification-only against the exact current remote `main`. Do not modify source and do not apply the Phase 4 migration until that exact-head verification passes.
