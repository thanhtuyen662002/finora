# FINORA — PHASE 4 TRANSACTIONS CORRECTIVE GATE

## TASK

Correct the published Phase 4 implementation on `thanhtuyen662002/finora`.

Authoritative implementation-under-audit SHA:

`399f96327111ebf9abeb7c95d445ce0174f91e6f`

Phase 3 remains accepted PASS and must not regress.

This is a **code-only corrective pass**. Do not apply any Phase 4 Supabase migration and do not begin Phase 5.

---

## 1. Why this corrective is mandatory

Repository audit of `399f96327111ebf9abeb7c95d445ce0174f91e6f` found that the Phase 4 report overstated completion.

Mandatory defects include:

1. `scripts/verify-phase4-db.sql` is only a minimal existence/column probe and does not implement the required strict structural gate or `99_OVERALL`.
2. `scripts/verify-phase4-rls.mjs` is incomplete and currently uses invalid Phase 3 setup data (missing explicit `user_id` on account/category inserts and invalid 3-digit colors), lacks full A↔B coverage, void/restore balance proof, integrity tests, cleanup proof, and truthful final status.
3. `/transactions` still uses `parseFloat()` and native JavaScript floating-point accumulation/subtraction for money summaries.
4. `AddTransactionModal` still uses `parseFloat()` for transaction amounts.
5. Transaction filters hardcode August/July 2026 and a fixed `2026-08-27` reference date instead of deriving periods from the actual current date.
6. Transaction sorting still compares monetary amounts using native numbers and allows amount sorting across unlike currencies.
7. The CSV button still shows fake success using `setTimeout` without producing an actual file.
8. There is no usable transaction void/restore control in `/transactions`; the feature functions exist but the required UI flow does not.
9. New-transaction account/category selection does not exclude archived rows. Edit mode must still represent the historical archived account/category already referenced by the selected transaction.
10. Monthly summaries currently aggregate all active transaction history rather than the actual current month.
11. `account_balances` is consumed as a JS `number`, and `AccountCard` calls `Number(...)` on money. This violates the Phase 4 exact-decimal contract.
12. The Phase 4 migration lacks sensible maximum-length bounds for `merchant` and `note`.
13. `docs/DATABASE.md` was not updated for Phase 4.
14. `docs/PROJECT_STATUS.md` was destructively shortened, losing detailed accepted Phase 2/3 provenance and receipts.
15. Dashboard edits must not be represented as Phase 6 implementation. Avoid expanding reports/net-worth/FX behavior in Phase 4 and avoid misleading transfer actions now that real transfer persistence is intentionally absent until Phase 5.

Do not run the current Phase 4 migration on remote Supabase before this corrective is accepted.

---

## 2. Migration correction

Because the Phase 4 migration has NOT been applied remotely, the existing unaccepted file may be corrected in place:

`supabase/migrations/20260828000002_phase_4_transactions.sql`

Keep `BEGIN;` / `COMMIT;`.

Mandatory corrections:

- preserve the ownership-safe composite FKs required by `PHASE_4_TRANSACTIONS.md`;
- keep `type` limited to `INCOME | EXPENSE` only;
- keep `amount numeric(20,4) CHECK (amount > 0)`;
- keep 3–5 uppercase `currency_code` snapshot and account-currency FK enforcement;
- add sensible bounded checks for merchant and note, e.g. trimmed merchant length `1..200` and note max `1000` (equivalent reasonable bounds are acceptable if documented);
- do not add FX/base conversion columns;
- do not add transfer persistence;
- do not add persisted `current_balance` to accounts;
- no DELETE policy or normal-client DELETE grant;
- creation should produce an active transaction by default. Prefer excluding `is_voided` from the authenticated INSERT allowlist; `is_voided` belongs in the UPDATE allowlist for void/restore;
- identity/ownership/timestamps remain immutable to authenticated clients.

### Exact decimal read surfaces

Do not force the browser to do money arithmetic with JS floating point.

`public.account_balances` must remain `WITH (security_invoker = true)` and should expose at least:

- `account_id`
- `user_id`
- `currency_code`
- `current_balance` as exact decimal text (cast from numeric) or an equally safe representation that never requires native-number arithmetic in the application.

