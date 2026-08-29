# Finora Phase 7 Two-User RLS Gate Receipt

## Status

PASS

## Accepted application and migration provenance

- Accepted Phase 7 application/source SHA: `ec1dcc338a26ea14e356aea5ec5c8e4429404a1a`
- Phase 7 migration blob SHA: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Structural gate receipt commit: `7695b4f53eef7275f3a8bd10a51db170001161c7`

## Accepted runtime verifier provenance

- Runtime-verifier corrective prompt commit: `771692582f0d4d7f1446f811863a15ce9688aaf6`
- Runtime-verifier implementation commit on remote main: `76fc6fbe3b7e3ad67d09a90c8c5c8fd6f9867d97`
- `scripts/verify-phase7-rls.mjs` blob SHA: `75aa63e016db2a7897584b8057de0e9dc3268d74`
- `scripts/verify-phase7-source.mjs` blob SHA: `852fcb599793c42056614b5a5d5c14617035643e`

The runtime execution report carried a stale `REMOTE_MAIN_SHA` value equal to the corrective prompt commit, but the reported verifier blob SHAs exactly match the files subsequently verified on GitHub remote main at `76fc6fbe3b7e3ad67d09a90c8c5c8fd6f9867d97`. The corrective commit changes exactly the two verifier files.

## Live two-user runtime verification

The runtime verifier was executed with Node.js against the target Supabase project using the public/publishable client and two distinct authenticated users. Process exit code was `0`.

PASS markers:

- `AUTH_USER_A=PASS`
- `AUTH_USER_B=PASS`
- `SCHEMA_READINESS_PHASE7=PASS`
- `USER_A_BUDGET_LIFECYCLE=PASS`
- `USER_A_GOAL_LIFECYCLE=PASS`
- `USER_A_RECURRING_LIFECYCLE=PASS`
- `USER_B_FULL_LIFECYCLE=PASS`
- `BIDIRECTIONAL_CROSS_USER_ISOLATION=PASS`
- `DOMAIN_REJECTION_MATRIX=PASS`
- `PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS`
- `PHASE5_TRANSFER_BUDGET_NEUTRALITY_REGRESSION=PASS`
- `DELIBERATE_NON_RLS_ERROR_DISTINCTION=PASS`
- `DETERMINISTIC_CLEANUP_ASSERTIONS=PASS`
- `ALL PHASE 7 LIVE RLS RUNTIME CONTRACTS PASSED.`

The corrected verifier compares monetary values by exact decimal semantics using string/BigInt normalization, verifies authoritative money through security-invoker exact-money views, recovers stale fixtures from prior failed runs, creates uniquely named fixtures, and guarantees deterministic cleanup through `try/finally` on both PASS and FAIL.

## Gate state

- `PHASE_7_SOURCE_GATE=PASS_CODE_ONLY`
- `PHASE_7_REMOTE_DATABASE=PASS`
- `PHASE_7_STRUCTURAL_GATE=PASS`
- `PHASE_7_TWO_USER_RLS=PASS`
- `PHASE_7_LIVE_PERSISTENCE_SMOKE=NOT_RUN`
- `PHASE_7_OVERALL=PARTIAL`
- `PHASE_8_AUTHORIZED=false`

Phase 7 must remain open until the owner completes live UI persistence smoke for Budgets, Goals, and Recurring and attests the results.
