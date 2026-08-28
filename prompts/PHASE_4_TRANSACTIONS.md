# FINORA — PHASE 4 TRANSACTIONS IMPLEMENTATION CONTRACT

## TASK

Implement **Finora Phase 4 — Transactions** on `thanhtuyen662002/finora`.

Authoritative Phase 3 completion baseline:

`935a806c15d28b8de412631f48cf2ee067a3af2f`

Phase 3 is accepted PASS. Preserve every accepted Phase 2/3 Auth, RLS, least-privilege, Accounts, Categories, and persistence invariant.

Do not begin Phase 5.

---

## 1. Mandatory pre-work

1. Fetch/sync `origin/main` and record exact HEAD before editing.
2. Read completely:
   - `AGENTS.md`
   - `docs/PROJECT_STATUS.md`
   - `docs/DATABASE.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `prompts/PHASE_4_TRANSACTIONS.md`
3. Inspect all current transaction mock/UI surfaces, especially:
   - `src/app/transactions/page.tsx`
   - `src/components/finance/AddTransactionModal.tsx`
   - `src/components/finance/TransactionList.tsx`
   - `src/components/finance/TransactionItem.tsx`
   - `src/lib/mock/transactions.ts`
   - `src/lib/mock/accounts.ts`
   - `src/types/finance.ts`
   - `src/types/database.ts`
   - `src/features/accounts/accounts.ts`
   - `src/features/categories/categories.ts`
4. Preserve accepted Phase 3 `accounts` and `categories` behavior and RLS.
5. Do not modify old accepted migrations in-place. Phase 4 gets a new migration.

---

## 2. Phase 4 scope

Phase 4 implements **real user-owned INCOME and EXPENSE transactions only**.

Mandatory:

- transaction persistence in Supabase;
- create;
- edit;
- void/cancel without hard delete;
- restore a voided transaction;
- list/search/filter/sort real transactions;
- use real Phase 3 accounts and categories;
- current account balances derived deterministically from opening balance + active transactions;
- monthly transaction summaries without fake FX conversion;
- RLS and least-privilege grants;
- strict structural verifier;
- bidirectional two-user runtime verifier;
- live persistence readiness.

Explicitly OUT OF SCOPE:

- transfers — Phase 5;
- treating transfer as a transaction category;
- dashboard/report expansion — Phase 6;
- budgets/goals/recurring — Phase 7;
- exchange-rate lookup, historical FX, or VND conversion — Phase 8;
- income-source/YouTube integration — Phase 9;
- AI — Phase 10+;
- import/export product work beyond a truthful bounded CSV export of currently loaded transaction data if retained.

The current mock `TRANSFER` transaction tab must not become real persistence in Phase 4. Remove it from the real create flow or clearly disable it as future Phase 5 functionality.

---

## 3. Database schema

Create a new source-controlled migration under `supabase/migrations/` with the next monotonic timestamp/name, e.g.:

`20260828000002_phase_4_transactions.sql`

The migration must be atomic with `BEGIN;` / `COMMIT;`.

### `public.transactions`

Required columns:

```text
id              uuid primary key default gen_random_uuid()
user_id         uuid not null
account_id      uuid not null
category_id     uuid not null
type            text not null          -- INCOME | EXPENSE only
amount          numeric(20,4) not null -- > 0
currency_code   text not null          -- uppercase 3-5 letters snapshot
merchant        text not null          -- bounded non-empty description/payee/source
note            text null
occurred_on     date not null default current_date
is_voided       boolean not null default false
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

Use sensible bounded checks for text fields. `amount` must be strictly positive.

### Ownership-safe foreign keys

Do not rely only on frontend filtering or a transaction `user_id` RLS check.

Add/ensure database uniqueness needed for composite ownership-safe FKs without changing accepted row identity semantics:

- `accounts (id, user_id, currency_code)` uniquely referenceable;
- `categories (id, user_id, type)` uniquely referenceable.

Then transactions must enforce:

```text
(account_id, user_id, currency_code)
  -> accounts(id, user_id, currency_code)

(category_id, user_id, type)
  -> categories(id, user_id, type)
```

This must guarantee at the database layer that:

- a transaction cannot reference another user's account;
- a transaction cannot reference another user's category;
- an EXPENSE cannot point at an INCOME category and vice versa;
- the transaction currency snapshot matches the selected account currency when created/edited;
- changing an account currency after dependent transactions exist cannot silently rewrite historical transaction currency.

Use `ON DELETE RESTRICT`/default restrictive behavior. Phase 4 does not hard-delete accounts/categories/transactions.

### Transaction type

Only:

```text
INCOME
EXPENSE
```

No `TRANSFER` value in `public.transactions`.

### FX

Do not create or persist:

