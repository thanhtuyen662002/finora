# Finora Phase 7 Mobile Navigation & Money Input UX Corrective

## Authority

GitHub remote `thanhtuyen662002/finora` is authoritative.

Baseline before this corrective:
- `PHASE_7_SOURCE_GATE=PASS_CODE_ONLY`
- `PHASE_7_REMOTE_DATABASE=PASS`
- `PHASE_7_STRUCTURAL_GATE=PASS`
- `PHASE_7_TWO_USER_RLS=PASS`
- Core live functional smoke has been owner-tested PASS, but Phase 7 MUST NOT close yet because the 390px/mobile usability DoD has two owner-observed blockers.
- `PHASE_8_AUTHORIZED=false`

This is UI/UX corrective only.

## Owner-observed blockers

1. On phone, the user cannot navigate to Accounts/Budgets/Goals/Recurring from the current mobile shell. Desktop sidebar contains these destinations, but the mobile navigation exposes only Dashboard, Transactions, Add, Reports, Settings.
2. Money entry uses ungrouped raw digits such as `1000000`, which is hard to read while typing. For VND, the owner wants grouped input such as `1.000.000` and no fractional display/input digits.

## Hard scope

### Allowed
- Mobile navigation/accessibility changes.
- Shared money-input presentation/parsing utilities/components.
- Updating existing live finance forms from Phases 3–7 to use the shared VND money-entry UX.
- Small UI copy/spacing/accessibility changes required by the above.
- Source tests/verifiers and living docs.

### Forbidden
- No migration changes.
- No Supabase DDL.
- No RLS/grant/policy changes.
- No change to persisted money schema or exact-money arithmetic.
- No change to accepted financial formulas.
- No Phase 8 FX implementation.
- No unrelated redesign/refactor.

The accepted migration blob must remain unchanged:
`5da681f7c66fdd85acda79172d1ad305496c6313`

---

# A. Mobile navigation contract

## A1. Every live destination must be reachable on mobile

At <= 767px, the authenticated shell must provide an obvious, touch-friendly path to ALL current user destinations:
- `/dashboard`
- `/accounts`
- `/transactions`
- `/budgets`
- `/recurring`
- `/goals`
- `/reports`
- `/settings`

Do not rely on the user manually typing URLs.

## A2. Preferred interaction

Keep the existing bottom bar as a quick navigation surface if useful, but add a clear **Menu / More** mobile navigation affordance that opens a full navigation drawer/sheet/menu containing the same grouped destinations as desktop.

Requirements:
- Visible at 390px viewport.
- Minimum practical touch targets around 44px.
- Active route state is visible.
- Selecting a destination closes the mobile menu.
- Keyboard/focus accessible.
- Menu has an accessible label.
- No horizontal overflow.
- Main content remains above the fixed bottom bar and safe-area inset.
- Sign out remains reachable on mobile.
- Do not duplicate business logic between independent desktop/mobile route lists if a shared nav model can be used safely.

## A3. Mobile smoke

At minimum manually verify at 390px width:
- open menu;
- navigate to Accounts;
- navigate to Budgets;
- navigate to Goals;
- navigate to Recurring;
- navigate to Reports;
- navigate to Settings;
- return to Dashboard;
- active state follows route;
- menu closes after navigation;
- no content is hidden behind bottom navigation.

---

# B. Money-input UX contract

## B1. Separate display text from canonical money

Persisted/business money remains the existing exact decimal string contract.

For VND:
- User-facing editing format: `1.000.000`
- Canonical exact value passed to services: `1000000.0000`
- No visible `.0000`, `,0000`, `.00`, or decimal fraction for VND.
- VND editing is integer-only.
- Use `inputMode="numeric"` where appropriate.

The display separators MUST NEVER be sent to Supabase/services.

## B2. No floating point

Parsing/formatting for input MUST use string/BigInt-safe logic only.

Forbidden for money parsing/comparison:
- `Number()`
- `parseFloat()`
- unary `+`
- floating-point arithmetic
- lossy locale conversion tricks

`parseInt` is also forbidden for monetary values.

## B3. VND typing behavior

Implement a shared reusable VND-aware money input/parser instead of one-off handlers in each modal.

Expected examples:

| User input/display | Canonical exact value |
|---|---|
| empty | empty/unset |
| `1` | `1.0000` |
| `1000` | `1000.0000` and display `1.000` |
| `1.000` | `1000.0000` |
| `1000000` | `1000000.0000` and display `1.000.000` |
| `1.000.000` | `1000000.0000` |