Current balance formula remains:

`opening_balance + active INCOME - active EXPENSE`

Voided transactions are excluded.

Create a read-only `public.transaction_details` view if useful/preferred, also `WITH (security_invoker = true)`, that joins account/category display metadata and exposes transaction `amount` as decimal text. If created:

- revoke anon/PUBLIC access;
- authenticated gets SELECT only;
- it must not bypass underlying RLS;
- it must not expose foreign-user rows.

The real transaction UI must read exact decimal strings either through a read view or another architecture that demonstrably avoids native JS floating-point monetary arithmetic.

---

## 3. Money correctness

No `parseFloat()` or `Number()` for monetary values in the Phase 4 real transaction/account-balance path.

No native-number monetary `+`, `-`, or reduce accumulation.

Implement one bounded exact-money approach:

- a small decimal-string helper under `src/lib/money/` using fixed 4-decimal scaling + `BigInt`; or
- a suitable exact decimal library if dependency cost is justified.

Required capabilities are limited to what Phase 4 actually needs:

- validate a positive decimal input;
- normalize decimal text;
- exact add/subtract for same-currency monthly summaries;
- exact comparison to zero;
- truthful formatting without converting the money value through unsafe JS floating point.

Keep summaries grouped by currency. Never add unlike currencies.

Do not alter Phase 8 ownership of FX.

---

## 4. Transaction types and feature API

Keep the public domain type narrow:

`'INCOME' | 'EXPENSE'`

Feature module must expose bounded mutation contracts only:

- `getTransactions(...)`
- `createTransaction(...)`
- `updateTransaction(...)`
- `voidTransaction(...)`
- `restoreTransaction(...)`

Do not expose mutation input that allows `id`, `user_id`, `created_at`, or `updated_at` changes.

Use exact decimal strings at mutation boundaries.

If `TransactionRow` remains a raw table shape, do not use its numeric `amount` for browser arithmetic. Prefer a dedicated read model from an exact-text view.

---

## 5. Real `/transactions` behavior

Mandatory real behaviors:

- real authenticated data only;
- loading + visible errors + empty state;
- create;
- edit;
- void (`Hủy giao dịch`);
- view voided records;
- restore (`Khôi phục`);
- refresh/re-login persistence readiness;
- real account/category filters;
- merchant/note/account/category search;
- newest/oldest date sorting;
- current-date-derived time filters;
- current-calendar-month summaries grouped per `currency_code`;
- no amount sorting across currencies. Remove amount-sort options unless a same-currency-only UX is deliberately implemented and proven;
- no fake FX/VND conversion.

### Void/restore UX

Provide an explicit action, not merely a visual `ĐÃ HỦY` badge.

- active transaction: edit + `Hủy giao dịch`;
- voided transaction: clearly shown in a voided view/filter and offers `Khôi phục`;
- await the mutation and reload before showing success/closing relevant UI;
- errors remain visible;
- voided rows are excluded from monthly summary and account balances.

### New vs edit account/category choices

For NEW transaction:

- selectable accounts: active only;
- selectable categories: active only and matching selected type;
- account determines currency snapshot.

For EDIT transaction:

- current historical account/category must remain displayable/selectable even if archived;
- other choices should obey normal active/type constraints;
- changing account must change the outgoing currency snapshot to that account's currency;
- database composite FKs remain authoritative.

### Dates

No fixed `2026-08`, `2026-07`, or `2026-08-27` logic.

Derive:

- current month;
- previous month;
- last 30 days;

from the actual client current date at runtime.

### CSV

Do not show fake success.

Either:

- implement a real bounded CSV download from currently loaded real rows; or
- remove/disable the export control for Phase 4.

No Phase 14 expansion.

---

## 6. Accounts integration

`/accounts` must show derived balances from `account_balances`.

Mandatory:

- exact decimal-safe read representation;
- no `Number(currentBalance)`;
- no fallback that labels opening balance as current balance when derived balance fetch fails;
- if balance loading fails, show a visible truthful error/unknown balance state;
- each account remains in its own currency;
- no cross-currency total;
- archive/edit Phase 3 behavior preserved.

