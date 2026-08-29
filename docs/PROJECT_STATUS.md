# Finora — Project Status

## Current State

- **Project:** Finora
- **Repository:** `thanhtuyen662002/finora`
- **Default branch:** `main`
- **Current phase:** Phase 6 — Dashboard + Reports — AUTHORIZED
- **Phase status:** PHASE_5_COMPLETE_PHASE_6_AUTHORIZED
- **Target Supabase project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora origin:** `https://finora-orpin-nu.vercel.app`
- **Accepted Phase 2 completion SHA:** `c4248e5be9884bb2402e74900daf16909735c641`
- **Phase 3 code verification SHA:** `2742768c7cbdea339c45ad5b43ec0aa0d81fa6a5`
- **Accepted Phase 3 migration-source SHA:** `529d1d42ab50d62b2327fadc7a9ac0b2122798fa`
- **Phase 3 structural receipt SHA:** `1422dcd5e9c67028d1c33006d5d61f7037827dff`
- **Phase 3 runtime RLS receipt SHA:** `2b09f494344a3f6d84bb374ad5bdba0512f7f459`
- **Phase 3 closure SHA:** `935a806c15d28b8de412631f48cf2ee067a3af2f`
- **Phase 4 implementation contract SHA:** `75dd85d4a7b062fb3f8cc2a25570a75c057838ac`
- **Phase 4 initial implementation SHA:** `399f96327111ebf9abeb7c95d445ce0174f91e6f`
- **Phase 4 first corrective baseline SHA:** `7a57a27029ffe86185b67bcceeddaac826e4985d`
- **Phase 4 final-corrective agent SHA audited:** `890184010434e7b88ff8f4050dc6a1d54aae577e`
- **Accepted Phase 4 exact-head source SHA:** `13287e773eeaa65460bd0980d502bd8885c45f9c`
- **Phase 4 structural-verifier syntax-fix SHA:** `bb6744692f786a0a86602971ee788567c2d44797`
- **Phase 4 structural receipt SHA:** `182787e142c2cdec4fd4f2bbc94bce2140fcc2fb`
- **Phase 4 runtime RLS receipt SHA:** `802addec082d0aa4366b2f70d1e6e20f5432827b`
- **Accepted Phase 5 exact-head source SHA:** `27215b99484938ff25879a412449a591fe6bb9dc`
- **Phase 5 structural-verifier fix SHA:** `897883f98ec4df0e94b5b96d6c69ab78d0f08d3e`
- **Phase 5 structural receipt SHA:** `0411e952b04d831ea440a1707b600b9bf006d3e0`
- **Phase 5 runtime RLS receipt SHA:** `cfb352460dfc05fc2ea79815eabf6664580d15fc`
- **Phase 5 closure receipt SHA:** `2794812af0367487247ce30520e62bcd9a29353b`
- **Phase 5 closure receipt:** `docs/receipts/PHASE_5_CLOSURE.md`

## Phase 2 Accepted Baseline

Phase 2 remains accepted PASS and must not be regressed.

Accepted gates:

- Auth/SSR code hardening: PASS
- Remote Phase 2 database structure and least-privilege grants: PASS
- Anonymous RLS isolation: PASS
- Bidirectional two-user RLS isolation: PASS
- Email/password signup/login/confirmation: PASS
- Onboarding routing and persistence: PASS
- Settings persistence: PASS
- Sign out and protected-route enforcement: PASS
- Password recovery: PASS
- Google OAuth: PASS

**PHASE_2 = PASS**

## Phase 3 — Accounts + Categories — Final Receipt

Phase 3 is accepted COMPLETE and remains the immutable baseline for later phases.

### Source gate

The Phase 3 application/runtime source was verified with matching local/remote HEAD and clean worktree.

- TypeScript: PASS
- Lint: PASS
- Production build: PASS
- Runtime verifier script syntax: PASS
- Verification code changes: NONE

### Remote database structural gate

The corrected Phase 3 migration was manually applied to the target Supabase project. Strict verification returned every mandatory check PASS and `99_OVERALL = PASS`.

Accepted facts:

