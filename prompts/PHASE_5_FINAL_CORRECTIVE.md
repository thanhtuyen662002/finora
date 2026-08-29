# Finora Phase 5 — Final Corrective Gate

## Mission

Perform one final CODE-ONLY corrective pass for Phase 5 Transfers on top of the actual remote source currently on `main`.

Do NOT apply any Supabase migration. Do NOT modify the remote database. Do NOT begin Phase 6.

## Authoritative baseline

Audit target before this prompt:

`56b147332405906598bfacdf7154d4dca80079dd`

The prior agent report referenced a different local SHA and therefore did not establish exact-head build provenance for this remote revision.

## Already accepted from the corrective implementation

Preserve these behaviors:

- transfer mutation public inputs use `amount: string`;
- `src/features/transfers/transfers.ts` validates and canonicalizes transfer amounts using exact-decimal helpers before persistence;
- transfer amount must be strictly positive;
- transfer read path remains `transfer_details` exact text read;
- Phase 5 migration remains code-only and unapplied;
- same-currency database design and Cartesian-safe account-balance architecture remain intact.

## Mandatory residual fixes

### 1. Runtime verifier — User B full lifecycle + neutrality

Harden `scripts/verify-phase5-rls.mjs` so User B receives the same lifecycle coverage as User A:

- capture B's initial combined same-currency balance using exact string/BigInt arithmetic;
- create transfer and verify exact amount text read-back;
- verify source decreases and destination increases exactly;
- explicitly assert combined B balance remains unchanged after create;
- edit transfer amount, verify exact amount read-back after edit, exact balances, and unchanged combined total;
- void transfer, verify both effects reverse and combined total remains unchanged;
- restore transfer, verify effects return and combined total remains unchanged.

Do not mark `USER_B_*_LIFECYCLE` PASS before the complete lifecycle passes.

### 2. Runtime verifier — cross-user matrix must be bidirectional

For BOTH directions A -> B and B -> A verify:

- spoofed foreign `user_id` INSERT is blocked;
- foreign source-account reference is blocked;
- foreign destination-account reference is blocked;
- foreign SELECT returns RLS-empty without database error;
- foreign UPDATE cannot change the row;
- ownership mutation is blocked;
- `transfer_details` does not leak foreign transfers;
- `account_balances` does not leak foreign accounts.

### 3. Runtime verifier — Phase 4 regression must use exact read view

The Phase 4 regression section must:

- create a normal INCOME or EXPENSE transaction using exact string amount;
- read it back through `transaction_details`;
- assert `transaction_details.amount` is a string and equals the exact persisted value;
- assert type remains exactly INCOME/EXPENSE semantics;
- verify exactly one account balance changes by the transaction amount while the transfer effect remains correct;
- void the regression transaction and verify its effect reverses without corrupting transfer balances.

### 4. Runtime verifier — cleanup must be fail-closed

Current `catch + console.warn` cleanup behavior is NOT acceptable.

Required:

- every test transaction void must be asserted successful;
- every test transfer void must be asserted successful;
- every test account archive must be asserted successful;
- cleanup failure must make the verifier exit non-zero;
- print `TEST_RECORD_CLEANUP=PASS` only after every cleanup mutation has been verified.

Do not swallow cleanup failures.

### 5. Structural verifier — prove account balance derivation semantics, not keywords

Harden `scripts/verify-phase5-db.sql`.

The current account-balance derivation checks are too loose and the active-only check is logically defective.

Required structural checks must prove from the actual view definition that:

- transaction totals are independently pre-aggregated before joining accounts;
- incoming transfers are independently pre-aggregated by destination account;
- outgoing transfers are independently pre-aggregated by source account;
- active transactions are filtered with `is_voided = false`;
- active transfers are filtered with `is_voided = false` for BOTH incoming and outgoing aggregation inputs;
- final formula includes opening balance + transaction net + incoming - outgoing;
- final `current_balance` remains text;
- `security_invoker=true` remains enabled.

Do not use a check that can PASS merely because the definition contains generic words such as `GROUP BY`, `transactions`, and `transfers`.

Fix the current active-only predicate so it cannot PASS from one occurrence of `is_voided = false`.

### 6. Preserve Phase 4 non-regression checks

Keep exact checks for:

- transaction table/RLS;
- exact three transaction policies;
- no DELETE policy;
- exact authenticated table SELECT-only grant;
- exact transaction INSERT allowlist;
- exact transaction UPDATE allowlist;
- transaction identity/ownership/timestamps blocked;
- `transaction_details security_invoker=true`;
- `transaction_details.amount=text`;
- exact view grants.

### 7. Truthful project status

Update `docs/PROJECT_STATUS.md` only if necessary so it does not claim any remote Phase 5 database/runtime/live gate PASS.

Phase 5 remains PARTIAL until migration + structural + runtime + live smoke pass.
Phase 6 remains unauthorized.

## Verification

Run at the final implementation revision:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase5-rls.mjs
git diff --check
```

Also scan the real Phase 5 transfer/balance path for forbidden monetary:

- `Number(`
- `parseFloat(`
- native floating-point money arithmetic
- lossy numeric casts
- `as any` in transfer mutation paths

## Git provenance gate

After corrections:

1. commit all corrections;
2. push to `main`;
3. fetch/query ACTUAL `origin/main` after push;
4. final local HEAD MUST equal final remote main SHA;
5. worktree MUST be clean;
6. the source revision that passed typecheck/lint/build MUST be the same exact SHA on remote main.

Do not report `PASS_CODE_ONLY` if HEADs differ.

If audit-only branches `tmp-check` or `tmp-p5-final-corrective-placeholder` exist, delete them after main is safely verified. They are not project branches.

## Required final report

Return EXACTLY the final report format defined in `prompts/PHASE_5_TRANSFERS.md`.

Remote fields must remain:

```text
REMOTE_DATABASE
BLOCKED_NOT_APPLIED

REMOTE_STRUCTURAL_GATE
NOT_RUN

REMOTE_TWO_USER_RLS
NOT_RUN

LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_5_OVERALL
PARTIAL

PHASE_6_AUTHORIZED
false
```

Do NOT apply Supabase SQL.
Do NOT begin Phase 6.
