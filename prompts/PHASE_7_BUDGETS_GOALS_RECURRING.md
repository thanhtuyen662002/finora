# Finora Phase 7 — Budgets + Goals + Recurring

## Mission

Implement the first real persisted planning layer for Finora:

1. monthly category budgets;
2. financial goals;
3. recurring income/expense schedules.

Phase 7 begins only after accepted Phase 6 closure. Preserve all Phase 2–6 behavior and receipts.

This phase **DOES require a new Supabase migration**, but the implementation/source gate is completed **before** the owner applies that migration to the remote database.

Do NOT begin Phase 8 FX.

---

## 0. Authoritative baseline and workflow

Start from actual remote `main` and require the workspace to match it before coding.

Expected Phase 6 closure baseline when this contract is created:

`4d3c3215f4d5f3f6ee4f221d4f77108c2f518d3b`

Read before implementation:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DATABASE.md`
- accepted Phase 3–6 migrations/features/verifiers/receipts
- current Budget, Goals, and Recurring mock UI

Workflow:

`READ -> UNDERSTAND -> PLAN -> IMPLEMENT -> VERIFY -> UPDATE DOCUMENTATION -> REPORT`

At the source gate:

- create the migration in source control;
- do **not** apply it to Supabase;
- do **not** modify the remote database;
- Phase 8 remains unauthorized.

---

# 1. Non-negotiable Phase 7 architecture

## 1.1 Deterministic finance remains authoritative

LLMs have no role in Phase 7 calculations.

All authoritative money values remain PostgreSQL `numeric(20,4)` at rest and exact decimal strings at the application boundary.

Do not use `Number()`, `parseFloat()`, `parseInt()`, unary `+`, implicit numeric coercion, or ordinary JS floating-point arithmetic for authoritative monetary values, totals, limits, goal progress, recurring amounts, or budget spent calculations.

Presentation-only ratios may use bounded integers such as basis points after exact arithmetic.

## 1.2 Pre-FX currency isolation remains mandatory

Phase 8 FX does not exist.

Therefore:

- never sum VND + USD + EUR + other currencies;
- Budget summaries must be currency-scoped or grouped by currency;
- Goal summaries must be currency-scoped or grouped by currency;
- Recurring summaries must be currency-scoped or grouped by currency;
- `user_settings.base_currency` may determine a default selector only according to the accepted Phase 6 default-currency semantics;
- do not manufacture converted/base-currency amounts;
- do not add exchange-rate columns.

## 1.3 Phase 7 planning records must not mutate net worth

Budgets, goals, and recurring schedules are planning/metadata records.

They must not alter:

- `accounts.opening_balance`;
- `account_balances`;
- transaction income/expense totals;
- transfer neutrality;
- Phase 6 Dashboard/Reports totals.

A Goal `current_amount` is a manually tracked goal-progress value, not another financial account and not additional net worth.

A Recurring item is a schedule/template only in Phase 7. It must **not automatically create transactions** and must not count as income/expense until a real transaction exists in `public.transactions`.

Do not add background jobs, cron, queues, auto-deduction, auto-posting, or transaction generation in this phase.

---

# 2. Required migration

Create exactly one new migration:

`supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql`

The migration must be atomic (`BEGIN; ... COMMIT;`) and idempotent only to the extent consistent with existing Finora migration style. Do not weaken structural verification merely to accommodate partial schemas.

Create the following user-owned tables.

---

# 3. `public.budgets`

Monthly category budgets are real persisted records.

Required columns:

```text
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL
category_id UUID NOT NULL
category_type TEXT NOT NULL DEFAULT 'EXPENSE'
limit_amount NUMERIC(20,4) NOT NULL
currency_code TEXT NOT NULL
period_month DATE NOT NULL
is_archived BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Required invariants:

- `limit_amount > 0`;
- `category_type = 'EXPENSE'` exactly;
- `currency_code ~ '^[A-Z]{3,5}$'`;
- `period_month` must be the first day of its calendar month;
- one budget record per `(user_id, category_id, currency_code, period_month)`;
- budget categories must belong to the same user and must be EXPENSE categories.

Use the already-established ownership-safe category key:

```text
(category_id, user_id, category_type)
  -> categories(id, user_id, type)
```

with `ON DELETE RESTRICT`.

Do not persist `spent_amount`, `remaining_amount`, progress %, or converted amounts in the table.

`spent_amount` is derived from active `EXPENSE` transactions for the exact:

- user;
- category;
- currency;
- calendar month.

