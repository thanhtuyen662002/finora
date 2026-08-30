# Finora Phase 8 — Pass A BASE Mode Final Corrective Acceptance Receipt

## Authority

- Accepted remote implementation SHA: `21fb405f4fd9aea707ff9a8b29c019cd05f837f3`
- Parent corrective prompt SHA: `a44fe4517a7f1cedba2efaeed7b7225e34d9f8cd`
- Rejected predecessor implementation SHA: `033673f113871ab1153eae0446088613a002b230`
- Phase 7 migration blob: `5da681f7c66fdd85acda79172d1ad305496c6313`
- Phase 8 migration blob: `69e3ff637c0430fa701794aff497f81eb875443e`

## Audited acceptance

The remote implementation is accepted for the Phase 8 Pass A UX/performance + BASE-mode code gate.

Audited invariants:

- current BASE valuation iterates active current account groups with holdings rather than report `availableCurrencies`;
- archived-only and historical-only currencies do not require current FX quotes;
- missing current quote for an active foreign holding remains fail-closed;
- historical transactions linked to archived accounts remain eligible for historical BASE conversion;
- native-first Reports keeps BASE discoverable without initial FX requests;
- explicit BASE remains the path that performs current/historical FX work;
- Reports and Dashboard fail closed when BASE historical/current authority is unavailable rather than rendering authoritative zero values;
- rejected baseline `41b61488dacee4d0167fe35224dfc73f6a206395` is required to report all `6/6` BASE-mode defect classes;
- Phase 7 and Phase 8 migrations remain unchanged.

## Gate state

```text
PHASE_8_PASS_A_SOURCE_GATE=PASS_CODE_ONLY
PHASE_8_REMOTE_DATABASE=PASS
PHASE_8_STRUCTURAL_GATE=PASS
PHASE_8_TWO_USER_RLS=PASS
PHASE_8_UX_PERFORMANCE_HARDENING=PASS_CODE_ONLY
PHASE_8_BASE_MODE_FINAL_CORRECTIVE=PASS_CODE_ONLY
PHASE_8_LIVE_PERSISTENCE_SMOKE=PENDING_RETEST
PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=NOT_STARTED
PHASE_8_OVERALL=PARTIAL
PHASE_9_AUTHORIZED=false
```

## Next gate

Perform owner live retest of Dashboard, Reports, and Settings on the deployed environment. Do not reapply migrations or rerun already accepted DB/RLS gates unless a new concrete database defect is discovered.
