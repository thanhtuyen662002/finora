# FINORA — PHASE 1 CORRECTIVE PASS

## TASK

Correct the existing Finora Phase 1 UI implementation only.

Repository:

`thanhtuyen662002/finora`

Authoritative audited Phase 1 implementation commit:

`14ffe6ffa2aba010a06a157ff1f79fd0424e8605`

The repository status ledger has already been updated to `CORRECTIVE_REQUIRED`.

Do not rebuild Phase 1 from scratch.
Do not begin Phase 2.

---

# 1. Mandatory Pre-Work

Before changing any implementation file:

1. Sync latest remote `main`.
2. Confirm remote HEAD.
3. Read `AGENTS.md` completely.
4. Read:
   - `docs/PROJECT_STATUS.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DATABASE.md`
   - `docs/DECISIONS.md`
5. Inspect the existing Phase 1 implementation.
6. Treat the current repository as authoritative.

Only fix the bounded findings documented in `docs/PROJECT_STATUS.md` and this corrective prompt.

---

# 2. Scope

This is still Phase 1.

Allowed:

- presentation components;
- mock data;
- local React state;
- filters;
- loading skeletons;
- empty states;
- responsive layout corrections;
- mock settings/admin wording;
- type-safety cleanup;
- documentation correction.

Forbidden:

- real Supabase Auth;
- profiles/user_settings tables;
- database migrations;
- RLS policies;
- real finance persistence;
- Gemini calls;
- AI credential storage;
- live FX API calls;
- YouTube API calls;
- PWA service worker;
- Phase 2 implementation.

Preserve the approved Phase 0 Supabase SSR files.

---

# 3. Correct Transaction Filters

Current `TransactionList` exposes only search and transaction type.

Implement usable controls for:

- search;
- transaction type;
- account;
- category;
- date/period;
- amount/direction sort or filter.

Requirements:

- desktop controls must remain clean and compact;
- mobile controls must not become a horizontally overflowing desktop toolbar;
- a mobile filter dialog/sheet/popover is acceptable;
- use existing mock transactions to derive account/category options where practical;
- filtered empty result must keep the existing user-friendly empty state;
- do not add backend queries.

Remove unused filter-related imports/state left by the previous implementation.

---

# 4. Complete `/settings`

Keep the existing profile, currency/region, and data/privacy concepts.

Add lightweight mock presentation sections for:

## Appearance

Examples:

- Light / Dark / System visual selector;
- no required persistent theme storage in Phase 1.

## Notifications

Examples:

- budget warning;
- recurring bill reminder;
- goal progress reminder.

Local switches only.

## AI

Show an end-user concept such as:

- AI assistance: enabled/disabled;
- credential source: managed by administrator;
- optional `Use my own API key` concept.

Do not accept, store, or persist a real credential.
If a credential field is shown, it must be disabled or clearly marked preview-only.

## Security

Examples:

- password/security placeholder;
- session/device placeholder;
- 2FA planned state.

Do not implement Auth/security backend logic.

Update `docs/PROJECT_STATUS.md` so it describes what actually exists.

---

# 5. Add Required Loading States

Add reusable loading-state UI for at least:

- `/dashboard`;
- `/transactions`;
- `/accounts`;
- `/reports`.

Preferred options:

- route-level `loading.tsx` files;
- or reusable page skeleton components used by route-level loading files.

Requirements:

- use the existing Skeleton primitive;
- match the real screen structure enough to avoid major layout jumps;
- no artificial delay;
- no fake network requests.

---

# 6. Complete Empty States

Ensure user-friendly empty-state behavior exists for at least:

## Accounts

Vietnamese copy equivalent to:

`Bạn chưa có tài khoản nào.`

`Thêm tài khoản đầu tiên để bắt đầu theo dõi tài chính.`

Include an action that opens the existing mock Add Account flow.

## Goals

Vietnamese copy equivalent to:

`Chưa có mục tiêu tài chính.`

Include an action opening the existing mock Add Goal flow.

Keep the existing transaction empty state.

Also handle empty filtered account results gracefully.

---

# 7. Separate Admin From Standard User Navigation

The normal user `AppShell` must not expose `/admin` as a regular navigation destination.

Remove the Admin entry from the standard sidebar/footer.

Do not delete `/admin`.
It must remain directly reachable for Phase 1 preview/testing.

Do not implement authorization yet; real admin authorization belongs to a later backend phase.

---

# 8. Correct Admin Mock Wording

The admin page is a Phase 1 visual shell.

Do not present planned backend behavior as already operational.

Correct wording that currently implies real implementation for items such as:

- RLS enforcement;
- encrypted server key storage;
- realtime FX synchronization;
- live provider API status;
- production Gemini configuration.

Use explicit labels such as:

- `Mock preview`;
- `Planned for Phase 2`;
- `Backend not connected`;
- `Configuration preview only`.

The top-level Phase 1 preview badge is not enough if individual cards contain factual claims that the backend already enforces those behaviors.

