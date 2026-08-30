# Finora Phase 8 — Pass A UX + Performance Corrective

## Authority

- Repository: `thanhtuyen662002/finora`
- Rejected implementation baseline: `fe95bc2406c32dcaaf5e51db3277611f1ee98b47`
- Preserve accepted good work from that implementation unless a concrete defect below requires touching it.
- Phase 7 migration MUST remain byte-for-byte: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration MUST remain byte-for-byte: `69e3ff637c0430fa701794aff497f81eb875443e`
- Phase 8 source gate: PASS_CODE_ONLY
- Phase 8 remote DB: PASS
- Phase 8 structural gate: PASS
- Phase 8 two-user RLS gate: PASS
- Remote Supabase MUST NOT be modified in this corrective.
- Do NOT run the live RLS verifier.
- Do NOT start Phase 8 Pass B or Phase 9.

## Why the prior pass is rejected

The report for `fe95bc...` claimed completion, but direct remote audit found material mismatches:

1. `src/app/settings/page.tsx` is still the old blob and still exposes the exact problems the pass was meant to remove:
   - `Cài đặt hệ thống`
   - `Row Level Security (RLS)`
   - `Giao diện (Appearance)`
   - `Sáng (Light)` / `Tối (Dark)` / `Hệ thống (Auto)`
   - `Tiền tệ & Khu vực (user_settings)`
   - `Base Currency`
   - raw IANA timezone labels
   - left-anchored `max-w-4xl` single-column layout.

2. Reports initial duplicate fetch still exists. `useEffect` depends on `selectedCurrency`, while the first fetch calls `setSelectedCurrency(res.selectedCurrency)`, causing a second expensive request after null/default currency resolution.

3. `TransactionList` only resets page for search and reset-all. Type/category/account/period/sort changes do not reset the current page, so filtering while on a later page can render a false empty state even when matching rows exist.

4. Dashboard preview filters archived accounts, but current account counts still use unfiltered `group.accounts.length`, including archived verifier/test accounts in summary and multi-currency badges.

5. No deterministic UX/performance verifier was added. `scripts/verify-phase8-source.mjs` is still the old 35-check blob and does not verify the new hardening requirements. It also contains stale status logic expecting `PHASE_8_REMOTE_DATABASE=BLOCKED_NOT_APPLIED`.

6. Native report/dashboard rendering still waits for unrelated FX work in the current architecture. `getDetailedReportData()` starts current valuation + historical snapshot work whenever Auto FX is enabled, even for an explicitly selected native currency, and waits for both before returning. This conflicts with the requirement that native-currency data remain responsive independently of optional FX enrichment.

7. Dashboard historical FX work uses the merged six-month analytics + recent-6 transaction set. If recent transactions lie outside the six-month analytics window, unrelated older transaction IDs may still be passed to historical snapshot retrieval.

8. `docs/PROJECT_STATUS.md` was updated with stale next steps telling the user to apply the Phase 8 migration and run DB/RLS gates even though those gates are already PASS.

## Preserve accepted good work

Do not regress these already-good changes from `fe95bc...`:

- `getTransactionsInDateRange` and `getRecentTransactions` bounded query helpers;
- snapshot chunk maximum 200 IDs;
- bounded snapshot concurrency no greater than 4 chunks;
- Accounts page pagination at 12/page and active/archived view reset;
- TransferList pagination at 20/page with filter resets;
- centralized account type localization helper;
- Dashboard active-account preview maximum 6;
- Reports active-account preview maximum 8 if already correctly implemented;
- package-lock repair if it is now synchronized.

## Mandatory corrective work

### 1. Actually implement Settings end-user cleanup

`src/app/settings/page.tsx` MUST change from rejected blob `a4d5014772491c062d97fd0e72e9162a1dc73c05`.

Required visible behavior:

