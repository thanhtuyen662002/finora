# FINORA — PHASE 4 FINAL CORRECTIVE GATE

## TASK

Perform the **final code-only corrective pass** for Finora Phase 4 — Transactions.

Authoritative audited remote baseline before this prompt:

`89a2e720ea011c342ed0ae2b2d420092ae2b0967`

The previous corrective report is NOT accepted as exact-remote evidence. Actual GitHub `main` differs from the reported local SHA and still contains source/verifier defects.

Do **not** apply any Supabase migration. Do **not** begin Phase 5.

Preserve all accepted Phase 2 and Phase 3 contracts and receipts.

---

## 1. Exact remote defects that MUST be fixed

### A. Exact-head source consistency / compilation

`src/components/finance/AddTransactionModal.tsx` on the audited remote contains duplicate imports of `createTransaction` and `updateTransaction`. Remove duplicate/unused imports and require exact-head TypeScript/lint/build PASS after every final change.

No final report may claim PASS from a different local commit than the actual pushed `origin/main`.

### B. Money must remain exact before and after reads

The current real transaction read path selects `public.transactions.amount` as PostgreSQL numeric into `TransactionRow.amount: number`, then converts it to string later. That can lose precision before decimal helpers see it.

Fix this by adding a read-only exact transaction read surface, preferably a PostgreSQL view such as `public.transaction_details` or `public.transaction_reads`, with:

- `WITH (security_invoker = true)`;
- only user-visible transaction/account/category metadata;
- `amount` exposed as text (`amount::text`) or another exact decimal-string representation;
- no FX/base amount fields;
- underlying RLS remains authoritative;
- `anon` / `PUBLIC` no privileges;
- `authenticated` SELECT only.

The application list/edit path must read exact amount strings from this surface. Do not read monetary values into JS `number` first.

Update database types so real Phase 4 monetary read values are strings. Do not use `as any` to bypass this.

`src/features/transactions/transactions.ts` must expose narrow mutation types and must remove the current `as any` used by void/restore.

### C. Decimal helper correctness

`src/lib/money/index.ts` must not use `parseInt()` / `Number()` to format arbitrarily large monetary integer parts. Format decimal strings using string-only grouping so values within PostgreSQL `numeric(20,4)` remain exact.

Validation of amount must also be string/exact-decimal based. Remove `Number(amount) <= 0` from `AddTransactionModal`.

No `parseFloat`, `Number`, unary numeric coercion, or native floating-point arithmetic may appear in the real Phase 4 monetary path.

### D. Monthly summaries

The three transaction summary cards must summarize **active transactions in the actual current calendar month**, grouped per `currency_code`.

They must not summarize all history.

Use the runtime current date. Do not hardcode 2026-08 or another fixed month.

### E. Date filters

`TransactionList` still hardcodes `2026-08`, `2026-07`, and `2026-08-27` in filtering logic.

Replace with actual runtime date calculations for:

- this month;
- previous month, including year rollover;
- last 30 days.

Keep only newest/oldest sorting. Do not reintroduce cross-currency amount sort.

### F. New vs historical archived references

For a NEW transaction:

- only active accounts may be selected;
- only active categories matching selected type may be selected;
- initial default account/category must be selected from active rows only.

For EDIT of an existing historical transaction:

- its currently referenced archived account/category may remain visible and selected;
- other archived rows must not become selectable as new references.

### G. Void / restore

Keep the real void/restore UI, but:

- no hard delete;
- await mutation and reload before closing/success;
- visible error on failure;
- voided transaction must remain editable only in ways consistent with the product contract; at minimum restore must work truthfully.

### H. CSV

Keep bounded real CSV export or remove the button.

If kept:

- export actual currently loaded real transaction rows;
- properly CSV-escape quotes/commas/newlines rather than wrapping unescaped strings in quotes;
- remove dead fake `exported` state/UI unless a truthful success state is actually set after triggering a real export.

### I. Migration

Keep Phase 4 migration atomic with `BEGIN` / `COMMIT`.

Required existing invariants must remain:

- transactions INCOME/EXPENSE only;
- amount `numeric(20,4)` and `> 0`;
- merchant non-empty and bounded;
- note bounded;
- currency uppercase 3-5 letters;
- ownership-safe composite FKs;
- updated-at trigger;
- no DELETE policy or DELETE grant;
- exact least-privilege INSERT/UPDATE columns;
- no persisted `current_balance`;
- `account_balances` security-invoker and exact decimal text;
- read view(s) security-invoker with least privileges.

### J. Structural verifier must be genuinely strict

Replace `scripts/verify-phase4-db.sql` completely if needed.

It must be valid PostgreSQL SQL/PLpgSQL and return explicit rows (not only NOTICE text) with columns comparable to:

```text
check_name | status | detail
```

and final:

```text
99_OVERALL | PASS | ...
```

`99_OVERALL` must be FAIL if any mandatory check fails.

It must verify AT LEAST:

