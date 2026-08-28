# FINORA — PHASE 3 FINAL CLEANUP GATE

## TASK

Finish the **last code-only cleanup for Finora Phase 3 — Accounts + Categories** on:

`thanhtuyen662002/finora`

Authoritative remote baseline at the time this gate was written:

`7c841ea4702ac191573e40ac2b4308913fd1daeb`

Target Supabase project:

- ref: `qibfitbnlfgiqctntufr`
- URL: `https://qibfitbnlfgiqctntufr.supabase.co`

Do **not** apply the Phase 3 migration remotely in this task.
Do **not** begin Phase 4.

This gate exists because the previous corrective report claimed `PASS_CODE_ONLY`, but exact remote audit still found mandatory contract defects.

---

## 1. Mandatory pre-work

1. Fetch/sync `origin/main` and report the exact remote HEAD before editing.
2. Read completely:
   - `AGENTS.md`
   - `docs/PROJECT_STATUS.md`
   - `docs/DATABASE.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `prompts/PHASE_3_ACCOUNTS_CATEGORIES.md`
   - `prompts/PHASE_3_CORRECTIVE.md`
   - `prompts/PHASE_3_FINAL_CLEANUP.md`
3. Inspect all current Phase 3 code and verifiers.
4. Preserve the accepted Phase 2 Auth/SSR/RLS contract.
5. Do not touch remote Supabase schema/data in this task.

---

## 2. Migration fixes — mandatory

File:

`supabase/migrations/20260828000001_phase_3_accounts_categories.sql`

Current audit findings:

- the invalid `DO ... SECURITY DEFINER SET search_path` syntax was fixed;
- default seeding was improved;
- but the migration is still **not atomic** despite the corrective contract requiring it;
- `public.handle_new_user_categories()` remains a SECURITY DEFINER helper without explicit direct EXECUTE revocation from all normal client roles.

Required final state:

1. Wrap the entire Phase 3 migration in:

```sql
BEGIN;
...
COMMIT;
```

2. Keep the existing Phase 2 `public.handle_updated_at()` reuse.
3. Keep `opening_balance NUMERIC(20,4)` and do not add derived balance/FX columns.
4. Keep `seed_default_categories(uuid)` idempotent by `(user_id, type, name)` including archived rows.
5. Backfill **every** existing `auth.users` row.
6. Keep exactly 5 INCOME + 7 EXPENSE baseline categories and never seed `Chuyển tiền`.
7. Both SECURITY DEFINER Phase 3 helpers must have:
   - `SET search_path = ''`;
   - fully-qualified protected object references;
   - no unnecessary client execution surface.
8. Explicitly revoke direct EXECUTE from `PUBLIC`, `anon`, and `authenticated` for **both**:

```text
public.seed_default_categories(uuid)
public.handle_new_user_categories()
```

9. Preserve explicit least-privilege table/column grants.
10. Do not add DELETE grants/policies.

Do not apply this migration remotely during this task.

---

## 3. Structural verifier — mandatory strict rewrite/hardening

File:

`scripts/verify-phase3-db.sql`

Current remote verifier can still false-PASS. It checks policy names but does not prove the complete policy contract, omits anon column privileges, does not fully prove provisioning-trigger wiring, and only checks direct EXECUTE for one helper.

The final verifier must return explicit PASS/FAIL rows and `99_OVERALL` must only PASS when **all** mandatory checks pass.

At minimum verify:

1. `public.accounts` and `public.categories` exist.
2. RLS enabled on both.
3. Exactly six expected policies exist and no additional Phase 3 policies exist.
4. Policy contract is correct by:
   - table;
   - policy name;
   - command (`SELECT`, `INSERT`, `UPDATE`);
   - role exactly `authenticated`;
   - ownership expression contains the expected `auth.uid()` / `user_id` semantics;
   - INSERT uses `WITH CHECK`;
   - UPDATE has both `USING` and `WITH CHECK`;
   - no DELETE policy.
5. `set_accounts_updated_at` and `set_categories_updated_at` exist and invoke `public.handle_updated_at`.
6. `on_auth_user_created_categories` exists on `auth.users` and invokes `public.handle_new_user_categories`.
7. Both Phase 3 SECURITY DEFINER helpers exist, are SECURITY DEFINER, and use empty `search_path`.
8. `PUBLIC`, `anon`, and `authenticated` have no direct EXECUTE privilege on either Phase 3 SECURITY DEFINER helper.
9. `anon` and `PUBLIC` have **no table privileges and no column privileges** on either Phase 3 table.
10. Authenticated table-level privileges are exactly SELECT on both tables and no broad table-level INSERT/UPDATE/DELETE exists.
11. Authenticated INSERT columns are exactly:

```text
accounts.user_id
accounts.name
accounts.type
accounts.currency_code
accounts.opening_balance
accounts.institution
accounts.color
accounts.is_archived
categories.user_id
categories.name
categories.type
categories.icon
categories.color
categories.is_archived
```

12. Authenticated UPDATE columns are exactly:

```text
accounts.name
accounts.type
accounts.currency_code
accounts.opening_balance
accounts.institution
accounts.color
accounts.is_archived
categories.name
categories.type
categories.icon
categories.color
categories.is_archived
```

13. No normal-client UPDATE privilege exists on `id`, `user_id`, `created_at`, or `updated_at`.
14. `opening_balance` is exactly PostgreSQL `numeric(20,4)`.
15. Forbidden account columns do not exist:

```text
current_balance
converted_balance_vnd
monthly_inflow
monthly_outflow
```

16. Every current Auth user has every one of the 12 baseline `(type, name)` pairs.
17. The baseline does not contain duplicate `(user_id, type, name)` rows immediately after migration.
18. No seeded `Chuyển tiền` category exists.
19. Final `99_OVERALL` reflects all checks, not a weaker subset.

Do not claim the verifier passes remotely; it is only source-hardening in this task.

---

## 4. Runtime RLS verifier — mandatory full matrix

File:

`scripts/verify-phase3-rls.mjs`

Use only:

- `NEXT_PUBLIC_SUPABASE_URL`
- publishable/anon client key
- disposable User A / User B credentials

Never use service-role credentials.

Final verifier requirements:

### Accounts

- A INSERT own account — persisted.
- A SELECT own account.
- A UPDATE own account — persistence proven.
- B INSERT own account — persisted.
- B SELECT own account.
- B UPDATE own account — persistence proven.
- A cannot INSERT an account owned by B.
- B cannot INSERT an account owned by A.
- A cannot SELECT B account.
- B cannot SELECT A account.
- A cannot UPDATE B account.
- B cannot UPDATE A account.
- normal clients cannot change account `user_id` ownership.

### Categories

Run the same complete bidirectional matrix.

### Seeded categories

- A sees all 12 own baseline categories and no foreign seeded rows.
- B sees all 12 own baseline categories and no foreign seeded rows.

### Assertion semantics

Forbidden UPDATE may legitimately return **zero rows without an error** under RLS. Treat either:

- a known authorization/RLS rejection; or
- zero returned/modified foreign rows

as blocked.

Do **not** treat arbitrary database/query errors as RLS success.

Add one deliberate invalid-query assertion and prove it produces a distinct non-RLS error so false positives are detectable.

Use unique verifier record names. Cleanup must archive all verifier-created records and prove the archive mutation persisted. Missing credentials/tables must exit non-zero truthfully.

---

## 5. Account UI cleanup — mandatory

Files include:

- `src/app/accounts/page.tsx`
- `src/components/finance/AddAccountModal.tsx`
- `src/components/finance/AccountCard.tsx`
- `src/features/accounts/accounts.ts`
- `src/types/database.ts`

Current audit findings still open:

1. `AddAccountModal` still uses `initialData?: any` and `catch (err: any)`.
2. Edit-form state is initialized only on first mount. Opening a different account can reuse stale form state unless the modal is keyed/remounted or explicitly synchronized.
3. `opening_balance` still uses `parseFloat`, introducing avoidable JS floating-point conversion before PostgreSQL `numeric(20,4)`.
4. AccountCard still uses `as any` for currency display.
5. Currency creation UI is still hard-coded to only the six Phase 1 mock currencies even though the Phase 3 DB contract is extensible.
6. Load/archive errors are still console-only rather than user-visible.
7. The account filter does not expose every supported account type.
8. Hover-only actions are weak on touch/mobile.

Required final state:

- no `any` in Phase 3 account mutation/form paths;
- narrow `AccountType` union and narrow create/update/form types;
- public update type must not permit `id`, `user_id`, `created_at`, `updated_at`;
- create/edit modal awaits persistence before closing;
- failed mutation stays open with visible error;
- edit modal always shows the selected account's current values (key/remount or explicit sync);
- preserve opening-balance decimal input as a string until it is sent to Supabase/PostgreSQL instead of `parseFloat` where practical;
- validate the decimal shape compatible with `numeric(20,4)`;
- allow arbitrary uppercase 3–5 character currency codes in the real account form, not only six mock options;
- `CurrencyBadge` / money display for real account rows must accept extensible currency strings without `as any`;
- show `Số dư khởi tạo` or similarly truthful wording;
- no mock FX or converted-VND claim;
- visible loading/empty/success/error states;
- create/edit/archive/show-archived/unarchive all work;
- filter includes BANK/CASH/EWALLET/SAVINGS/CREDIT_CARD/INVESTMENT/OTHER plus optional foreign grouping;
- archive/edit actions remain usable on mobile, not only hover;
- feature helpers for archive/unarchive are preferred.

Do not change mock transaction pages to real persistence in this phase.

---

## 6. Category UI cleanup — mandatory

Files include:

- `src/app/settings/categories/page.tsx`
- `src/components/finance/AddCategoryModal.tsx`
- `src/features/categories/categories.ts`
- `src/types/database.ts`

Current audit findings still open:

- `initialData?: any` and `catch (err: any)` remain;
- edit-form state can become stale between selected categories;
- load/archive failures are console-only;
- visible success/error/empty states are incomplete.

Required final state:

- no `any` in Phase 3 category mutation/form paths;
- narrow `CategoryType = 'INCOME' | 'EXPENSE'`;
- public update type excludes identity/ownership/timestamps;
- create/edit awaits persistence before close;
- failure stays visible in the form;
- correct selected category data is loaded on every edit;
- create/edit/archive/show archived/unarchive work;
- archive wording remains `Lưu trữ`, never hard-delete wording;
- visible page-level loading/empty/success/error states;
- no fake transaction usage counts.

---

## 7. Database documentation restoration — mandatory

File:

`docs/DATABASE.md`

The initial Phase 3 commit replaced the detailed accepted Phase 2 security documentation with a lossy summary. The previous corrective attempt did not restore it.

Required final state:

1. Restore the accepted Phase 2 details for:
   - `profiles` columns/constraints;
   - `user_settings` columns/constraints;
   - updated-at triggers;
   - exact Phase 2 RLS policies;
   - explicit least-privilege grants;
   - `handle_new_user` provisioning behavior;
   - Phase 2 migration ledger state.
2. Append Phase 3 source design rather than overwriting Phase 2 history.
3. Be truthful that Phase 3 remote migration is still pending in this task.
4. Document Phase 3 table grants/RLS, `numeric(20,4)`, seed helpers and runtime/structural verification contracts.

Do not call Phase 3 remotely active until later verification proves it.

---

## 8. Repository hygiene — mandatory

The previous agent accidentally committed one-off local patch helpers to repository root.

Remove these generated helper artifacts if they are still present:

```text
fix-acc-modal.js
fix-acc-page.js
fix-cat-modal.js
fix-cat-modal2.js
fix-cat-page.js
update-status.js
```

`REPORT.txt` is also an agent-generated execution report rather than product source. Remove it unless repository governance explicitly requires it; `docs/PROJECT_STATUS.md` is the authoritative ledger.

Do not add new one-off helper scripts to the repository just to edit files.

---

## 9. Project status truthfulness

Update `docs/PROJECT_STATUS.md` only after source cleanup and local verification.

Until remote migration/runtime verification later succeeds, the ledger must remain equivalent to:

```text
PHASE_2=PASS
PHASE_3_CODE=PASS
PHASE_3_REMOTE_DATABASE=BLOCKED_NOT_APPLIED
PHASE_3_STRUCTURAL_GATE=NOT_RUN
PHASE_3_RUNTIME_RLS=NOT_RUN
PHASE_3_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_3_OVERALL=PARTIAL
PHASE_4_AUTHORIZED=false
```

Do not authorize Phase 4.
Do not claim any verifier “will pass”.

---

## 10. Verification before publish

Run on the exact final source:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/verify-phase3-rls.mjs
```

