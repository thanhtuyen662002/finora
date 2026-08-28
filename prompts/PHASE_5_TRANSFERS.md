# Finora Phase 5 — Transfers Implementation Contract

## 1. Mission

Implement Phase 5 — Transfers on top of the accepted Phase 2/3/4 baseline.

Phase 5 adds real persisted transfers between a user's own accounts. Transfers are a separate financial primitive from income/expense transactions and MUST remain neutral to aggregate net worth.

Do not begin Phase 6.

## 2. Authoritative baseline

Before changing code:

1. sync the latest `origin/main`;
2. read `AGENTS.md` and all governance docs;
3. read `docs/PROJECT_STATUS.md`, `docs/DATABASE.md`, and accepted Phase 4 source/migration/verifiers;
4. inspect the actual current implementation rather than relying on prior reports.

Preserve all accepted Phase 2/3/4 security, RLS, least-privilege, exact-decimal, exact-read-view, and documentation contracts.

## 3. Non-negotiable financial invariants

### 3.1 Transfer is not income or expense

A transfer MUST NOT be stored as an `INCOME`, `EXPENSE`, or synthetic category transaction.

Do not add `TRANSFER` to `transactions.type`.

Do not create a transfer category.

### 3.2 Net-worth neutrality

For a same-currency transfer of `5,000,000 VND` from Account A to Account B:

- Account A balance decreases exactly `5,000,000.0000`;
- Account B balance increases exactly `5,000,000.0000`;
- the sum of both account balances remains exactly unchanged.

Voiding a transfer must exactly reverse both effects. Restoring it must exactly reapply both effects.

### 3.3 No FX before Phase 8

Phase 5 supports transfers only between accounts with the SAME `currency_code`.

If source and destination account currencies differ:

- database must reject the transfer;
- UI must prevent selection/submission;
- display a truthful message that cross-currency transfers will be supported in Phase 8;
- do not invent exchange rates;
- do not persist `exchange_rate`, `base_amount`, converted values, or fake VND equivalents.

### 3.4 Exact decimal safety

All persisted monetary amounts remain PostgreSQL `numeric(20,4)`.

All application money boundaries must use decimal strings / existing exact BigInt-scaled helpers.

Do NOT use `Number`, `parseFloat`, floating-point addition/subtraction, or lossy numeric casts in real transfer/balance paths.

## 4. Database schema

Create one new migration after the accepted Phase 4 migration. Use the repository migration naming convention and one atomic `BEGIN; ... COMMIT;` migration.

Create `public.transfers` with at least:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL`
- `from_account_id UUID NOT NULL`
- `to_account_id UUID NOT NULL`
- `amount NUMERIC(20,4) NOT NULL`
- `currency_code TEXT NOT NULL`
- `note TEXT NULL`
- `occurred_on DATE NOT NULL DEFAULT CURRENT_DATE`
- `is_voided BOOLEAN NOT NULL DEFAULT FALSE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Required constraints:

- `amount > 0`
- `from_account_id <> to_account_id`
- `currency_code ~ '^[A-Z]{3,5}$'`
- `note IS NULL OR char_length(note) <= 1000`

Ownership/currency-safe composite FKs:

- `(from_account_id, user_id, currency_code)` -> `accounts(id, user_id, currency_code)` ON DELETE RESTRICT
- `(to_account_id, user_id, currency_code)` -> `accounts(id, user_id, currency_code)` ON DELETE RESTRICT

These FKs must guarantee both referenced accounts belong to the transfer owner and both have exactly the transfer currency.

Reuse `public.handle_updated_at()` for a transfer updated-at trigger.

Do not hard-delete transfers in normal client lifecycle.

## 5. RLS and least privilege

Enable RLS on `public.transfers`.

Exactly three authenticated ownership policies:

- SELECT: `(select auth.uid()) = user_id`
- INSERT WITH CHECK: `(select auth.uid()) = user_id`
- UPDATE USING + WITH CHECK: `(select auth.uid()) = user_id`

No DELETE policy.

Before grants:

- REVOKE ALL from `anon`
- REVOKE ALL from `authenticated`
- REVOKE ALL from `PUBLIC`

Authenticated privileges:

- table-level SELECT only;
- column-level INSERT only for creation fields including `user_id`, excluding identity/timestamps/`is_voided`;
- column-level UPDATE only for mutable business fields + `is_voided`;
- `user_id`, `id`, `created_at`, `updated_at` must not be client mutable.

No service-role credentials in browser/runtime verification.

## 6. Exact read surfaces

Create `public.transfer_details WITH (security_invoker = true)`.

It must expose transfer data needed by UI, including source/destination account names, while casting `amount` to TEXT before JSON crosses into JavaScript.

Authenticated: SELECT only.
Anon/PUBLIC: no privileges.

No fallback from application code to reading `transfers.amount` as JS number.

