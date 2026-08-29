import fs from 'fs';
const file = 'src/types/database.ts';
let lines = fs.readFileSync(file, 'utf-8').split('\n');

const viewLines = `      transaction_fx_snapshot_details: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          source_currency_code: string;
          target_currency_code: string;
          source_amount: string;
          rate: string;
          converted_amount: string;
          requested_date: string;
          effective_date: string;
          provider: string;
          created_at: string;
        };
      };`.split('\n');

const viewsIndex = lines.findIndex(l => l.includes('Views: {'));
if (viewsIndex !== -1) {
  // Check if it's already there
  const nextLine = lines[viewsIndex + 1];
  if (!nextLine.includes('transaction_fx_snapshot_details')) {
    lines.splice(viewsIndex + 1, 0, ...viewLines);
    fs.writeFileSync(file, lines.join('\n'));
  }
}
