# Finora Phase 8 — Pass A UX + Performance Audit Closure

## Authority

- Repository: `thanhtuyen662002/finora`
- Rejected implementation baseline SHA: `fc348276bfd255b81ad7d510ab1b934f7941e7c4`
- Parent final-corrective prompt SHA: `e908be81dc2b7f320d0d963ef55617ab965899fc`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Phase 8 source gate: PASS_CODE_ONLY
- Phase 8 remote DB migration: PASS
- Phase 8 structural gate: PASS
- Phase 8 two-user RLS gate: PASS
- Remote Supabase MUST NOT be modified.
- Live DB/RLS verifiers MUST NOT be run in this pass.
- Phase 8 Pass B and Phase 9 remain unauthorized.

## Why `fc348276...` is rejected

The application improvements are materially better, but the reported final-corrective completion is false-confidence because mandatory verifier/governance work was not performed and two user-facing/runtime defects remain.

Concrete audited defects:

1. `scripts/verify-phase8-ux-performance.mjs` remains the shallow pre-final verifier. It does NOT prove theme persistence, fake-control absence, Dashboard native non-blocking semantics, exact Dashboard snapshot scope, native Reports current-FX bypass, authoritative archived-account counts, or truthful gate-state governance.
2. The UX verifier does not demonstrate that rejected baseline `d1a261a0d9f17dab31442c10613b76f82ef38f3c` fails for the eight mandatory final-corrective defects.
3. `scripts/verify-phase8-source.mjs` still expects stale `PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED`; therefore its `35/35 PASS` is not evidence of truthful current governance.
4. `docs/PROJECT_STATUS.md` still tells the owner to reapply the Phase 8 migration and rerun DB/RLS gates, and still records `BLOCKED_NOT_APPLIED / NOT_RUN`, even though those gates are already accepted PASS.
5. Settings still exposes a fake-functional `Tải bản sao lưu` action whose handler only toggles an `exported` state and does not create/download a backup.
6. Dashboard FX enrichment is non-blocking but lacks request-generation / stale-response protection. An older background enrichment can overwrite newer native data after a reload or mutation-triggered refresh.
7. Documentation claims approximately `~30ms` Dashboard payload latency without measured evidence in the accepted verification output. Remove unsupported timing claims unless measured deterministically and reported.

## Preserve accepted work

Do NOT reopen working behavior without a concrete need:

- persisted theme load/save already restored;
- Settings wide centered two-column layout and friendly labels;
- fake mask-balance switch disabled as `Sắp hỗ trợ`;
- bounded dashboard transaction queries;
- Dashboard native data returned before FX enrichment;
- Dashboard historical snapshot IDs based on `periodTxList` rather than merged recent transactions;
- native report requests bypass FX when a native ISO currency is explicitly selected;
- active-account filtering in current-position groups;
- max 6 Dashboard account preview;
- max 8 Reports account preview;
- TransactionList / TransferList / Accounts pagination;
- bounded snapshot chunk concurrency <= 4;
- account-type localization;
- synchronized package lock and lowercase `@supabase/` imports.

## 1. Make Dashboard progressive enrichment safe

Current background enrichment must not overwrite newer state.

Required:

- add a monotonic request generation / sequence token, abort mechanism, or equivalent stale-response guard covering BOTH native Dashboard loads and subsequent FX enrichment;
- if a newer `loadDashboard()` / initialization / mutation refresh begins, an older enrichment result MUST be ignored;
- unmount must prevent state writes;
- errors from stale enrichment must not replace newer data or surface as current errors;
- preserve immediate native rendering;
- preserve fail-isolated BASE enrichment;
- do not reintroduce blocking `await Promise.allSettled(...)` before native payload render.

Deterministic verification must prove stale enrichment rejection semantically, not merely search for `useRef` or a comment.

## 2. Remove all fake-functional Settings actions

The `Che số dư công cộng` control is already correctly disabled. Keep that behavior.

Audit all remaining Settings actions.

`Tải bản sao lưu` currently does not perform a backup. Without implementing a complete truthful export in this pass, choose one safe option:

- hide the backup action; OR
- render the backup card/button disabled with a visible `Sắp hỗ trợ` indicator.

Do NOT show a success state such as `Đã tải bản sao lưu` unless bytes were actually generated and downloaded.

Remove obsolete mock-only local state/handlers when no longer used.

No normal-user Settings control may appear operational if it is not implemented/persisted.

## 3. Fix the authoritative Phase 8 governance ledger

Update `docs/PROJECT_STATUS.md` so its CURRENT Phase 8 gate state is exactly truthful:

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_UX_PERFORMANCE_HARDENING=PENDING_AUDIT_CLOSURE
PHASE_8_LIVE_PERSISTENCE_SMOKE=PENDING_RETEST
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

Mandatory:

- remove the current `Next Recommended Action` instructions that tell the owner to reapply the already-applied migration or rerun already-accepted structural/RLS gates;
- do not leave an authoritative current block saying `BLOCKED_NOT_APPLIED`, `NOT_RUN`, or `NOT_STARTED` for DB/structural/RLS;
- historical prose may mention old states only when clearly labeled as historical/non-authoritative;
- remove unsupported `~30ms` timing claims unless a real measured verification was performed and reported;
- do NOT mark live persistence smoke PASS yet.

## 4. Replace the shallow UX/performance verifier with semantic closure checks

Strengthen `scripts/verify-phase8-ux-performance.mjs` substantially.

It MUST prove the current source and MUST make rejected baseline `d1a261a0d9f17dab31442c10613b76f82ef38f3c` fail for the defects required by the previous final-corrective contract.

