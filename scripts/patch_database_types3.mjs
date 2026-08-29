import fs from 'fs';
let content = fs.readFileSync('src/types/database.ts', 'utf-8');

// Add auto_fx_enabled to user_settings
content = content.replace(
  "          theme: 'light' | 'dark' | 'system';\n          created_at: string;\n          updated_at: string;",
  "          theme: 'light' | 'dark' | 'system';\n          auto_fx_enabled: boolean;\n          created_at: string;\n          updated_at: string;"
);
content = content.replace(
  "          theme?: 'light' | 'dark' | 'system';\n          created_at?: string;\n          updated_at?: string;",
  "          theme?: 'light' | 'dark' | 'system';\n          auto_fx_enabled?: boolean;\n          created_at?: string;\n          updated_at?: string;"
);
content = content.replace(
  "          theme?: 'light' | 'dark' | 'system';\n          created_at?: string;\n          updated_at?: string;",
  "          theme?: 'light' | 'dark' | 'system';\n          auto_fx_enabled?: boolean;\n          created_at?: string;\n          updated_at?: string;"
);

// Add transaction_fx_snapshots
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
        Relationships: [
          {
            foreignKeyName: "transaction_fx_snapshots_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {`;

content = content.replace("      profiles: {", fxSnapshotType);

fs.writeFileSync('src/types/database.ts', content);
