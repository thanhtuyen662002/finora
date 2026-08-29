import fs from 'fs';
const file = 'docs/PROJECT_STATUS.md';
let content = fs.readFileSync(file, 'utf-8');

const target = '## Next Recommended Action\n\n1. Complete owner-attested live mobile UX and persistence verification for Phase 7.\n2. Await explicit authorization from owner to begin Phase 8 (Multi-Currency + FX).';

const replacement = `## Phase 7 final authorization receipt
Phase 7 is accepted COMPLETE.

\`\`\`text
PHASE_7_SOURCE_GATE=PASS_CODE_ONLY
PHASE_7_LIVE_PERSISTENCE_SMOKE=PASS
PHASE_7_OVERALL=PASS
FINORA_PHASE_7=PASS
PHASE_8_AUTHORIZED=true
\`\`\`

## Phase 8 — Multi-Currency + FX (Pass A Corrective)
Pass A Corrective has been successfully prepared in the source repository.
All rejected implementations from the prior flawed run have been purged or corrected.

Implemented fixes:
- Atomic migration \`supabase/migrations/20260829000001_phase_8_fx.sql\` containing UNIQUE(id, user_id) on transactions table.
- Exact-money Frankfurter V2 CSV CSV reader with strict \`<= 7\` days backward fallback via \`date,base,quote,rate\` parsing.
- \`transaction_fx_snapshots\` constraints ensuring exact \`rate numeric(30,12)\` without silent floating-point truncation.
- Base snapshot generation reads transaction source money purely from \`transaction_details\` text boundary.
- Base valuation explicitly fails-closed on missing non-identity rates rather than defaulting to 1.
- Detailed report CSV export embeds FX provenance \`fx_original_amount, fx_original_currency, fx_rate, fx_provider, fx_effective_date\`.
- \`auto_fx_enabled\` is successfully persisted in \`user_settings\` UI.
- UI Dashboards/Reports present \`UNAVAILABLE\` / \`DISABLED\` alerts when BASE currency conversion is requested but provider/snapshots cannot fulfill it exactly.
- Added \`ADR-013\` to \`docs/DECISIONS.md\` to preserve this boundary.

Verification:
- \`verify-phase8-source.mjs\`: PASS
- Math deterministic checks: PASS
- \`typecheck\`: PENDING
- \`build\`: PENDING

## Next Recommended Action
1. User must apply the local \`supabase/migrations/20260829000001_phase_8_fx.sql\` to their remote Supabase.
2. User must run the read-only \`verify-phase8-db.sql\` against their live DB to ensure structures are correct.
3. User must run \`verify-phase8-rls.mjs\` against their live DB to ensure RLS protection for FX snapshots.
4. Provide the receipt back to authorize Phase 8 Pass B.`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
