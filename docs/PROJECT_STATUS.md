# Finora Project Status

Current Phase: Phase 8 — Multi-Currency + FX (Pass A)
Status: IN_PROGRESS (Near Completion)

## Feature Implementation Status
- Account CRUD: COMPLETE
- Category CRUD: COMPLETE
- Transaction CRUD: COMPLETE
- Transfers: COMPLETE
- Budgets: COMPLETE
- Goals: COMPLETE
- Recurring: COMPLETE
- Multi-Currency (Pass A): COMPLETE

## Implementation Details (Phase 8 Pass A)
1. **FX Provider & Math**:
   - `src/lib/exchange-rate/fx-math.ts`: BigInt exact decimal math (rounding half away from zero).
   - `src/lib/exchange-rate/frankfurter.ts`: Frankfurter v2 exact string CSV parsing provider.
   - `scripts/verify-fx-math.mjs`: verified (15/15 checks pass).
   - `scripts/verify-fx-provider.mjs`: verified (10/10 checks pass).
2. **Database Migration**:
   - Created `20260829000001_phase_8_fx.sql`.
   - `transaction_fx_snapshots` with composite unique constraint `(transaction_id, target_currency_code)`.
   - `user_settings.auto_fx_enabled`.
3. **Server API**:
   - `SUPABASE_SERVICE_ROLE_KEY` added to `admin.ts` (strictly server-only).
   - `/api/fx/transaction-snapshots` for batch generation/insertion of FX snapshots (fail closed).
   - `/api/fx/current-batch` for latest account valuation.
4. **Dashboard & Reports Integration**:
   - Refactored `getDashboardReportData` and `getDetailedReportData` in `src/features/reports/reports.ts` to seamlessly generate and fetch `BASE` currency snapshots via the new APIs.
   - Preserves all native-currency reporting.
   - Injects the pseudo-currency `'BASE'` (displays as `Tổng hợp (BASE_CURRENCY)` in UI) when `auto_fx_enabled` is true.
   - Fully utilizes exact decimal calculations.
   - Adds CSV export provenance headers for BASE mode.

## Phase 8 Pass A - Final Receipt

### Source gate
Accepted exact-head source SHA: `47ca9a227e59c95fa1f460d490d5cf0a93697434`.
Exact-head verification established:
- local HEAD = remote main: PASS;
- worktree clean: PASS;
- TypeScript: PASS;
- lint: PASS;
- production build: PASS;
- Phase 8 FX math verifier: PASS;
- Phase 8 FX provider verifier: PASS;
- git diff check: PASS;
- remote database modified: false.

Accepted implementation behavior includes:
- immutable transaction FX snapshots;
- exact-string transport and BigInt FX scaling;
- fail-closed behavior for unsupported pairs;
- server-only trusted writes via service-role;
- seamless injection of BASE currency reporting.

**PHASE_8_A_SOURCE_GATE = PASS_CODE_ONLY**

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4=PASS
PHASE_5=PASS
PHASE_6=PASS
PHASE_7=PASS
PHASE_8_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_A_REMOTE_DATABASE=NOT_RUN
PHASE_8_A_STRUCTURAL_GATE=NOT_RUN
PHASE_8_A_TWO_USER_RLS=NOT_RUN
PHASE_8_A_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_8_A_OVERALL=PARTIAL
PHASE_8_B_AUTHORIZED=false
```

## Next Recommended Action
1. Apply `20260829000001_phase_8_fx.sql` to remote Supabase manually.
2. Run structural and RLS verifiers against live Supabase.
3. Complete owner-attested live mobile UX and persistence verification for Phase 8 Pass A.
4. Await explicit authorization from owner to begin Phase 8 Pass B (Cross-Currency Transfers).
