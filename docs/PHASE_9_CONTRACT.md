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
- `user_id` (uuid, not null, default `auth.uid()`, references `auth.users(id)` ON DELETE CASCADE)
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
- `user_id` (uuid, not null, default `auth.uid()`, references `auth.users(id)` ON DELETE CASCADE)
- `income_source_id` (uuid, not null)
- `name` (text, not null, check length 1..200)
- `is_archived` (boolean, not null, default false)
- `created_at` (timestamptz, not null, default now())
- `updated_at` (timestamptz, not null, default now())

**Constraints & Keys:**
- `UNIQUE (id, income_source_id, user_id)` (required for composite attribution foreign keys)
- Composite Foreign Key: `FOREIGN KEY (income_source_id, user_id) REFERENCES public.income_sources(id, user_id) ON DELETE RESTRICT`

### C. Database-Derived Ownership & Insertability Invariant
- `CLIENT_USER_ID_AUTHORITY=false`
- `DATABASE_DERIVED_USER_ID=true`
- Authenticated client INSERT statements strictly omit `user_id`. The database derives ownership directly from the authenticated JWT session via `DEFAULT auth.uid()`.
- Client applications are not required to call `getUser()` merely to send user UUIDs into source/stream creation payloads.
- Authenticated role is strictly denied INSERT and UPDATE privileges on `user_id`.

### D. Generic Sub-Source Model
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
2. **Historical Readability & Non-Destructive Archive (`ARCHIVE_DOES_NOT_ERASE_HISTORY=true`):**
   - Income source totals are derived from realized `type = 'INCOME'` and `is_voided = false` transactions.
   - Archiving an income source or stream (`is_archived = true`) MUST NOT remove, alter, or erase historical realized income from financial reporting.
   - Historical transactions referencing archived sources or streams must continue to resolve names and metadata without disruption.
3. **Fail-Closed New Attribution:** New transactions or updates that assign an archived source or stream (`is_archived = true`) must be rejected.
4. **Trigger Specification:**
   - Enforced via a `BEFORE INSERT OR UPDATE OF type, income_source_id, income_source_stream_id ON public.transactions` trigger.
   - Function signature: `SECURITY INVOKER`, `SET search_path = ''`, using fully qualified table references (`public.income_sources`, `public.income_source_streams`).
   - Editing unrelated fields (e.g. `note`, `merchant`) on existing transactions referencing archived sources must remain permitted.

---

## 7. Updated-At Timestamp Contract

1. **Reuse Existing Function:** Production already possesses the accepted timestamp function:
   ```sql
   public.handle_updated_at()
   ```
   with verified characteristics: `SECURITY INVOKER`, `SET search_path = ''`, `NEW.updated_at = pg_catalog.now()`.
2. **Contract Invariants:**
   - `REUSE_PUBLIC_HANDLE_UPDATED_AT=true`
   - `NEW_UPDATED_AT_FUNCTION=false`
   - Do NOT create duplicate updated-at functions or triggers with different signatures.
3. **Trigger Attachment:** Phase 9 attaches BEFORE UPDATE triggers on `public.income_sources` and `public.income_source_streams` executing `public.handle_updated_at()`.

---

## 8. Multi-Currency & FX Contract

1. **No Scalar Addition Across Currencies:** Native-currency reporting must group amounts by their authoritative transaction `currency_code` (e.g. $100\text{ USD}$ and $2,000,000\text{ VND}$ are reported separately, never summed as $2,000,100$).
2. **Phase 8 FX Architecture Reuse:** When BASE currency valuation is selected, calculations reuse `public.transaction_fx_snapshots` and the Phase 8 FX service. No secondary FX provider or source-level conversion rates shall exist.
3. **Historical FX Immutability:** Modifying source or stream attribution never triggers re-computation or mutation of `transaction_fx_snapshots`.

---

## 9. View Compatibility Lock (`public.transaction_details`)

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

## 10. Exact-Money Boundary & Arithmetic

1. `transaction_details.amount` is cast to exact string `text` to prevent JavaScript IEEE 754 precision loss at the API/JSON boundary.
2. Financial aggregations must use exact decimal helpers (`convertExactAmount`, scaled BigInt arithmetic).
3. Forbidden in all financial paths: `Number(amount)`, `parseFloat(amount)`, unary `+amount`, floating-point `reduce()`.
4. Legacy mock components (e.g. `IncomeSourcesBreakdown`) must be refactored to consume exact-money interfaces before production use.

---

## 11. Analytics & Reporting Dimensions

Income source analytics must answer: "How much income came from each source and stream over a given period?"
- **Dimensions:** Source, Stream, Period (`1M`, `3M`, `6M`, `1Y`, `ALL`), Currency.
- **Filter Invariants:** Strictly active income records only (`type = 'INCOME' AND is_voided = false`).
- **Calendar Semantics:** Reuses existing report calendar period boundaries.

---

