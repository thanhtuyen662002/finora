# Finora — Project Status

## Current State
- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 4 — Transactions
- **Phase status:** IN_PROGRESS
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`

## Phase 2 Accepted Baseline
Phase 2 remains accepted PASS and must not be regressed.
**PHASE_2 = PASS**

## Phase 3 — Accounts + Categories — Final Receipt
Phase 3 is accepted COMPLETE.
**PHASE_3 = PASS**

## Phase 4 Boundary — Transactions
Phase 4 implements real user-owned income/expense transaction persistence on top of the accepted Phase 2/3 Auth, Accounts, Categories, RLS, and least-privilege contracts.

**Current progress:**
- Added transaction feature APIs (`src/features/transactions/transactions.ts`).
- Created `TransactionRow`, `TransactionInsert`, `TransactionUpdate`, `AccountBalanceRow`, and `ExtendedTransaction` types.
- Rewrote `TransactionList`, `TransactionItem`, and `AddTransactionModal` to use real data.
- Rewrote `src/app/transactions/page.tsx` to handle real fetching and summation per currency.
- Updated `AccountCard` to display `currentBalance`.
- Removed all `MOCK_` from transaction paths and updated dashboard to stop rendering `MOCK_TRANSACTIONS`.
- Created `scripts/verify-phase4-db.sql`.
- Created `scripts/verify-phase4-rls.mjs`.

## Next Recommended Action
Complete code verification, commit and push Phase 4 to main. Wait for user to verify RLS structurally and remote.