- Page title: `Cài đặt`.
- No user-facing `RLS`, `Row Level Security`, `user_settings`, `Appearance`, `Light`, `Dark`, `Auto`, `Base Currency`, `Credential Source`, roadmap phase labels or other developer/internal wording.
- Theme labels: `Sáng`, `Tối`, `Theo hệ thống`.
- Currency section: `Tiền tệ & khu vực`.
- Base currency label: `Tiền tệ cơ sở`.
- Friendly timezone labels such as `Việt Nam (GMT+7)`, `Nhật Bản (GMT+9)`, `New York (GMT-4)` while retaining IANA values internally.
- Friendly currency names in Vietnamese where reasonable.
- Mock-only notification/AI preferences that are not persisted MUST be hidden or disabled with a clear `Sắp hỗ trợ`; they must not look functional.

Layout:

- centered responsive container: `w-full max-w-6xl mx-auto` or equivalent;
- desktop `xl` grid that reduces excessive vertical height;
- mobile remains one column;
- important full-width cards may span both columns;
- no horizontal overflow at 390/768/1024;
- save action remains easy to find.

Do NOT replace the requirement with `max-w-2xl` single-column; that recreates excessive vertical scrolling and wastes desktop width.

### 2. Eliminate Reports duplicate initial fetch semantically

The first report load MUST issue exactly one `getDetailedReportData(...)` call for the initial scope.

Do not rely on timing tricks.

A valid design may:

- separate requested currency from resolved currency;
- only trigger effects from user-requested scope changes;
- avoid placing server-resolved `selectedCurrency` back into the same dependency cycle;
- or use an exact request-key guard/cache.

Preserve stale-response rejection for rapid period/currency changes.

Add a deterministic test that would fail the rejected `fe95bc...` dependency cycle.

### 3. Correct TransactionList pagination resets

Every user input that changes the filtered/sorted result set MUST reset to page 1:

- search;
- type;
- category;
- account;
- period;
- sort order;
- clear-search;
- reset-all.

Also clamp/reset page safely when the incoming `transactions` prop changes and the old page is now out of range.

Filter summary must show total matching rows, not merely the number on the current page.

Add deterministic coverage for:

- page 2+ -> filter -> page 1;
- filtered data with fewer pages never renders a false empty state;
- preview `limit` mode does not show pagination.

### 4. Fix archived-account counts everywhere current position is shown

Archived accounts MUST be excluded from:

- Dashboard `Tài sản (...)` account count;
- Dashboard `Tài khoản & Ví (...)` preview count;
- Dashboard per-currency badge account counts;
- Reports current-position account counts/lists;
- BASE converted current-position account count/list.

Historical transactions attached to archived accounts remain in historical calculations.

Do not mutate/delete archived rows.

### 5. Native mode must not wait for unrelated FX enrichment

This corrective must materially address the remaining latency source.

For an explicitly selected native currency (`VND`, `USD`, etc.):

- `getDetailedReportData()` MUST NOT request historical FX snapshots merely because Auto FX is enabled;
- native report summaries/charts/lists must resolve without waiting for current/base FX enrichment that is not required for the selected native mode;
- switching to `Tổng hợp`/BASE may then perform the required current valuation + historical snapshot work.

For Dashboard initial rendering:

- native financial data must render without waiting for historical snapshot enrichment;
- historical/base enrichment may load progressively afterward;
- a small localized enrichment loading state is acceptable;
- failure of base enrichment must not blank native cards.

If progressive Dashboard enrichment is implemented through separate functions/state, preserve deterministic stale-response protection and mutation refresh behavior.

### 6. Snapshot scope must be exact

Dashboard historical snapshot requests must use only transaction IDs required for the six-month/current-month BASE analytics scope.

Do not include an out-of-window transaction just because it appears in `recentTransactions` preview.

Reports snapshot IDs must remain restricted to the selected report scope.

Add deterministic tests proving an out-of-range ID is never sent to `/api/fx/transaction-snapshots`.

### 7. Add a real UX/performance verifier

Do not claim success from the legacy 35/35 Phase 8 source verifier alone.

Add a dedicated deterministic script, for example:

`node scripts/verify-phase8-ux-performance.mjs`

It MUST fail rejected baseline `fe95bc...` and prove at minimum:

