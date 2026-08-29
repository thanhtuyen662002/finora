# Finora Phase 7 — Corrective Gate

## Mission

Correct the Phase 7 implementation currently at remote SHA:

`4c0e710014c142e2722f12d08b87e895046ac171`

This is still a **SOURCE / MIGRATION-PREP gate only**.

The Phase 7 migration has NOT been applied. Keep it that way during this corrective pass.

Do NOT modify the remote Supabase database. Do NOT run the structural verifier against remote Supabase. Do NOT run the live RLS verifier against remote Supabase. Do NOT begin Phase 8.

Read first:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DATABASE.md`
- `prompts/PHASE_7_BUDGETS_GOALS_RECURRING.md`

Preserve all accepted Phase 2–6 behavior and receipts.

---

## 1. Why the current source gate is NOT accepted

Repository audit found the following contract violations at `4c0e710...`.

### 1.1 Structural verifier is materially incomplete

`scripts/verify-phase7-db.sql` currently evaluates only 12 checks covering basic existence, RLS enabled, and policy names/commands.

It does NOT prove the required:

- column sets/nullability/defaults;
- exact `numeric(20,4)` money columns;
- absence of FX / persisted budget progress / recurring next_due columns;
- constraints and exact domain semantics;
- ownership-safe composite FKs and RESTRICT delete actions;
- one updated-at trigger per table using `public.handle_updated_at()`;
- exact policy roles/predicates/USING/WITH CHECK and no DELETE policies;
- exact table/column grants;
- immutable identity/ownership/timestamps;
- `security_invoker=true` on all Phase 7 views;
- exact text money output types;
- `budget_progress` active EXPENSE/category/currency/month derivation semantics;
- exact view grants;
- Phase 4/5 account-balance/transaction/transfer non-regression;
- RLS remaining enabled across Phase 2–7 tables.

Rewrite it into a strict read-only fail-closed verifier matching section 17 of the Phase 7 contract. Every mandatory check must be individually named. `99_OVERALL` must include every mandatory check and FAIL if any fails.

### 1.2 Runtime RLS verifier is materially incomplete

`scripts/verify-phase7-rls.mjs` currently only authenticates A/B, creates one User-A goal, and checks two User-B reads.

Replace it with the full Phase 7 runtime verifier required by section 18:

- schema readiness;
- A full Budget/Goal/Recurring lifecycle;
- B equivalent lifecycle;
- exact view readbacks;
- budget spent from real EXPENSE transaction plus void/restore reversal;
- bidirectional cross-user insert/reference/select/update/ownership/view isolation;
- full domain/integrity rejection matrix;
- Phase 4 transaction/account-balance regression;
- Goal/Recurring neutrality to balances/reports;
- Phase 5 transfer neutrality and budget neutrality;
- deliberate non-RLS database error distinction;
- fail-closed archive/void cleanup with assertions.

When this runtime verifier is actually executed later, missing required URL/key/A/B credentials must be a non-zero failure, not `process.exit(0)`. Source gate only runs `node --check` on it.

Never use service role.

### 1.3 Source verifier coverage is insufficient

`scripts/verify-phase7-source.mjs` currently misses multiple current defects and overstates coverage.

Harden it to prove the actual Phase 7 contract, including:

- no mock types/float fallback inside authoritative Phase 7 components (`BudgetProgress`, `GoalCard`, modals/pages/services);
- no raw VND-only authoritative initialization when real/default currency semantics are required;
- Budget current month is configured-timezone based, not browser-local `new Date()` semantics;
- Recurring next-due `asOfDate` is configured-timezone based with strict invalid-timezone fail-closed behavior;
- Budget month navigation/control exists;
- currency selection/default behavior exists for Budget/Goals/Recurring;
- create selectors exclude archived accounts/categories;
- all required edit/archive/unarchive and pause/resume actions are wired to persisted service mutations;
- pages fail closed on load/reload failure and do not continue rendering stale finance/planning data;
- no unsupported auto-post/auto-deduct claims;
- no Phase 7 rows influence account balances or Reports;
- structural/runtime verifiers satisfy the required coverage contract;
- project status is truthful and Phase 8 unauthorized;
- migration source remains exactly one Phase 7 migration.

Do not claim executable testing of code that is only checked statically.

---

## 2. Budget corrective requirements

Current Budget UI is not contract-complete.

Required corrections:

1. Remove browser-local `getCurrentMonthString()` as authoritative calendar source. Load `user_settings.timezone` and use the accepted Phase 6 timezone helper/semantics:
   - missing timezone may use `Asia/Ho_Chi_Minh`;
   - invalid non-empty timezone fails closed.

2. Add truthful selected-month navigation/control. Current month remains default, but users must be able to inspect other months.

3. Remove authoritative hard-coded `useState('VND')`. Determine available real financial currencies and default using accepted Phase 6 semantics. Add a real currency selector when appropriate. Never fabricate a cross-currency total.

4. Implement persisted UI lifecycle required by the contract:
   - create;
   - edit;
   - archive;
   - unarchive/history access.

5. Creation category list must contain active EXPENSE categories only. Archived categories must not be silently selectable for a new budget.

6. Preserve historical archived category display for existing records.

7. Fail closed on loading/reload errors: clear/block stale budget monetary data and show retry state instead of rendering previous totals as current.

8. Fix over-budget presentation semantics. `computeBasisPoints()` is capped at 10000, so do not use `basisPoints > 10000` or `basisPoints <= 10000` to decide whether a budget is over. Use exact `isOverBudget` / `overBudgetCount` / exact comparison and render negative remaining truthfully as an overage.

9. Remove `MockBudget` / `formatMoney` / floating arithmetic fallback from authoritative `BudgetProgress`.

10. Harden `normalizePeriodMonth`: reject invalid calendar months and do not silently accept arbitrary invalid `YYYY-MM-DD` values as valid budget periods.

---

## 3. Goals corrective requirements

Required corrections:

1. Remove authoritative `useState('VND')` default. Use real available currencies plus accepted Phase 6 base-currency default semantics and provide truthful currency selection/grouping.

2. Implement persisted UI lifecycle:
   - create;
   - edit;
   - edit/manual current progress or explicit contribution action;
   - archive;
   - unarchive/history access.

3. Fail closed on load/reload errors and do not render stale goal totals under a new/error state.

4. Remove `MockGoal` / `formatMoney` / floating arithmetic fallback from authoritative `GoalCard`.

5. Validate `category`, `icon`, and `color` lengths on the application mutation boundary before writes, not only via database rejection.

6. Validate date inputs truthfully where present.

7. Do not make unsupported promises about finishing on time. Goal planning remains separate from net worth and Reports.

---

## 4. Recurring corrective requirements

Required corrections:

1. Do not derive authoritative current date from browser-local `getTodayISODate()` defaults. The Recurring data load must read strict `user_settings.timezone`, derive the current calendar date through the accepted Phase 6 timezone logic, and pass that explicit `asOfDate` into next-due calculations.

2. Invalid non-empty timezone must fail closed; missing timezone may use `Asia/Ho_Chi_Minh`.

3. Remove authoritative hard-coded `useState('VND')`; use real available currency/default semantics and a truthful selector.

4. New recurring records may select only active accounts and active categories matching the transaction type. Account currency determines/locks currency. Changing type must invalidate incompatible category selection.

5. Implement persisted UI lifecycle:
   - create;
   - edit;
   - pause/resume;
   - archive;
   - unarchive/history access.

6. Preserve historical archived account/category references for existing records without silently replacing them.

7. Fail closed on load/reload/settings errors and do not render stale recurring planning data.

8. Remove/replace the phrase implying automatic execution such as `"để tự động theo dõi"` if it can be read as auto-posting. Explicitly state schedules are planning only and do not create transactions automatically.

9. Prefer summaries grouped by actual frequency rather than manufacturing a universal monthly equivalent. If monthly-equivalent projection is retained, document its deterministic assumptions visibly and in ADR/docs, label it clearly as a projection, and define exact rounding/truncation semantics. Do not present it as actual monthly income/expense.

10. Validate ISO calendar dates strictly. `parseISODate` must reject invalid month/day combinations, not only regex shape.

11. Keep weekly/monthly/yearly short-month and Feb-29 regressions on the actual recurrence helper.

---

## 5. Migration/source hardening before it is applied

Because the migration is still unapplied, it MAY be corrected in-place in source now.

Preserve the required schema and least-privilege model.

Recommended hardening for the views:

- `budget_progress` category join should explicitly include ownership/type semantics (`category_id`, `user_id`, category type) rather than only `category_id`;
- `recurring_details` account/category joins should explicitly include ownership plus currency/type semantics matching the composite FKs;
- keep `security_invoker=true`;
- keep all authoritative money outputs as text;
- keep budget spent active EXPENSE-only and scoped to exact user/category/currency/month;
- do not alter `account_balances`, `transaction_details`, or `transfer_details` semantics.

Do not add FX columns/tables/rates.

If the migration changes, the final report must contain the NEW migration blob SHA.

---

## 6. Documentation truthfulness

`docs/PROJECT_STATUS.md` currently overstates parts of the implementation (for example claiming complete mock eradication and describing derived fields that the views do not actually expose).

Update it to exactly match source reality.

Required end state remains:

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_7_STRUCTURAL_GATE=NOT_RUN
PHASE_7_TWO_USER_RLS=NOT_RUN
PHASE_7_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

Do not instruct the owner to apply the migration until this corrective source gate is independently accepted.

---

## 7. Final verification

At the FINAL exact revision run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase7-source.mjs
node scripts/verify-phase7-source.mjs
node --check scripts/verify-phase7-rls.mjs
git diff --check
```

