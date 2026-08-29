# Finora Phase 5 — Corrective Gate

## Purpose

This is a mandatory CODE-ONLY corrective pass for Phase 5 — Transfers after audit of remote implementation commit `400eb3c84fc501c3554e439b0c1a4f49ea982178`.

Do NOT apply the Phase 5 Supabase migration.
Do NOT modify the remote database.
Do NOT begin Phase 6.
Preserve all accepted Phase 2/3/4 receipts and contracts.

## Authoritative findings to correct

### 1. Transfer feature-layer decimal validation is overstated and incomplete

`src/features/transfers/transfers.ts` currently accepts `amount: string` but sends it to PostgreSQL without validating/normalizing the amount itself.

Required correction:
- validate every create/update amount with the existing exact decimal helpers before the database mutation;
- reject non-positive values;
- reject more than 4 fractional digits;
- never allow PostgreSQL `numeric(20,4)` to silently round an invalid application-layer amount;
- normalize valid amount values to the exact canonical 4-decimal string before mutation;
- keep public transfer mutation contracts `amount: string` only;
- no `Number`, `parseFloat`, floating-point arithmetic, lossy casts, or `as any` in transfer mutation paths.

Also tighten Phase 5 transfer database application types so transfer `Insert.amount` and `Update.amount` are string-only rather than `number | string`.

### 2. Project status must be truthful

`docs/PROJECT_STATUS.md` currently claims that the transfer feature module already has strict decimal validation and rejects invalid precision. That is not true at audited SHA `400eb3c...`.

Correct the Phase 5 implementation receipt to describe only verified behavior after this corrective pass. Preserve all Phase 2/3/4 history intact.

### 3. Structural verifier is not yet complete enough

`scripts/verify-phase5-db.sql` is materially improved, but it does not yet prove every mandatory non-regression/derivation requirement from `prompts/PHASE_5_TRANSFERS.md`.

Required additions/hardening:

- keep the verifier READ-ONLY and fail-closed;
- keep individual PASS/FAIL rows and `99_OVERALL`;
- verify exact Phase 4 transaction policies remain intact: names, authenticated role, commands, `USING`, `WITH CHECK`, and no DELETE policy;
- verify Phase 4 transaction table grants remain exact: authenticated table-level SELECT only;
- verify exact Phase 4 transaction INSERT column allowlist remains intact;
- verify exact Phase 4 transaction UPDATE column allowlist remains intact;
- verify transaction ownership/identity/timestamps remain non-client-mutable;
- verify `transaction_details` remains `security_invoker=true`, exact amount text, and authenticated SELECT-only with anon/PUBLIC excluded;
- verify `account_balances` definition actually incorporates all three independently pre-aggregated inputs: transaction totals, incoming transfers, outgoing transfers;
- verify active-only semantics are present for both transactions and transfers in the account balance derivation;
- verify the view is not implemented by a raw transaction × transfer multi-join that can multiply rows;
- update the overall check count and PASS message truthfully.

Do not weaken existing Phase 5 checks.

### 4. Runtime verifier is missing mandatory matrix cases

`scripts/verify-phase5-rls.mjs` must be expanded so it covers ALL required cases from the authoritative Phase 5 contract.

Required additions:

#### Schema readiness
- explicitly probe for `transfers`, `transfer_details`, and transfer-aware `account_balances` before the main test;
- if Phase 5 schema/view is missing, emit a distinct blocked/fail message and exit non-zero.

#### Exact net-worth neutrality — BOTH users
Use exact decimal-string / scaled-BigInt arithmetic in the verifier, never JavaScript floating point.

For User A and User B separately assert the combined source + destination balance is exactly unchanged:
- before transfer;
- after create;
- after edit amount;
- after void;
- after restore.

Do not infer neutrality only from individual expected balances; assert the combined invariant explicitly.

#### Own lifecycle read-back — BOTH users
For both users verify exact `transfer_details.amount` text read-back after create and after edit, plus void/restore status read-back.

#### Domain/integrity matrix
Add explicit rejection tests for:
- invalid currency-code format;
- note length > 1000;
- mismatched transfer `currency_code` vs same-currency accounts;
- a REAL cross-currency source/destination pair. Create disposable USD fixture account(s) so the test proves a VND-account -> USD-account transfer is rejected by the composite FK design;
- existing amount 0, negative amount, and same source/destination checks must remain;
- DELETE blocking and deliberate non-RLS database error distinction must remain.

#### Phase 4 regression checks
Create a disposable normal Phase 4 INCOME or EXPENSE transaction and prove:
- `transaction_details` exact read surface remains usable and amount is text;
- the normal transaction changes exactly one account balance by the exact amount;
- transfer rows remain separate from `transactions` and do not alter INCOME/EXPENSE transaction semantics;
- transfer activity does not create `TRANSFER` in `transactions.type` or require a transfer category.

Use an existing user-owned matching category or a safe disposable fixture consistent with accepted Phase 3 rules.

#### Cleanup
- void every transfer fixture;
- void any transaction regression fixture;
- archive every disposable account fixture, including cross-currency fixtures;
- assert every cleanup mutation succeeds;
- cleanup failures must cause non-zero exit.

### 5. Report format/provenance

The previous response did not use the exact required Phase 5 report format and omitted authoritative/local/remote SHAs and remote-head match evidence.

After corrections, run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase5-rls.mjs
git diff --check
```

Also scan the actual Phase 5 transfer/balance money path for forbidden monetary `Number`, `parseFloat`, lossy casts, native floating-point arithmetic, and `as any`.

Commit and push the corrective source to `main`.
Then fetch/query ACTUAL `origin/main` again.

`STATUS=PASS_CODE_ONLY` is allowed only when:
- all source verification passes;
- worktree is clean;
- final local HEAD equals actual remote main;
- migration has NOT been applied remotely.

Return EXACTLY the final report format defined in `prompts/PHASE_5_TRANSFERS.md`.

## Database authorization

Even after a successful corrective report:
- `REMOTE_DATABASE` must remain `BLOCKED_NOT_APPLIED`;
- `REMOTE_STRUCTURAL_GATE` must remain `NOT_RUN`;
- `REMOTE_TWO_USER_RLS` must remain `NOT_RUN`;
- `LIVE_PERSISTENCE_SMOKE` must remain `NOT_RUN`;
- `PHASE_5_OVERALL` must remain `PARTIAL`;
- `PHASE_6_AUTHORIZED` must remain `false`.

Only a subsequent repository audit may authorize the Phase 5 migration.