Voided transactions must never count toward budget spent.

Transfers must never count toward budget spent.

Archived budgets remain historical records but are excluded from the default active Budget UI.

---

# 4. `public.goals`

Required columns:

```text
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL
name TEXT NOT NULL
target_amount NUMERIC(20,4) NOT NULL
current_amount NUMERIC(20,4) NOT NULL DEFAULT 0
monthly_contribution NUMERIC(20,4) NOT NULL DEFAULT 0
currency_code TEXT NOT NULL
target_date DATE NULL
category TEXT NOT NULL DEFAULT 'OTHER'
icon TEXT NOT NULL DEFAULT 'Target'
color TEXT NOT NULL DEFAULT '#10b981'
is_archived BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Required invariants:

- trimmed `name` length 1..200;
- `target_amount > 0`;
- `current_amount >= 0`;
- `monthly_contribution >= 0`;
- `currency_code ~ '^[A-Z]{3,5}$'`;
- category length 1..100;
- icon length 1..100;
- color length 1..32;
- no cross-user ownership mutation;
- no hard delete from authenticated clients.

Do **not** require `current_amount <= target_amount`; users may deliberately record overfunded goals.

Goal completion/progress must be derived from exact amounts. Do not persist a percentage or completion flag solely for derived state.

Goal totals must never be aggregated across currencies.

---

# 5. `public.recurring_items`

Phase 7 Recurring is a persisted schedule/template, not an auto-posting engine.

Required columns:

```text
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL
account_id UUID NOT NULL
category_id UUID NOT NULL
transaction_type TEXT NOT NULL
name TEXT NOT NULL
amount NUMERIC(20,4) NOT NULL
currency_code TEXT NOT NULL
frequency TEXT NOT NULL
anchor_date DATE NOT NULL
end_date DATE NULL
note TEXT NULL
is_paused BOOLEAN NOT NULL DEFAULT FALSE
is_archived BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Required invariants:

- `transaction_type IN ('INCOME','EXPENSE')`;
- `amount > 0`;
- `currency_code ~ '^[A-Z]{3,5}$'`;
- `frequency IN ('WEEKLY','MONTHLY','YEARLY')`;
- trimmed `name` length 1..200;
- note NULL or length <= 1000;
- `end_date IS NULL OR end_date >= anchor_date`;
- account belongs to same user and exact currency;
- category belongs to same user and exact transaction type;
- no hard delete for authenticated clients.

Use ownership-safe composite foreign keys:

```text
(account_id, user_id, currency_code)
  -> accounts(id, user_id, currency_code)

(category_id, user_id, transaction_type)
  -> categories(id, user_id, type)
```

with `ON DELETE RESTRICT`.

Do not persist `next_due_date` in Phase 7. It is derived deterministically from `anchor_date`, `frequency`, the current user-local calendar date, and optional `end_date`.

Required recurrence semantics:

- WEEKLY: every 7 calendar days from anchor;
- MONTHLY: same anchor day-of-month; when a month is shorter, clamp to that month's final calendar day;
- YEARLY: same month/day; a Feb-29 anchor clamps to Feb-28 in non-leap years;
- derive the first due date on or after the current user-local calendar date;
- if `end_date` exists and the next derived due date would be later than it, next due is unavailable/ended;
- paused/archived records do not contribute to active recurring summaries;
- the configured timezone must use the accepted Phase 6 strict semantics: missing setting may fall back to `Asia/Ho_Chi_Minh`; invalid non-empty configured timezone fails closed.

Do not use timestamp arithmetic that accidentally changes the intended local calendar date.

---

# 6. Updated-at triggers

Use the existing trusted `public.handle_updated_at()` function for all three new tables.

Create exactly one updated-at trigger per new table.

Do not create SECURITY DEFINER helpers unless absolutely necessary. If any are introduced, they must follow existing hardening requirements (`search_path = ''`, explicit schema qualification, client EXECUTE revoked) and the structural verifier must prove those properties.

---

# 7. RLS ownership policies

Enable RLS on all three new tables.

For each table, implement exactly the established authenticated ownership policy model:

- SELECT own rows;
- INSERT own rows;
- UPDATE own rows with both `USING` and `WITH CHECK`;
- no DELETE policy.

Use the established predicate form based on `(SELECT auth.uid()) = user_id`.

No `auth.role()` checks.
No metadata-based ownership.
No service-role use in browser code.

Expected total Phase 7 table policies: **9**.

---

# 8. Least-privilege grants

