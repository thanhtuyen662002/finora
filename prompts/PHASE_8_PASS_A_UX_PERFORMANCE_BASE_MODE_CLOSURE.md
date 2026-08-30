# Finora Phase 8 — Pass A UX + Performance BASE Mode Closure

## Authority

- Repository: `thanhtuyen662002/finora`
- Rejected implementation baseline SHA: `41b61488dacee4d0167fe35224dfc73f6a206395`
- Parent audit-closure prompt SHA: `c25e73d7959e9ab603eee7b3026687b034ac9060`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Phase 8 source gate: PASS_CODE_ONLY
- Phase 8 remote DB migration: PASS
- Phase 8 structural gate: PASS
- Phase 8 two-user RLS gate: PASS
- Remote Supabase MUST NOT be modified.
- Live DB/RLS verifiers MUST NOT be run in this pass.
- Phase 8 Pass B and Phase 9 remain unauthorized.

## Why `41b61488...` is still rejected

The prior audit-closure implementation materially fixed race safety, fake Settings actions and stale governance, but source audit found a functional regression in Phase 8 BASE/Tổng hợp mode and fail-closed rendering.

Concrete defects:

1. Native-first Reports initial load runs with `preferredCurrency=undefined` and correctly skips FX, but `getAvailableCurrenciesAndDefault()` returns only real ISO currencies. `ReportsPage` renders selector buttons only from `data.availableCurrencies`. Therefore `BASE` is not exposed on initial native load and the user has no route to request `preferredCurrency='BASE'`.
2. If BASE becomes selectable and historical FX fails while current valuation succeeds, Reports computes summary/chart/category/transactions from empty `baseTransactions` and can present zero values as if authoritative. Historical BASE authority must fail closed, not masquerade as zero.
3. Dashboard adds `BASE` when either current valuation OR historical enrichment succeeds. If current valuation succeeds but historical enrichment fails, Dashboard summary cards/cash-flow can fall back to zero/empty arrays for BASE. That is a fake historical total.
4. Dashboard multi-currency balance badges currently use `group?.totalBalance || '0.0000'`. If BASE historical succeeds but current valuation fails, BASE may be selectable while the current BASE balance group is absent; the badge can therefore show fake `0` instead of `Không khả dụng`.
5. Current-rate requests in both Dashboard BASE enrichment and detailed BASE Reports derive source currencies from all accounts, including archived accounts. An archived-only currency can therefore trigger a provider dependency/failure and affect current net-worth availability even though archived accounts must not participate in current net worth.
6. Reports still contains user-facing implementation jargon `snapshots` in the historical-FX unavailable warning.
7. The current 17-check UX verifier does not test BASE-mode discoverability, separate current-vs-historical fail-closed rendering, archived-only FX-source exclusion, or report-wide jargon cleanup.

## Preserve accepted work

Do NOT reopen working behavior without a concrete need:

- persisted theme load/save and runtime application;
- Settings centered `max-w-6xl` layout and friendly labels;
- all mock-only Settings controls disabled/hidden truthfully;
- backup action disabled as `Sắp hỗ trợ`;
- bounded Dashboard transaction queries;
- Dashboard native payload returned before FX enrichment;
- Dashboard stale-generation guard;
- Dashboard historical snapshot IDs restricted to `periodTxList`;
- native Reports requests bypass both current FX and historical snapshot APIs;
- Reports initial double-fetch prevention;
- active-account current-position groups;
- pagination and preview bounds;
- bounded snapshot chunk concurrency;
- account-type localization;
- package-lock repair and lowercase `@supabase/` imports;
- truthful PROJECT_STATUS live DB/structural/RLS PASS state;
- source verifier current governance assertion.

## 1. Restore BASE/Tổng hợp discoverability without reintroducing native latency

The initial/default Reports request MUST remain native-only and MUST NOT call `/api/fx/current-batch` or `/api/fx/transaction-snapshots`.

At the same time, when Auto FX is enabled and the selected report scope contains a meaningful foreign-currency financial scope, the UI MUST expose a user-selectable `Tổng hợp (<base currency>)` mode without first fetching BASE data.

A meaningful foreign-currency financial scope should be derived from:

