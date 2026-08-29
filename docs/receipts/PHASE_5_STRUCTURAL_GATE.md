# Finora Phase 5 — Remote Database Structural Gate Receipt

## Status

```text
PHASE_5_SOURCE_GATE=PASS
PHASE_5_REMOTE_DATABASE=PASS
PHASE_5_STRUCTURAL_GATE=PASS
PHASE_5_TWO_USER_RLS=PENDING
PHASE_5_LIVE_PERSISTENCE_SMOKE=PENDING
PHASE_5_OVERALL=PARTIAL
PHASE_6_AUTHORIZED=false
```

## Provenance

- Accepted Phase 5 application/source exact-head SHA: `27215b99484938ff25879a412449a591fe6bb9dc`
- Phase 5 migration: `supabase/migrations/20260828000003_phase_5_transfers.sql`
- Structural verifier false-negative fix SHA: `897883f98ec4df0e94b5b96d6c69ab78d0f08d3e`
- Structural verifier: `scripts/verify-phase5-db.sql`

The verifier-only fix changed only `scripts/verify-phase5-db.sql`; it did not change the Phase 5 migration, application code, or runtime RLS verifier. Therefore the accepted application/source gate remains bound to `27215b99484938ff25879a412449a591fe6bb9dc`.

## Remote Database Structural Result

The Phase 5 migration was applied to the target Supabase database. The complete strict structural verifier was then rerun after the verifier-only correction.

All 38 mandatory checks returned `PASS`, and `99_OVERALL` returned:

```text
PASS
All 38 Phase 5 structural, derivation, non-regression, and security checks passed
```

Accepted remote facts include:

- `public.transfers` exists with RLS enabled;
- exactly three authenticated ownership policies exist for SELECT, INSERT, and UPDATE;
- no DELETE policy exists;
- `amount` is `numeric(20,4)` with positive-amount constraint;
- source and destination accounts must differ;
- currency format and note-length constraints are present;
- source and destination composite FKs bind `(account_id,user_id,currency_code)` to the owner's same-currency accounts with `ON DELETE RESTRICT`;
- no transfer FX persistence columns exist;
- transfer `updated_at` trigger is wired to `public.handle_updated_at()`;
- anon/PUBLIC have no transfer privileges;
- authenticated has table-level SELECT only plus exact INSERT/UPDATE column allowlists;
- transfer identity, ownership, and trigger-managed timestamps are not client mutable;
- `transfer_details` uses `security_invoker=true` and exposes `amount` as text;
- Phase 4 transaction table, RLS, policies, DELETE prohibition, grants, exact read view, and text amount boundary remain intact;
- `account_balances` uses `security_invoker=true`, returns `current_balance` as text, and independently pre-aggregates transaction totals, incoming transfers, and outgoing transfers before joining accounts;
- derived balance semantics are opening balance + transaction net + incoming transfers - outgoing transfers;
- voided transactions and transfers are excluded from active balance aggregation;
- authenticated has SELECT-only view access while anon/PUBLIC are excluded;
- `accounts.current_balance` remains derived-only and is not persisted;
- RLS remains enabled for profiles, user_settings, accounts, categories, transactions, and transfers.

## Next Gate

Phase 5 two-user runtime RLS/integrity verification is authorized.

Do not begin Phase 6. Phase 5 remains PARTIAL until runtime verification and owner live persistence smoke both pass.
