import fs from 'fs';
const file = 'src/app/api/fx/transaction-snapshots/route.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  'const match = existingSnapshots?.find(s =>',
  'const match = (existingSnapshots as any[])?.find(s =>'
);

content = content.replace(
  'const s = finalSnapshots.find(s =>',
  'const s = (finalSnapshots as any[]).find(s =>'
);

fs.writeFileSync(file, content);
