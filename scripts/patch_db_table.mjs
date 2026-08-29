import fs from 'fs';
const file = 'src/types/database.ts';
let content = fs.readFileSync(file, 'utf-8');

// I will just use regex to replace the entire transaction_fx_snapshots block
const tableRegex = /transaction_fx_snapshots:\s*\{[\s\S]*?(?=\s*(profiles|user_settings|accounts|categories|transactions|transfers|budgets|goals|recurring_items):\s*\{)/;

const newTableBlock = `transaction_fx_snapshots: {
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
      };
      `;

content = content.replace(tableRegex, newTableBlock);

fs.writeFileSync(file, content);
