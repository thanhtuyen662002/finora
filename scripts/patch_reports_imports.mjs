import fs from 'fs';
let content = fs.readFileSync('src/features/reports/reports.ts', 'utf-8');

content = content.replace(
  "import { convertExactAmountPure, addExactDecimals } from '@/lib/exchange-rate';",
  "import { convertExactAmount } from '@/lib/exchange-rate/fx-math';\nimport { addExactDecimals } from '@/lib/money';"
);

content = content.replace(
  /convertExactAmountPure/g,
  "convertExactAmount"
);

fs.writeFileSync('src/features/reports/reports.ts', content);