- `accounts` and `categories` exist with RLS enabled;
- exactly six authenticated ownership policies are present;
- account/category updated-at triggers are present;
- category provisioning trigger on `auth.users` is present;
- Phase 3 SECURITY DEFINER helpers use empty `search_path` and client EXECUTE is revoked;
- `anon` and `PUBLIC` have no table or column privileges on Phase 3 tables;
- authenticated has table-level SELECT only with exact column-level INSERT/UPDATE allowlists;
- `opening_balance` is PostgreSQL `numeric(20,4)`;
- baseline categories were complete for all current auth users;
- no seeded transfer category exists.

**PHASE_3_REMOTE_DATABASE = PASS**
**PHASE_3_STRUCTURAL_GATE = PASS**

### Two-user runtime RLS gate

The hardened two-user runtime verifier exited `0`.

Accepted runtime facts:

- User A/B authentication: PASS
- own account INSERT/SELECT/UPDATE: PASS
- cross-user account INSERT/SELECT/UPDATE blocked: PASS
- account ownership mutation blocked: PASS
- category baseline visibility/isolation: PASS
- own category INSERT/SELECT/UPDATE: PASS
- cross-user category INSERT/SELECT/UPDATE blocked: PASS
- category ownership mutation blocked: PASS
- deliberate non-RLS database error distinction: PASS
- verifier cleanup/archive: PASS

**PHASE_3_TWO_USER_RLS = PASS**

### Live application persistence smoke

Owner-attested live smoke on the Finora Vercel application:

- account create + edit + persistence: PASS
- account archive + unarchive: PASS
- category create + edit + persistence: PASS
- category archive + unarchive: PASS
- refresh + logout/login persistence: PASS
- unexpected live errors: NONE