### Update `public.account_balances`

Update the accepted `account_balances` security-invoker view so current balance is derived exactly as:

`opening_balance + active INCOME - active EXPENSE + active incoming transfers - active outgoing transfers`

Requirements:

- ignore voided transactions;
- ignore voided transfers;
- no persisted `current_balance` column;
- final `current_balance` must still be exposed as TEXT;
- no cross-currency conversion;
- avoid join multiplication/double-counting when combining transaction and transfer aggregates. Prefer independently pre-aggregated per-account inputs/CTEs joined to accounts rather than a raw multi-join that can produce Cartesian multiplication.

## 7. Application feature module

Create/complete `src/features/transfers/` with typed functions such as:

- `getTransfers()`
- `createTransfer()`
- `updateTransfer()`
- `voidTransfer()`
- `restoreTransfer()`

Use the Supabase authenticated client and `transfer_details` exact read surface.

Public transfer mutation contracts must use `amount: string`.

No `as any` in transfer mutation paths.

Visible errors must be returned/displayed truthfully.

## 8. UI behavior

Implement a real transfer UX consistent with existing Finora UI.

Preferred integration:

- keep income/expense transactions as their own existing flow;
- add a clearly separated `Chuyển tiền` flow/tab/section under the transaction experience OR a dedicated `/transfers` route if that fits the current architecture better;
- enable transfer action from account surfaces where currently disabled/placeholder, without adding Phase 6 dashboard behavior.

Required transfer UX:

- real persisted list;
- create;
- edit;
- void;
- restore;
- loading state;
- empty state;
- visible error state;
- refresh persistence;
- logout/login persistence.

### Account selection rules

For NEW transfer:

- source account must be active;
- destination account must be active;
- source and destination must be different;
- after choosing source, destination choices must be limited to active accounts with same `currency_code`;
- if there is no compatible destination, show a truthful disabled/empty explanation.

For EDIT of historical transfer:

- preserve currently referenced archived source/destination accounts if already assigned to the transfer;
- do not expose unrelated archived accounts as new choices;
- preserve same-currency invariant.

### Amount behavior

Use exact decimal validation. No `Number()` / `parseFloat()` monetary checks.

Do not silently round or truncate more than 4 fractional digits.

## 9. Reporting and transaction summaries

Phase 4 income/expense monthly summaries MUST remain income/expense-only.

Transfers must not increase monthly income or monthly expense.

If transfer records are shown alongside other activity, they must be visually distinguishable and excluded from income/expense totals.

Do not implement Phase 6 reporting aggregation beyond what is necessary to keep existing screens truthful.

## 10. Structural verifier

Create `scripts/verify-phase5-db.sql` as a READ-ONLY, fail-closed verifier.

It must emit individual `PASS`/`FAIL` rows and a final `99_OVERALL` that is PASS only if every mandatory check passes.

At minimum verify semantics for:

- transfers table exists;
- RLS enabled;
- exact three authenticated policy names/roles/commands/USING/WITH CHECK;
- no DELETE policy;
- amount exactly numeric(20,4);
- positive amount constraint;
- from != to constraint;
- currency format and note length constraints;
- exact ordered source-account composite FK and RESTRICT action;
- exact ordered destination-account composite FK and RESTRICT action;
- updated-at trigger points to `handle_updated_at()`;
- anon/PUBLIC no table/column privileges;
- authenticated table-level SELECT only;
- exact INSERT column allowlist;
- exact UPDATE column allowlist;
- ownership/identity/timestamps not mutable;
- `transfer_details` security_invoker=true;
- `transfer_details.amount` is text;
- exact view grants;
- `account_balances` remains security_invoker=true and current_balance text;
- no persisted current_balance;
- no FX fields introduced;
- `transactions.type` still only INCOME/EXPENSE;
- Phase 2/3/4 RLS remains enabled;
- Phase 4 transaction policies/grants are not regressed.

The verifier itself must be executable PostgreSQL and must not mutate the database.

## 11. Two-user runtime verifier

Create `scripts/verify-phase5-rls.mjs`.

Use only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- disposable User A credentials
- disposable User B credentials

No service role.

Missing required env => non-zero exit.
Missing Phase 5 table/view => distinct non-zero blocked/fail result.
Any failed assertion => non-zero exit.
All PASS => exit 0.

The runtime matrix must include at least:

### Fixture setup

For both A and B create same-currency source/destination accounts using valid Phase 3 fields and exact string opening balances.

### Own transfer lifecycle — BOTH users

- create transfer;
- exact `transfer_details.amount` text read-back;
- verify source balance decreases exactly;
- verify destination balance increases exactly;
- verify combined same-currency balance is exactly unchanged;
- edit amount and verify both balances + unchanged combined total;
- void and verify both account effects reverse exactly;
- restore and verify effects return exactly.

### Cross-user isolation — BOTH directions

