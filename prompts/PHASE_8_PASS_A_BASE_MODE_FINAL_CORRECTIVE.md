# Finora Phase 8 — Pass A BASE Mode Final Corrective

## Authority

- Repository: `thanhtuyen662002/finora`
- Rejected implementation baseline SHA: `033673f113871ab1153eae0446088613a002b230`
- Parent BASE-mode closure prompt SHA: `a93446ccaea5b5899db888f3a66d7a0469c66923`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Remote Supabase MUST NOT be modified.
- Live DB/RLS verifiers MUST NOT be run.
- Phase 8 Pass B and Phase 9 remain unauthorized.

## Why `033673f...` is rejected

The BASE-mode UX behavior is materially improved, but one current-valuation defect and two verification false-confidence issues remain.

### 1. Archived-only / historical-only currencies can still break current BASE valuation

`aggregateAccountBalancesByCurrency()` creates a currency group before checking `account.is_archived`, so an archived-only currency can remain as an empty current-position group.

At the same time, BASE current valuation requests rates only for active account currencies, which is correct.

However, both Dashboard `enrichDashboardBaseFx()` and Reports explicit BASE valuation still iterate `availableCurrencies`, and they check `rates[c]` before proving that `group.accounts` contains any active accounts. Therefore an archived-only or transaction-history-only currency can have no requested current rate and still cause `Missing required rate` even though it contributes nothing to current net worth.

Required invariant:

- current BASE valuation authority is determined ONLY by active current account holdings;
- archived-only currencies and historical-transaction-only currencies MUST NOT require current FX rates;
- historical transactions of archived accounts MUST remain included in historical reports.

### 2. Rejected-baseline verifier mode is too weak

Current `scripts/verify-phase8-ux-performance.mjs` builds a list of mandatory defect classes but exits expected-fail when only `caughtCount > 0`.

That does not prove the BASE-mode rejected baseline was rejected for every defect required by the BASE-mode closure.

For baseline `41b61488dacee4d0167fe35224dfc73f6a206395`, the verifier MUST prove ALL SIX BASE-mode defect classes are caught:

1. `BASE discoverable missing`
2. `Reports historical BASE masquerades as zero`
3. `Dashboard historical BASE masquerades as zero`
4. `Dashboard BASE balance badge masquerades as zero`
5. `archived-only FX source included`
6. `user-facing snapshot jargon`

Do not require old defect classes that were already fixed before `41b61488...`; use baseline-specific expected defect sets or equivalent deterministic logic.

The baseline command MUST exit non-zero only after reporting exactly `6/6` required BASE-mode defects caught. `1/6`, `5/6`, or generic `caughtCount > 0` is FAIL.

### 3. `phase8-base-mode.test.ts` largely reimplements logic instead of testing production behavior

The current 7/7 test reconstructs booleans and mock control flow locally. This is weak regression protection.

Required:

- extract small pure production helpers only where it improves testability, without changing financial semantics; OR test the actual existing production helper/source contract directly;
- at minimum directly test production logic that determines active current FX source currencies / current valuation groups and BASE discoverability;
- include a case with:
  - active VND account,
  - active USD account,
  - archived EUR account,
  - historical EUR transaction;
- assert current FX requirement is VND+USD only;
- assert EUR does not make current BASE valuation unavailable merely because no current EUR rate was requested;
- preserve historical EUR transaction eligibility for historical BASE conversion;
- native mode remains zero-FX-network path;
- explicit BASE remains the only path that triggers current/historical FX work.

Do not turn the test into comments/string-presence checks.

## Preserve accepted behavior

Do not regress:

- Reports native-first initial load;
- BASE/Tổng hợp selector discoverability;
- initial/native Reports zero FX calls;
- explicit BASE triggering current and historical FX;
- Reports fail-closed historical BASE UI;
- Dashboard fail-closed historical BASE UI;
- Dashboard current valuation unavailable rendering;
- user-facing jargon cleanup;
- stale Dashboard enrichment generation guard;
- theme persistence and truthful Settings controls;
- pagination/bounded queries/bounded snapshot concurrency;
- DB/structural/two-user RLS accepted PASS;
- exact-money and immutable historical FX semantics.

## Mandatory implementation

### A. Current BASE valuation must iterate active holdings, not `availableCurrencies`

Use an authoritative set derived from active current account groups/active accounts.

Safe examples include:

- iterate only `Object.values(accountGroups).filter(group => group.accounts.length > 0)`; or
- derive exact active currency set from active accounts and then lookup groups.

For each active holding currency:

- identity base currency may use exact `1.000000000000`;
- non-base active currency requires a current quote;
- missing quote for an ACTIVE holding MUST fail closed;
- no quote is required for an empty/archived-only/history-only current group.

Apply this consistently in:

- `enrichDashboardBaseFx()`;
- explicit BASE branch of `getDetailedReportData()`.

Do not silently skip an active account with missing quote.

### B. Harden UX verifier baseline mode

Update `scripts/verify-phase8-ux-performance.mjs` so baseline-specific expected defect sets are authoritative.

Required proof for:

```bash
node scripts/verify-phase8-ux-performance.mjs --baseline 41b61488dacee4d0167fe35224dfc73f6a206395
```

Output must include an exact final line equivalent to:

```text
BASE_MODE_REJECTED_BASELINE_DEFECTS_CAUGHT: 6/6
```

and exit non-zero.

Current source must exit 0 with all current checks PASS.

Add a current-source semantic check that proves valuation iteration does not require a current quote for zero-active-account currency groups. Checking only `accounts.filter(!is_archived)` before the request is insufficient.

### C. Strengthen BASE mode tests

Replace self-fulfilling local reimplementation with direct production behavior tests as described above.

The test count may change; report actual count truthfully.

## Verification

Run all:

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
npx tsx tests/phase8-math.test.ts
npx tsx tests/phase8-base-mode.test.ts
git diff --check
```

Expected baseline verifier process exit is non-zero, but it is PASS evidence only if it explicitly proves `6/6` BASE-mode defect classes caught.

Do NOT run live RLS verifier.
Do NOT modify remote Supabase.

## Final repository proof

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
git diff --check
```

Required:

- HEAD == origin/main;
- clean worktree;
- Phase 7 migration blob `5da681f7c66fdd85acda79172d1ad305496c6313`;
- Phase 8 migration blob `69e3ff637c0430fa701794aff497f81eb875443e`.

## Required final report

```text
TASK
Finora Phase 8 — Pass A BASE Mode Final Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
033673f113871ab1153eae0446088613a002b230

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

BASELINE_41B61488_EXPECTED_FAIL
PASS / FAIL

BASE_MODE_REJECTED_BASELINE_DEFECTS_CAUGHT
6/6 / <n>/6

BASE_MODE_TESTS
PASS <n>/<n> / FAIL

PHASE_8_MATH_TESTS
PASS <n>/<n> / FAIL

ACTIVE_CURRENT_FX_SCOPE_EXACT
PASS / FAIL

ARCHIVED_ONLY_CURRENT_RATE_NOT_REQUIRED
PASS / FAIL

HISTORICAL_ARCHIVED_TX_PRESERVED
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

REMOTE_DATABASE_MODIFIED
false

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