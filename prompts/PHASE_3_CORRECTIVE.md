# FINORA — PHASE 3 CORRECTIVE GATE

## TASK

Correct and finish **Finora Phase 3 — Accounts + Categories** on:

`thanhtuyen662002/finora`

Authoritative defective Phase 3 implementation baseline:

`8ebe887ed1e5aee8416dd084bad74a575b8d082d`

The previous implementation MUST NOT be treated as complete merely because TypeScript/lint/build passed. The remote Phase 3 database migration has not been applied or verified, runtime RLS has not passed, and source audit found mandatory code/database defects.

Do not begin Phase 4.

---

## 1. Mandatory pre-work

1. Fetch/sync `origin/main` and report exact HEAD before editing.
2. Read completely:
   - `AGENTS.md`
   - `docs/PROJECT_STATUS.md`
   - `docs/DATABASE.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `prompts/PHASE_3_ACCOUNTS_CATEGORIES.md`
   - `prompts/PHASE_3_CORRECTIVE.md`
3. Inspect the full Phase 3 implementation, especially:
   - `supabase/migrations/20260828000001_phase_3_accounts_categories.sql`
   - `scripts/verify-phase3-db.sql`
   - `scripts/verify-phase3-rls.mjs`
   - `src/types/database.ts`
   - `src/features/accounts/accounts.ts`
   - `src/features/categories/categories.ts`
   - `src/app/accounts/page.tsx`
   - `src/components/finance/AccountCard.tsx`
   - `src/components/finance/AddAccountModal.tsx`
   - `src/app/settings/categories/page.tsx`
   - `src/components/finance/AddCategoryModal.tsx`
4. Preserve accepted Phase 2 Auth/SSR/RLS behavior.
5. Do not apply the Phase 3 migration remotely until all migration/verifier defects below are fixed and local code verification passes.

---

## 2. Known source-audit defects — all mandatory

### A. Migration contains invalid PostgreSQL `DO` syntax

Current migration ends the backfill block as approximately:

```sql
DO $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

This is invalid PostgreSQL syntax. `DO` supports an optional `LANGUAGE`, but not `SECURITY DEFINER` or function `SET` attributes.

Fix the backfill safely. A normal anonymous block is sufficient because the migration itself executes with migration-owner privileges and all object names inside must be schema-qualified.

Use an atomic migration (`BEGIN` / `COMMIT`) so a failure cannot leave a misleading partially-applied Phase 3 schema.

### B. Default-category seeding must be idempotent and complete

Current backfill only seeds a user when that user has zero categories. That is too weak for the contract.

Requirements:

- `seed_default_categories(p_user_id)` must insert each expected baseline `(type, name)` only when that user does not already have that baseline row;
- calling it more than once must not duplicate defaults;
- backfill must call it for **every existing `auth.users` row**, not only users with zero categories;
- preserve a user's archived default rather than silently re-creating another active duplicate solely because it is archived;
- do not seed `Chuyển tiền`;
- keep exactly the Phase 3 baseline set: 5 INCOME + 7 EXPENSE categories.

Use fully-qualified identifiers in SECURITY DEFINER code and keep `SET search_path = ''`.

Revoke unnecessary direct EXECUTE from `PUBLIC`, `anon`, and `authenticated` for helper SECURITY DEFINER functions. The category seed helper must not become a client privilege-escalation surface.

### C. Structural verifier is not strict enough

Strengthen `scripts/verify-phase3-db.sql`.

The verifier must PASS/FAIL explicitly and final `99_OVERALL` must only PASS when all mandatory checks pass.

At minimum verify:

1. `accounts`, `categories` exist;
2. RLS enabled on both;
3. policies are exact by **table + policy name + command + authenticated role** and no additional policies exist;
4. SELECT/INSERT/UPDATE ownership policies have the expected `auth.uid()`/`user_id` ownership semantics, including UPDATE `WITH CHECK`;
5. no DELETE policy exists;
6. updated-at triggers exist;
7. category provisioning trigger exists;
8. seed/trigger function SECURITY DEFINER and safe search_path configuration are correct where required;
9. normal client roles do not have unintended EXECUTE on the category SECURITY DEFINER helpers;
10. `anon` and `PUBLIC` have **no table privileges and no column privileges** on either Phase 3 table;
11. authenticated table-level privileges are exactly SELECT on both tables — no broad table INSERT/UPDATE/DELETE;
12. authenticated INSERT columns exactly match the intended creation fields;
13. authenticated UPDATE columns exactly match the intended mutable fields;
14. `opening_balance` is PostgreSQL `numeric(20,4)` and forbidden derived columns (`current_balance`, `converted_balance_vnd`, `monthly_inflow`, `monthly_outflow`) do not exist;
15. every current auth user has every one of the 12 expected baseline categories by `(type, name)`;
16. no seeded `Chuyển tiền` category exists;
17. the Phase 3 tables have no unexpected ownership-changing client UPDATE privilege (`user_id`, id/timestamps).