---

## 7. Dashboard boundary

Phase 6 owns real dashboard/reporting.

Do not claim Phase 4 makes dashboard net worth, cash-flow charts, budgets, goals, or FX summaries real.

Keep changes bounded to compatibility. In particular:

- do not introduce `any` adapters for finance rows;
- do not present a `Chuyển khoản` action that silently opens an INCOME/EXPENSE transaction flow. Disable/label it as future Phase 5 or otherwise remove the false action;
- do not add fake Phase 4 transaction success to dashboard;
- preserve build compatibility without expanding Phase 6 scope.

---

## 8. Strict structural verifier

Rewrite `scripts/verify-phase4-db.sql` completely.

It must emit explicit rows:

`check_name | status | detail`

and a final `99_OVERALL`, PASS only if every mandatory condition passes.

At minimum prove all items from the original Phase 4 contract:

1. transactions table exists;
2. transactions RLS enabled;
3. exact three policies with expected names/commands/role and no extra policies;
4. exact ownership `qual` / `with_check` semantics;
5. no DELETE policy;
6. amount exactly numeric(20,4), NOT NULL, positive constraint;
7. type restricted to INCOME/EXPENSE only;
8. no TRANSFER persistence value/schema;
9. no exchange-rate/base-conversion columns;
10. exact composite account ownership/currency FK;
11. exact composite category ownership/type FK;
12. unique referenced keys exist on accounts/categories;
13. transaction updated_at trigger exists;
14. anon/PUBLIC no transaction table or column privileges;
15. authenticated transaction table privileges exactly SELECT;
16. authenticated INSERT columns exactly intended creation allowlist;
17. authenticated UPDATE columns exactly intended mutable allowlist;
18. ownership/identity/timestamps have no UPDATE privilege;
19. DELETE/TRUNCATE/TRIGGER/REFERENCES not granted to normal clients;
20. account_balances exists and is security_invoker=true;
21. transaction_details, if present, is security_invoker=true;
22. anon/PUBLIC cannot read new views; authenticated has SELECT only;
23. no persisted accounts.current_balance;
24. account balance exact-read representation is decimal-safe and includes currency context;
25. merchant/note bounds exist;
26. Phase 2/3 RLS remains enabled on profiles/user_settings/accounts/categories;
27. no Phase 2/3 accepted table lost its established least-privilege posture.

The verifier must not return PASS just because objects exist.

---

## 9. Full two-user runtime verifier

Rewrite `scripts/verify-phase4-rls.mjs` as a genuine fail-closed verifier.

Use only normal publishable clients and:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `FINORA_TEST_USER_A_EMAIL`
- `FINORA_TEST_USER_A_PASSWORD`
- `FINORA_TEST_USER_B_EMAIL`
- `FINORA_TEST_USER_B_PASSWORD`

All six variables are mandatory. Do not print secrets.

Use unique verifier names and valid Phase 3 data:

- account/category inserts must include the authenticated user's own `user_id` as required by existing grants/RLS;
- colors must satisfy Phase 3 six-digit `#RRGGBB` constraints;
- create matching INCOME and EXPENSE verifier categories where needed or select appropriate own baseline categories safely.

Mandatory matrix:

### Auth/setup
- A auth PASS;
- B auth PASS;
- A own verifier account setup/read PASS;
- B own verifier account setup/read PASS;
- valid own matching categories for both users.

### Own transaction operations — BOTH A and B
- insert own;
- select own;
- update own merchant/amount/date/category as appropriate;
- read-back proves update persisted;
- void own;
- exact derived account balance change after void is proven;
- restore own;
- exact balance change after restore is proven.

### Cross-user, both directions
- A cannot insert a transaction owned by B;
- B cannot insert a transaction owned by A;
- A cannot reference B account;
- B cannot reference A account;
- A cannot reference B category;
- B cannot reference A category;
- A cannot select B transaction;
- B cannot select A transaction;
- A cannot update B transaction;
- B cannot update A transaction;
- neither can mutate transaction `user_id` through normal client privileges.

