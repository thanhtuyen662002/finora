# Finora Phase 8 — Exact Logo Fidelity Corrective

## Authority

Repository: `thanhtuyen662002/finora`

Expected baseline main SHA before implementation:

`db223c7b25d1f20746ebfcddd4acf3aa15654f81`

This is a **branding-only corrective**. Do not reopen Phase 8 finance, FX, RLS, migrations, performance, theme-first-paint, pagination, or report semantics.

## Why this corrective exists

Live owner review found that the current Finora logo is visually wrong compared with the approved reference. The current implementation manually redraws the mark with SVG paths. That recreation changes the silhouette, ribbon curvature, sphere proportions, gradients, spacing and wordmark.

The approved reference is the **exact visual authority**. Do not reinterpret it.

## Authoritative assets supplied by the owner

The operator will provide these three PNG files together with this prompt:

- `finora-logo-dark.png` — exact cropped full logo for dark backgrounds, transparent background, white wordmark.
- `finora-logo-light.png` — exact derived full logo for light backgrounds, transparent background, dark-navy wordmark while preserving the original ribbon and green accent.
- `finora-icon.png` — exact cropped icon-only mark from the approved reference.

Copy them byte-for-byte into:

- `public/brand/finora-logo-dark.png`
- `public/brand/finora-logo-light.png`
- `public/brand/finora-icon.png`

If any of these three authoritative files is not available in the working environment, **STOP and report BLOCKED_ASSET_MISSING**. Do not draw a replacement.

## Non-negotiable visual rule

**DO NOT redraw, regenerate, trace, approximate or recreate the logo with SVG paths, CSS shapes, gradients or text.**

The current hand-built SVG implementation is rejected.

The application must render the supplied raster assets directly with preserved aspect ratio and transparent background.

## Required implementation

### 1. Replace FinoraLogo internals

Update `src/components/ui/FinoraLogo.tsx` so that:

- `variant="full"` renders the exact full logo assets.
- Dark theme renders `/brand/finora-logo-dark.png`.
- Light theme renders `/brand/finora-logo-light.png`.
- `variant="icon"` renders `/brand/finora-icon.png`.
- Use `next/image` where appropriate.
- Use `object-contain` / intrinsic sizing; never stretch or distort.
- No inline `<svg>`, `<path>`, `<circle>`, manually defined gradients or CSS-drawn brand geometry may remain in this component.

Full-logo sizing must remain readable without taking over the navigation:

- desktop sidebar: approximately 120–150 px wide, aspect ratio preserved;
- auth / landing branding: approximately 160–220 px wide depending viewport;
- mobile header: compact full logo if space permits, otherwise exact icon variant;
- compact/mobile menu/favicons: exact icon-only asset.

Do not crop internal parts of the logo.

### 2. Remove rejected handcrafted brand assets

The following manually recreated assets are not authoritative:

- `public/finora-logo.svg`
- `public/finora-icon.svg`

Delete them if no longer needed. No runtime code or metadata may reference them after this corrective.

### 3. Favicon/app-icon authority

Update `src/app/layout.tsx` metadata so normal icon references use the exact `public/brand/finora-icon.png` asset (or deterministic size derivatives made from that exact PNG without redrawing).

Do not alter the accepted pre-hydration theme script.

### 4. Preserve existing integration points

Keep Finora branding present in all already-integrated locations:

- desktop AppShell sidebar;
- mobile top header;
- mobile menu sheet;
- landing page;
- login;
- signup;
- forgot-password;
- reset-password;
- favicon/app icon.

Do not remove branding from a route merely to make the verifier pass.

### 5. Preserve all accepted behavior

Do not modify:

- remote Supabase;
- Phase 7 migration;
- Phase 8 migration;
- FX logic;
- exact-money behavior;
- DB/RLS verifiers;
- BASE fail-closed behavior;
- Dashboard/Reports query behavior;
- pagination;
- theme persistence or first-paint logic;
- current Settings behavior apart from logo references if any.

## Mandatory verifier hardening

Extend `scripts/verify-phase8-ux-performance.mjs` or add a focused deterministic verifier that proves at minimum:

1. all three exact PNG paths exist;
2. `FinoraLogo.tsx` references the exact PNG assets;
3. `FinoraLogo.tsx` contains no brand-drawing `<svg`, `<path`, `<circle`, `linearGradient`, or equivalent manual geometry;
4. old `/finora-logo.svg` and `/finora-icon.svg` runtime references are absent;
5. `layout.tsx` app icon metadata uses the exact icon PNG;
6. AppShell + auth/landing integration points still use `FinoraLogo`;
7. pre-hydration theme behavior remains present and unchanged in semantics.

A comment or filename string is not proof.

## Mandatory verification

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
node --test tests/phase8-math.test.ts
node --test tests/phase8-base-mode.test.ts
git diff --check
```

Use the project's actual existing test command if Node's direct `--test` invocation is not the established command, but report the exact command used. Do not substitute `compile_applet` or `lint_applet` for repository verification.

## Git finalization

Commit and push `main`.

Then run:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Required:

- `HEAD == origin/main`
- clean worktree

## Required report

Return exactly:

```text
TASK
Finora Phase 8 — Exact Logo Fidelity Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED_ASSET_MISSING

BASE_SHA
db223c7b25d1f20746ebfcddd4acf3aa15654f81

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

EXACT_DARK_LOGO_ASSET
PASS / FAIL

EXACT_LIGHT_LOGO_ASSET
PASS / FAIL

EXACT_ICON_ASSET
PASS / FAIL

HAND_DRAWN_SVG_REMOVED
PASS / FAIL

OLD_SVG_RUNTIME_REFERENCES_REMOVED
PASS / FAIL

APP_BRAND_INTEGRATION_PRESERVED
PASS / FAIL

FAVICON_EXACT_ICON
PASS / FAIL

THEME_FIRST_PAINT_PRESERVED
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

REMOTE_DATABASE_MODIFIED
false

PHASE_8_LOGO_FIDELITY
PASS_CODE_ONLY / FAIL

PHASE_8_LIVE_PERSISTENCE_SMOKE
PENDING_LOGO_RETEST

PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS
NOT_STARTED

PHASE_8_OVERALL
PARTIAL

PHASE_9_AUTHORIZED
false
```
