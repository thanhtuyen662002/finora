# Finora Phase 9 — Income Sources & Revenue Attribution — Contract Specification

## 1. Overview & Document Status

- **Phase Name:** Phase 9 — Income Sources & Revenue Attribution
- **Repository:** `thanhtuyen662002/finora`
- **Target Supabase Project:** `qibfitbnlfgiqctntufr`
- **Document Status:** CONTRACT_DEFINED (Authoritative implementation contract; implementation pending authorization)
- **Architectural Reference:** `ADR-015 — Income Sources Are Attribution Metadata, Not a Financial Ledger` (`docs/DECISIONS.md`)

This document defines the strict, authoritative technical and financial contract for Phase 9.

---

## 2. Core Architectural Principle

Income Sources and Streams are **pure attribution and categorization metadata**, not an independent financial ledger.

### Non-Authority Invariants
An income source or stream MUST NOT own or store:
- `current_balance`
- `historical_balance`
- `total_income`
- `monthly_income`
- `converted_income`
- `exchange_rate`
- `base_amount`
- `account_balance`
- `currency_code` (intrinsic source currency authority)

All financial balances, historical values, and currency conversions must remain strictly derived from authoritative records in `public.transactions` and the Phase 8 FX engine (`public.transaction_fx_snapshots`).

### Financial Neutrality
Operations on income sources and streams must satisfy the following strict zero-delta financial invariants:
```text
ACCOUNT_BALANCE_DELTA = 0
NET_WORTH_DELTA = 0
INCOME_TOTAL_DELTA = 0
EXPENSE_TOTAL_DELTA = 0
FX_SNAPSHOT_DELTA = 0
```
Creating, updating, renaming, or archiving a source or stream has zero impact on user account balances, net worth, historical income/expense ledgers, or FX rates.

---

## 3. Proven Pre-State

Prior to Phase 9 implementation, the database state is:
```text
public.income_sources = ABSENT
public.income_source_streams = ABSENT
public.income_source_details = ABSENT
transactions.income_source_id = ABSENT
transactions.income_source_stream_id = ABSENT
```
`public.transactions` remains the sole realized monetary ledger for all income and expense items.

---

## 4. Database Schema Specifications

Phase 9 defines two user-owned tables and updates `public.transactions` and `public.transaction_details`.

### A. Table `public.income_sources`
Represents high-level logical sources of income.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null, references `auth.users(id)` ON DELETE CASCADE)
- `name` (text, not null, check length 1..200)
- `type` (text, not null, check in (`'SALARY'`, `'YOUTUBE'`, `'FREELANCE'`, `'INVESTMENT'`, `'OTHER'`))
- `is_archived` (boolean, not null, default false)
- `created_at` (timestamptz, not null, default now())
- `updated_at` (timestamptz, not null, default now())

**Constraints & Keys:**
- `UNIQUE (id, user_id)` (required for composite ownership foreign keys)

### B. Table `public.income_source_streams`
Represents optional sub-sources/channels underneath a primary income source.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `user_id` (uuid, not null, references `auth.users(id)` ON DELETE CASCADE)
- `income_source_id` (uuid, not null)
- `name` (text, not null, check length 1..200)
- `is_archived` (boolean, not null, default false)
- `created_at` (timestamptz, not null, default now())
- `updated_at` (timestamptz, not null, default now())

**Constraints & Keys:**
- `UNIQUE (id, income_source_id, user_id)` (required for composite attribution foreign keys)
- Composite Foreign Key: `FOREIGN KEY (income_source_id, user_id) REFERENCES public.income_sources(id, user_id) ON DELETE RESTRICT`

### C. Generic Sub-Source Model
Streams are generic and modular across all source types:
- YouTube: Channel A, Channel B, Channel C
- Freelance: Client X, Client Y
- Investment: Brokerage 1, Dividend Portfolio 2

No provider-specific tables (such as `youtube_channels`) shall be created.

---

## 5. Transaction Attribution Invariants

Phase 9 adds optional attribution columns to `public.transactions`:
- `income_source_id` (uuid, nullable)
- `income_source_stream_id` (uuid, nullable)

