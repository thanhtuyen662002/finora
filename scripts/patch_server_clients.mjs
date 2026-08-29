import fs from 'fs';

for (const file of [
  'src/app/api/fx/current-batch/route.ts',
  'src/app/api/fx/rate/route.ts',
  'src/app/api/fx/transaction-snapshots/route.ts'
]) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace("const supabase = createClient();", "const supabase = await createClient();");
  if (file.includes('transaction-snapshots')) {
     content = content.replace(/convertExactAmountPure/g, 'convertExactAmount');
  }
  fs.writeFileSync(file, content);
}
