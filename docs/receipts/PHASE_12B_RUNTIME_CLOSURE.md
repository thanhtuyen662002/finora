# Finora Phase 12B Runtime Closure Receipt

Date: 2026-09-08  
Repository: `thanhtuyen662002/finora`  
Production origin: https://finora-orpin-nu.vercel.app  
Production source commit: `910568da9c9ce76f61a3d9b063d361803b216325`  
Production deployment: `dpl_C3JPA52wYW5ZeNGjRrh6KEBQxaUo` (READY)

## Runtime gates

### Near-limit transport

PASS. An authenticated production receipt upload used a JPEG measuring `4,108,479` bytes with dimensions `2048 × 3072`. The file is below the `4,194,304` byte application cap and the `4,350,000` byte Server Action body budget. The upload reached the receipt-analysis flow successfully.

### Live receipt analysis and zero analyze mutation

PASS. The production receipt flow returned a valid draft:

- amount: `85000.0000 VND`
- occurred_on: `2026-09-08`
- merchant: `FINORA TEST MART`
- note: `Coffee, Sandwich`

The pre-save read-only database check contained one existing `FINORA TEST MART` transaction. No additional row was created by analysis or draft application; persistence occurred only after the standard explicit Save action.

### Explicit Save cardinality

PASS. Each explicit Save action created exactly one transaction row. After two deliberate Save actions (one ordinary test image and one near-limit image), the read-only verification returned:

- row_count: `2`
- amount per row: `85000.0000 VND`
- merchant total: `170000.0000 VND`
- account: `MBBank`
- category: `Ăn uống`

The two identical-looking rows are the result of two deliberate Save actions, not automatic duplication or retry behavior.

## Post-test production data reset

PASS. Authorized SQL reset removed all financial/test rows while preserving login identities and user settings:

- auth.users: `5` preserved
- profiles: `5` preserved
- user_settings: `5` preserved
- accounts: `0`
- transactions: `0`
- transfers: `0`
- budgets: `0`
- goals: `0`
- recurring_items: `0`
- income_sources: `0`
- income_source_streams: `0`
- transaction_fx_snapshots: `0`
- categories: `60` clean defaults (`12` per user)
- storage.objects: `0`

No schema, migration, or source-code changes were made by the reset.

## Deployment health

- Production login route: HTTP `200`.
- Vercel runtime errors in the last 24 hours: none.
- GitHub open PRs: none.
- GitHub open issues: none.

## Final constants

```text
PHASE_12B_NEAR_LIMIT_TRANSPORT=PASS
PHASE_12B_LIVE_ANALYZE=PASS
PHASE_12B_ANALYZE_FINANCIAL_MUTATION=false
PHASE_12B_EXPLICIT_SAVE_CARDINALITY=PASS
PHASE_12B_RUNTIME=PASS
PHASE_12B_DATABASE_RESET=PASS
PHASE_12B_OVERALL=CLOSED_PASS
REAL_GEMINI_PRODUCTION_SMOKE=PASS
DATABASE_SCHEMA_MUTATION=NONE
```