**PHASE_3_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 3 authorization receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3_SOURCE=PASS
PHASE_3_REMOTE_DATABASE=PASS
PHASE_3_STRUCTURAL_GATE=PASS
PHASE_3_TWO_USER_RLS=PASS
PHASE_3_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_3=PASS
PHASE_4_AUTHORIZED=true
```

## Phase 4 — Transactions — Source Receipt

The final-corrective agent revision `890184010434e7b88ff8f4050dc6a1d54aae577e` materially improved Phase 4. A bounded repository audit then corrected residual issues directly on `main`.

Accepted source behavior includes:

1. transaction reads fail closed on `public.transaction_details`; there is no fallback to direct numeric table reads;
2. public transaction mutation contracts accept monetary `amount` as string only;
3. create/update/void/restore read back through the exact text view;
4. exact decimal normalization rejects invalid precision instead of silently truncating extra fractional digits;
5. a new transaction never falls back to an archived account when no active account exists;
6. monthly summaries use the actual current calendar month and exact per-currency decimal accumulation;
7. transaction filters derive runtime dates and do not perform cross-currency amount sorting;
8. truthful RFC 4180 CSV export is implemented;
9. void/restore UI is implemented with visible error handling;
10. the runtime verifier contains the full two-user integrity/isolation matrix.

Exact-head verification against source SHA `13287e773eeaa65460bd0980d502bd8885c45f9c` returned:

- local HEAD = remote main: PASS
- worktree clean: PASS
- git diff check: PASS
- TypeScript: PASS
- lint: PASS
- production build: PASS
- runtime RLS script syntax: PASS
- money coercion scan: PASS
- `as any` mutation-path scan: PASS
- exact read fail-closed: PASS
- active/historical selection behavior: PASS
- strict structural verifier inspection: PASS
- runtime full-matrix inspection: PASS

**PHASE_4_SOURCE_GATE = PASS**

## Phase 4 — Remote Database Structural Receipt

The Phase 4 migration `supabase/migrations/20260828000002_phase_4_transactions.sql` was applied to the target Supabase database.

The strict read-only structural verifier was executed after a verifier-only PostgreSQL type-cast correction at `bb6744692f786a0a86602971ee788567c2d44797`.

All 26 mandatory checks returned PASS and `99_OVERALL = PASS`.

Accepted remote facts:

- `public.transactions` exists and RLS is enabled;
- exactly three authenticated ownership policies exist with the expected SELECT/INSERT/UPDATE semantics;
- no DELETE policy exists;
- `amount` is PostgreSQL `numeric(20,4)`;
- positive-amount, INCOME/EXPENSE, merchant/note-length and currency-code constraints are present;
- no transfer or FX persistence columns exist;
- account FK is exactly `(account_id,user_id,currency_code) -> accounts(id,user_id,currency_code)` with RESTRICT delete action;
- category FK is exactly `(category_id,user_id,type) -> categories(id,user_id,type)` with RESTRICT delete action;
- required composite unique keys exist on accounts and categories;
- the transaction updated-at trigger is wired to `public.handle_updated_at()`;
- anon/PUBLIC have no transaction table or column privileges;
- authenticated has table-level SELECT only plus exact INSERT/UPDATE column allowlists;
- identity, ownership, and timestamps are not client-mutable;
- `account_balances` and `transaction_details` both use `security_invoker=true`;
- `account_balances.current_balance` and `transaction_details.amount` are exposed as text;
- authenticated has SELECT-only access to the views while anon/PUBLIC are excluded;
- no persisted `accounts.current_balance` exists;
- Phase 2/3 RLS remains enabled on profiles, user_settings, accounts, and categories.

**PHASE_4_REMOTE_DATABASE = PASS**
**PHASE_4_STRUCTURAL_GATE = PASS**

## Phase 4 — Two-User Runtime RLS / Integrity Receipt

The hardened runtime verifier was executed against the target Supabase database using only the public Supabase URL/publishable key plus two disposable test-user credentials. It exited with code `0` and made no source changes.

Accepted runtime results:

- User A authentication: PASS
- User B authentication: PASS
- User A own transaction lifecycle: PASS
- User B own transaction lifecycle: PASS
- cross-user owned-row INSERT blocked: PASS
- cross-user account/category references blocked: PASS
- cross-user SELECT blocked: PASS
- cross-user UPDATE blocked: PASS
- ownership change blocked: PASS
- domain integrity constraints: PASS
- DELETE blocked: PASS
- `security_invoker` view isolation: PASS
- deliberate non-RLS database-error distinction: PASS
- test-record cleanup: PASS

**PHASE_4_TWO_USER_RLS = PASS**
**PHASE_4_RUNTIME_PROCESS_EXIT_CODE = 0**

## Phase 4 — Live Application Persistence Receipt

Owner-attested live smoke on the deployed Finora application returned PASS for every required Phase 4 behavior:

- transaction create: PASS
- transaction edit: PASS
- transaction void: PASS
- voided transaction excluded from derived account balance: PASS
- transaction restore: PASS
- restored transaction included in derived account balance: PASS
- exact decimal persistence: PASS
- refresh persistence: PASS
- logout/login persistence: PASS
- current-month summary: PASS
- real CSV export: PASS
- unexpected live errors: NONE

**PHASE_4_LIVE_PERSISTENCE_SMOKE = PASS**

## Phase 4 — Final Authorization Receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4_SOURCE_GATE=PASS
PHASE_4_REMOTE_DATABASE=PASS
PHASE_4_STRUCTURAL_GATE=PASS
PHASE_4_TWO_USER_RLS=PASS
PHASE_4_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_4=PASS
PHASE_5_AUTHORIZED=true
```

Phase 4 is CLOSED. Reopen it only if a regression is found.

## Phase 5 — Same-Currency Transfers — Final Receipt

Phase 5 is accepted COMPLETE. Full closure evidence is preserved in `docs/receipts/PHASE_5_CLOSURE.md`.

### Source gate

Accepted application/source exact-head SHA: `27215b99484938ff25879a412449a591fe6bb9dc`.

Exact-head verification established:

- local HEAD = remote main: PASS;
- worktree clean: PASS;
- TypeScript: PASS;
- lint: PASS;
- production build: PASS;
- runtime verifier syntax: PASS;
- git diff check: PASS;
- money-path scan: PASS;
- string-only exact-decimal transfer mutation boundary: PASS;
- same-currency-only transfer design: PASS;
- transfer/net-worth neutrality design: PASS;
- Cartesian-safe account balance derivation: PASS.