Also perform the semantic scan required by the original Phase 7 contract across authoritative Phase 7 services/pages/components:

```text
parseFloat(
Number(
Math.round(
MOCK_BUDGETS
MOCK_GOALS
MOCK_RECURRING
MockBudget
MockGoal
MockRecurring
convertedBalance
exchangeRate
baseAmount
as any
```

`parseInt` is allowed only for non-money calendar/date parsing when semantically correct.

Do not run remote DB or runtime tests in this corrective source pass.

After verification:

1. commit all corrective changes;
2. push `main`;
3. `git fetch origin`;
4. require final local HEAD == actual `origin/main`;
5. require clean worktree;
6. exact final SHA must be the same revision that passed all final checks;
7. report migration blob SHA and runtime verifier blob SHA.

Responsive claims only if actually exercised at 390 / 768 / 1024 / 1440; otherwise `NOT_RUN`.

---

## Required final report

Return exactly:

```text
TASK
Finora Phase 7 — Corrective Gate

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
4c0e710014c142e2722f12d08b87e895046ac171

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

HEAD_MATCH
true / false

WORKTREE_CLEAN
true / false

TYPECHECK
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

PHASE_7_SOURCE_VERIFIER_SYNTAX
PASS / FAIL

PHASE_7_SOURCE_VERIFIER
PASS / FAIL

PHASE_7_SOURCE_CHECK_COUNT
<number passed>/<number total>

PHASE_7_RUNTIME_VERIFIER_SYNTAX
PASS / FAIL

GIT_DIFF_CHECK
PASS / FAIL

MONEY_MOCK_FX_SCAN
PASS / FAIL

BUDGET_UI_CONTRACT
PASS / FAIL

GOALS_UI_CONTRACT
PASS / FAIL

RECURRING_UI_CONTRACT
PASS / FAIL

TIMEZONE_FAIL_CLOSED
PASS / FAIL

ACTIVE_SELECTION_INTEGRITY
PASS / FAIL

STRUCTURAL_VERIFIER_COVERAGE
PASS / FAIL

RUNTIME_VERIFIER_COVERAGE
PASS / FAIL

MIGRATION_PATH
supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql

MIGRATION_BLOB_SHA
<sha>

STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

RUNTIME_VERIFIER_BLOB_SHA
<sha>

RESPONSIVE_390
PASS / FAIL / NOT_RUN

RESPONSIVE_768
PASS / FAIL / NOT_RUN

RESPONSIVE_1024
PASS / FAIL / NOT_RUN

RESPONSIVE_1440
PASS / FAIL / NOT_RUN

MIGRATION_CREATED
true

REMOTE_DATABASE_MODIFIED
false

PHASE_7_SOURCE_GATE
PASS_CODE_ONLY / FAIL

PHASE_7_REMOTE_DATABASE
BLOCKED_NOT_APPLIED

PHASE_7_STRUCTURAL_GATE
NOT_RUN

PHASE_7_TWO_USER_RLS
NOT_RUN

PHASE_7_LIVE_PERSISTENCE_SMOKE
NOT_RUN

PHASE_7_OVERALL
PARTIAL

PHASE_8_AUTHORIZED
false
```

No prose before or after the report.
