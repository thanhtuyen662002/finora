# Finora Phase 7 — Verifier / Provenance Fix

## Mission

Correct the remaining Phase 7 verification-gate defects at authoritative remote SHA:

`8fa0d262dca9041cd08fb9b0a2f5445f18a186f0`

This is still SOURCE / MIGRATION-PREP ONLY.

Do NOT apply the Phase 7 migration to Supabase.
Do NOT modify the remote database.
Do NOT run the structural verifier against remote Supabase.
Do NOT run the runtime RLS verifier against remote Supabase.
Do NOT begin Phase 8.

The current application/migration source is close to acceptable. This pass is intentionally narrow: verifier correctness, truthful recurring projection documentation/labeling, status truthfulness, and exact-head provenance. Do not refactor unrelated application code.

Read first:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/DECISIONS.md`
- `prompts/PHASE_7_BUDGETS_GOALS_RECURRING.md`
- `prompts/PHASE_7_CORRECTIVE.md`
- `prompts/PHASE_7_FINAL_CORRECTIVE.md`

---

## 1. Structural verifier is not accepted yet

`scripts/verify-phase7-db.sql` must be corrected before any owner migration apply.

Known defects at `8fa0d262...` include:

1. Exact column-count checks are wrong:
   - `public.budgets` contract has 10 columns, not 9;
   - `public.goals` contract has 14 columns, not 12;
   - `public.recurring_items` contract has 16 columns, not 14.

2. The goals numeric precision check currently constructs a boolean subquery and then compares that boolean to integer `3`. Rewrite it as a valid boolean check.

3. Trigger verification incorrectly searches trigger names for `handle_updated_at`. The migration creates trigger names `set_budgets_updated_at`, `set_goals_updated_at`, and `set_recurring_items_updated_at`; what must be proven is exactly one non-internal BEFORE UPDATE row trigger per Phase 7 table whose trigger function is `public.handle_updated_at()`.

4. Generic constraint-count checks such as `count(*) >= N` are not sufficient. Verify the actual named/semantic constraints required by the Phase 7 contract using catalog expressions/definitions.

5. Generic existence of a unique/FK is not sufficient. Prove exact ordered local and referenced column sets plus referenced table and `ON DELETE RESTRICT`.

6. Policy verification must prove exact command, authenticated role, and exact ownership semantics for SELECT / INSERT / UPDATE; UPDATE must have both USING and WITH CHECK; no DELETE policy.

7. Grant checks must prove exact table-level and column-level privileges, not only broad absence/presence.

8. View checks must prove `security_invoker=true`, exact text money output, exact authenticated/anon/PUBLIC grants, and required derivation/join semantics.

9. Phase 4–6 non-regression checks must be real catalog/view-definition checks, not generic keyword assertions.

Keep the verifier read-only and fail-closed. Every mandatory check must feed `99_OVERALL`.

Do not merely change expected numbers until the file passes superficial inspection; make the checks semantically correct.

---

## 2. Runtime verifier must match the live schema it will test

`scripts/verify-phase7-rls.mjs` is not accepted yet.

Known defects at `8fa0d262...` include:

1. Reference `accounts` / `categories` inserts omit required `user_id`. Use the authenticated user's actual ID as required by the established Phase 3 mutation/RLS contract.

2. The Phase 4 transaction test uses `occurred_at`, but the authoritative transaction schema uses `occurred_on DATE`.

3. The transaction test omits required `merchant TEXT NOT NULL`.

4. The verifier must use only fields/allowlists that actually exist in accepted Phase 3–5 schemas.

5. Preserve missing-credential fail-closed exit 1.

6. Ensure User B receives an independent complete Budget/Goal/Recurring lifecycle, not only authentication/cross-read checks.

7. Ensure bidirectional A->B and B->A coverage for spoofed inserts, foreign references, SELECT, UPDATE, ownership mutation and Phase 7 view isolation.

8. Implement the complete domain/integrity rejection matrix from the Phase 7 contract.

9. Include Phase 4 exact transaction read/account-balance effect + void/restore regression using `transaction_details` and `account_balances`.

10. Include a real same-currency Phase 5 transfer lifecycle/neutrality regression and prove transfers do not affect budget spent.

11. Include deliberate unrelated DB error distinction.

12. Include deterministic fail-closed cleanup using allowed archive/void mutations and assert final states. Do not swallow cleanup failures.

13. Never use service role and never print secrets.

At this source-only gate run only `node --check scripts/verify-phase7-rls.mjs`; do not execute it against remote Supabase yet.

---

## 3. Source verifier must detect verifier regressions

Harden `scripts/verify-phase7-source.mjs` so the currently audited verifier defects would fail source verification.

At minimum verify statically that:

- structural verifier uses correct exact Phase 7 column cardinalities;
- structural verifier verifies trigger function identity rather than requiring trigger names to contain `handle_updated_at`;
- structural verifier contains exact constraint/FK/policy/grant/view/non-regression checks;
- runtime verifier uses `occurred_on`, not `occurred_at`;
- runtime transaction creation supplies required `merchant`;
- runtime reference row creation supplies authenticated ownership `user_id` where required;
- runtime verifier contains User B lifecycle, bidirectional isolation, transfer regression, domain rejection matrix, deliberate non-RLS error case and cleanup assertions;
- missing runtime credentials fail non-zero;
- Phase 8 remains unauthorized.

Do not claim dynamic DB/runtime verification from this source verifier.

---

## 4. Recurring monthly-equivalent projection contract

Current Recurring code retains a deterministic monthly-equivalent projection:

- MONTHLY: amount unchanged;
- WEEKLY: `amount * 52 / 12` using scaled BigInt integer division;
- YEARLY: `amount / 12` using scaled BigInt integer division.

If this projection is retained, complete the original contract requirement:

1. `docs/DECISIONS.md` ADR-012 must explicitly document these assumptions and the truncation behavior caused by integer division at 4-decimal scale.
2. Recurring UI must clearly label the cards as **projection / monthly equivalent**, not actual realized monthly income/expense.
3. UI must include a short truthful note that weekly/yearly schedules are normalized for planning only and no transaction is automatically posted.
4. Source verifier must check the presence of the projection labeling/documentation if `computeMonthlyProjectedAmount` remains in authoritative source.

Alternatively, remove the monthly-equivalent summary and group by actual frequency. Do not broaden scope beyond one of these two contract-compliant approaches.

---

## 5. Project status must remain truthful

Until this verifier/provenance fix is independently accepted, `docs/PROJECT_STATUS.md` must not imply the owner should already apply the migration.

Required final state after this pass, if all source gates pass:

```text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_7_STRUCTURAL_GATE=NOT_RUN
PHASE_7_TWO_USER_RLS=NOT_RUN
PHASE_7_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_7_OVERALL=PARTIAL
PHASE_8_AUTHORIZED=false
```

Next recommended action may say: independent exact-remote audit, then owner migration apply only after approval.

---

## 6. Exact-head verification

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

Do not execute `verify-phase7-db.sql` against remote Supabase.
Do not execute `verify-phase7-rls.mjs` against remote Supabase.

Then:

1. commit the narrow corrective changes;
2. push `main`;
3. `git fetch origin`;
4. require local HEAD == actual `origin/main`;
5. require clean worktree;
6. the exact same final SHA must be the revision that passed every source command;
7. record the actual blob SHAs for migration, structural verifier and runtime verifier.

The migration should remain unchanged unless a concrete migration defect is discovered. If it changes, explain exactly why and report the new blob SHA.

---

## 7. Required report

Return EXACTLY:

```text
TASK
Finora Phase 7 — Verifier / Provenance Fix

STATUS
PASS_CODE_ONLY / FAIL / BLOCKED

BASE_SHA
8fa0d262dca9041cd08fb9b0a2f5445f18a186f0

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

MIGRATION_CHANGED_IN_THIS_FIX
true / false

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