**PHASE_5_SOURCE_GATE = PASS**

### Remote database + structural gate

The Phase 5 migration `supabase/migrations/20260828000003_phase_5_transfers.sql` was applied to the target Supabase project.

The strict read-only verifier was rerun after verifier-only correction SHA `897883f98ec4df0e94b5b96d6c69ab78d0f08d3e`.

All 38 mandatory checks returned PASS and `99_OVERALL = PASS`.

Accepted facts include:

- `public.transfers` exists with RLS enabled;
- exact authenticated ownership policies exist for SELECT/INSERT/UPDATE;
- DELETE is not exposed to authenticated clients;
- transfer amount is `numeric(20,4)` with positive constraint;
- source/destination must differ;
- composite ownership/currency FKs enforce own-account same-currency transfers;
- no Phase 5 FX persistence exists;
- `transfer_details` and `account_balances` are `security_invoker=true`;
- exact money view boundaries remain text;
- account balances independently pre-aggregate transaction totals, incoming transfers, and outgoing transfers;
- formula is opening balance + transaction net + incoming - outgoing;
- voided transactions/transfers are excluded;
- Phase 4 transaction RLS, grants, view semantics, and exact-money contract remain intact.

**PHASE_5_REMOTE_DATABASE = PASS**
**PHASE_5_STRUCTURAL_GATE = PASS**

### Two-user runtime RLS / integrity gate

The hardened public-key/two-user verifier exited `0` with no source changes.

Accepted runtime results:

- User A authentication: PASS;
- User B authentication: PASS;
- schema readiness: PASS;
- User A create/edit/void/restore lifecycle + net-worth neutrality: PASS;
- User B create/edit/void/restore lifecycle + net-worth neutrality: PASS;
- bidirectional cross-user isolation/spoofing blocked: PASS;
- domain/integrity rejection cases: PASS;
- Phase 4 transaction non-regression/co-derivation: PASS;
- deterministic fail-closed cleanup: PASS.

**PHASE_5_TWO_USER_RLS = PASS**
**PHASE_5_RUNTIME_PROCESS_EXIT_CODE = 0**

### Live application persistence smoke

Owner-attested live smoke returned PASS for every required Phase 5 behavior:

- transfer create: PASS;
- source balance decreases exactly: PASS;
- destination balance increases exactly: PASS;
- net-worth neutrality after create: PASS;
- transfer edit: PASS;
- net-worth neutrality after edit: PASS;
- transfer void: PASS;
- void reverses both balance effects: PASS;
- transfer restore: PASS;
- restore reapplies both balance effects: PASS;
- exact decimal persistence: PASS;
- refresh persistence: PASS;
- logout/login persistence: PASS;
- cross-currency transfer blocked truthfully: PASS;
- unexpected live errors: NONE.

**PHASE_5_LIVE_PERSISTENCE_SMOKE = PASS**

### Phase 5 final authorization receipt

```text
PHASE_0=PASS
PHASE_1=PASS
PHASE_2=PASS
PHASE_3=PASS
PHASE_4=PASS
PHASE_5_SOURCE_GATE=PASS
PHASE_5_REMOTE_DATABASE=PASS
PHASE_5_STRUCTURAL_GATE=PASS
PHASE_5_TWO_USER_RLS=PASS
PHASE_5_LIVE_PERSISTENCE_SMOKE=PASS
FINORA_PHASE_5=PASS
PHASE_6_AUTHORIZED=true
```

Phase 5 is CLOSED. Reopen it only if a concrete regression is found.

## Phase Authorization

- **Phase 0:** PASS
- **Phase 1:** PASS
- **Phase 2:** PASS
- **Phase 3 — Accounts + Categories:** PASS
- **Phase 4 — Transactions:** PASS
- **Phase 5 — Same-Currency Transfers:** PASS
- **Phase 6 — Dashboard + Reports:** AUTHORIZED

## Next Recommended Action

Author and review the precise Phase 6 — Dashboard + Reports implementation contract before changing Phase 6 application code. Phase 6 must preserve all accepted Phase 2–5 RLS, exact-money, same-currency transfer neutrality, multi-currency grouping, and no-fake-FX invariants.