- Settings blob/content no longer contains forbidden user-visible implementation strings;
- Settings centered `max-w-6xl`-class equivalent and desktop grid semantics;
- mock-only controls are hidden/disabled;
- Reports initial-fetch dependency cycle removed;
- TransactionList resets all filters/sort to page 1;
- pagination summary uses total filtered count;
- Dashboard active-account counts exclude archived accounts;
- native Reports path avoids FX snapshots;
- Dashboard historical snapshot IDs are analytics-window-only, not recent-preview union;
- snapshot concurrency remains bounded <=4;
- Dashboard preview <=6;
- Reports account preview <=8;
- no tracked `@Supabase/` imports;
- Phase 7/8 migration blob SHAs unchanged.

No unconditional true checks, comment-only checks or shallow keyword assertions that could pass the rejected baseline.

Also update `verify-phase8-source.mjs` only if needed to remove stale governance assumptions; do not weaken its financial/security checks.

### 8. Repository-wide visible-language scan

Scan normal user-facing pages/components for forbidden implementation leakage.

Normal-user UI must not expose:

- `RLS` / `Row Level Security`;
- `user_settings`;
- `Phase 7` / `Phase 8` / roadmap labels;
- `FX Engine`;
- `FX snapshot` / `snapshot` as implementation language;
- `UNAVAILABLE`;
- `Appearance`, `(Light)`, `(Dark)`, `(Auto)`;
- `Credential Source`;
- raw account enums.

Developer docs, source identifiers, logs, tests and technical admin-only surfaces are exempt.

### 9. PROJECT_STATUS must be historically truthful

Do NOT tell the user to re-apply an already-applied migration or re-run already-passed structural/RLS gates.

Expected post-code state:

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_UX_PERFORMANCE_HARDENING=PASS_CODE_ONLY
PHASE_8_LIVE_PERSISTENCE_SMOKE=PENDING_RETEST
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

Next recommended action must be live UX/performance/persistence retest, not migration/DB/RLS replay.

## Required verification

Run from clean checkout/worktree:

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
# any added unit tests for report request scoping/pagination
git diff --check
```

Do NOT substitute `compile_applet` for `npm run build` in the final evidence.

Do NOT execute live RLS or modify remote Supabase.

If viewport browser tooling is actually available, verify 1440, 1024, 768 and 390. If unavailable, report `NOT_RUN`; never claim inferred viewport proof.

## Git proof

After push:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require exact HEAD match and clean worktree.

## Required final report

Return exactly:

```text
TASK
Finora Phase 8 — Pass A UX + Performance Corrective

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
fe95bc2406c32dcaaf5e51db3277611f1ee98b47

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

PHASE_8_SOURCE_VERIFIER
PASS <n>/<n> / FAIL

UX_PERFORMANCE_VERIFIER
PASS <n>/<n> / FAIL

RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

PHASE_8_TESTS
PASS <n>/<n> / FAIL

GIT_DIFF_CHECK
PASS / FAIL

PHASE_7_MIGRATION_BLOB_SHA
<sha>

PHASE_8_MIGRATION_BLOB_SHA
<sha>

SETTINGS_BLOB_SHA
<sha>

SETTINGS_CHANGED_FROM_REJECTED_BLOB
true / false

SETTINGS_END_USER_LANGUAGE
PASS / FAIL

SETTINGS_CENTERED_DESKTOP_GRID
PASS / FAIL

REPORT_INITIAL_FETCH_EXACT_ONCE
PASS / FAIL

NATIVE_REPORT_SKIPS_UNRELATED_FX
PASS / FAIL

DASHBOARD_NATIVE_RENDER_INDEPENDENT_OF_HISTORICAL_FX
PASS / FAIL

SNAPSHOT_SCOPE_EXACT
PASS / FAIL

TRANSACTION_PAGINATION_RESETS_ALL_FILTERS
PASS / FAIL

ARCHIVED_ACCOUNT_VISIBLE_CURRENT_COUNTS
0 / <n>

DASHBOARD_ACCOUNT_PREVIEW_MAX
<n>

REPORT_ACCOUNT_PREVIEW_MAX
<n>

TRACKED_UPPERCASE_SUPABASE_IMPORTS
0 / <n>

PROJECT_STATUS_LIVE_GATES_TRUTHFUL
PASS / FAIL

REMOTE_DATABASE_MODIFIED
false

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