Rules:
- Reject letters and unsupported symbols.
- Reject negative values where the consuming form forbids negative values.
- Do not silently round fractional VND input; VND UI should not permit a fraction in the first place.
- Pasting grouped VND values must work.
- Backspace/delete must remain usable and must not fight the caret more than necessary.
- Empty optional fields remain empty visually and are converted to the existing canonical default by the consuming form only when required.

## B4. Non-VND behavior

Do NOT redesign Phase 8 currency semantics here.

For non-VND currencies:
- Preserve the existing exact-decimal capability up to 4 fractional digits.
- Do not force VND dot-grouping rules onto USD/EUR/etc.
- Existing exact service boundary remains authoritative.

A shared component may support both modes, but VND is the mandatory UX improvement in this corrective.

## B5. Apply to all currently live persisted money-entry forms

Audit current Phases 3–7 live UI and migrate applicable monetary inputs to the shared component/utilities, including at least where present:
- Account opening balance create/edit flows.
- Transaction amount create/edit flows.
- Transfer amount create/edit flows.
- Budget add/edit.
- Goal add/edit/contribute.
- Recurring add/edit.

Do not leave Phase 7 polished while older live forms still require raw `1000000` VND entry.

## B6. VND display output

Audit user-facing VND money output touched by these flows.

Expected normal presentation examples:
- `1.000.000 ₫`
- `250.000 ₫`
- `0 ₫`

Do not display `1.000.000,0000 ₫`, `1000000.0000`, or other storage-scale artifacts to users.

Underlying canonical strings may and should remain `numeric(20,4)` compatible.

---

# C. Regression requirements

The following accepted behavior must remain unchanged:
- exact-money storage/business arithmetic;
- Budget spent derivation;
- transaction void/restore behavior;
- transfer neutrality;
- goal overfund support;
- recurring scheduling logic;
- currency isolation;
- RLS/security;
- persistence.

Do not re-run destructive/live RLS tests unless explicitly needed. This corrective should be verifiable source-side plus owner UI smoke.

---

# D. Source verification

Add or extend source verification so it fails if:
- mobile has no route path to `/budgets`, `/goals`, `/recurring`, `/accounts`;
- Phase 7/mobile nav is desktop-only;
- VND monetary inputs remain raw one-off text inputs for the targeted live forms;
- VND input implementation uses floating-point money parsing;
- VND user-facing format shows fractional storage scale;
- grouped display values can leak to service mutation payloads.

Add pure tests for money-entry helpers covering at least:
- `0`
- `1`
- `999`
- `1000`
- `1000000`
- already grouped `1.000.000`
- paste cleanup
- invalid characters
- empty optional input
- canonical `numeric(20,4)` output
- non-VND exact fractional input preserved.

---

# E. Required final checks

Run at the FINAL exact revision:

```bash
npm run typecheck
npm run lint
npm run build
node scripts/verify-phase7-source.mjs
git diff --check
```

If a dedicated UX verifier/test is added, run it too.

Manually verify responsive UI at:
- 390px mobile
- 768px tablet boundary
- 1440px desktop

Do not claim viewport PASS unless actually checked.

---

# F. Documentation / gate state

Update `docs/PROJECT_STATUS.md` truthfully.

Until owner retests the two UX items, Phase 7 remains open even though core functionality and RLS are already PASS.

Required state after source implementation of this corrective but before owner retest:

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=PASS
PHASE_7_STRUCTURAL_GATE=PASS
PHASE_7_TWO_USER_RLS=PASS
PHASE_7_CORE_LIVE_FUNCTIONAL_SMOKE=PASS
PHASE_7_MOBILE_UX_SMOKE=PENDING_OWNER
PHASE_7_MONEY_INPUT_UX_SMOKE=PENDING_OWNER
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

Do not close Phase 7 and do not authorize Phase 8 yet.

---

# G. Provenance

Commit and push the implementation to `main`, then:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Require:
- local HEAD == actual origin/main
- clean worktree
- migration blob remains `5da681f7c66fdd85acda79172d1ad305496c6313`

Return a concise report including:
- FINAL_LOCAL_HEAD_SHA
- FINAL_REMOTE_MAIN_SHA
- MIGRATION_BLOB_SHA
- MOBILE_NAV_IMPLEMENTATION
- VND_INPUT_IMPLEMENTATION
- LIVE_FORMS_MIGRATED
- VND_DISPLAY_POLICY
- TYPECHECK
- LINT
- BUILD
- SOURCE_VERIFIER
- WORKTREE_CLEAN
- PHASE_8_AUTHORIZED=false

No Phase 8 work.