Explicitly revoke default privileges from `anon`, `PUBLIC`, and `authenticated`, then grant only what the application needs.

For each new table:

- authenticated table-level SELECT only;
- exact INSERT column allowlist;
- exact UPDATE column allowlist;
- no DELETE;
- immutable `id`, `user_id`, `created_at`, and trigger-managed `updated_at` must not be client-updatable;
- client must not insert identity/timestamp fields that should be server-generated;
- do not expose service-role secrets anywhere in source.

Recommended exact mutation allowlists:

### budgets INSERT

```text
user_id, category_id, category_type, limit_amount, currency_code, period_month
```

### budgets UPDATE

```text
category_id, category_type, limit_amount, currency_code, period_month, is_archived
```

### goals INSERT

```text
user_id, name, target_amount, current_amount, monthly_contribution,
currency_code, target_date, category, icon, color
```

### goals UPDATE

```text
name, target_amount, current_amount, monthly_contribution,
currency_code, target_date, category, icon, color, is_archived
```

### recurring_items INSERT

```text
user_id, account_id, category_id, transaction_type, name, amount,
currency_code, frequency, anchor_date, end_date, note
```

### recurring_items UPDATE

```text
account_id, category_id, transaction_type, name, amount, currency_code,
frequency, anchor_date, end_date, note, is_paused, is_archived
```

If implementation requires any deviation, document and justify it; do not silently broaden privileges.

---

# 9. Required security-invoker exact-money views

All authoritative money reads in the Phase 7 application must cross an exact string boundary.

Create these views with `security_invoker = true`.

## 9.1 `public.budget_progress`

Expose enough fields to render persisted budget records plus category metadata and exact derived spent values.

At minimum:

```text
id
user_id
category_id
category_name
category_icon
category_color
limit_amount TEXT
spent_amount TEXT
currency_code
period_month
is_archived
created_at
updated_at
```

`spent_amount` must derive only active matching EXPENSE transactions and must be cast to text.

`limit_amount` must be cast to text.

Do not introduce a Cartesian multiplication path.

Do not compute cross-currency totals in the view.

## 9.2 `public.goal_details`

At minimum expose:

```text
id
user_id
name
target_amount TEXT
current_amount TEXT
monthly_contribution TEXT
currency_code
target_date
category
icon
color
is_archived
created_at
updated_at
```

All three monetary columns must be text.

## 9.3 `public.recurring_details`

At minimum expose:

```text
id
user_id
account_id
account_name
account_color
category_id
category_name
category_icon
category_color
transaction_type
name
amount TEXT
currency_code
frequency
anchor_date
end_date
note
is_paused
is_archived
created_at
updated_at
```

`amount` must be text.

View access:

- revoke from anon/PUBLIC;
- authenticated SELECT only;
- preserve only the trusted Postgres/service role capabilities expected by Supabase;
- structural verifier must prove `security_invoker=true` and exact authenticated/anon/PUBLIC behavior.

Because the views are security invoker, authenticated users must still have the underlying SELECT grants needed for RLS enforcement.

---

# 10. Application feature modules

Create/complete dedicated feature modules under:

```text
src/features/budgets/
src/features/goals/
src/features/recurring/
```

Use typed public boundaries. Avoid `as any` in authoritative mutation/read paths.

All monetary mutation inputs are strings.

Normalize/validate money before Supabase writes using existing exact-money utilities. Reject invalid syntax, non-positive values where required, negative goal progress/contribution, and more than 4 fractional digits. Do not silently round/truncate.

Required Budget operations:

- list/read from `budget_progress`;
- create;
- edit;
- archive;
- unarchive;
- exact readback after mutation through `budget_progress`;
- fail closed if authoritative view read fails.

Required Goal operations:

- list/read from `goal_details`;
- create;
- edit, including manual current progress;
- archive;
- unarchive;
- exact readback after mutation through `goal_details`;
- fail closed on authoritative view errors.

Required Recurring operations:

- list/read from `recurring_details`;
- create;
- edit;
- pause/resume;
- archive/unarchive;
- exact readback after mutation through `recurring_details`;
- deterministic next-due derivation helper;
- fail closed on authoritative view/errors.

Do not implement delete.

---

# 11. Selection integrity rules

For creation UI:

- Budget may select only active EXPENSE categories;
- Recurring may select only active accounts and active categories matching its transaction type;
- Recurring account currency determines/locks recurring currency;
- changing recurring type must invalidate an incompatible category selection;
- archived references must not be silently selected for new records.

For editing an existing historical record:

