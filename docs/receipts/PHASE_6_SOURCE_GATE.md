# Finora Phase 6 — Source Gate Receipt

## Accepted source revision

Accepted exact-head application/source SHA:

`4c5df491256d07550ee8d2bd2d92eb8b6c7f3056`

This revision is the accepted Phase 6 Dashboard + Reports source implementation prior to owner live smoke.

## Exact-head provenance

Owner/agent verification receipt:

```text
LOCAL_HEAD_SHA
4c5df491256d07550ee8d2bd2d92eb8b6c7f3056

REMOTE_MAIN_SHA
4c5df491256d07550ee8d2bd2d92eb8b6c7f3056

HEAD_MATCH
true

WORKTREE_CLEAN
true

TYPECHECK
PASS

LINT
PASS

BUILD
PASS

PHASE_6_VERIFIER_SYNTAX
PASS

PHASE_6_VERIFIER
PASS

PHASE_6_VERIFIER_CHECK_COUNT
71/71

GIT_DIFF_CHECK
PASS

CODE_CHANGES
NONE

MIGRATION_CREATED
false

REMOTE_DATABASE_MODIFIED
false

PHASE_6_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_6_OVERALL
PARTIAL

PHASE_7_AUTHORIZED
false
```

GitHub remote was independently re-checked after the receipt and `main` still pointed to the same accepted SHA.

## Accepted source invariants

- Dashboard and Reports use real user-isolated Supabase data.
- `transaction_details` remains the authoritative exact-money transaction read path.
- `account_balances` is authoritative and missing balance rows fail closed.
- Current-month and report calendar semantics use the configured timezone; a missing timezone may fall back to `Asia/Ho_Chi_Minh`, while an invalid non-empty configured timezone fails closed.
- `ALL` report month buckets span from the earliest active matching transaction month through the current month and include intermediate zero months.
- Cash-flow scaling uses exact decimal comparison rather than relational string comparison.
- Base currency is used as default only when present in real financial currencies; otherwise deterministic real currency selection is used without injecting an absent base currency.
- Cross-currency values are never summed before Phase 8 FX support.
- Transfers remain excluded from income/expense reports and remain neutral through `account_balances`.
- Reports synchronously invalidate old data when period/currency selection changes and preserve out-of-order request protection.
- CSV export remains real, selected-period/selected-currency scoped, exact-money preserving, and UTF-8/RFC-4180 compatible.
- Phase 6 is code-only: no migration or remote database modification was performed.

## Gate state

```text
PHASE_6_SOURCE_GATE=PASS_CODE_ONLY
PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_6_OVERALL=PARTIAL
PHASE_7_AUTHORIZED=false
```

Phase 6 is not closed until owner live Dashboard/Reports smoke passes.
