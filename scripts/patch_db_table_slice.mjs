import fs from 'fs';
const file = 'src/types/database.ts';
let lines = fs.readFileSync(file, 'utf-8').split('\n');

const newTableLines = `      transaction_fx_snapshots: {
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
        Insert: {
          id?: string;
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
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_id?: string;
          source_currency_code?: string;
          target_currency_code?: string;
          source_amount?: string;
          rate?: string;
          converted_amount?: string;
          requested_date?: string;
          effective_date?: string;
          provider?: string;
          created_at?: string;
        };
      };`.split('\n');

// Find Tables: {
const tablesIndex = lines.findIndex(l => l.includes('Tables: {'));
// Find profiles: {
const profilesIndex = lines.findIndex(l => l.includes('profiles: {'));

// Replace everything between Tables: { and profiles: {
lines.splice(tablesIndex + 1, profilesIndex - tablesIndex - 1, ...newTableLines);

fs.writeFileSync(file, lines.join('\n'));
