import fs from 'fs';
const file = 'src/types/database.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  '          created_at?: string;\n        };\n      };\n      profiles:',
  '          created_at?: string;\n        };\n        Relationships: [\n          {\n            foreignKeyName: "transaction_fx_snapshots_transaction_id_fkey"\n            columns: ["transaction_id"]\n            isOneToOne: false\n            referencedRelation: "transactions"\n            referencedColumns: ["id"]\n          }\n        ];\n      };\n      profiles:'
);

content = content.replace(
  '          created_at: string;\n        };\n      };\n      account_balances:',
  '          created_at: string;\n        };\n        Relationships: [];\n      };\n      account_balances:'
);

fs.writeFileSync(file, content);