- A cannot insert transfer owned by B;
- B cannot insert transfer owned by A;
- A cannot reference B source account;
- A cannot reference B destination account;
- B cannot reference A source account;
- B cannot reference A destination account;
- foreign SELECT returns no rows without RLS database error;
- foreign UPDATE affects no rows;
- ownership mutation is blocked;
- `transfer_details` does not leak foreign rows;
- `account_balances` does not leak foreign accounts.

### Domain/integrity checks

- amount `0` rejected;
- negative amount rejected;
- same source/destination rejected;
- invalid currency code rejected;
- mismatched transfer currency vs accounts rejected;
- cross-currency source/destination pair rejected;
- note >1000 rejected;
- client DELETE blocked;
- deliberate known non-RLS database constraint error is distinguishable from RLS-empty behavior.

### Regression checks

- a normal Phase 4 transaction still changes one account balance correctly;
- a transfer does NOT alter income/expense transaction semantics;
- transaction exact read view remains usable.

### Cleanup

No hard-delete capability is available to normal users, so cleanup must use allowed lifecycle operations (void test transfers, archive test accounts) and assert each cleanup mutation succeeds.

## 12. Live smoke expectations

Do not mark Phase 5 overall PASS until remote migration, structural verifier, runtime verifier, and live smoke all pass.

Expected live smoke after authorization:

- create same-currency transfer;
- source decreases exactly;
- destination increases exactly;
- combined total unchanged;
- edit persists;
- void reverses both account effects;
- restore reapplies both effects;
- refresh persists;
- logout/login persists;
- cross-currency transfer is visibly blocked/truthful;
- monthly income/expense summary unchanged by transfer;
- no unexpected live errors.

## 13. Documentation

Update `docs/DATABASE.md` with the real Phase 5 schema, views, grants, RLS, and balance derivation.

Update `docs/PROJECT_STATUS.md` truthfully while PRESERVING all accepted Phase 2/3/4 receipts and history.

Do not prematurely mark:

- remote migration PASS;
- structural DB PASS;
- two-user runtime PASS;
- live smoke PASS;
- Phase 5 overall PASS;
- Phase 6 authorized.

## 14. Source verification before database authorization

Run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase5-rls.mjs
git diff --check
```

Also scan the Phase 5 money path for forbidden `Number`, `parseFloat`, lossy numeric casts, or native floating-point money arithmetic.

Do not apply the remote Supabase migration during the implementation/code gate unless explicitly authorized after repository audit.

## 15. Scope exclusions

Do NOT implement:

- cross-currency FX conversion;
- exchange-rate providers;
- historical/current FX logic;
- Phase 6 dashboard/report redesign;
- budgets/goals/recurring changes;
- income-source/YouTube features;
- AI infrastructure;
- admin features;
- import/export expansion beyond existing truthful behavior;
- service-role browser usage.

## 16. Final report format

Return exactly:

```text
TASK
Finora Phase 5 — Transfers

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

WORKTREE_CLEAN
true / false

TRANSFER_SCHEMA
PASS / FAIL

SAME_CURRENCY_INVARIANT
PASS / FAIL

NET_WORTH_NEUTRALITY_DESIGN
PASS / FAIL

TRANSFER_CREATE_EDIT
PASS / FAIL

TRANSFER_VOID_RESTORE
PASS / FAIL

EXACT_DECIMAL_SAFETY
PASS / FAIL

ACCOUNT_BALANCE_DERIVATION
PASS / FAIL

CROSS_CURRENCY_BLOCKED
PASS / FAIL

RLS_LEAST_PRIVILEGE
PASS / FAIL

STRUCTURAL_VERIFIER_CREATED
PASS / FAIL

RUNTIME_RLS_VERIFIER_CREATED
PASS / FAIL

DATABASE_DOC_UPDATED
PASS / FAIL

PROJECT_STATUS_PRESERVED_UPDATED
PASS / FAIL

TYPESCRIPT
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

RUNTIME_RLS_SCRIPT_SYNTAX
PASS / FAIL

GIT_DIFF_CHECK
PASS / FAIL

REMOTE_DATABASE
BLOCKED_NOT_APPLIED / APPLIED

REMOTE_STRUCTURAL_GATE
NOT_RUN / PASS / FAIL

REMOTE_TWO_USER_RLS
NOT_RUN / PASS / FAIL

LIVE_PERSISTENCE_SMOKE
NOT_RUN / PASS / FAIL

PHASE_5_OVERALL
PARTIAL / PASS / FAIL

PHASE_6_AUTHORIZED
false

CODE_CHANGES
<one file per line or NONE>

KNOWN_BLOCKERS
<NONE or exact blockers>
```

A `PASS_CODE_ONLY` report is allowed only when source verification passes and actual local HEAD equals actual remote `origin/main` after push. Remote database/live gates remain pending until separately authorized and executed.