1. transactions exists;
2. transactions RLS enabled;
3. exactly expected SELECT/INSERT/UPDATE policies, correct role and no extras;
4. exact `qual` / `with_check` ownership predicates;
5. no DELETE policy;
6. amount exactly numeric(20,4);
7. positive amount constraint;
8. transaction type only INCOME/EXPENSE;
9. merchant/note bounds;
10. no TRANSFER persistence value/column;
11. no FX/base-conversion columns;
12. exact account composite FK;
13. exact category composite FK;
14. required referenced unique constraints;
15. updated-at trigger;
16. anon/PUBLIC no table or column privileges on transactions;
17. authenticated table-level privileges exactly SELECT;
18. exact INSERT column allowlist;
19. exact UPDATE column allowlist;
20. no identity/ownership/timestamp update privilege;
21. account_balances exists and is `security_invoker=true`;
22. transaction exact-read view exists and is `security_invoker=true` if used;
23. anon/PUBLIC cannot read new views;
24. authenticated has SELECT only on new views;
25. accounts has no persisted `current_balance`;
26. Phase 2/3 RLS remains enabled on accepted tables.

Do not use unsupported nested `PROCEDURE ... IS` declarations inside an anonymous DO block.

### K. Runtime RLS verifier must be full and runnable

Replace/harden `scripts/verify-phase4-rls.mjs`.

Use only publishable client plus existing test-user env vars. Never use service role.

Every INSERT into user-owned Phase 3/4 tables must supply required ownership fields when the normal client contract requires them.

Use unique verifier names per run.

Required matrix:

- A auth PASS;
- B auth PASS;
- A own verifier account/category setup PASS;
- B own verifier account/category setup PASS;
- A own transaction insert/select/update + read-back PASS;
- B own transaction insert/select/update + read-back PASS;
- A void -> derived balance exclusion -> restore -> balance restoration PASS;
- B same PASS;
- A cannot SELECT/UPDATE B transaction;
- B cannot SELECT/UPDATE A transaction;
- A cannot insert transaction owned by B;
- B cannot insert transaction owned by A;
- A cannot reference B account/category;
- B cannot reference A account/category;
- transaction user_id ownership mutation blocked;
- EXPENSE with INCOME category blocked;
- INCOME with EXPENSE category blocked;
- currency/account mismatch blocked;
- amount zero blocked;
- amount negative blocked;
- normal-client DELETE blocked;
- A balance view only A rows;
- B balance view only B rows;
- transaction read view has no cross-user leakage;
- deliberate non-RLS DB error distinguishable from RLS-empty result;
- every cleanup mutation checked; verifier transactions voided and verifier account/categories archived where appropriate;
- missing credentials/migration exits non-zero;
- final PASS exits exactly 0.

Do not merely print PASS labels. Every assertion must affect exit status.

### L. Documentation / ledger

Preserve detailed accepted Phase 2/3 history.

Update `docs/DATABASE.md` with final Phase 4 schema/views/RLS/grants truth.

Update `docs/PROJECT_STATUS.md` truthfully. Until remote migration/structural/runtime/live gates pass:

```text
PHASE_4_CODE=PASS_CODE_ONLY   # only after exact remote head is actually verified
PHASE_4_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_4_STRUCTURAL_GATE=NOT_RUN
PHASE_4_TWO_USER_RLS=NOT_RUN
PHASE_4_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_4_OVERALL=PARTIAL
PHASE_5_AUTHORIZED=false
```

---

## 2. Required final local/exact-remote verification

After all code changes, run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase4-rls.mjs
```

Also search the real Phase 4 path and require no prohibited money coercion in relevant files:

```text
parseFloat(
Number(
```

except clearly non-money date/index code if any; report each exception explicitly.

Commit and push all changes to `main`.

Then fetch/query the ACTUAL `origin/main` again.

Final success requires:

```text
FINAL_LOCAL_HEAD_SHA == FINAL_REMOTE_MAIN_SHA
REMOTE_HEAD_MATCHES_LOCAL=true
WORKTREE_CLEAN=true
```

If push reports an auth/transport failure, query actual remote before deciding whether push failed.

Do not apply Supabase migration in this task.

---

## 3. Exact final report

Return exactly:

```text
TASK
Finora Phase 4 Final Corrective Gate

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

SOURCE_COMPILE_CLEAN
PASS / FAIL

MIGRATION_FINAL
PASS / FAIL

EXACT_TRANSACTION_READ
PASS / FAIL

MONEY_DECIMAL_SAFETY
PASS / FAIL

MONTHLY_PER_CURRENCY_SUMMARY
PASS / FAIL

CURRENT_DATE_FILTERS
PASS / FAIL

ACTIVE_REFERENCE_SELECTION
PASS / FAIL

VOID_RESTORE_UI
PASS / FAIL

CSV_TRUTHFUL
PASS / FAIL

STRUCTURAL_VERIFIER_STRICT
PASS / FAIL

RUNTIME_RLS_VERIFIER_FULL_MATRIX
PASS / FAIL

DATABASE_DOC
PASS / FAIL

PROJECT_STATUS_LEDGER
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
<paths or NONE>

KNOWN_BLOCKERS
<NONE or truthful blockers>
```
