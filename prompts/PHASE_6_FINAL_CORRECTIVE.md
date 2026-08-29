# Finora Phase 6 — Final Corrective Gate

## Mission

Close the final residual Phase 6 Dashboard + Reports contract violations found during repository audit of corrective implementation SHA `e6c7544bc35e07a95045eb032b14956d8c8ab8d1`.

This is a **CODE-ONLY** gate.

Do NOT create or apply migrations. Do NOT modify the remote Supabase database. Do NOT begin Phase 7.

## Authoritative baseline

Expected implementation baseline:

`e6c7544bc35e07a95045eb032b14956d8c8ab8d1`

Preserve all accepted Phase 2–5 receipts and all already-correct Phase 6 behavior.

---

## 1. Reports must not render stale authoritative finance data while a new selection is loading

`src/app/reports/page.tsx` currently uses request sequencing, but when period/currency changes it keeps the previous `data` while `loading=true`.

Because the loading gate is effectively conditional on `!data`, the previous monetary report can remain visible while the controls already represent the new requested period/currency.

Request sequencing prevents an old response from overwriting a newer response, but it does **not** by itself prevent stale previous report data from being displayed during the new request.

Required behavior:

- when a new authoritative report request begins, previous report data must not be rendered as if it belongs to the new selection;
- simplest acceptable implementation: clear authoritative `data` before awaiting the new request and render loading state while the request is pending;
- an equivalent request-identity design is acceptable only if the rendered data is explicitly bound to the exact period/currency that produced it and can never be mislabeled by newer controls;
- both initial-effect loads and retry/manual reload paths must obey the same rule;
- preserve out-of-order response protection;
- on failure, remain fail-closed with visible retry state and no stale monetary values.

The loading/error flow must be deterministic and truthful.

---

## 2. Invalid configured timezone must fail closed

`src/features/reports/engine.ts` currently catches an invalid configured IANA timezone and silently substitutes `Asia/Ho_Chi_Minh`.

The corrective contract allows the established project timezone only when the user timezone setting is genuinely absent. A present-but-invalid configured timezone is a corrupt/invalid authoritative setting and must not be silently treated as a successful default.

Required behavior:

- if `user_settings.timezone` is absent/null/empty, use the established fallback `Asia/Ho_Chi_Minh`;
- if a non-empty configured timezone is invalid, throw a clear error and fail closed;
- do not silently replace a present invalid timezone with another timezone;
- use a deterministic timezone validation helper and keep standard platform APIs only;
- Dashboard/Reports must surface the resulting finance load error through their existing visible fail-closed states.

Add verifier evidence for:

- absent timezone -> fallback accepted;
- valid configured timezone -> used;
- invalid non-empty configured timezone -> rejected / throws.

---

## 3. PROJECT_STATUS must remain truthful until owner live smoke

`docs/PROJECT_STATUS.md` currently says:

`Phase 6 — Dashboard + Reports: COMPLETE (Corrective Verification Passed)`

That is premature. Phase 6 live persistence/report smoke has not yet been owner-verified.

Required source-gate state after this final corrective:

```text
PHASE_6_SOURCE_GATE=PASS_CODE_ONLY
PHASE_6_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_6_OVERALL=PARTIAL
PHASE_7_AUTHORIZED=false
```

The phase authorization section must not call Phase 6 COMPLETE yet.

Use wording such as:

`Phase 6 — Dashboard + Reports: SOURCE_COMPLETE_LIVE_SMOKE_PENDING`

or equivalent truthful wording.

Do not erase the implementation history or accepted Phase 2–5 receipts.

---

## 4. Harden `scripts/verify-phase6-source.mjs` specifically for the remaining classes

The verifier currently considers Reports stale-data handling PASS when it merely finds `setData(null)` somewhere and an error gate. That is insufficient.

Required verifier hardening:

