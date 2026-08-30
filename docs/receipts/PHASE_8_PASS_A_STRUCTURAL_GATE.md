# Finora Phase 8 — Pass A Structural Gate Receipt

## Accepted source baseline

- Accepted Phase 8 Pass A application/verifier source: `14f431f18d3d2182fcf184b74b6222cbe7c5bbaa`
- Source gate receipt commit: `178105168a598d6750a02769d35eebf3fefb68f5`
- Phase 7 migration blob: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration blob: `69e3ff637c0430fa701794aff497f81eb875443e`

## Remote database evidence

The owner applied `supabase/migrations/20260829000001_phase_8_fx.sql` to the target Supabase project and then executed `scripts/verify-phase8-db.sql` read-only against the live database.

Every emitted structural check returned `true`, including:

- exact snapshot columns/types/defaults;
- all snapshot CHECK constraints;
- transactions composite unique key;
- snapshot version unique key;
- composite snapshot transaction FK with RESTRICT;
- RLS enabled and exact SELECT ownership policy;
- no anon/PUBLIC table or view grants;
- authenticated table/view SELECT-only grants;
- exact `auto_fx_enabled` column UPDATE grant and no anon/PUBLIC column grant;
- snapshot details view existence, exact columns, text money/rate casts and `security_invoker=true`;
- `auto_fx_enabled` exact structure;
- Phase 2–7 RLS non-regression;
- Phase 5 same-currency transfer non-regression;
- accepted prior views remain `security_invoker=true`.

Verifier terminal result:

```text
99_OVERALL=true
```

## Gate result

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=AUTHORIZED_TO_RUN
PHASE_8_LIVE_PERSISTENCE_SMOKE=NOT_RUN
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

Phase 8 Pass A structural gate is accepted. The next authorized action is the two-user public-key runtime RLS verifier. Service-role credentials are prohibited for that verifier.
