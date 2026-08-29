# Finora Phase 6 — UI/Provenance Final Fix

## Mission

Close the last Phase 6 source-gate residuals found during audit of implementation SHA `4ff9a5f110d0f2dec7911e52944d5410ccb6b06b`.

This is CODE-ONLY. Do NOT create or apply migrations. Do NOT modify the remote Supabase database. Do NOT begin Phase 7.

## Authoritative baseline

Expected implementation baseline before this fix:

`4ff9a5f110d0f2dec7911e52944d5410ccb6b06b`

Preserve all already-correct Phase 2–5 receipts and Phase 6 behavior.

---

## 1. Prevent even a transient stale-data render when period/currency controls change

`src/app/reports/page.tsx` currently clears `data` inside the effect/request body, but the controls still call state setters directly:

```tsx
<PeriodSelector selected={period} onChange={setPeriod} />
```

and

```tsx
onClick={() => setSelectedCurrency(c)}
```

React may render once with the newly selected control state while the previous authoritative `data` still exists before the passive effect runs and clears it.

The Phase 6 contract requires that previous monetary results must never be presented as belonging to a newly selected period/currency.

Required:

- replace direct period/currency setters used by user interactions with explicit transition handlers;
- synchronously invalidate/clear previous authoritative report data before or in the same interaction update that changes the selection;
- set/loading state truthfully so the next render cannot show old money under new controls;
- invalidate any currently in-flight request immediately when a new selection is made (for example by advancing the request sequence before changing selection), or provide an equivalent safe mechanism;
- preserve the existing effect-level request sequencing and out-of-order response protection;
- preserve retry behavior;
- do not introduce render loops.

An acceptable pattern is conceptually:

```ts
function beginSelectionTransition() {
  requestSeqRef.current += 1;
  setLoading(true);
  setError(null);
  setData(null);
}

function handlePeriodChange(next: ReportPeriod) {
  beginSelectionTransition();
  setPeriod(next);
}

function handleCurrencyChange(next: string) {
  beginSelectionTransition();
  setSelectedCurrency(next);
}
```

Equivalent implementations are allowed if they guarantee the same invariant.

The UI controls must use those safe handlers instead of the raw state setters.

---

## 2. Harden the verifier for synchronous selection-transition safety

Update `scripts/verify-phase6-source.mjs` so it rejects the currently audited pattern.

Required verifier evidence:

- reject `PeriodSelector ... onChange={setPeriod}` in the authoritative Reports page;
- reject direct currency interaction `onClick={() => setSelectedCurrency(c)}` (or equivalent raw setter wiring);
- prove the user-interaction transition path clears/invalidate old authoritative data before changing/committing the new selection;
- prove loading is engaged for the selection transition;
- prove an in-flight older request is invalidated or otherwise unable to publish stale data;
- retain the existing request-start `setData(null)` check, unconditional loading gate, request sequencing checks, timezone checks, account balance authority, ALL-history checks, exact money checks, CSV checks, no-mock/no-fake-FX checks, and truthful status checks;
- remain fail-closed and exit non-zero on any mandatory failure.

Do not inflate the reported check count without actual checks.

---

## 3. Make the authoritative `PROJECT_STATUS.md` Current State header consistent

The detailed Phase 6 section is truthful, but the top `## Current State` block still says:

```text
Current phase: Phase 6 — Dashboard + Reports — AUTHORIZED
Phase status: PHASE_5_COMPLETE_PHASE_6_AUTHORIZED
```

That is stale now that Phase 6 source implementation exists.

Update the top authoritative Current State block to a truthful source-gate-pending-live-smoke state, for example:

```text
Current phase: Phase 6 — Dashboard + Reports — SOURCE_COMPLETE_LIVE_SMOKE_PENDING
Phase status: PHASE_6_SOURCE_GATE_PASS_CODE_ONLY_LIVE_SMOKE_PENDING
```

Keep the required gate fields:

```text
PHASE_6_SOURCE_GATE=PASS_CODE_ONLY
PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_6_OVERALL=PARTIAL
PHASE_7_AUTHORIZED=false
```

Do NOT mark Phase 6 overall PASS/COMPLETE before owner live smoke.

---

## 4. Exact-head provenance is mandatory

The previous report omitted exact local/remote SHA evidence.

At the final revision run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase6-source.mjs
node scripts/verify-phase6-source.mjs
git diff --check
```

Then:

1. commit the final fix;
2. push to `main`;
3. `git fetch origin`;
4. require `git rev-parse HEAD == git rev-parse origin/main`;
5. require clean worktree;
6. the exact SHA reported below must be the same revision that passed all commands above.

Do not claim PASS_CODE_ONLY if the SHA equality/provenance requirement is not met.

No database operation is required or allowed.

---

## Required final report

Return exactly:

```text
TASK
Finora Phase 6 — UI/Provenance Final Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

AUTHORITATIVE_BASE_SHA
4ff9a5f110d0f2dec7911e52944d5410ccb6b06b

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

WORKTREE_CLEAN
true / false

TYPECHECK
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

PHASE_6_VERIFIER_SYNTAX
PASS / FAIL

PHASE_6_VERIFIER
PASS / FAIL

PHASE_6_VERIFIER_CHECK_COUNT
<number passed>/<number total>

GIT_DIFF_CHECK
PASS / FAIL

STALE_SELECTION_TRANSITION_BLOCKED
PASS / FAIL

INVALID_TIMEZONE_FAIL_CLOSED
PASS / FAIL

ACCOUNT_BALANCES_AUTHORITATIVE
PASS / FAIL

ALL_HISTORY_DYNAMIC
PASS / FAIL

DEFAULT_CURRENCY_SEMANTICS
PASS / FAIL

PROJECT_STATUS_TRUTHFUL
PASS / FAIL

MIGRATION_CREATED
false

REMOTE_DATABASE_MODIFIED
false

PHASE_6_SOURCE_GATE
PASS_CODE_ONLY / FAIL

PHASE_6_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_6_OVERALL
PARTIAL

PHASE_7_AUTHORIZED
false

CODE_CHANGES
<exact changed paths>
```

Do not run owner live smoke. Do not begin Phase 7.