### Strict Invariant Rules
1. **Optional Attribution:** Attribution is optional; existing transactions remain valid with `income_source_id IS NULL` and `income_source_stream_id IS NULL`.
2. **Income Type Invariant:** Attribution is strictly prohibited on expense transactions:
   ```sql
   CHECK (
     (type = 'EXPENSE' AND income_source_id IS NULL AND income_source_stream_id IS NULL)
     OR
     (type = 'INCOME')
   )
   ```
3. **Stream Hierarchy Invariant:** A stream attribution requires a source attribution:
   ```sql
   CHECK (
     income_source_stream_id IS NULL
     OR
     income_source_id IS NOT NULL
   )
   ```
4. **Composite Referential Integrity:**
   ```sql
   FOREIGN KEY (income_source_id, user_id)
     REFERENCES public.income_sources(id, user_id)
     ON DELETE RESTRICT;

   FOREIGN KEY (income_source_stream_id, income_source_id, user_id)
     REFERENCES public.income_source_streams(id, income_source_id, user_id)
     ON DELETE RESTRICT;
   ```
   This guarantees at the database engine level that:
   - The source belongs to the transaction owner (`user_id`).
   - The stream belongs to the transaction owner (`user_id`).
   - The stream belongs to the specified `income_source_id`.
   - Cross-user attribution is impossible to construct.

---

## 6. Active Attribution & Archive Enforcement

1. **Soft Archive Only:** Hard deletes are prohibited on sources and streams.
2. **Historical Readability:** Historical transactions referencing archived sources or streams must continue to resolve names and metadata without disruption.
3. **Fail-Closed New Attribution:** New transactions or updates that assign an archived source or stream (`is_archived = true`) must be rejected.
4. **Trigger Specification:**
   - Enforced via a `BEFORE INSERT OR UPDATE OF type, income_source_id, income_source_stream_id ON public.transactions` trigger.
   - Function signature: `SECURITY INVOKER`, `SET search_path = ''`, using fully qualified table references (`public.income_sources`, `public.income_source_streams`).
   - Editing unrelated fields (e.g. `note`, `merchant`) on existing transactions referencing archived sources must remain permitted.

---

## 7. Multi-Currency & FX Contract

1. **No Scalar Addition Across Currencies:** Native-currency reporting must group amounts by their authoritative transaction `currency_code` (e.g. $100\text{ USD}$ and $2,000,000\text{ VND}$ are reported separately, never summed as $2,000,100$).
2. **Phase 8 FX Architecture Reuse:** When BASE currency valuation is selected, calculations reuse `public.transaction_fx_snapshots` and the Phase 8 FX service. No secondary FX provider or source-level conversion rates shall exist.
3. **Historical FX Immutability:** Modifying source or stream attribution never triggers re-computation or mutation of `transaction_fx_snapshots`.

---

## 8. View Compatibility Lock (`public.transaction_details`)

Production `public.transaction_details` has an immutable 17-column prefix:
```text
1  id
2  user_id
3  account_id
4  category_id
5  type
6  amount
7  currency_code
8  merchant
9  note
10 occurred_on
11 is_voided
12 created_at
13 updated_at
14 account_name
15 category_name
16 category_icon
17 category_color
```
Phase 9 view definitions MUST append new attribution columns strictly after column 17:
```text
18 income_source_id
19 income_source_stream_id
20 income_source_name
21 income_source_type
22 income_source_stream_name
```
The view must be defined with `WITH (security_invoker = true)`. Reordering, removing, or inserting columns within the 1-17 prefix is strictly forbidden.

---

## 9. Exact-Money Boundary & Arithmetic

1. `transaction_details.amount` is cast to exact string `text` to prevent JavaScript IEEE 754 precision loss at the API/JSON boundary.
2. Financial aggregations must use exact decimal helpers (`convertExactAmount`, scaled BigInt arithmetic).
3. Forbidden in all financial paths: `Number(amount)`, `parseFloat(amount)`, unary `+amount`, floating-point `reduce()`.
4. Legacy mock components (e.g. `IncomeSourcesBreakdown`) must be refactored to consume exact-money interfaces before production use.

---

## 10. Analytics & Reporting Dimensions

Income source analytics must answer: "How much income came from each source and stream over a given period?"
- **Dimensions:** Source, Stream, Period (`1M`, `3M`, `6M`, `1Y`, `ALL`), Currency.
- **Filter Invariants:** Strictly active income records only (`type = 'INCOME' AND is_voided = false`).
- **Calendar Semantics:** Reuses existing report calendar period boundaries.

