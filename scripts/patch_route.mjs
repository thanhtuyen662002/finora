import fs from 'fs';
let content = fs.readFileSync('src/app/api/fx/transaction-snapshots/route.ts', 'utf-8');

content = content.replace(
  "(inserted as any[]).forEach(row => {\n              finalMap.set(row.transaction_id, {",
  "(inserted as any[]).forEach((row: any) => {\n              finalMap.set(row.transaction_id, {"
);

content = content.replace(
  "((raceSnapshots as any[]) || []).forEach(row => {\n                  finalMap.set(row.transaction_id, {",
  "((raceSnapshots as any[]) || []).forEach((row: any) => {\n                  finalMap.set(row.transaction_id, {"
);

content = content.replace(
  "existingSnapshots.forEach(row => {\n        finalMap.set(row.transaction_id, {",
  "(existingSnapshots as any[]).forEach((row: any) => {\n        finalMap.set(row.transaction_id, {"
);

fs.writeFileSync('src/app/api/fx/transaction-snapshots/route.ts', content);
