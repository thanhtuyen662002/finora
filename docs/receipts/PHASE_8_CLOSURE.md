# Finora Phase 8 — Closure Receipt

## Status

Phase 8 — Multi-Currency + FX is accepted COMPLETE.

## Accepted source authority

- Authoritative accepted pre-closure implementation SHA: `0294c5faaa751b950aae152e1ec1789ff5b32891`
- Supabase Project ID: `qibfitbnlfgiqctntufr`
- Production application URL: `https://finora-orpin-nu.vercel.app`

## Pass A

`PHASE_8_PASS_A = PASS`

Accepted scope includes:
- Multi-currency BASE valuation in Dashboard and Reports
- Exact string/decimal money arithmetic (no floating point drift)
- Historical FX snapshots in database and domain layer
- Fail-closed missing-FX behavior without zero masquerading
- Active-account valuation iteration
- BASE and native currency reporting modes
- Accepted brand identity, theme toggle, and logo behavior

## Pass B source and migration authority

- `PHASE_8_PASS_B_SOURCE = PASS_CODE_ONLY`
- `PHASE_8_PASS_B_REMOTE_MIGRATIONS = PASS`
- `PHASE_8_PASS_B_SEARCH_PATH_CORRECTIVE = PASS`
- `PHASE_8_PASS_B_CATALOG_STRUCTURAL_ASSERTIONS = PASS`
- `PHASE_8_PASS_B_STRUCTURAL_REMOTE_GATE = PASS`
- `PHASE_8_PASS_B_SECURITY_ADVISOR_PASS_B_SCOPE = PASS`

Production migration chain:
- `20260828000000`
- `20260828000001`
- `20260828000002`
- `20260828000003`
- `20260829000000`
- `20260829000001`
- `20260829000002` (blob SHA: `e046ea3f62aaa76f00295e68126ca29a48bfaa9b`)
- `20260831142135` (blob SHA: `5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18`)
- `20260831144154` (blob SHA: `3ee23b513bcd65182afa613084dda8fbf5b40293`)
- `20260831150000` (blob SHA: `78be2172d313935057aee57fccfc98ed73a5b4d4`)

## Remote database structural gate

Accepted structural facts:
- `transfers` exact numeric precision = PASS (`numeric(18,4)` amounts, `numeric(18,12)` rate)
- Cross-currency conversion CHECK = PASS (`chk_transfers_conversion_rate`)
- Same-currency invariant CHECK = PASS (`chk_transfers_same_currency_rate_and_dest`)
- Currency compatibility CHECK = PASS (`chk_transfers_currency_compatibility`)
- Composite user/currency account FKs = PASS (`fk_transfers_source_account_currency`, `fk_transfers_destination_account_currency`)
- Foreign key deletion semantics = `ON DELETE RESTRICT` (PASS)
- Row Level Security (RLS) enabled on `public.transfers` = PASS
- Authenticated SELECT policy with `auth.uid() = user_id` = PASS
- Authenticated INSERT policy with `auth.uid() = user_id` = PASS
- Authenticated UPDATE policy with `auth.uid() = user_id` = PASS
- DELETE policy absent on `public.transfers` = PASS
- Anonymous access to `public.transfers` denied = PASS
- Authenticated column grant allowlist enforced = PASS
- `public.transfer_details` view `security_invoker = true` = PASS
- `public.account_balances` view `security_invoker = true` = PASS
- Trigger `trg_check_transfer_accounts_active` configured `BEFORE INSERT OR UPDATE FOR EACH ROW` = PASS
- Trigger function `check_transfer_accounts_active` configured `SECURITY INVOKER` (`prosecdef = false`) with `search_path = ''` = PASS

## Security hardening

- Function `check_transfer_accounts_active` explicitly sets `search_path = ''` resolving the Supabase Security Advisor `function_search_path_mutable` warning.
- Direct invocation and trigger evaluation operate with least-privilege security invoker context.

## Authenticated two-user runtime RLS gate