- preserve its currently referenced archived category/account long enough to render and edit truthfully;
- do not silently replace an archived historical reference with a different active reference;
- switching to a new reference must use an active compatible record.

Budget's historical archived category may still render through the view.

---

# 12. Budget UI requirements

Replace `MOCK_BUDGETS` entirely from the authoritative Budget page.

Remove the hard-coded August 2026 copy.

Required behavior:

- dynamic user-timezone month;
- current month is default;
- provide a truthful selected-month control/navigation sufficient to inspect other months;
- currency selector follows accepted Phase 6 real-currency/default semantics;
- no cross-currency aggregate;
- per-category budget limit/spent/remaining uses exact money;
- overall selected-currency limit/spent/remaining uses exact arithmetic;
- progress ratio uses exact arithmetic -> bounded presentation basis points/percent;
- over-budget detection uses exact comparison;
- active budgets default view; archived/history access may be a filter/toggle;
- create/edit/archive/unarchive are real persisted actions;
- loading/error states fail closed;
- empty state is truthful;
- transaction changes must be reflected after refresh/navigation because `spent_amount` derives from real transactions.

Budget progress must use transaction `occurred_on` calendar month; transfers do not count.

---

# 13. Goals UI requirements

Replace `MOCK_GOALS` entirely.

Required behavior:

- real persisted goals;
- selected-currency or grouped-by-currency totals only;
- no VND-only assumptions;
- exact target/current/monthly contribution values;
- progress percentage derived using exact arithmetic;
- create/edit current amount/archive/unarchive;
- goal status such as completed/on-track must not make unsupported promises;
- do not claim "will finish on time" unless backed by a deterministic calculation with truthful assumptions;
- if target-date/monthly-contribution forecast is shown, label it as a simple deterministic projection and handle zero contribution / past date / overfunded cases correctly;
- Goals do not alter Dashboard net worth or transaction reports;
- fail-closed loading/error state;
- no mock values after load errors.

---

# 14. Recurring UI requirements

Replace `MOCK_RECURRING` entirely and remove the mock `alert()` add action.

Required behavior:

- real create/edit/pause/resume/archive/unarchive;
- currency-isolated summary;
- do not call all schedules "monthly" when WEEKLY/YEARLY exist;
- do not manufacture a monthly equivalent from mixed frequencies unless a deterministic documented conversion is explicitly implemented; preferred Phase 7 UI is to group/summarize by frequency;
- show deterministic next due date derived from schedule rather than a persisted stale date;
- active/paused/ended status must be truthful;
- no auto-deduct or auto-post claims;
- recurring item amount is planning only and must not affect reports until a transaction exists;
- use configured timezone with accepted strict validation semantics;
- fail closed on read/settings errors.

If a "Create transaction" convenience action is implemented, it must require explicit user confirmation and create an ordinary Phase 4 transaction through the existing transaction mutation boundary. It is optional for Phase 7 and must not create any automatic schedule execution semantics.

---

# 15. Phase 6 and earlier non-regression

Do not change authoritative Phase 4/5 finance semantics merely to implement Phase 7.

Required preserved invariants:

- `transactions.type` remains only INCOME/EXPENSE;
- transfers remain separate;
- `transaction_details` exact text amount remains intact;
- `transfer_details` exact text amount remains intact;
- `account_balances` exact text and formula remain intact;
- transfers remain net-worth neutral;
- Dashboard/Reports remain pre-FX currency isolated;
- Phase 6 period/timezone/CSV semantics remain intact;
- no persisted `accounts.current_balance`;
- no FX fields/tables/rates in Phase 7.

Do not make Budget/Goal/Recurring rows part of Dashboard income/expense/net-worth formulas.

---

# 16. Type definitions

Update `src/types/database.ts` and feature-level types so Phase 7 uses exact string money at public application boundaries.

Do not propagate the Phase 1 `MockBudget`, `MockGoal`, `MockRecurringItem` numeric model into authoritative Phase 7 feature code.

Mock types/files may remain only if still needed by non-authoritative Phase 1 preview code elsewhere; authoritative Phase 7 pages must not import them.

Do not broaden the old mock `TransactionType='TRANSFER'` pattern into real transaction code.

---

# 17. Required structural verifier

Create:

`scripts/verify-phase7-db.sql`

It must be **read-only**, deterministic, and fail closed.

It must verify at minimum:

### Tables / columns