Do not repeat the Phase 2 verifier mistake where details exposed extra privileges while the check still returned PASS.

### D. Runtime RLS verifier has false-failure/coverage defects

Fix `scripts/verify-phase3-rls.mjs`.

PostgREST/Supabase RLS can make a forbidden UPDATE affect zero rows **without returning an error**. Therefore this is incorrect:

```js
if (!bUpdateAErr) FAIL
```

For forbidden UPDATE assertions, request/inspect returned rows (or perform a read-back) and assert that **zero foreign rows were modified**. Treat either an explicit authorization error or zero modified rows as blocked, depending on PostgREST behavior.

The final runtime verifier must cover both directions and both tables:

- A authenticates; B authenticates;
- A can INSERT own account;
- A can SELECT own account;
- A can UPDATE own account and the value is persisted;
- A cannot INSERT an account owned by B;
- A cannot SELECT B account;
- A cannot UPDATE B account;
- B can INSERT own account;
- B can SELECT own account;
- B can UPDATE own account and persistence is proven;
- B cannot INSERT for A;
- B cannot SELECT A account;
- B cannot UPDATE A account;
- same required matrix for categories;
- seeded baseline categories are visible to the owning user and foreign seeded rows are invisible;
- ownership (`user_id`) cannot be changed through normal client UPDATE;
- deliberate query-error handling is distinguishable from an RLS empty result;
- no service-role key.

Use unique test names to avoid collisions. Clean up without requiring DELETE: archive test records and leave them clearly marked as verifier records, or restore prior values where applicable. Do not claim cleanup success unless the cleanup mutation is checked.

Missing credentials or missing tables must exit non-zero with truthful BLOCKED/FAIL state.

---

## 3. Account UI/application corrective requirements

The current `/accounts` implementation does not satisfy the Phase 3 contract because it only creates/archives records, has no edit/unarchive surface, and errors are only logged to console.

Mandatory behavior:

- list authenticated user's real accounts;
- create;
- edit all intended mutable account fields;
- archive;
- show archived accounts through a clear filter/view;
- unarchive;
- filter active accounts by all supported account types;
- persist changes after refresh/re-login;
- show truthful loading, empty, success, and visible error states.

Do not label an archive action as hard delete.

Foreign accounts must remain in original currency. No mock FX, no converted VND, no fake cross-currency net worth, no fake monthly inflow/outflow.

`opening_balance` is the currently known Phase 3 amount and must not be represented as transaction-derived history.

### Async mutation correctness

Current `AddAccountModal` calls an async parent callback without awaiting it, then closes immediately. This can show false success when Supabase insert fails.

Fix it:

- remove `any` callback types;
- make mutation callbacks explicitly async/Promise-aware;
- await persistence before closing/resetting the modal;
- on failure, keep the form available and show a visible useful error;
- do not swallow promise rejections;
- use a real pending state while the request is in flight.

Provide bounded feature helpers for archive/unarchive rather than making page components rely on magic booleans everywhere if practical.

Application-layer update inputs should be narrowed to mutable fields; normal UI code should not be typed as if it can update `id`, `user_id`, `created_at`, or `updated_at`.

Do not introduce floating-point arithmetic for financial calculations. Phase 3 does not need account aggregation. Preserve the database `numeric(20,4)` contract and avoid unnecessary arithmetic on money values.

---

## 4. Category UI/application corrective requirements

The current categories page only creates and archives active rows. It has no edit or unarchive surface and labels archive as `Xóa`.

Mandatory behavior:

- list real categories separated by INCOME/EXPENSE;
- create;
- edit name/type/icon/color;
- archive with truthful `Lưu trữ` wording;
- show archived categories;
- unarchive;
- visible loading/empty/error/success feedback;
- changes survive refresh/re-login;
- no fake transaction usage counts.

Fix `AddCategoryModal` (or replace with a bounded category form modal) so async create/edit persistence is awaited and failures do not close the form or pretend success.

Remove `any` from mutation callback types.

Narrow application-layer category updates to mutable fields only.

---

## 5. Types and data-access contract

Keep `src/types/database.ts` structurally aligned with the migration.

Do not use the broad generated-style `Update` object directly as the public feature mutation contract if it permits identity/ownership/timestamp fields. Define narrow feature mutation types/Picks for allowed mutable fields.