---

## 11. Security & RLS Policy Contract

Both `public.income_sources` and `public.income_source_streams` must enable Row Level Security (RLS).

### Policy Matrix
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `WITH CHECK (auth.uid() = user_id)`
- `UPDATE`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- `DELETE`: Explicitly absent (no DELETE policy; authenticated users cannot hard-delete rows)

### Privilege Grant Matrix
- `anon` / `PUBLIC`: Zero privileges (`REVOKE ALL`).
- `authenticated`: Table-level `SELECT`, column-specific `INSERT` and `UPDATE` allowlists. No client authority over `id`, `user_id`, `created_at`, or `updated_at`.

---

## 12. Verification Gates & Execution Requirements

### A. Two-User Runtime Verification Matrix
Future Phase 9 implementation must satisfy the following automated two-user runtime test suite:
1. User A creates income source: PASS
2. User B creates income source: PASS
3. User A reads own source: PASS
4. User B cannot read User A source: PASS
5. User B cannot update User A source: PASS
6. User A creates income stream: PASS
7. User B cannot read or update User A stream: PASS
8. Cross-user source attribution rejected by FK: PASS
9. Cross-user stream attribution rejected by FK: PASS
10. Stream/source mismatch attribution rejected by composite FK: PASS
11. Expense transaction with income source attribution rejected by CHECK: PASS
12. New attribution referencing archived source rejected by trigger: PASS
13. New attribution referencing archived stream rejected by trigger: PASS
14. Historical transaction referencing archived source remains readable: PASS
15. Source/stream archiving exhibits zero financial balance drift: PASS

### B. Structural Catalog Verifier
A dedicated structural verifier must prove:
- Tables and views exist with exact column definitions.
- RLS enabled on all user-owned tables.
- Exact SELECT, INSERT, UPDATE policies; NO DELETE policy.
- Absence of `anon`/`PUBLIC` privileges.
- Composite UNIQUE constraints and FKs with `ON DELETE RESTRICT`.
- CHECK constraints on transaction type and stream-source hierarchy.
- Trigger properties: `SECURITY INVOKER`, `SET search_path = ''`.
- `public.transaction_details` prefix lock and `security_invoker = true`.
- Previous phase migrations, triggers, and views remain untouched and functional.

### C. Phase 8 Migration Blob Locks
Phase 9 must not alter applied Phase 8 migration files:
- `20260829000002_phase_8_cross_currency_transfers.sql`: `e046ea3f62aaa76f00295e68126ca29a48bfaa9b`
- `20260831142135_phase_8_cross_currency_transfer_integrity_corrective.sql`: `5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18`
- `20260831144154_phase_8_transfer_trigger_security_hardening.sql`: `3ee23b513bcd65182afa613084dda8fbf5b40293`
- `20260831150000_phase_8_transfer_trigger_search_path_hardening.sql`: `78be2172d313935057aee57fccfc98ed73a5b4d4`

---

## 13. Explicit Phase 9 Non-Goals

The following capabilities are explicitly out of scope for Phase 9 and must not be implemented:
- YouTube OAuth, YouTube Data/Analytics API, AdSense API, automatic revenue synchronization.
- Gemini AI financial assistant, AI transaction categorization, receipt OCR.
- Administrative backend, system feature flag backend, user invitation systems.
- Bank synchronization, open banking APIs, credit card aggregators.
- Background automated recurring transaction posting.
- Native mobile applications (iOS / Android).
- Enterprise RBAC, multi-tenant organizational billing, subscription management.

---

## 14. Governance Status

```text
PHASE_8_OVERALL=PASS
FINORA_PHASE_8=PASS

PHASE_9_AUTHORIZED=true
PHASE_9_SCOPE=INCOME_SOURCES_REVENUE_ATTRIBUTION
PHASE_9_CONTRACT=PASS_CODE_ONLY
PHASE_9_IMPLEMENTATION_AUTHORIZED=false
PHASE_9_SOURCE_GATE=PENDING
PHASE_9_REMOTE_DATABASE=PENDING
PHASE_9_STRUCTURAL_GATE=PENDING
PHASE_9_TWO_USER_RLS=PENDING
PHASE_9_LIVE_PERSISTENCE_SMOKE=PENDING
PHASE_9_OVERALL=PARTIAL

PHASE_10_AUTHORIZED=false
```
