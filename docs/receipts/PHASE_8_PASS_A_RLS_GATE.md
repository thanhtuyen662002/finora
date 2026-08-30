# Finora Phase 8 — Pass A Two-User RLS Gate Receipt

## Authority

- Repository: `thanhtuyen662002/finora`
- Source gate receipt parent: `178105168a598d6750a02769d35eebf3fefb68f5`
- Structural gate receipt parent: `2fbec45b4165b57ac1fa68cfc1cc2f4e1a3346bd`
- Phase 7 migration blob: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration blob: `69e3ff637c0430fa701794aff497f81eb875443e`
- Runtime verifier: `scripts/verify-phase8-rls.mjs`

## Owner-Run Runtime Result

The owner ran the two-user runtime verifier locally against the live Supabase project using public/publishable credentials and two distinct authenticated users. The supplied complete terminal output ended with:

```text
99_OVERALL=PASS
```

Accepted runtime evidence:

- User A authentication: PASS
- User B authentication: PASS
- Distinct user IDs: PASS
- User settings lifecycle for A/B: PASS
- Bidirectional settings SELECT/UPDATE isolation: PASS
- Browser snapshot INSERT denial with RLS `42501`: PASS
- Snapshot UPDATE denial with canonical mutation readback proof: PASS
- Snapshot DELETE denial with canonical mutation readback proof: PASS
- Bidirectional snapshot table isolation: PASS
- Bidirectional snapshot `security_invoker` view isolation: PASS
- Phase 4 transaction owner/foreign-user isolation: PASS
- Phase 4 exact account balance effect: PASS
- Phase 4 void restores balance: PASS
- Phase 5 transfer owner/foreign-user isolation: PASS
- Phase 5 exact source/destination balance effects: PASS
- Phase 5 combined transfer neutrality / void restoration: PASS
- Deliberate non-RLS FK error distinguished from RLS error: PASS
- Deterministic settings restoration: PASS
- Deterministic transaction void cleanup + readback: PASS
- Deterministic transfer void cleanup + readback: PASS
- Deterministic account archive cleanup + readback: PASS
- Deterministic category archive cleanup + readback: PASS

## Gate Decision

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_LIVE_PERSISTENCE_SMOKE=AUTHORIZED_TO_RUN
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

Phase 8 Pass A is not yet closed. Live application persistence/FX smoke remains mandatory before Pass A closure.
