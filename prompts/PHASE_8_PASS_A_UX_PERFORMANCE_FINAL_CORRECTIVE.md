# Finora Phase 8 — Pass A UX + Performance Final Corrective

## Authority

- Repository: `thanhtuyen662002/finora`
- Expected baseline implementation SHA: `d1a261a0d9f17dab31442c10613b76f82ef38f3c`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Phase 8 source gate: PASS_CODE_ONLY
- Phase 8 remote DB migration: PASS
- Phase 8 structural gate: PASS
- Phase 8 two-user RLS gate: PASS
- This is application/query/UX/verifier/governance hardening only.
- Do NOT modify remote Supabase.
- Do NOT run live DB/RLS verifiers.
- Do NOT start Phase 8 Pass B or Phase 9.

## Preserve accepted work

Preserve unless a concrete defect below requires a change:

- bounded dashboard transaction helpers;
- date-scoped report transaction queries;
- bounded snapshot chunk concurrency;
- Reports duplicate-fetch prevention approach;
- TransactionList/TransferList pagination;
- Accounts pagination;
- max 6 Dashboard account preview;
- max 8 Reports account preview;
- localized account-type labels;
- Settings centered `max-w-6xl` two-column design and friendly labels;
- synchronized package lock and canonical lowercase `@supabase/` imports.

## Rejected baseline defects that MUST be fixed

### 1. Settings persistence regression

Current baseline renders functional-looking theme controls but no longer loads or saves persisted `user_settings.theme`.

Required:

- restore loading of persisted theme from user settings;
- restore saving `theme` in the settings update payload;
- preserve `light | dark | system` exact persisted values;
- if the app already has a theme application mechanism, keep it consistent; do not invent an unrelated theme store;
- a successful save + refresh/relogin must preserve the selected theme value.

The `Che số dư công cộng` switch is currently local-only/non-persisted and therefore misleading.

Without adding a migration in this pass, either:

- remove/hide it; or
- render disabled with a visible `Sắp hỗ trợ` label.

No normal-user control may look functional if it is not persisted/implemented.

Audit all remaining Settings controls for the same rule.

### 2. Dashboard native data must not be blocked by FX enrichment

Current `getDashboardReportData()` starts current valuation + historical snapshot work and awaits `Promise.allSettled` before returning the page payload. That still blocks native Dashboard rendering on FX/provider latency.

Required architecture:

- native Dashboard balances/current-month summaries/6M native cash-flow/recent transactions must become available without waiting for historical snapshot work;
- do not request historical snapshots for recent transactions that are outside the six-month analytics scope;
- snapshot transaction IDs must be the exact six-month/current-month analytics transaction scope, not the merged `periodTxList + recentTxList` set;
- current FX valuation and historical BASE enrichment remain fail-isolated and must never blank native data;
- use a safe progressive enrichment path (separate loader/API/state enrichment or equivalent) rather than pretending asynchronous work is non-blocking while still awaiting it before return;
- preserve exact-money and BASE fail-closed semantics.

Do not introduce fake BASE totals or stale cross-currency data.

### 3. Native Reports must skip unrelated FX work entirely

Current baseline only early-returns inside `historicalTask` when `preferredCurrency !== 'BASE'`, but still executes and awaits `valuationTask` (current FX API). This violates native-mode latency requirements.

Required:

- when the explicitly selected report currency is a native ISO currency (not `BASE`), do not call current FX valuation API and do not call historical snapshot API for that report request;
- native report summary/chart/account list/transactions must resolve only from native DB data;
- when BASE is explicitly selected, run the required current valuation and historical snapshot work with existing fail-closed semantics;
- initial/default selection must remain deterministic and must not create a duplicate fetch loop;
- changing period/currency rapidly must preserve stale-response rejection.

### 4. Archived account counts must be exact everywhere

Current Dashboard preview filters archived accounts, but summary/count strings still use raw `group.accounts.length`, which includes archived accounts.

Required:

- every current-position account count on Dashboard and Reports must count active accounts only;
- current-position account list must contain active accounts only;
- BASE synthetic account group exposed to current UI must not retain archived entries if UI count/list is derived from it;
- historical transactions linked to archived accounts remain included in historical report calculations;
- Accounts management archived view remains unchanged.

### 5. Governance ledger must reflect already-passed live gates

`docs/PROJECT_STATUS.md` is stale and currently says the Phase 8 migration is not applied / structural and RLS gates are not run, then recommends applying migration again.

Correct it to the already accepted state:

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_UX_PERFORMANCE_HARDENING=PENDING_FINAL_CORRECTIVE_AUDIT
PHASE_8_LIVE_PERSISTENCE_SMOKE=PENDING_RETEST
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

Remove instructions telling the user to reapply the migration or rerun already-accepted structural/RLS gates.

Do NOT claim live persistence smoke PASS yet.

## Verifier hardening

Strengthen `scripts/verify-phase8-ux-performance.mjs` so it proves semantics instead of shallow string presence.

It MUST fail the rejected baseline `d1a261a0d9f17dab31442c10613b76f82ef38f3c` for at least these defects:

1. theme not loaded from settings;
2. theme absent from save payload;
3. local-only mask balance toggle presented as functional;
4. Dashboard snapshot IDs derived from merged recent+period set;
5. Dashboard waits on historical FX before returning native payload;
6. native Reports still executes current valuation FX work;
7. Dashboard current account count uses raw `accounts.length` including archived;
8. stale `PROJECT_STATUS` says DB migration blocked/not applied and RLS not run.

Avoid checks that can pass from comments alone. Prefer extracting relevant functions/blocks or deterministic unit/source fixtures.

Also update `scripts/verify-phase8-source.mjs` governance assertions so it no longer expects stale `BLOCKED_NOT_APPLIED` / `NOT_RUN` live gate state.

Verifier must also retain checks for:

- Settings centered wide layout and friendly language;
- pagination limits/reset behavior;
- archived preview filtering;
- report no duplicate initial fetch;
- snapshot chunk concurrency <= 4;
- migration blob integrity;
- package lock/package json synchronization evidence where deterministic;
- no tracked `@Supabase/` import casing.

## Required verification

Run from clean worktree:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-ux-performance.mjs
node scripts/verify-phase8-ux-performance.mjs
node --check scripts/verify-phase8-rls.mjs
# existing deterministic Phase 8 tests
git diff --check
```

Do NOT run the live RLS verifier.
Do NOT modify remote Supabase.

If browser tooling is actually available, verify 1440, 1024, 768 and 390 widths. Do not claim viewport proof if not executed.

## Required final report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A UX + Performance Final Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
d1a261a0d9f17dab31442c10613b76f82ef38f3c

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

UX_PERFORMANCE_VERIFIER
PASS <n>/<n> / FAIL

PHASE_8_TESTS
PASS <n>/<n> / FAIL

GIT_DIFF_CHECK
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

SETTINGS_THEME_PERSISTENCE
PASS / FAIL

SETTINGS_NO_FAKE_FUNCTIONAL_CONTROLS
PASS / FAIL

DASHBOARD_NATIVE_NONBLOCKING_FX
PASS / FAIL

DASHBOARD_SNAPSHOT_SCOPE_EXACT
PASS / FAIL

REPORT_NATIVE_FX_BYPASS
PASS / FAIL

ARCHIVED_CURRENT_COUNTS_EXCLUDED
PASS / FAIL

REPORT_INITIAL_DOUBLE_FETCH
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