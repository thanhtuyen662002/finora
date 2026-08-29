import fs from 'fs';
let content = fs.readFileSync('src/app/api/fx/transaction-snapshots/route.ts', 'utf-8');

content = content.replace(
  "for (const s of raceSnapshots) {",
  "for (const s of (raceSnapshots as any[])) {"
);

content = content.replace(
  "for (const s of inserted) {",
  "for (const s of (inserted as any[])) {"
);

fs.writeFileSync('src/app/api/fx/transaction-snapshots/route.ts', content);