```text
exchange_rate
base_amount
base_amount_vnd
converted_balance_vnd
```

Phase 8 owns FX. A transaction preserves only its original `amount` and `currency_code` snapshot in Phase 4.

### updated_at

Use the accepted hardened `public.handle_updated_at()` trigger pattern from Phase 2/3.

---

## 4. Voiding semantics

Phase 4 uses reversible **voiding**, not hard DELETE.

- active transaction: `is_voided = false`;
- voided transaction: `is_voided = true`;
- voided rows remain auditable but are excluded from current balances and active income/expense summaries;
- restore changes `is_voided` back to false;
- application wording should be `Hủy giao dịch` / `Khôi phục`, not pretend a hard delete occurred.

Do not grant DELETE to normal clients and do not create a DELETE RLS policy.

---

## 5. Derived account balances

Do **not** add a persisted `current_balance` column to `accounts`.

Create a read-only derived database surface, preferably a PostgreSQL view such as:

`public.account_balances`

Requirements:

- `WITH (security_invoker = true)`;
- underlying RLS remains authoritative;
- one user's rows cannot leak to another user;
- current balance per account is:

```text
opening_balance
+ sum(active INCOME amounts)
- sum(active EXPENSE amounts)
```

- voided transactions do not affect balance;
- return exact monetary values in a form that does not require unsafe JS floating-point arithmetic; casting derived numeric values to decimal text is acceptable/preferred;
- preserve each account's own currency; never sum unlike currencies into one fake VND number.

Phase 5 will later extend balance derivation to include transfers. Do not implement that now.

If a transaction detail/read view is used, it must also use `security_invoker = true`, expose no secret data, and remain read-only to normal clients.

---

## 6. Money correctness

PostgreSQL `numeric(20,4)` remains authoritative.

Mandatory application rules:

- preserve amount form input as a decimal string through the mutation boundary where practical;
- no `parseFloat()`/`Number()` money arithmetic;
- no JavaScript `reduce((sum) => sum + amount)` over native floating-point monetary values;
- use exact decimal-string handling or an exact decimal library/helper in `lib/money` for any client-side arithmetic;
- no cross-currency arithmetic before Phase 8;
- summaries must be grouped by `currency_code` when more than one currency is present.

Do not use mock exchange rates anywhere in the real transaction path.

---

## 7. RLS and privileges

Enable RLS on `public.transactions`.

Expected policies:

### SELECT

```text
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id)
```

### INSERT

```text
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id)
```

Composite FKs provide the second ownership/category/currency line of defense.

### UPDATE

```text
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id)
```

No DELETE policy.

### Grants

First revoke default grants from:

```text
anon
authenticated
PUBLIC
```

Then grant only:

- table-level SELECT to `authenticated`;
- column-level INSERT for exact creation columns;
- column-level UPDATE for intended mutable columns only;
- no `user_id`, `id`, `created_at`, `updated_at` ownership/identity mutation;
- no DELETE/TRUNCATE/TRIGGER/REFERENCES privileges to normal clients.

If new views exist, revoke from anon/PUBLIC and grant SELECT only to authenticated.

Do not add service-role usage.

---

## 8. Types and feature module

Extend `src/types/database.ts` to match the migration and any read-only views.

Create a bounded feature module under:

`src/features/transactions/`

Provide narrow APIs/types for at least:

```text
getTransactions(...)
createTransaction(...)
updateTransaction(...)
voidTransaction(...)
restoreTransaction(...)
```

Do not expose broad database-generated `Update` types as the public feature mutation contract when they permit identity/ownership/timestamp mutation.

Domain transaction type must be a narrow union:

```ts
'INCOME' | 'EXPENSE'
```

Currency remains extensible 3-5 uppercase letters, not a fixed six-currency enum.

---

## 9. Real transaction UI

Replace mock transaction source-of-truth under `/transactions`.

### Page

Required:

- load authenticated user's real transactions;
- truthful loading state;
- truthful visible error state;
- empty state;
- create;
- edit;
- void;
- view voided records;
- restore;
- refresh/re-login persistence;
- search by merchant/note/category/account;
- filters use real accounts/categories;
- date periods derive from the actual current date, never hardcode `2026-08` or fixed timestamps;
- newest/oldest sort;
- do not compare/sort monetary amounts across different currencies as if directly comparable before Phase 8.

Monthly summary cards must not add USD/EUR/etc into VND. Show per-currency totals or another truthful grouped representation.

### Add/Edit transaction modal

Use real Phase 3 data.

For new transactions:

- only active accounts are selectable;
- only active categories matching selected INCOME/EXPENSE type are selectable;
- selected account determines `currency_code`;
- amount stays a decimal string through mutation boundary;
- no transfer tab;
- no mock income source selector;
- await persistence before closing;
- pending state while saving;
- visible useful error on failure;
- no fake `setTimeout` success.