- all 3 Phase 7 tables exist;
- required columns, nullability/defaults;
- money columns are exact `numeric(20,4)`;
- no Phase 7 FX columns;
- no persisted budget spent/remaining/progress columns;
- no persisted recurring `next_due_date`.

### Constraints / FKs

- exact amount domain checks;
- currency regex checks;
- budget first-day-of-month check;
- budget EXPENSE-only category contract;
- budget unique key;
- goal text/domain checks;
- recurring type/frequency/end-date checks;
- exact ownership-safe composite FKs and RESTRICT actions.

### Triggers

- one `handle_updated_at()` trigger on each new table.

### RLS / policies

- RLS enabled on all 3;
- exactly 9 authenticated policies total for the 3 tables;
- SELECT/INSERT/UPDATE ownership semantics exact;
- UPDATE has `USING` + `WITH CHECK`;
- no DELETE policies.

### Grants

- anon/PUBLIC have no table or column privileges;
- authenticated table SELECT only;
- exact INSERT/UPDATE allowlists;
- immutable identity/ownership/timestamp fields blocked;
- DELETE blocked.

### Views

- `budget_progress`, `goal_details`, `recurring_details` exist;
- all 3 are `security_invoker=true`;
- all authoritative money outputs are text;
- budget spent is derived from active EXPENSE transactions only and scoped by category/currency/month;
- views have exact authenticated SELECT and no anon/PUBLIC access.

### Non-regression

Prove the accepted Phase 4/5 table/view/RLS/privilege core remains intact, including:

- transactions RLS + 3 policies + no delete policy;
- transfers RLS + 3 policies + no delete policy;
- transaction/transfer exact-money views;
- `account_balances` security invoker and text current_balance;
- account balance derivation still contains transaction + incoming transfer - outgoing transfer semantics and active-only filters;
- no persisted accounts.current_balance;
- RLS remains enabled on Phase 2–7 user-owned tables.

Return individually named PASS/FAIL checks plus one `99_OVERALL` row. `99_OVERALL` must count every mandatory check and return FAIL if any check fails.

Do not write or mutate database state from this verifier.

---

# 18. Required two-user runtime verifier

Create:

`scripts/verify-phase7-rls.mjs`

Use only:

- public Supabase URL;
- publishable/anon key;
- disposable User A credentials;
- disposable User B credentials.

Never use service role.
Never print passwords/secrets.

The verifier is executed **only after** the owner applies the migration and structural verifier passes.

Required runtime coverage:

## 18.1 Schema readiness

Fail clearly if any Phase 7 table/view is absent.

## 18.2 User A full lifecycle

Budgets:
- create exact amount;
- exact view readback;
- edit;
- derive spent from a real test EXPENSE transaction;
- void transaction -> spent reverses;
- restore -> spent reapplies;
- archive/unarchive.

Goals:
- create exact target/current/monthly values;
- edit exact values;
- allow overfunded current_amount;
- archive/unarchive;
- exact view readback.

Recurring:
- create;
- edit;
- pause/resume;
- archive/unarchive;
- exact amount view readback;
- next-due helper regression cases run locally in the verifier or a source verifier.

## 18.3 User B full lifecycle

Run equivalent independent Budget/Goal/Recurring create/edit/archive-state lifecycle for User B.

## 18.4 Bidirectional cross-user isolation

For both A->B and B->A, prove blocked/isolated behavior for relevant cases:

- spoofed `user_id` inserts;
- budget referencing other user's category;
- recurring referencing other user's account;
- recurring referencing other user's category;
- cross-user SELECT;
- cross-user UPDATE;
- ownership mutation;
- Phase 7 view isolation.

## 18.5 Domain/integrity rejection matrix

At minimum reject:

Budgets:
- zero limit;
- negative limit;
- lowercase/invalid currency;
- non-first-day period_month;
- INCOME category;
- duplicate same user/category/currency/month;
- DELETE.

Goals:
- zero/negative target;
- negative current amount;
- negative monthly contribution;
- blank/too-long name;
- invalid/lowercase currency;
- DELETE.

Recurring:
- zero/negative amount;
- invalid transaction type;
- invalid frequency;
- lowercase/invalid currency;
- end_date before anchor;
- account/currency mismatch;
- category/type mismatch;
- nonexistent references;
- DELETE.

## 18.6 Phase 4–6 non-regression

Create/void/restore a normal exact transaction and confirm:

- `transaction_details` exact text read;
- `account_balances` exact effect/reversal;
- budget spent follows only active matching expense transaction;
- Goal/Recurring records do not change account balance or report transaction totals.