- inspect the actual Reports request-start paths and prove authoritative old `data` is cleared or otherwise blocked from rendering when a new period/currency request begins;
- reject the current pattern where loading can render existing previous `data` under new controls;
- retain request sequencing / out-of-order response checks;
- prove invalid non-empty configured timezone is rejected rather than silently defaulted;
- prove absent timezone fallback remains supported;
- prove PROJECT_STATUS does not mark Phase 6 COMPLETE or Phase 7 authorized before live smoke;
- retain all earlier Phase 6 checks for exact money, account_balances authority, ALL history, base-currency semantics, mock removal, no fake FX, CSV, and no migrations;
- remain fail-closed and exit non-zero on any failed mandatory check.

Static source-contract checks plus deterministic helper regression tests are acceptable, but the verifier must describe truthfully what it validates.

---

## 5. Preserve already-correct behavior

Do not regress:

- `transaction_details` exact-money reads;
- `account_balances` authoritative fail-closed current balances;
- exact decimal / BigInt aggregation;
- `compareExactDecimals` cash-flow max scaling;
- timezone-aware valid configured calendar semantics;
- ALL-period earliest-history through current-month buckets;
- pre-FX currency isolation and no cross-currency totals;
- correct base-currency default-selection rules;
- transfer exclusion from income/expense reports;
- Dashboard refresh after transaction/transfer success;
- real RFC 4180 CSV export;
- mock/YouTube/PDF-Excel removal;
- no Phase 6 database changes.

---

## 6. Final verification

At the **final exact revision** run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase6-source.mjs
node scripts/verify-phase6-source.mjs
git diff --check
```

Also inspect authoritative Phase 6 paths for:

```text
MOCK_
Number(
parseFloat(
parseInt(
as any
opening_balance
PDF/Excel
2026
```

Interpret semantically. `parseInt` on non-money date fields or bounded presentation values is not automatically a failure, but monetary coercion remains forbidden.

Do not claim responsive viewport PASS unless actually verified.

---

## 7. Git provenance gate

After implementation:

1. commit corrective changes;
2. push to `main`;
3. fetch ACTUAL `origin/main` after push;
4. require final local HEAD == final remote main SHA;
5. require clean worktree;
6. exact remote SHA must be the same revision that passed typecheck/lint/build/source verifier.

Do not call Phase 6 overall COMPLETE. The next gate after accepted source is owner live smoke.

---

## Required final report

Return **exactly**:

```text
TASK
Finora Phase 6 — Dashboard + Reports Final Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

AUTHORITATIVE_BASE_SHA
e6c7544bc35e07a95045eb032b14956d8c8ab8d1

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

WORKTREE_CLEAN
true / false

REPORTS_STALE_DATA_FAIL_CLOSED
PASS / FAIL

REQUEST_RACE_PROTECTION
PASS / FAIL

TIMEZONE_VALID_CONFIG_USED
PASS / FAIL

TIMEZONE_ABSENT_FALLBACK
PASS / FAIL

TIMEZONE_INVALID_CONFIG_REJECTED
PASS / FAIL

ACCOUNT_BALANCES_FAIL_CLOSED
PASS / FAIL

ALL_HISTORY_DYNAMIC
PASS / FAIL

EXACT_DECIMAL_MAX_COMPARISON
PASS / FAIL

BASE_CURRENCY_DEFAULT_SELECTION
PASS / FAIL

PRE_FX_CURRENCY_ISOLATION
PASS / FAIL

CSV_EXPORT
PASS / FAIL

SOURCE_VERIFIER
PASS / FAIL

TYPECHECK
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

SOURCE_VERIFIER_SYNTAX
PASS / FAIL

GIT_DIFF_CHECK
PASS / FAIL

MIGRATION_CREATED
false

REMOTE_DATABASE_MODIFIED
false

PHASE_6_SOURCE_GATE
PASS_CODE_ONLY / FAIL / BLOCKED

PHASE_6_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_6_OVERALL
PARTIAL

PHASE_7_AUTHORIZED
false

CODE_CHANGES
<space-separated changed files or NONE>

KNOWN_BLOCKERS
<NONE or concise blocker>
```

No additional prose before or after the report.