For editing historical records:

- initialize state from the selected transaction every time the modal opens/row changes;
- do not show stale values from a previously edited row;
- allow current archived account/category references to remain representable even when they are no longer selectable for a brand-new transaction;
- edits must remain ownership/category/currency-valid.

### Transaction item/list

Convert components away from `MockTransaction`.

Display:

- original amount;
- original currency;
- real account/category metadata;
- date;
- merchant/note as appropriate;
- clear visual indication for voided transactions.

Do not show fake `≈ VND` converted amounts.

### CSV

The existing fake export button must not show success without producing real output.

Either:

- implement a bounded truthful CSV export from the user's currently loaded real transaction rows; or
- remove/disable export for Phase 4.

Do not expand into full Phase 14 import/export work.

---

## 10. Accounts integration

Update the real Accounts UI to display **derived current balance** from the accepted read-only balance surface instead of presenting `opening_balance` as if it were the current balance.

Requirements:

- opening balance remains stored unchanged;
- current balance is derived;
- each account is displayed in its own currency;
- no cross-currency net-worth total;
- voided transactions do not affect current balance;
- errors loading derived balances must be visible/truthful rather than silently falling back to a wrong number.

Do not add transfers to the balance formula yet.

---

## 11. Strict structural verifier

Create:

`scripts/verify-phase4-db.sql`

It must produce explicit PASS/FAIL rows and a final `99_OVERALL` that is PASS only when all mandatory checks pass.

At minimum prove:

1. `public.transactions` exists;
2. RLS enabled;
3. exact expected transaction policies by table/name/command/role and no extras;
4. exact ownership `qual` / `with_check` semantics;
5. no DELETE policy;
6. `amount` is exactly `numeric(20,4)` and positive constraint exists;
7. type allows only INCOME/EXPENSE;
8. no transfer-specific persistence columns/value;
9. no FX/base-conversion columns;
10. exact ownership-safe composite FKs to accounts/categories exist;
11. required unique referenced keys on accounts/categories exist;
12. updated-at trigger exists;
13. anon/PUBLIC have no table or column privileges on transactions;
14. authenticated transaction table privileges are exactly SELECT;
15. authenticated INSERT columns match exact allowlist;
16. authenticated UPDATE columns match exact mutable allowlist;
17. no ownership/identity/timestamp UPDATE privilege;
18. derived account-balance view exists and is `security_invoker=true`;
19. any transaction-detail/read views are `security_invoker=true`;
20. anon/PUBLIC cannot read the new views; authenticated has only SELECT;
21. no persisted `current_balance` was added to accounts;
22. Phase 2/3 RLS remains enabled on accepted tables.

Do not build a verifier that prints suspicious details while still returning PASS.

---

## 12. Two-user runtime RLS verifier

Create:

`scripts/verify-phase4-rls.mjs`

Use only the normal publishable client and the existing environment pattern:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
FINORA_TEST_USER_A_EMAIL
FINORA_TEST_USER_A_PASSWORD
FINORA_TEST_USER_B_EMAIL
FINORA_TEST_USER_B_PASSWORD
```

Never use service-role credentials.

The verifier must use unique verifier names and cover at least:

### Authentication

- A authenticates;
- B authenticates.

### Setup

- A can create/read its own verifier account;
- B can create/read its own verifier account;
- use or create valid own categories of matching type.

### Transactions — own operations

For A and B independently:

- INSERT own transaction;
- SELECT own transaction;
- UPDATE own amount/merchant/category/date as appropriate;
- update persistence proven by read-back;
- void own transaction;
- void exclusion from derived active balance proven;
- restore own transaction;
- restored balance effect proven.

### Cross-user isolation

Both directions where applicable:

- A cannot INSERT transaction owned by B;
- B cannot INSERT transaction owned by A;
- A cannot reference B account;
- B cannot reference A account;
- A cannot reference B category;
- B cannot reference A category;
- A cannot SELECT B transaction;
- B cannot SELECT A transaction;
- A cannot UPDATE B transaction;
- B cannot UPDATE A transaction;
- transaction `user_id` ownership cannot be changed through normal client UPDATE.

### Domain integrity

- EXPENSE using INCOME category is blocked;
- INCOME using EXPENSE category is blocked;
- transaction currency not matching selected account is blocked;
- amount `<= 0` is blocked;
- DELETE through normal client is blocked;
- deliberate normal database error is distinguishable from an RLS-empty result.

### Read views

- A account-balance view returns only A rows;
- B account-balance view returns only B rows;
- transaction-detail view, if present, does not leak cross-user rows.

### Cleanup

No DELETE requirement. Void verifier transactions and archive verifier accounts/categories where appropriate. Check every cleanup mutation; do not claim cleanup if it was not proven.

Missing credentials or missing migration must exit non-zero with truthful BLOCKED/FAIL state.

Final PASS requires process exit code `0`.

---

## 13. Documentation

Update `docs/DATABASE.md` by **appending Phase 4 truth** while preserving detailed accepted Phase 2/3 security contracts.

Update `docs/PROJECT_STATUS.md` truthfully.

Until remote Phase 4 DB/runtime gates later pass, status must remain approximately:

```text
PHASE_3=PASS
PHASE_4_CODE=<PASS only after exact-head local verification>
PHASE_4_REMOTE_DATABASE=BLOCKED_NOT_APPLIED / NOT_RUN
PHASE_4_STRUCTURAL_GATE=NOT_RUN
PHASE_4_TWO_USER_RLS=NOT_RUN
PHASE_4_LIVE_PERSISTENCE=NOT_RUN
PHASE_4_OVERALL=PARTIAL
PHASE_5_AUTHORIZED=false
```

Do not write Phase 4 COMPLETE/PASS merely because TypeScript/lint/build passed.

Append an ADR only if a genuinely new durable architectural decision needs recording. If recording the reversible transaction voiding model or composite ownership FK strategy, keep it bounded and explicit.

---

## 14. Verification before publishing source

Run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase4-rls.mjs
```

