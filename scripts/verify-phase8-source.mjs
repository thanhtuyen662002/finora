import { readFileSync } from 'fs';
let failed = false;
function checkFile(path, rules) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const rule of rules) {
      if (!rule.test(text)) {
        console.error(`FAIL: ${path} failed rule ${rule}`);
        failed = true;
      }
    }
  } catch (err) {
    console.error(`FAIL: Could not read ${path}`);
    failed = true;
  }
}
checkFile('src/lib/exchange-rate/frankfurter.ts', [
  /v2\/rates\.csv/
]);
checkFile('src/lib/exchange-rate/fx-math.ts', [
  /function toExactRate/,
  /function convertExactAmount/
]);
checkFile('src/app/api/fx/transaction-snapshots/route.ts', [
  /transaction_details/,
  /transaction_fx_snapshot_details/
]);
checkFile('src/app/api/fx/current-batch/route.ts', [
  /Promise\.all/
]);
if (failed) {
  process.exit(1);
} else {
  console.log('Phase 8 Source Verification PASSED');
}
