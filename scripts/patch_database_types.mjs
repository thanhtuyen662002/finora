import fs from 'fs';
let content = fs.readFileSync('src/types/database.ts', 'utf-8');

const fxSnapshotType = `
      transaction_fx_snapshots: {
        Row: {
          transaction_id: string;
          user_id: string;
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
          transaction_id: string;
          user_id?: string;
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
          transaction_id?: string;
          user_id?: string;
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
      };
`;

content = content.replace("    Tables: {", "    Tables: {" + fxSnapshotType);

fs.writeFileSync('src/types/database.ts', content);
