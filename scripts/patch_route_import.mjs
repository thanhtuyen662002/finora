import fs from 'fs';
let content = fs.readFileSync('src/app/api/fx/transaction-snapshots/route.ts', 'utf-8');
content = content.replace(
  "import { defaultFxProvider, convertExactAmountPure } from '@/lib/exchange-rate';",
  "import { defaultFxProvider, convertExactAmount } from '@/lib/exchange-rate';"
);
content = content.replace(
  "convertExactAmountPure(String(tx.amount), rate.rate)",
  "convertExactAmount(String(tx.amount), rate.rate)"
);
fs.writeFileSync('src/app/api/fx/transaction-snapshots/route.ts', content);