- active accounts whose currency differs from the base currency; OR
- in-scope historical transactions whose currency differs from the base currency, including transactions linked to archived accounts because historical records remain authoritative.

Do NOT expose BASE merely because an archived account exists in a foreign currency with no relevant historical transaction/current active position.

Recommended architecture:

- distinguish real/native currencies from selectable report modes;
- allow `availableCurrencies` or a dedicated selector field to include synthetic `BASE` capability while initial `selectedCurrency` remains native;
- clicking `BASE` causes a new request with `preferredCurrency='BASE'` and only then performs required current/historical FX work;
- if Auto FX is disabled, do not expose BASE.

Do not reintroduce the original duplicate initial fetch.

## 2. Preserve separate FX authorities and fail closed in UI

Current valuation and historical conversion are separate authorities.

### Reports

When `selectedCurrency === 'BASE'`:

- if `baseHistorical.status !== 'AVAILABLE'`, income/expense/net-savings summary cards MUST NOT display numeric zero as an authoritative BASE result;
- historical cash-flow chart MUST NOT display an empty/zero series as authoritative BASE data;
- category breakdown MUST NOT display zero/empty data as if historical conversion succeeded;
- transaction details/CSV controls MUST NOT imply a valid BASE historical dataset;
- render localized `Không khả dụng` / explanatory state instead;
- native data remains available by switching back to a native currency.

If `baseHistorical.status === 'AVAILABLE'` but `baseValuation.status !== 'AVAILABLE'`, historical report analytics may remain available while current account-position total must display `Không khả dụng`.

If `baseValuation.status === 'AVAILABLE'` but `baseHistorical.status !== 'AVAILABLE'`, current account position may remain available while historical analytics must display `Không khả dụng`.

### Dashboard

When `effectiveCurrency === 'BASE'`:

- asset/current-position card is governed only by `baseValuation`;
- current-month income/expense/savings and six-month cash-flow are governed only by `baseHistorical`;
- if `baseHistorical.status !== 'AVAILABLE'`, do not use fallback zero `activeSummary` or empty cash-flow as authoritative BASE analytics;
- if `baseValuation.status !== 'AVAILABLE'`, BASE balance badges/current-position displays must show unavailable, never fallback `0.0000`;
- native currency widgets must remain usable regardless of BASE failure.

Do not collapse the two authorities into one all-or-nothing status.

## 3. Archived accounts must not create current FX dependencies

For current BASE valuation in both:

- `enrichDashboardBaseFx()`; and
- `getDetailedReportData(..., 'BASE')`

build `sourceCurrencies` only from active accounts participating in current net worth.

Requirements:

- archived-only account currencies MUST NOT be sent to `/api/fx/current-batch`;
- an archived-only unsupported/missing currency MUST NOT make current BASE valuation unavailable;
- current account groups and totals remain active-only;
- historical transactions linked to archived accounts remain eligible for historical snapshot conversion in the selected period.

Same-currency identity behavior remains exact.

## 4. End-user language cleanup

Remove implementation wording such as `snapshot` / `snapshots` from normal Reports/Dashboard UI.

Replace the current historical warning with friendly Vietnamese such as:

`Chưa thể tổng hợp lịch sử vì một số giao dịch chưa có tỷ giá đã lưu.`

Technical identifiers may remain in logs/docs/tests/admin-only technical surfaces.

## 5. Verifier hardening

Extend `scripts/verify-phase8-ux-performance.mjs` with deterministic checks for the new defects.

It MUST make rejected baseline `41b61488dacee4d0167fe35224dfc73f6a206395` fail for at least these classes:

1. BASE not discoverable from native-first Reports initial state;
2. Reports historical BASE unavailable can masquerade as zero summary/chart/details;
3. Dashboard historical BASE unavailable can masquerade as zero summary/chart;
4. Dashboard BASE current balance badge can masquerade as zero when valuation unavailable;
5. archived-only account currencies included in current FX source currency requests;
6. user-facing `snapshot` jargon remains in Reports/Dashboard.

Keep all existing current-source and rejected-baseline checks from the audit-closure verifier.

Do not satisfy checks with comments or one loose string. Extract relevant functions/render blocks or add deterministic unit helpers where safer.

