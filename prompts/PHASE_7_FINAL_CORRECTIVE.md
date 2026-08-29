# Finora Phase 7 — Final Corrective Gate

## Mission

Correct the remaining Phase 7 source/migration-prep defects at remote SHA:

`736d751693281ad332eaa24739309b2fecc901d3`

This is still SOURCE / MIGRATION-PREP ONLY.

Do NOT apply the Phase 7 migration to Supabase.
Do NOT modify the remote database.
Do NOT run the structural verifier against remote Supabase.
Do NOT run the runtime RLS verifier against remote Supabase.
Do NOT begin Phase 8.

Read first:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `prompts/PHASE_7_BUDGETS_GOALS_RECURRING.md`
- `prompts/PHASE_7_CORRECTIVE.md`

Preserve all accepted Phase 2–6 behavior.

---

## 1. Audit discrepancy that MUST be resolved

The previous corrective report claimed several files were hardened, but the actual commit diff from `316749e7...` to `736d7516...` shows these required files were NOT changed:

- `scripts/verify-phase7-db.sql`
- `scripts/verify-phase7-rls.mjs`
- `src/features/goals/goals.ts`
- `src/types/database.ts`
- `docs/PROJECT_STATUS.md`

The repository, not the report, is authoritative.

Do not report a file as changed unless it actually differs in the final Git commit.

---

## 2. Structural verifier MUST be rewritten completely

Current `scripts/verify-phase7-db.sql` still has only 12 checks. That is unacceptable.

Rewrite it into a strict, read-only, fail-closed verifier that individually proves ALL mandatory Phase 7 database requirements from the original contract.

At minimum create separately named checks for:

### Tables / columns
- budgets/goals/recurring_items existence;
- exact required columns;
- nullability/defaults;
- `numeric(20,4)` money precision/scale;
- absence of FX columns;
- absence of persisted budget spent/remaining/progress;
- absence of recurring `next_due_date`.

### Constraints / keys / FKs
- budget positive amount;
- budget EXPENSE-only category type;
- budget currency regex;
- budget first-day-of-month constraint;
- budget unique `(user_id,category_id,currency_code,period_month)`;
- goal name/domain constraints;
- goal positive/non-negative money constraints;
- goal currency/text-length constraints;
- recurring positive amount/type/frequency/currency/name/note/date constraints;
- exact ownership-safe composite FKs;
- RESTRICT delete actions.

### Triggers
- exactly one `handle_updated_at()` trigger for each new table.

### RLS / policies
- RLS enabled on all 3;
- exactly 3 policies per table / 9 total;
- role is authenticated;
- exact SELECT/INSERT/UPDATE commands;
- exact `(SELECT auth.uid()) = user_id` ownership semantics;
- UPDATE has both USING and WITH CHECK;
- no DELETE policy.

### Grants
- anon and PUBLIC: no table/column privileges;
- authenticated table-level SELECT only;
- exact INSERT column allowlists;
- exact UPDATE column allowlists;
- no DELETE;
- id/user_id/created_at/updated_at immutable as required;
- server-generated identity/timestamps not insertable.

### Views
- budget_progress / goal_details / recurring_details exist;
- all have `security_invoker=true`;
- all authoritative money outputs are PostgreSQL text;
- budget_progress spent derives only active matching EXPENSE transactions by exact user/category/currency/month;
- budget_progress category ownership/type join semantics;
- recurring_details account ownership/currency join semantics;
- recurring_details category ownership/type join semantics;
- authenticated SELECT only; anon/PUBLIC none.

### Phase 4–6 non-regression
- transactions RLS + 3 policies + no DELETE;
- transfers RLS + 3 policies + no DELETE;
- transaction_details security_invoker + amount text;
- transfer_details security_invoker + amount text;
- account_balances security_invoker + current_balance text;
- account_balances still proves opening + transaction net + incoming - outgoing with active-only semantics;
- no persisted `accounts.current_balance`;
- RLS remains enabled across Phase 2–7 owned tables.

`99_OVERALL` must include every mandatory check and FAIL if any mandatory check fails.

Do not weaken checks to generic keyword existence.

---

## 3. Runtime verifier MUST be rewritten completely

Current `scripts/verify-phase7-rls.mjs` is still the old minimal goal-only smoke and exits 0 when credentials are absent.

Replace it completely with the runtime contract from section 18 of the original Phase 7 prompt.

Mandatory behavior:

- missing URL/key/A/B credentials => non-zero failure when runtime verifier is actually run;
- schema readiness for all Phase 7 tables/views;
- User A full Budget lifecycle including real EXPENSE spent derivation + void/restore + archive/unarchive;
- User A full Goal lifecycle including exact values, edit, overfunded current amount, archive/unarchive;
- User A full Recurring lifecycle including create/edit/pause/resume/archive/unarchive exact readback;
- equivalent independent User B lifecycle;
- bidirectional A->B and B->A spoof/reference/select/update/ownership/view isolation;
- complete budget/goal/recurring domain rejection matrix from original contract;
- Phase 4 transaction exact read + account balance effect/reversal;
- Goal and Recurring neutrality to balance/report totals;
- Phase 5 transfer neutrality and transfer exclusion from budget spent;
- deliberate unrelated DB error distinction;
- fail-closed archive/void cleanup with asserted final states;
- mandatory failure => process exit 1;
- never use service-role credentials.

At source gate, only run `node --check scripts/verify-phase7-rls.mjs`.

