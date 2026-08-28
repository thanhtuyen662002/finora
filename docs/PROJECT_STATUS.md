# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 4 — Transactions — FINAL CORRECTIVE IMPLEMENTED
- **Phase status:** CODE_VERIFIED_PENDING_MIGRATION
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

## Phase 4 — Transactions — Final Corrective Implementation

All mandatory items specified in `prompts/PHASE_4_FINAL_CORRECTIVE.md` have been implemented:

1. **Exact-Head Source Consistency & Compilation:**
   - Removed all duplicate imports in `AddTransactionModal.tsx`.
   - Cleaned up top-level module imports for feature functions.
   - Verified zero TypeScript and ESLint warnings/errors.

2. **Exact Decimal Monetary Safety:**
   - Created `public.transaction_details` exact-read view (`security_invoker = true`) casting `amount` to `TEXT` in database.
   - Updated `TransactionRow` and `Database` schema types so `amount` is typed and handled as exact `string`.
   - Implemented pure BigInt/string-based arithmetic in `src/lib/money/index.ts` without native floating point conversions or `parseInt` precision loss.
   - Added `isPositiveExactDecimal` and validated all modal inputs with exact decimal checks.
   - Removed all `as any` typecasts across transaction mutation paths (`voidTransaction`, `restoreTransaction`).

3. **Current Calendar Month Summaries:**
   - Summary cards derive the actual current calendar month dynamically from `new Date()` (e.g. `Tháng M/YYYY`).
   - Active transactions occurring in the current month are grouped and aggregated per `currency_code` using exact decimal addition.

4. **Dynamic Runtime Date Filters:**
   - Replaced all hardcoded date substrings with dynamic date calculations for `THIS_MONTH`, `LAST_MONTH` (with year rollover), and `LAST_30_DAYS`.
   - Constrained transaction sorting strictly to `NEWEST` and `OLDEST` (removed cross-currency amount sorting).

5. **Active vs Historical Archived Selection:**
   - New transactions restrict account and category selection strictly to active rows.
   - Edit mode preserves the selected historical archived account/category without enabling selection of other archived entities.

6. **Void / Restore Lifecycle:**
   - Provided clear, synchronous void and restore actions with UI feedback and error handling.
   - Excluded voided transactions from derived balances and monthly summaries while preserving auditability.

7. **Truthful CSV Export:**
   - Implemented RFC 4180-compliant CSV field escaping for quotes, commas, and newlines.
   - Exports the currently loaded transaction records with download feedback and automatic state cleanup.

8. **Strict Structural Database Verifier:**
   - Rewrote `scripts/verify-phase4-db.sql` into a 26-check PL/pgSQL test suite returning individual `PASS`/`FAIL` rows and a closing `99_OVERALL` gate.

9. **Bidirectional Runtime RLS Matrix:**
   - Rewrote `scripts/verify-phase4-rls.mjs` into a comprehensive two-user test suite validating CRUD isolation, composite foreign keys, type/currency mismatch rejection, check constraints, immutable column restrictions, and cleanup.

## Remote Phase 4 Database State

The Phase 4 migration is **NOT YET APPLIED** to the target Supabase instance.
Per the strict protocol, the remote database migration will only be authorized after source review.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** PASS
- **Phase 3:** PASS
- **Phase 4 Code Gate:** PASS
- **Phase 4 Remote Database:** PENDING_MANUAL_APPLICATION
- **Phase 4 Structural Gate:** READY_TO_RUN
- **Phase 4 Two-User Runtime RLS:** READY_TO_RUN
- **Phase 4 Live Persistence Smoke:** PENDING_MIGRATION
- **Phase 4 Overall:** IN_PROGRESS
- **Phase 5 — Transfers:** NOT AUTHORIZED

## Next Recommended Action

1. Verify and commit code-only changes.
2. Apply Phase 4 migration (`supabase/migrations/20260828000002_phase_4_transactions.sql`) to Supabase.
3. Run strict structural verifier (`scripts/verify-phase4-db.sql`) in Supabase SQL editor.
4. Run two-user runtime RLS verifier (`scripts/verify-phase4-rls.mjs`).
5. Conduct live persistence smoke test on Vercel preview.
