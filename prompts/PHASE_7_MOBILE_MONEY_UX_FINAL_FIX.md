# Finora Phase 7 — Mobile & Money UX Final Fix

## Scope

This is a narrow UI/UX corrective only. Do not modify the Phase 7 migration, Supabase schema, RLS, grants, accepted finance formulas, or begin Phase 8.

Expected baseline before this pass:

- Remote main parent: `142ff678b8eb3a7f5a5aa7586444d4bb5048177b`
- Phase 7 migration blob must remain: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 7 source/database/structural/two-user RLS gates remain PASS.
- Owner live functional smoke is PASS except final mobile navigation / money UX acceptance.

## Confirmed Accepted Part

The Sheet-based mobile menu source is acceptable in structure: mobile users can reach Dashboard, Accounts, Transactions, Budgets, Recurring, Goals, Reports, and Settings. Do not redesign it unless a concrete defect is found.

## Mandatory Residual Fixes

### 1. VND display must never show fractional digits

Owner requirement: Vietnamese money is displayed as integer đồng only.

Examples:

- `1000000.0000` -> `1.000.000 ₫`
- `250000.0000` -> `250.000 ₫`
- `0.0000` -> `0 ₫`

Do not render VND as `1.000.000,0000`, `1.000.000,5`, or any other fractional form.

Update the shared display formatter (`formatExactMoney` or the authoritative shared display boundary), not one-off UI call sites.

If an old persisted VND value contains a fractional part, keep database/source exactness unchanged but omit the fractional part at presentation only. Do not mutate persisted finance data in this corrective.

### 2. Localized decimal comma for non-VND money input

The current shared parser treats every comma as a thousands separator. This makes a mobile locale input such as `12,34` become `1234`, which is incorrect.

Harden the shared parser for decimal currencies without using floating-point arithmetic.

Required examples:

- USD/EUR input `12,34` -> canonical raw `12.34`
- USD/EUR input `1.234,56` -> canonical raw `1234.56`
- USD/EUR input `1,234.56` -> canonical raw `1234.56`
- USD input `1000.5` -> canonical raw `1000.5`
- VND input `1000000` -> raw `1000000`, displayed `1.000.000`
- VND pasted `1.000.000` -> raw `1000000`, displayed `1.000.000`

Use deterministic string/BigInt-safe logic only. Do not use `Number()`, `parseFloat()`, unary `+`, or floating-point money arithmetic.

### 3. Preserve VND integer-only input

VND user-facing inputs must remain integer-only. Do not add decimal entry for VND.

The service/database boundary remains exact canonical decimal via the existing money layer, e.g. user input `1.000.000` ultimately persists as `1000000.0000`.

### 4. Add regression verification for the new UX boundary

The previous commit did not modify `scripts/verify-phase7-source.mjs`. Harden source verification (or add a dedicated deterministic UX verifier) so the previous SHA `142ff678b8eb3a7f5a5aa7586444d4bb5048177b` would fail for:

- VND display allowing fractional digits;
- non-VND localized comma `12,34` parsing incorrectly;
- missing exact examples above;
- introduction of float-based money parsing in the new input layer.

The verification must test behavior, not only file/keyword existence where practical.

### 5. Correct PROJECT_STATUS truthfulness

`docs/PROJECT_STATUS.md` currently contains stale Phase 7 status text such as migration pending apply. Update it truthfully to reflect the accepted current gates:

- `PHASE_7_SOURCE_GATE=PASS_CODE_ONLY`
- `PHASE_7_REMOTE_DATABASE=PASS`
- `PHASE_7_STRUCTURAL_GATE=PASS`
- `PHASE_7_TWO_USER_RLS=PASS`
- `PHASE_7_LIVE_PERSISTENCE_SMOKE=PASS_CORE_PENDING_FINAL_MOBILE_MONEY_UX`
- `PHASE_7_OVERALL=PARTIAL`
- `PHASE_8_AUTHORIZED=false`

Do not claim Phase 7 closure until owner verifies the final UX on a real mobile device.

## Required Verification

Run at the final exact revision:

```bash
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase7-source.mjs
node scripts/verify-phase7-source.mjs
git diff --check
```

Run any new dedicated money-input UX verifier/tests added by this pass.

If browser/device tooling is genuinely available, verify 390px, 768px, and 1440px. Do not claim viewport/device PASS without actually checking it.

## Git Provenance

Commit and push `main`, then:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
git rev-parse supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql
```

Require:

- local HEAD == actual `origin/main`;
- clean worktree;
- migration blob still `5da681f7c66fdd85acda79172d1ad305496c6313`.

## Final Report Format

Return exactly:

```text
TASK
Phase 7 Mobile & Money UX Final Fix

STATUS
PASS|FAIL

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

MIGRATION_BLOB_SHA
<sha>

MONEY_INPUT_BLOB_SHA
<sha>

MONEY_INPUT_UTIL_BLOB_SHA
<sha>

SOURCE_VERIFIER_BLOB_SHA
<sha>

MOBILE_NAV_SOURCE
PASS|FAIL

VND_INTEGER_INPUT
PASS|FAIL

VND_INTEGER_DISPLAY
PASS|FAIL

LOCALIZED_DECIMAL_COMMA
PASS|FAIL

EXACT_MONEY_NO_FLOAT
PASS|FAIL

PROJECT_STATUS_TRUTHFUL
PASS|FAIL

TYPECHECK
PASS|FAIL

LINT
PASS|FAIL

BUILD
PASS|FAIL

SOURCE_VERIFIER
PASS|FAIL <count if available>

UX_TESTS
PASS|FAIL <details>

VIEWPORT_390
PASS|FAIL|NOT_RUN

VIEWPORT_768
PASS|FAIL|NOT_RUN

VIEWPORT_1440
PASS|FAIL|NOT_RUN

WORKTREE_CLEAN
true|false

PHASE_8_AUTHORIZED
false
```

No prose before or after the report.