Also add or extend deterministic Phase 8 tests where useful to prove:

- native-first response exposes BASE capability without executing FX;
- explicit native report path makes zero FX network calls;
- explicit BASE path makes required FX calls;
- partial authority states do not render numeric zero as authoritative;
- archived-only currencies do not enter current FX source list.

## 6. Migration/security invariants

Do NOT modify:

- Phase 7 migration blob `5da681f7c66fdd85acda79172d1ad305496c6313`;
- Phase 8 migration blob `69e3ff637c0430fa701794aff497f81eb875443e`;
- RLS policies/grants;
- exact-money string boundaries;
- snapshot immutability;
- same-currency Phase 5 transfer schema.

No remote Supabase writes.

## 7. Verification

Run from final clean checkout:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-ux-performance.mjs
node scripts/verify-phase8-ux-performance.mjs
node scripts/verify-phase8-ux-performance.mjs --baseline 41b61488dacee4d0167fe35224dfc73f6a206395
node --check scripts/verify-phase8-rls.mjs
# existing deterministic Phase 8 tests
# any new BASE-mode deterministic test command
git diff --check
```

The baseline command is expected to exit non-zero and must explicitly report all six newly rejected defect classes.

Do NOT run live `verify-phase8-rls.mjs`.
Do NOT modify remote Supabase.

If browser tooling is actually available, verify Reports/Dashboard/Settings at 1440/1024/768/390. Never claim viewport proof if not executed.

## 8. Governance state

Do NOT mark live smoke PASS in source.

Current expected authoritative block remains:

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_UX_PERFORMANCE_HARDENING=PENDING_BASE_MODE_CLOSURE_AUDIT
PHASE_8_LIVE_PERSISTENCE_SMOKE=PENDING_RETEST
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

## 9. Final repository state

Before reporting:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
git diff --check
```

Required:

- `HEAD == origin/main`;
- worktree clean;
- migrations unchanged exactly.

## Required final report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A UX + Performance BASE Mode Closure

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
41b61488dacee4d0167fe35224dfc73f6a206395

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

HEAD_MATCH
true / false

WORKTREE_CLEAN
true / false

NPM_CI
PASS / FAIL

TYPECHECK
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

SOURCE_VERIFIER
PASS <n>/<n> / FAIL

UX_PERFORMANCE_VERIFIER_CURRENT
PASS <n>/<n> / FAIL

REJECTED_BASELINE_41B_DEFECTS_CAUGHT
PASS <n>/6 / FAIL

PHASE_8_TESTS
PASS <n>/<n> / FAIL

BASE_MODE_TESTS
PASS <n>/<n> / FAIL

GIT_DIFF_CHECK
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

REPORT_BASE_DISCOVERABLE_NATIVE_FIRST
PASS / FAIL

REPORT_NATIVE_ZERO_FX_CALLS
PASS / FAIL

REPORT_BASE_PARTIAL_AUTHORITY_FAIL_CLOSED
PASS / FAIL

DASHBOARD_BASE_PARTIAL_AUTHORITY_FAIL_CLOSED
PASS / FAIL

CURRENT_FX_ACTIVE_ACCOUNT_SCOPE_ONLY
PASS / FAIL

USER_FACING_FX_JARGON_CLEAN
PASS / FAIL

DASHBOARD_STALE_ENRICHMENT_GUARD
PASS / FAIL

PROJECT_STATUS_LIVE_GATES_TRUTHFUL
PASS / FAIL

REMOTE_DATABASE_MODIFIED
false

PHASE_8_PASS_A_SOURCE_GATE
PASS_CODE_ONLY

PHASE_8_REMOTE_DATABASE
PASS

PHASE_8_STRUCTURAL_GATE
PASS

PHASE_8_TWO_USER_RLS
PASS

PHASE_8_UX_PERFORMANCE_HARDENING
PASS_CODE_ONLY / FAIL

PHASE_8_LIVE_PERSISTENCE_SMOKE
PENDING_RETEST

PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS
NOT_STARTED

PHASE_8_OVERALL
PARTIAL

PHASE_9_AUTHORIZED
false
```

No prose before or after.