Also search the resulting diff/source for:

```text
initialData?: any
catch (err: any)
parseFloat(balance)
currency_code as any
MOCK_ACCOUNTS   under /accounts
MOCK_CATEGORIES as category-management source
service_role
Phase 4 — Transactions: AUTHORIZED
```

All forbidden findings above must be absent from the Phase 3 real account/category paths.

Do not apply the remote migration in this task even if all local checks pass.

---

## 11. Git/provenance

- Base on the exact latest `origin/main`, not a stale local report SHA.
- Commit only Phase 3 final-cleanup scope.
- Push to `main`.
- After push, fetch `origin/main` again and report the **actual** remote SHA.
- If git transport prints an error, still query the real remote branch before claiming push failed.
- Do not report a local SHA as remote proof.

---

## 12. Required final report

Return exactly:

```text
TASK
Finora Phase 3 Final Cleanup Gate

STATUS
PASS_CODE_ONLY / PARTIAL / FAIL

AUTHORITATIVE_BASE_SHA
<sha>

FINAL_LOCAL_HEAD_SHA
<sha>

FINAL_REMOTE_MAIN_SHA
<sha>

REMOTE_HEAD_MATCHES_LOCAL
true / false

MIGRATION_ATOMIC
PASS / FAIL

SECURITY_DEFINER_EXECUTE_LOCKDOWN
PASS / FAIL

SEED_IDEMPOTENCY
PASS / FAIL

STRUCTURAL_VERIFIER_STRICT
PASS / FAIL

RUNTIME_RLS_MATRIX_COMPLETE
PASS / FAIL

ACCOUNT_FORM_TYPES_NO_ANY
PASS / FAIL

ACCOUNT_DECIMAL_INPUT_NO_PARSEFLOAT
PASS / FAIL

ACCOUNT_EXTENSIBLE_CURRENCY_UI
PASS / FAIL

ACCOUNT_EDIT_ARCHIVE_UNARCHIVE
PASS / FAIL

ACCOUNT_VISIBLE_FEEDBACK
PASS / FAIL

CATEGORY_FORM_TYPES_NO_ANY
PASS / FAIL

CATEGORY_EDIT_ARCHIVE_UNARCHIVE
PASS / FAIL

CATEGORY_VISIBLE_FEEDBACK
PASS / FAIL

PHASE2_DATABASE_DOCS_RESTORED
PASS / FAIL

TEMP_HELPERS_REMOVED
PASS / FAIL

TYPESCRIPT
PASS / FAIL

LINT
PASS / FAIL

BUILD
PASS / FAIL

RUNTIME_SCRIPT_SYNTAX
PASS / FAIL

REMOTE_DATABASE
BLOCKED_NOT_APPLIED

REMOTE_STRUCTURAL_GATE
NOT_RUN

REMOTE_TWO_USER_RLS
NOT_RUN

PHASE_3_OVERALL
PARTIAL

PHASE_4_AUTHORIZED
false

CODE_CHANGES
<exact files>

KNOWN_BLOCKERS
<exact blockers or NONE>
```

A code-only PASS is not Phase 3 completion. Phase 3 can close only after the exact accepted migration is applied remotely, the strict structural SQL returns `99_OVERALL=PASS`, the two-user runtime verifier exits 0, and live account/category persistence smoke tests pass.