Create/void/restore same-currency transfer and confirm Phase 5 balance neutrality remains intact and it does not affect budget spent.

## 18.7 Deliberate non-RLS error distinction

Include a deliberate invalid database operation proving the verifier can distinguish expected RLS denial from unrelated database errors.

## 18.8 Fail-closed cleanup

Authenticated clients cannot DELETE test rows. Cleanup must therefore archive/void all verifier-created user-owned records using allowed mutations and assert the resulting archived/voided state.

Do not swallow cleanup errors.

Any mandatory failure => non-zero exit code.

---

# 19. Required source verifier

Create:

`scripts/verify-phase7-source.mjs`

It must inspect the actual authoritative source and fail closed.

Required checks include:

- authoritative pages do not import `MOCK_BUDGETS`, `MOCK_GOALS`, or `MOCK_RECURRING`;
- no mock `alert()` recurring creation;
- no hard-coded August 2026 budget period;
- no authoritative Phase 7 `parseFloat` / `Number` / money `number` mutation paths;
- feature mutation money inputs are string-only;
- reads use exact-money views and fail closed;
- no `as any` in authoritative Phase 7 feature mutation paths;
- no Phase 7 FX fields or conversion helpers;
- budget calculations are currency-scoped and transfer-neutral;
- Goal totals are currency isolated;
- Recurring summary does not blindly label mixed frequencies as monthly totals;
- recurring next-due helper is deterministic and tests monthly short-month and Feb-29 behavior;
- configured timezone invalid non-empty values fail closed;
- Phase 7 does not auto-create transactions;
- migration exists exactly once with expected filename;
- database/runtime verifiers exist;
- Phase 8 remains unauthorized in status docs.

Where deterministic helper regression tests are feasible, test the actual exported helper rather than silently copying a separate implementation. If tooling constraints prevent importing TS directly, be explicit about what is static inspection vs executable helper validation.

Do not claim coverage you do not actually perform.

---

# 20. Source verification gates

Before final source report, run at the final exact revision:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase7-source.mjs
node scripts/verify-phase7-source.mjs
node --check scripts/verify-phase7-rls.mjs
git diff --check
```

Also scan authoritative Phase 7 code for:

```text
parseFloat(
Number(
parseInt(
Math.round(
MOCK_BUDGETS
MOCK_GOALS
MOCK_RECURRING
convertedBalance
exchangeRate
baseAmount
as any
```

Interpret scan results semantically; date parsing/presentation-only integer operations are not automatically money violations, but every hit must be reviewed.

Do not fabricate viewport verification. If responsive UI is actually exercised, test at 390 / 768 / 1024 / 1440 and report truthfully. Otherwise report NOT_RUN.

---

# 21. Documentation

Update truthfully:

- `docs/DATABASE.md`
- `docs/DECISIONS.md` if a durable design decision is introduced;
- `docs/PROJECT_STATUS.md`.

At source gate, PROJECT_STATUS must say Phase 7 is partial and remote DB has not been applied.

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

Do not mark Phase 7 COMPLETE before remote DB + structural + runtime + owner live smoke all pass.

---

# 22. Source-gate Git provenance

After implementation:

1. commit all logical Phase 7 source changes;
2. push to `main`;
3. fetch actual `origin/main` after push;
4. require final local HEAD == actual remote main SHA;
5. require clean worktree;
6. the exact SHA that passed typecheck/lint/build/source verifier must equal actual remote main;
7. record the migration blob SHA in the report;
8. record the runtime verifier blob SHA in the report;
9. do not apply the migration.

If HEAD does not match remote, source gate is not PASS.

---

# 23. Required final implementation report

Return exactly:

```text
TASK
Finora Phase 7 — Budgets + Goals + Recurring

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
<sha>

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

Do not add prose before or after the report.

---

# 24. Owner sequence after source PASS

Do not execute these steps during implementation. They happen only after repository audit accepts the exact source revision.

Expected later gate sequence:

1. owner applies exactly `20260829000000_phase_7_budgets_goals_recurring.sql` in Supabase SQL Editor;
2. owner runs complete latest `scripts/verify-phase7-db.sql`;
3. all mandatory structural checks + `99_OVERALL` must PASS;
4. only then run `node scripts/verify-phase7-rls.mjs` with two disposable users and public credentials;
5. runtime must exit 0;
6. owner runs live Budget/Goals/Recurring persistence smoke;
7. only then close Phase 7 and authorize Phase 8.

No shortcut may mark Phase 7 complete before all gates pass.