### Domain integrity
- EXPENSE -> INCOME category blocked;
- INCOME -> EXPENSE category blocked;
- currency mismatch vs selected account blocked;
- zero amount blocked;
- negative amount blocked;
- DELETE blocked;
- normal deliberate constraint error is distinguished from RLS-empty behavior.

### View isolation
- account_balances for A exposes only A;
- account_balances for B exposes only B;
- transaction_details if present exposes only the requesting user's rows.

### Cleanup
No hard delete requirement.

- void verifier transactions;
- archive verifier accounts/categories when constraints permit;
- assert every cleanup mutation and read-back;
- never print cleanup PASS merely because no exception was thrown.

Any failed assertion => final process exit non-zero.

Missing migration => truthful BLOCKED, non-zero.

Final exit `0` only when all assertions pass.

---

## 10. Documentation

### `docs/DATABASE.md`
Preserve all existing accepted Phase 2/3 detail and append Phase 4 truth:

- transactions schema;
- ownership-safe composite FKs;
- void semantics;
- exact money strategy;
- account_balances security_invoker semantics;
- transaction_details if used;
- grants/RLS;
- migration ledger entry.

### `docs/PROJECT_STATUS.md`
Restore the detailed accepted Phase 2/3 receipt history from the pre-Phase-4 ledger rather than keeping the destructive abbreviated rewrite.

Then append Phase 4 audit state truthfully.

Until remote migration later passes:

```text
PHASE_3=PASS
PHASE_4_CODE=<PASS only after exact-head checks>
PHASE_4_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_4_STRUCTURAL_GATE=NOT_RUN
PHASE_4_TWO_USER_RLS=NOT_RUN
PHASE_4_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_4_OVERALL=PARTIAL
PHASE_5_AUTHORIZED=false
```

Do not mark Phase 4 complete from local/code-only evidence.

---

## 11. Verification before publishing

Run on the final exact source:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase4-rls.mjs
```

Also search the real Phase 4 transaction/account-balance path for forbidden money patterns and require NONE in monetary logic:

```text
parseFloat(
Number(
baseAmountVND
exchangeRate
convertMockToBase
getMockExchangeRate
```

`Number(...)` used for non-money dates/counts is not the target; monetary use is forbidden.

Verify no `TRANSFER` value can be persisted in Phase 4 transactions.

Verify no fake CSV success remains.

Do not run remote DB verification in this task.

Commit and push the corrective source to `main`. After push, query/fetch ACTUAL `origin/main`; do not trust a transient transport error without checking remote state.

---

## 12. Required final report

Return exactly:

```text
TASK
Finora Phase 4 Corrective Gate

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

AUTHORITATIVE_BASE_SHA
<sha>

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

WORKTREE_CLEAN
true / false

MIGRATION_CORRECTED
PASS / FAIL

MONEY_DECIMAL_SAFETY
PASS / FAIL

ACCOUNT_BALANCE_EXACT_READ
PASS / FAIL

TRANSACTION_CREATE_EDIT
PASS / FAIL

TRANSACTION_VOID_RESTORE_UI
PASS / FAIL

ACTIVE_ACCOUNT_CATEGORY_SELECTION
PASS / FAIL

CURRENT_DATE_FILTERS
PASS / FAIL

MONTHLY_PER_CURRENCY_SUMMARY
PASS / FAIL

CSV_TRUTHFUL
PASS / FAIL

STRUCTURAL_VERIFIER_STRICT
PASS / FAIL

RUNTIME_RLS_VERIFIER_FULL_MATRIX
PASS / FAIL

DATABASE_DOC_PRESERVED_UPDATED
PASS / FAIL

PROJECT_STATUS_HISTORY_RESTORED
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
BLOCKED_NOT_APPLIED

REMOTE_STRUCTURAL_GATE
NOT_RUN

REMOTE_TWO_USER_RLS
NOT_RUN

LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_4_OVERALL
PARTIAL

PHASE_5_AUTHORIZED
false

CODE_CHANGES
<exact files>

KNOWN_BLOCKERS
<exact blockers or NONE>
```

Do not apply Supabase migration.
Do not begin Phase 5.