Account type and category type should be narrow TypeScript unions in the application/domain layer where useful, without turning database currency codes into a fixed six-currency enum.

Supabase browser client must use only the publishable key and RLS. No service-role key.

---

## 6. Documentation corrective requirements

The previous Phase 3 commit incorrectly rewrote the ledger as `Phase 3 COMPLETE / PASS` while also stating `REMOTE_DATABASE=BLOCKED`, and authorized Phase 4 before Phase 3 remote gates passed. This is forbidden.

Update `docs/PROJECT_STATUS.md` truthfully:

Until remote verification later succeeds:

```text
PHASE_2=PASS
PHASE_3_CODE=<PASS only after this corrective pass verifies locally>
PHASE_3_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_3_STRUCTURAL_GATE=NOT_RUN
PHASE_3_RUNTIME_RLS=NOT_RUN
PHASE_3_OVERALL=PARTIAL
PHASE_4_AUTHORIZED=false
```

Do not claim that a verifier "will PASS" before it runs.

Restore/preserve the accepted Phase 2 database/security documentation instead of replacing detailed hardened Phase 2 facts with a lossy summary. `docs/DATABASE.md` should append Phase 3 tables/privileges/invariants to the existing Phase 2 truth, not erase the Phase 2 privilege/trigger contract.

`docs/ARCHITECTURE.md` contains stale wording that application code has not been initialized; if touched, update only that stale status statement and current implemented boundaries without unrelated rewrites.

Append an ADR only if a genuinely new architectural decision was made; do not add ADR noise for routine Phase 3 implementation.

---

## 7. Verification before publishing corrective source

Run all of the following after corrections:

```text
npm run typecheck
npm run lint
npm run build
```

Also inspect source for:

- `any` in the new account/category mutation callback paths;
- `MOCK_ACCOUNTS` imports under `/accounts`;
- `MOCK_CATEGORIES` as category-management source of truth;
- mock FX calls/claims on real account UI;
- service-role credentials;
- accidental transaction/transfer persistence;
- false `Phase 3 PASS` / Phase 4 authorization wording.

Do not claim remote database PASS or runtime RLS PASS in this corrective code pass unless the migration was actually applied and the exact-head remote gates were truly executed.

If remote database access remains unavailable, that is acceptable: publish corrected source with `REMOTE_DATABASE=BLOCKED_NOT_APPLIED` and stop for owner/manual migration authorization.

---

## 8. Git/provenance requirements

- Base corrections on current authoritative `origin/main`.
- Keep changes limited to Phase 3 corrective scope.
- Commit all corrected source and docs.
- Push to `main` if repository policy allows it.
- If push reports failure, verify the actual remote branch before reporting that the push failed; do not emit stale Git transport assumptions.
- Report exact local HEAD and exact `origin/main` SHA at the end.
- Phase 4 remains unauthorized.

---

## 9. Required final report

Return exactly this structure:

```text
TASK
Finora Phase 3 Corrective Gate

STATUS
PASS_CODE_ONLY / PARTIAL / FAIL

AUTHORITATIVE_BASE_SHA
<sha>

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

MIGRATION_SQL_CORRECTED
PASS / FAIL

SEED_IDEMPOTENCY
PASS / FAIL

STRUCTURAL_VERIFIER_HARDENED
PASS / FAIL

RUNTIME_RLS_VERIFIER_HARDENED
PASS / FAIL

ACCOUNT_CREATE
PASS / FAIL

ACCOUNT_EDIT
PASS / FAIL

ACCOUNT_ARCHIVE_UNARCHIVE
PASS / FAIL

ACCOUNT_VISIBLE_ERROR_HANDLING
PASS / FAIL

CATEGORY_CREATE
PASS / FAIL

CATEGORY_EDIT
PASS / FAIL

CATEGORY_ARCHIVE_UNARCHIVE
PASS / FAIL

CATEGORY_VISIBLE_ERROR_HANDLING
PASS / FAIL

TYPESCRIPT
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

REMOTE_DATABASE
BLOCKED_NOT_APPLIED / PASS / FAIL

REMOTE_STRUCTURAL_GATE
NOT_RUN / PASS / FAIL

REMOTE_TWO_USER_RLS
NOT_RUN / PASS / FAIL

PHASE_3_OVERALL
PARTIAL / PASS / FAIL

PHASE_4_AUTHORIZED
false

CODE_CHANGES
<exact files>

KNOWN_BLOCKERS
<exact blockers or NONE>
```

Even if all local code checks pass, Phase 3 remains PARTIAL until the remote migration, strict structural verifier, and two-user runtime RLS verifier pass against the target Supabase project.
