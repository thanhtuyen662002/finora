import fs from 'fs';
const file = 'docs/DATABASE.md';
let content = fs.readFileSync(file, 'utf-8');

const additional = `
## Phase 8: Multi-Currency FX
- **transaction_fx_snapshots**: Stores immutable point-in-time exact-decimal FX records for transactions.
  - \`rate\`: \`numeric(30,12)\` exact exchange rate.
  - \`source_amount\`, \`converted_amount\`: \`numeric(20,4)\`.
  - Composite unique key ensuring a single snapshot per transaction per target currency.
  - RLS restricted to owner.
  - Reads exposed via exact-text view \`transaction_fx_snapshot_details\`.
`;

if (!content.includes('transaction_fx_snapshots')) {
  content += additional;
  fs.writeFileSync(file, content);
}