---

## 4. Source verifier MUST reject the currently-audited defects

Harden `scripts/verify-phase7-source.mjs` so the current SHA `736d7516...` would FAIL.

It must explicitly reject/prove:

- structural verifier remaining at only 12 shallow checks;
- runtime verifier remaining goal-only/minimal;
- runtime verifier `process.exit(0)` on missing credentials;
- hard-coded Budget current-period state such as `'2026-08-01'`;
- authoritative `COMMON_CURRENCIES` injection / fabricated selectable currencies;
- raw base-currency injection when the base currency is absent from non-empty real financial currencies;
- swallowed required-reference/settings failures such as `getAccounts().catch(() => [])` / `getCategories().catch(() => [])` in authoritative Phase 7 loading paths;
- browser-local `getTodayISODate()` used as the authoritative current date for new Recurring scheduling;
- stale planning data visible under a newly selected currency/month while a new request is loading;
- archived accounts/categories selectable for creation;
- missing persisted edit/archive/unarchive/pause/resume wiring;
- Goal mutation boundary missing strict category/icon/color length validation;
- Goal target_date accepting invalid calendar dates;
- recurring anchor/end dates accepting invalid calendar dates;
- mixed WEEKLY/MONTHLY/YEARLY schedules presented as actual monthly income/expense via an undocumented monthly-equivalent conversion;
- mock/float fallbacks in authoritative Phase 7 components;
- Phase 8 authorization or FX semantics.

Keep executable regression tests on the actual recurrence helper.

Do not claim dynamic runtime coverage for checks that are only static source inspection.

---

## 5. Currency/default semantics MUST match accepted Phase 6 behavior

Budget, Goals, and Recurring must not initialize authoritative state by fabricating VND/common currency options.

Required semantics:

1. Determine the actual available financial/planning currency set from real persisted user data relevant to the page.
2. If that set is non-empty:
   - select `user_settings.base_currency` only if it is actually present;
   - otherwise select a deterministic first real currency.
3. If there is no real currency data at all, base_currency alone may be used as the initial creation/display currency.
4. Do not inject all `COMMON_CURRENCIES` into the authoritative selector.
5. Never cross-sum currencies.

Changing currency/month must synchronously invalidate or block the prior authoritative planning data before the new controls can render with stale totals.

---

## 6. Required service/UI corrections

### Budget
- remove hard-coded `'2026-08-01'` authoritative state;
- configured-timezone current month only;
- month navigation retained;
- active EXPENSE category creation choices only (`is_archived=false`);
- fail closed if settings/accounts/categories required for the page fail to load;
- persisted create/edit/archive/unarchive retained;
- exact over-budget semantics retained;
- `normalizePeriodMonth` strictly rejects invalid calendar month/date input.

### Goals
- update `src/features/goals/goals.ts` in this corrective commit;
- validate category trimmed length 1..100;
- icon trimmed length 1..100;
- color trimmed length 1..32;
- validate non-null target_date as a real ISO calendar date;
- apply validations on both create and update boundaries;
- persisted edit/contribution/archive/unarchive retained;
- fail closed on required data/settings errors;
- real currency semantics from section 5.

### Recurring
- required account/category/settings queries must fail closed; do not swallow them into empty arrays;
- creation uses active accounts/categories only;
- account currency locks recurring currency;
- changing type invalidates incompatible category;
- current/anchor default date must come from configured user timezone, passed explicitly into modal/service rather than browser-local default;
- validate anchor/end dates as real ISO dates in create/update boundaries;
- persisted edit/pause/resume/archive/unarchive retained;
- historical archived references may render for existing items;
- remove actual-monthly presentation of mixed frequencies. Preferred: summarize by actual frequency. If a monthly-equivalent projection is retained, label every displayed figure explicitly as a projection and document exact assumptions/rounding in ADR + UI; it must never be labeled as actual monthly income/expense.

---

## 7. Migration

Migration is still unapplied and may be corrected in-place if needed.

Preserve the already-improved ownership-aware view joins.

Do not add FX.
Do not change Phase 4/5 balance/report semantics.

If migration changes, final report must return the new migration blob SHA.

---

## 8. Project status

Update `docs/PROJECT_STATUS.md` truthfully in the final corrective commit.

Required state:

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_7_STRUCTURAL_GATE=NOT_RUN
PHASE_7_TWO_USER_RLS=NOT_RUN
PHASE_7_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

Do not recommend applying migration until the exact remote corrective SHA is independently audited.

---

## 9. Final exact-head verification

At the FINAL revision run:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase7-source.mjs
node scripts/verify-phase7-source.mjs
node --check scripts/verify-phase7-rls.mjs
git diff --check
```

Perform the original Phase 7 money/mock/FX semantic scan.

Then commit and push `main`, fetch actual `origin/main`, and require:

- local HEAD == actual origin/main;
- worktree clean;
- the exact same SHA is the revision that passed all commands.

Do NOT apply migration.

---

## 10. Required final report

Return EXACTLY:

```text
TASK
Finora Phase 7 — Final Corrective Source / Migration Prep

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
736d751693281ad332eaa24739309b2fecc901d3

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

MIGRATION_PATH
supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql

MIGRATION_BLOB_SHA
<sha>

STRUCTURAL_VERIFIER_BLOB_SHA
<sha>

RUNTIME_VERIFIER_BLOB_SHA
<sha>

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

No prose before or after this report.