Authoritative harness: `scripts/verify-phase8-pass-b-runtime.sql`
- Transaction isolation: `BEGIN ... ROLLBACK`
- Dynamic two-user discovery: two real `auth.users`
- Session context: `SET LOCAL ROLE authenticated` with `request.jwt.claim.sub`
- Isolation verification: User B cannot SELECT or UPDATE User A transfers
- Account boundary verification: Cross-user account reference rejected by composite FKs
- DELETE authority: Revoked/denied for authenticated role
- Negative integrity verification: Bad same-currency rates, destination amounts, currency mismatches, same-account transfers, and archived-account transfers rejected with specific SQLSTATEs
- Transaction isolation: Transfers do not mutate or insert records in `public.transactions`

Post-execution database audit:
- 0 leftover test fixtures in database
- ROLLBACK cleanup verified

`PHASE_8_PASS_B_TWO_USER_RLS_RUNTIME = PASS`

## Void / restore runtime gate

- Transfer voiding sets `is_voided = true` and rolls back balance impacts on both source and destination accounts
- Transfer restoring resets `is_voided = false` and re-applies exact balance deductions/additions
- Historical FX rate and destination amount remain immutable during void/restore cycles

`PHASE_8_PASS_B_VOID_RESTORE_RUNTIME = PASS`

## Live production persistence smoke

Owner-attested live authenticated cross-currency transfer executed via deployed Finora UI:
- Source account currency: USD
- Destination account currency: VND
- Outgoing amount: `10.0000`
- Exchange rate: `26044.000000000000`
- Destination amount: `260440.0000`
- Exact arithmetic: `10.0000 * 26044.000000000000 = 260440.0000`
- API trace:
  - Account lookup: HTTP 200
  - Transfer insert (`POST /rest/v1/transfers`): HTTP 201
  - Transfer details query (`GET /rest/v1/transfer_details`): HTTP 200
  - Account balances query (`GET /rest/v1/account_balances`): HTTP 200
- Full browser refresh and re-fetch:
  - Auth user verification: HTTP 200
  - Accounts query: HTTP 200
  - Account balances query: HTTP 200
  - Profiles query: HTTP 200
  - User settings query: HTTP 200
- Exact balance verification:
  - Source USD account: opening `20.0000` - transfer `10.0000` = `10.0000` (MATCH)
  - Destination VND account: opening `0.0000` - net transactions `50000.0000` + transfer `260440.0000` = `210440.0000` (MATCH)

```text
LIVE_AUTHENTICATED_CREATE=PASS
LIVE_READ_AFTER_WRITE=PASS
LIVE_REFRESH_PERSISTENCE=PASS
LIVE_TRANSFER_DETAILS=PASS
LIVE_SOURCE_BALANCE_EFFECT=PASS
LIVE_DESTINATION_BALANCE_EFFECT=PASS
LIVE_DUAL_CURRENCY_BALANCE_INTEGRITY=PASS
```

`PHASE_8_PASS_B_LIVE_PERSISTENCE_SMOKE = PASS`

## Production deployment authority

- Production Vercel deployment bound to authoritative GitHub commit `0294c5faaa751b950aae152e1ec1789ff5b32891`
- Deployment State: `READY`
- Target: `production`

## Final authorization

```text
PHASE_8_PASS_A=PASS
PHASE_8_PASS_B_SOURCE=PASS_CODE_ONLY
PHASE_8_PASS_B_REMOTE_MIGRATIONS=PASS
PHASE_8_PASS_B_SEARCH_PATH_CORRECTIVE=PASS
PHASE_8_PASS_B_CATALOG_STRUCTURAL_ASSERTIONS=PASS
PHASE_8_PASS_B_STRUCTURAL_REMOTE_GATE=PASS
PHASE_8_PASS_B_SECURITY_ADVISOR_PASS_B_SCOPE=PASS
PHASE_8_PASS_B_TWO_USER_RLS_RUNTIME=PASS
PHASE_8_PASS_B_VOID_RESTORE_RUNTIME=PASS
PHASE_8_PASS_B_LIVE_PERSISTENCE_SMOKE=PASS
PHASE_8_PASS_B=PASS
PHASE_8_OVERALL=PASS
FINORA_PHASE_8=PASS
PHASE_9_AUTHORIZED=true
```

Phase 8 is CLOSED.
Reopen Phase 8 only if a concrete regression is found.

Phase 9 is authorized for contract definition and subsequent implementation.
Phase 9 implementation has not started in this closure task.
