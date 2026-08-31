# Finora Phase 8 — Theme + Logo User-Facing Polish Closure

## Authority

- Repository: `thanhtuyen662002/finora`
- Accepted BASE-mode source candidate: `21fb405f4fd9aea707ff9a8b29c019cd05f837f3`
- Theme/logo implementation candidate to correct: `8dd5299e62bc566c2ef22a0bc7898c38621f5ec6`
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Remote Supabase MUST NOT be modified.
- Live DB/RLS verifiers MUST NOT be rerun.
- Phase 8 Pass B and Phase 9 remain unauthorized.

## Preserve accepted work

Do not regress or unnecessarily rewrite:

- pre-hydration theme script in `src/app/layout.tsx`;
- unified `finora_theme` localStorage key and theme helper;
- AppShell theme synchronization;
- Finora ribbon logo/icon assets and `FinoraLogo` component;
- logo integration in AppShell and auth screens;
- favicon/app-icon integration;
- Settings `max-w-6xl` responsive layout and truthful disabled controls;
- Dashboard non-blocking FX enrichment and stale-response guard;
- BASE discoverability and fail-closed finance behavior;
- pagination/bounded-query work;
- accepted DB / structural / two-user RLS gates;
- exact-money and immutable historical FX semantics.

## Why `8dd5299e...` is not yet accepted

### 1. User-facing landing page exposes false/internal project state

The root landing page currently renders `Phase 8 Complete`, while the authoritative ledger still states:

```text
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

This is false user-facing product status.

The same page also exposes implementation jargon such as `Supabase RLS` and may contain other developer-facing terms (`Phase`, `Feature Flags`, `Gemini model`, technical Admin labels) that are inappropriate for a normal end user.

Required:

- remove `Phase 8 Complete` from normal user UI;
- do not replace it with another internal phase label;
- use a product-value badge/label if a badge is desired, e.g. `Riêng tư · Đa tiền tệ`, or remove the badge;
- rewrite normal-user landing copy so it describes benefits, not implementation stack;
- normal-user landing UI MUST NOT expose `Phase`, `Supabase`, `RLS`, `Feature Flags`, raw model/config jargon, or misleading completion claims;
- do not change authoritative engineering documentation merely to make UI text pass.

### 2. Reports BASE-unavailable UX is not actually consolidated

A top-level BASE-unavailable banner was added, which is good, but the same long warning sentence is still repeated inside:

- cash-flow chart empty state;
- category breakdown empty state;
- transaction details empty state.

This defeats the intended consolidation and makes the page visually noisy.

Required:

- keep exactly one primary explanatory BASE-unavailable banner near the top;
- banner may contain the full explanation and action to switch to a native currency;
- summary cards may display `—` plus a short neutral status such as `Chưa có dữ liệu tổng hợp`, but MUST NOT repeat the full warning sentence;
- chart/category/details empty states must be concise and non-technical, e.g. `Dữ liệu tổng hợp chưa sẵn sàng`;
- the full explanatory warning sentence should appear once only in the normal user-visible Reports render path;
- preserve fail-closed behavior: no zero masquerading, no BASE chart/category/details rendered as authoritative when historical BASE is unavailable;
- current BASE valuation unavailable must remain distinct from historical BASE unavailable.

## Verification hardening

Update or extend `scripts/verify-phase8-ux-performance.mjs` so current source proves at minimum:

1. theme first-paint script remains present before hydration;
2. `FINORA_THEME_KEY` and layout first-paint key remain unified;
3. Finora logo assets/component/AppShell integration remain present;
4. root normal-user UI does not contain `Phase 8 Complete`;
5. root normal-user UI does not expose `Supabase RLS` or equivalent internal stack jargon;
6. Reports has one primary BASE-unavailable explanatory banner;
7. the long BASE-unavailable explanation is not duplicated across chart/category/details;
8. fail-closed `—` / unavailable rendering remains in place;
9. Settings responsive centered layout remains present;
10. existing pagination/bounded-list checks remain intact.

Do not weaken prior checks. Do not use unconditional booleans/comments as proof.

## Required verification

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
node --check scripts/verify-phase8-rls.mjs
npx tsx tests/phase8-math.test.ts
npx tsx tests/phase8-base-mode.test.ts
git diff --check
```

Do NOT execute the live RLS verifier.
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
Finora Phase 8 — Theme + Logo User-Facing Polish Closure

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
8dd5299e62bc566c2ef22a0bc7898c38621f5ec6

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

THEME_FIRST_PAINT_PRESERVED
PASS / FAIL

LOGO_INTEGRATION_PRESERVED
PASS / FAIL

LANDING_INTERNAL_JARGON_REMOVED
PASS / FAIL

FALSE_PHASE_COMPLETE_REMOVED
PASS / FAIL

REPORTS_SINGLE_PRIMARY_BASE_WARNING
PASS / FAIL

REPORTS_FAIL_CLOSED_PRESERVED
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

REMOTE_DATABASE_MODIFIED
false

PHASE_8_THEME_LOGO_POLISH
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