Also verify source contains no real transaction-path imports/references to:

```text
MOCK_TRANSACTIONS
MOCK_ACCOUNTS
MOCK_CATEGORIES
MOCK_INCOME_SOURCES
getMockExchangeRate
convertMockToBase
```

Verify:

- no `parseFloat`/unsafe Number-based money arithmetic in new transaction code;
- no fake timeout persistence;
- no real `TRANSFER` transaction persistence;
- no service-role key;
- no Phase 5 transfer table;
- no Phase 8 exchange-rate table/API;
- no false Phase 4 PASS wording.

If remote Supabase access is unavailable, that is acceptable. Publish verified source and report the remote DB gate as blocked/not applied. Do not fake it.

---

## 15. Git/provenance

- Base work on current authoritative `origin/main`.
- Keep changes limited to Phase 4.
- Commit corrected source/docs.
- Push to `main` if repository policy permits.
- After push, explicitly fetch/query actual `origin/main` again before reporting push state.
- If a git transport command says push failed, do not assume remote remained unchanged; verify it.
- Phase 5 remains unauthorized.

---

## 16. Required final report

Return exactly:

```text
TASK
Finora Phase 4 — Transactions

STATUS
PASS_CODE_ONLY / PARTIAL / FAIL

AUTHORITATIVE_BASE_SHA
<sha>

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

MIGRATION_CREATED
PASS / FAIL

TRANSACTION_SCHEMA
PASS / FAIL

COMPOSITE_OWNERSHIP_FKS
PASS / FAIL

TRANSACTION_RLS
PASS / FAIL

LEAST_PRIVILEGE_GRANTS
PASS / FAIL

DERIVED_ACCOUNT_BALANCES
PASS / FAIL

NO_TRANSFER_PERSISTENCE
PASS / FAIL

NO_FAKE_FX
PASS / FAIL

TRANSACTION_CREATE
PASS / FAIL

TRANSACTION_EDIT
PASS / FAIL

TRANSACTION_VOID_RESTORE
PASS / FAIL

REAL_FILTERS_AND_LIST
PASS / FAIL

VISIBLE_ERROR_HANDLING
PASS / FAIL

MONEY_DECIMAL_SAFETY
PASS / FAIL

STRUCTURAL_VERIFIER_CREATED
PASS / FAIL

RUNTIME_RLS_VERIFIER_CREATED
PASS / FAIL

TYPESCRIPT
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

RUNTIME_RLS_SCRIPT_SYNTAX
PASS / FAIL

REMOTE_DATABASE
BLOCKED_NOT_APPLIED / PASS / FAIL

REMOTE_STRUCTURAL_GATE
NOT_RUN / PASS / FAIL

REMOTE_TWO_USER_RLS
NOT_RUN / PASS / FAIL

LIVE_PERSISTENCE_SMOKE
NOT_RUN / PASS / FAIL

PHASE_4_OVERALL
PARTIAL / PASS / FAIL

PHASE_5_AUTHORIZED
false

CODE_CHANGES
<exact files>

KNOWN_BLOCKERS
<exact blockers or NONE>
```

Even if all code checks pass, Phase 4 remains PARTIAL until the remote migration, strict structural verifier, two-user runtime verifier, and bounded live persistence smoke pass against the target Supabase project.