## 12. Security & RLS Policy Contract

Both `public.income_sources` and `public.income_source_streams` must enable Row Level Security (RLS).

### Canonical RLS Policy Matrix
Enforces ownership via the optimized Supabase/PostgreSQL pattern:
- `SELECT`: `USING ((SELECT auth.uid()) = user_id)`
- `INSERT`: `WITH CHECK ((SELECT auth.uid()) = user_id)`
- `UPDATE`: `USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)`
- `DELETE`: Explicitly absent (no DELETE policy; authenticated users cannot hard-delete rows)

### Exact Column Privilege Allowlist Contract
- `anon` / `PUBLIC`: Zero privileges (`REVOKE ALL`).
- `authenticated` on `public.income_sources`:
  - `TABLE SELECT`
  - INSERT allowlist exact: `(name, type)`
  - UPDATE allowlist exact: `(name, type, is_archived)`
  - Authenticated MUST NOT INSERT or UPDATE: `id`, `user_id`, `created_at`, `updated_at`
  - `is_archived` defaults to `false` and is not user-supplied during initial INSERT.
- `authenticated` on `public.income_source_streams`:
  - `TABLE SELECT`
  - INSERT allowlist exact: `(income_source_id, name)`
  - UPDATE allowlist exact: `(name, is_archived)`
  - Authenticated MUST NOT INSERT or UPDATE: `id`, `user_id`, `created_at`, `updated_at`
  - `STREAM_PARENT_IMMUTABLE=true`: `income_source_id` is immutable after stream creation from the authenticated client contract.

---

## 13. Verification Gates & Execution Requirements

### A. Two-User Runtime Verification Matrix
Future Phase 9 implementation must satisfy the following automated two-user runtime test suite:
1. User A authenticated INSERT source WITHOUT user_id: PASS
2. Inserted source user_id == auth.uid(): PASS
3. User B authenticated INSERT source WITHOUT user_id: PASS
4. Inserted source user_id == auth.uid(): PASS
5. authenticated explicit user_id injection attempt: REJECTED
6. User A authenticated INSERT stream WITHOUT user_id: PASS
7. Inserted stream user_id == auth.uid(): PASS
8. authenticated explicit stream user_id injection: REJECTED
9. authenticated stream parent reassignment after creation: REJECTED
10. User A reads own source: PASS
11. User B cannot read User A source: PASS
12. User B cannot update User A source: PASS
13. User A creates income stream: PASS
14. User B cannot read or update User A stream: PASS
15. Cross-user source attribution rejected by FK: PASS
16. Cross-user stream attribution rejected by FK: PASS
17. Stream/source mismatch attribution rejected by composite FK: PASS
18. Expense transaction with income source attribution rejected by CHECK: PASS
19. New attribution referencing archived source rejected by trigger: PASS
20. New attribution referencing archived stream rejected by trigger: PASS
21. Historical transaction referencing archived source remains readable: PASS
22. Source/stream archiving exhibits zero financial balance drift: PASS

### B. Structural Catalog Verifier
A dedicated structural verifier must prove:
- `income_sources.user_id` default = `auth.uid()`
- `income_source_streams.user_id` default = `auth.uid()`
- authenticated cannot INSERT user_id (`CLIENT_USER_ID_INSERT_FORBIDDEN`)
- authenticated cannot UPDATE user_id
- authenticated `income_sources` INSERT allowlist exact: `(name, type)`
- authenticated `income_sources` UPDATE allowlist exact: `(name, type, is_archived)`
- authenticated `income_source_streams` INSERT allowlist exact: `(income_source_id, name)`
- authenticated `income_source_streams` UPDATE allowlist exact: `(name, is_archived)`
- stream `income_source_id` not client-updatable (`STREAM_PARENT_IMMUTABLE=true`)
- `income_sources` updated_at trigger -> `public.handle_updated_at()`
- `income_source_streams` updated_at trigger -> `public.handle_updated_at()`
- `REUSE_PUBLIC_HANDLE_UPDATED_AT=true`, `NEW_UPDATED_AT_FUNCTION=false`
- Canonical RLS policies with `(SELECT auth.uid()) = user_id` for SELECT, INSERT, UPDATE; NO DELETE policy.
- Tables and views exist with exact column definitions.
- RLS enabled on all user-owned tables.
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

## 14. Explicit Phase 9 Non-Goals

The following capabilities are explicitly out of scope for Phase 9 and must not be implemented:
- YouTube OAuth, YouTube Data/Analytics API, AdSense API, automatic revenue synchronization.
- Gemini AI financial assistant, AI transaction categorization, receipt OCR.
- Administrative backend, system feature flag backend, user invitation systems.
- Bank synchronization, open banking APIs, credit card aggregators.
- Background automated recurring transaction posting.
- Native mobile applications (iOS / Android).
- Enterprise RBAC, multi-tenant organizational billing, subscription management.

---

## 15. Governance Status

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