### Required current-source checks

At minimum verify:

1. Settings theme is loaded from persisted settings and validated to `light | dark | system` behavior.
2. Theme is included in the actual `updateCurrentUserSettings` payload.
3. Mask balance is not functional unless persisted; current expected state is disabled/`Sắp hỗ trợ`.
4. Backup/export action on Settings is either genuinely implemented or visibly disabled/hidden as `Sắp hỗ trợ`; a state-only fake download handler MUST fail verification.
5. `getDashboardReportData()` contains no current-rate/snapshot network request and returns native payload independently of `enrichDashboardBaseFx()`.
6. `enrichDashboardBaseFx()` snapshot IDs derive only from exact six-month analytics `periodTxList`, not the merged recent display set.
7. Dashboard stale FX enrichment cannot overwrite a newer native request generation.
8. Native `getDetailedReportData(period, <ISO>)` path executes neither `/api/fx/current-batch` nor `/api/fx/transaction-snapshots`; BASE path retains both when required.
9. Active current account groups/counts exclude archived accounts while historical transaction calculations do not filter transactions merely because their account is archived.
10. Reports initial load does not perform a second same-scope fetch from null currency resolution.
11. TransactionList page resets on every search/type/category/account/period/sort change.
12. Dashboard preview <= 6, Reports preview <= 8, Transactions/Transfers 20/page, Accounts 12/page.
13. snapshot chunk concurrency is bounded at <= 4 and chunk size <= 200.
14. Settings is centered wide (`max-w-6xl` or equivalent) and forbidden normal-user jargon remains absent.
15. no tracked `@Supabase/` casing.
16. Phase 7 and Phase 8 migration blobs exactly match authority.
17. authoritative current PROJECT_STATUS gate block contains DB/structural/RLS PASS and does not instruct migration/RLS rerun.

### Rejected-baseline proof

The verifier MUST contain an actual deterministic rejected-baseline mode, not comments-as-proof.

Preferred implementation:

- support `--root <checkout>` or equivalent so the same semantic verifier can run against another checkout; OR
- use `git show d1a261a0d9f17dab31442c10613b76f82ef38f3c:<path>` to feed the SAME semantic predicates with rejected baseline source.

Required execution proof:

- current HEAD verifier exits `0`;
- rejected baseline verifier exits non-zero and identifies at least the mandatory final-corrective defect classes:
  - theme load missing;
  - theme save missing;
  - fake mask control;
  - Dashboard merged snapshot scope;
  - Dashboard blocking FX;
  - native Reports current-FX call;
  - archived raw current counts;
  - stale gate ledger.

Do NOT satisfy this by hardcoding `if (sha === rejected) fail`.

## 5. Fix Phase 8 source verifier governance assertion

Update `scripts/verify-phase8-source.mjs`.

Current check 27 is stale and explicitly requires `PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED`.

Required:

- extract/inspect the authoritative current Phase 8 gate block rather than searching the entire historical document;
- require:
  - `PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY`
  - `PHASE_8_REMOTE_DATABASE=PASS`
  - `PHASE_8_STRUCTURAL_GATE=PASS`
  - `PHASE_8_TWO_USER_RLS=PASS`
  - `PHASE_9_AUTHORIZED=false`
- explicitly reject current authoritative values `BLOCKED_NOT_APPLIED` and `NOT_RUN` for already accepted live gates;
- keep existing Phase 8 security/exactness checks intact;
- total check count may increase; report the actual count truthfully.

## 6. Verification

Run all of these from the final clean implementation checkout:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-ux-performance.mjs
node scripts/verify-phase8-ux-performance.mjs
# Run the same UX semantic verifier against rejected baseline d1a261... using its supported baseline/root mode
node --check scripts/verify-phase8-rls.mjs
# existing deterministic Phase 8 tests
git diff --check
```

Do NOT execute live `verify-phase8-rls.mjs`.
Do NOT modify remote Supabase.

If browser tooling is actually available, verify 1440/1024/768/390. Never claim viewport proof unless it was actually executed.

## 7. Final repository state

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
- Phase 7 migration blob exactly `5da681f7c66fdd85acda79172d1ad305496c6313`;
- Phase 8 migration blob exactly `69e3ff637c0430fa701794aff497f81eb875443e`.

## Required final report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A UX + Performance Audit Closure

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
fc348276bfd255b81ad7d510ab1b934f7941e7c4

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

UX_PERFORMANCE_REJECTED_BASELINE
EXPECTED_FAIL / UNEXPECTED_PASS / NOT_RUN

REJECTED_BASELINE_DEFECTS_CAUGHT
<n>/8

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

SETTINGS_BACKUP_TRUTHFUL
PASS / FAIL

DASHBOARD_NATIVE_NONBLOCKING_FX
PASS / FAIL

DASHBOARD_SNAPSHOT_SCOPE_EXACT
PASS / FAIL

DASHBOARD_STALE_ENRICHMENT_GUARD
PASS / FAIL

REPORT_NATIVE_FX_BYPASS
PASS / FAIL

ARCHIVED_CURRENT_COUNTS_EXCLUDED
PASS / FAIL

REPORT_INITIAL_DOUBLE_FETCH
PASS / FAIL

PROJECT_STATUS_LIVE_GATES_TRUTHFUL
PASS / FAIL

SOURCE_VERIFIER_GOVERNANCE_CURRENT
PASS / FAIL

UNSUPPORTED_TIMING_CLAIMS_REMOVED
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

No prose before or after the report.
