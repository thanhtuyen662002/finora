import fs from 'fs';
const file = 'src/types/database.ts';
let content = fs.readFileSync(file, 'utf-8');

// Replace the existing transaction_fx_snapshots
const oldTableBlock = `      transaction_fx_snapshots: {
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
      };`;

const newTableBlock = `      transaction_fx_snapshots: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          source_currency_code: string;
          target_currency_code: string;
          source_amount: number;
          rate: number;
          converted_amount: number;
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
          source_amount: number;
          rate: number;
          converted_amount: number;
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
          source_amount?: number;
          rate?: number;
          converted_amount?: number;
          requested_date?: string;
          effective_date?: string;
          provider?: string;
          created_at?: string;
        };
      };`;

content = content.replace(oldTableBlock, newTableBlock);

const viewBlock = `      transaction_fx_snapshot_details: {
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
      };`;

if (!content.includes('transaction_fx_snapshot_details: {')) {
  content = content.replace('Views: {', 'Views: {\n' + viewBlock);
}

fs.writeFileSync(file, content);
