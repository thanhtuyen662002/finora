# Finora Phase 8 — Theme First-Paint + Logo Integration Remote Finalization

## Authority

- Repository: `thanhtuyen662002/finora`
- Current authoritative remote baseline: `a77ca40436a6c692ef032f4535c369e047e497eb`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Remote Supabase MUST NOT be modified.
- Live DB/RLS verifiers MUST NOT be run.
- Phase 8 Pass B and Phase 9 remain unauthorized.

## Situation

A local implementation report claims completion of:

- first-paint theme correctness;
- shared theme helper;
- Finora logo assets/component/integration;
- Reports BASE warning consolidation;
- Settings layout balancing;
- docs update.

However, authoritative GitHub `main` still points to `a77ca40436a6c692ef032f4535c369e047e497eb`, so those changes are not yet auditable on source-of-truth remote.

Do NOT redo correct local work unnecessarily. First inspect the current local worktree and preserve the implementation if it is sound. The purpose of this pass is to finalize, verify, commit, push, and prove exact remote state.

## Logo authority

Use the Finora ribbon logo supplied by the owner as the visual authority. If the local implementation already contains `public/finora-logo.svg`, `public/finora-icon.svg`, and a reusable `FinoraLogo` component derived from that supplied logo, preserve them only if they visually match the supplied asset and work in both light and dark contexts.

Do NOT substitute a generic unrelated logo or a plain letter `F` as the primary brand mark where the new Finora brand should appear.

## Mandatory audit before commit

### A. Theme first-paint correctness

Verify all of the following in source:

1. Theme is applied before React hydration on every route.
2. The inline/pre-hydration logic and runtime helper use the same storage key and values.
3. Supported values are exactly the app's intended theme modes (`light`, `dark`, `system` or equivalent existing canonical values).
4. `system` mode evaluates `prefers-color-scheme` before first paint.
5. Settings runtime theme changes update the document root immediately and persist the same canonical value.
6. Navigating to Settings is NOT required for theme correctness.
7. No stale second theme implementation remains that can override the pre-hydration decision after mount.
8. Avoid introducing hydration warnings or CSP-unsafe implementation beyond the project's current architecture; document the exact mechanism used.

### B. Logo integration

Verify:

- brand assets exist under `public/`;
- `FinoraLogo` is reusable and uses those assets or equivalent inline SVG source;
- desktop sidebar/header uses the new brand;
- mobile header/menu uses the new brand;
- auth pages use the new brand where applicable;
- root metadata/favicon/app icon points to the new icon asset;
- contrast/readability is acceptable in both light and dark modes;
- no broken image path;
- no oversized layout shift caused by logo dimensions.

### C. Reports BASE unavailable UX

Preserve finance fail-closed semantics.

- There may be one primary explanatory warning banner.
- Individual unavailable sections may use concise `Không khả dụng` / compact empty states.
- Do NOT suppress necessary fail-closed state merely to remove repeated wording.
- Native currency reports must remain unaffected.
- BASE selector discoverability and explicit BASE-only FX behavior must remain intact.

### D. Settings layout

Verify the final desktop layout is balanced and responsive.

- No awkward narrow left-anchored `max-w-*` container.
- Long full-width sections may span both columns.
- Unsupported controls remain disabled/truthful with `Sắp hỗ trợ`.
- No reintroduction of internal jargon.

### E. Long list containment / performance non-regression

Preserve accepted behavior:

- Dashboard recent transactions bounded.
- Dashboard active accounts bounded.
- Reports transaction list paginated.
- Accounts list paginated.
- filter/sort resets remain correct.
- Dashboard native render remains non-blocking relative to FX enrichment.
- no duplicate Reports initial fetch.

## Verification — use repository-standard commands

The prior report used `compile_applet` / `lint_applet`. Those are NOT sufficient acceptance proof for Finora.

Run exactly:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase8-source.mjs
node scripts/verify-phase8-source.mjs
node --check scripts/verify-phase8-ux-performance.mjs
node scripts/verify-phase8-ux-performance.mjs
npx tsx tests/phase8-math.test.ts
npx tsx tests/phase8-base-mode.test.ts
git diff --check
```

If you add a deterministic theme/logo verifier, run it too and report its count.

Do NOT run live DB or RLS verifiers.

## Required repository finalization

After verification succeeds:

1. Review `git status --short` and ensure only authorized Theme/Logo/UX files are changed.
2. Commit the complete implementation in a logical commit.
3. Push to `main`.
4. Fetch origin again.
5. Prove exact remote synchronization and clean worktree:

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
- actual implementation commit must be a descendant of this prompt commit;
- migrations unchanged.

## Required final report

Return exactly:

```text
TASK
Finora Phase 8 — Theme First-Paint + Logo Integration Remote Finalization

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_REMOTE_SHA
a77ca40436a6c692ef032f4535c369e047e497eb

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

PHASE_8_MATH_TESTS
PASS <n>/<n> / FAIL

PHASE_8_BASE_MODE_TESTS
PASS <n>/<n> / FAIL

THEME_FIRST_PAINT_PRE_HYDRATION
PASS / FAIL

THEME_STORAGE_KEY_UNIFIED
PASS / FAIL

SYSTEM_THEME_FIRST_PAINT
PASS / FAIL

LOGO_ASSETS_PRESENT
PASS / FAIL

LOGO_APP_INTEGRATION
PASS / FAIL

FAVICON_APP_ICON_INTEGRATION
PASS / FAIL

REPORTS_BASE_FAIL_CLOSED_PRESERVED
PASS / FAIL

SETTINGS_LAYOUT_POLISH
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

REMOTE_DATABASE_MODIFIED
false

PHASE_8_UX_PERFORMANCE_HARDENING
PASS_CODE_ONLY

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