Model selectors should be UI placeholders/configuration examples rather than implying a locked production policy.

No real keys may appear.
Masked examples only.

---

# 9. Centralize Mock FX Conversion

The current UI supports:

- VND;
- USD;
- EUR;
- JPY;
- CNY;
- KRW.

But newly created local account/transaction records only convert USD correctly.

Correct this by using a single mock conversion helper/rate map for every supported currency.

Requirements:

- keep it clearly mock-only;
- no external requests;
- do not treat these rates as historical truth;
- reuse the existing mock rate map if appropriate;
- avoid duplicating rates in account and transaction page handlers.

It is acceptable to introduce a helper such as:

`convertMockToBase(amount, currency)`

inside the Phase 1 mock/presentation layer.

Do not build the real FX Engine yet.

---

# 10. Type Safety

Remove `any` introduced in local mock creation paths.

At minimum correct:

- Add Account success payload;
- Account page create handler;
- Add Transaction success payload;
- Transaction page create handler.

Use small presentation input types such as:

- `MockAccountInput`;
- `MockTransactionInput`.

Do not attempt to design the final database DTO layer during Phase 1.

---

# 11. Documentation Accuracy

Audit `docs/PROJECT_STATUS.md` against actual exports and implemented screens.

Do not claim functions/features that are absent.

In particular, do not claim helpers such as:

- `formatExchangeRate`;
- `getCurrencySymbol`;
- `getCurrencyName`;

unless they genuinely exist and are needed.

Prefer correcting documentation rather than adding unnecessary code solely to satisfy stale documentation.

The final status file must match source code exactly.

---

# 12. Preserve Existing Good Work

Do not rewrite the entire design system.

Preserve:

- all existing routes;
- AppShell visual language;
- dashboard structure;
- account cards;
- transaction list styling;
- reports and YouTube income breakdown;
- mock add dialogs;
- shadcn/Radix dependency set;
- Supabase Phase 0 foundation.

This must remain a small corrective diff relative to the existing Phase 1 implementation.

---

# 13. Verification

Run:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Runtime-check all required routes:

- `/login`
- `/onboarding`
- `/dashboard`
- `/accounts`
- `/transactions`
- `/budgets`
- `/goals`
- `/recurring`
- `/reports`
- `/settings`
- `/admin`

Explicitly verify responsive behavior at:

- 390px;
- 768px;
- 1024px;
- 1440px.

At minimum inspect:

- Dashboard;
- Transactions filters;
- Accounts empty/filter states;
- Goals empty state;
- Settings;
- Admin;
- mobile bottom navigation.

Check browser console for:

- runtime exceptions;
- hydration problems;
- missing React keys;
- significant warnings.

Do not report an unexecuted check as PASS.

---

# 14. Scope Audit Before Completion

Before commit, inspect the complete diff and confirm:

- no migration files added;
- no database tables added;
- no RLS added;
- no Supabase Auth actions added;
- no Gemini calls added;
- no live FX provider added;
- no secrets added;
- no LocalStorage finance persistence added;
- no Phase 2 implementation added.

---

# 15. Project Status

If every corrective gate passes, update:

`docs/PROJECT_STATUS.md`

To:

- Current Phase: `Phase 1 — UI Foundation`
- Phase Status: `COMPLETE`
- Next Recommended Action: `Phase 2 — Authentication + User Isolation`

Record the final verification truthfully.

Do not mark Phase 2 started.

---

# 16. Git

Review:

```bash
git status
git diff
```

Commit the corrective work.

Suggested message:

`fix(ui): complete Phase 1 interface contract`

Publish through the connected GitHub integration.

The remote GitHub SHA is the authoritative completion receipt.

Do not stop with local-only work if publishing is available.

---

# 17. Final Report

Return exactly:

```text
TASK
Finora Phase 1 — Corrective Pass

STATUS
PASS / PARTIAL / BLOCKED

START_HEAD
<remote head before corrective implementation>

FINAL_LOCAL_HEAD
<local corrective commit>

REMOTE_MAIN_HEAD
<actual GitHub main after publish>

HEAD_MATCH
YES / NO

CORRECTIONS
Transactions filters:
Settings completeness:
Loading states:
Empty states:
Admin separation:
Admin mock wording:
Mock FX conversion:
Type safety:
Documentation accuracy:

SUPABASE
Phase 0 foundation preserved: YES / NO
Auth implemented: NO

DATABASE CHANGES
NONE

AI
MOCK UI ONLY

FX
MOCK RATES ONLY

SECURITY
<secret review>

VERIFICATION
Install:
Lint:
TypeScript:
Build:
Runtime:
Routes:
Console:
390px:
768px:
1024px:
1440px:

KNOWN ISSUES
<NONE or exact issues>

PROJECT STATUS
Phase 1 — UI Foundation: COMPLETE / CORRECTIVE_REQUIRED
Next Action:

REMOTE COMMIT
<actual pushed SHA or BLOCKED>
```

Then stop.

Do not begin Phase 2.
