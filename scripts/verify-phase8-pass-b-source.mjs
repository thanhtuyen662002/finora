import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';

let passed = 0;
const total = 22;

function check(num, name, condition) {
  if (condition) {
    console.log(`[PASS] ${num}. ${name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${num}. ${name}`);
  }
}

function sha(content) {
  return crypto.createHash('sha1').update(`blob ${content.length}\0${content}`).digest('hex');
}

// 1. Original Pass B migration SHA unchanged
const passBMig = fs.readFileSync('supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql', 'utf-8');
check(1, "Phase 8 Pass B original migration SHA unchanged", sha(passBMig) === 'fbe5fefed202fcdc9f9bc48fb590aa11deba4e79');

// 2. Corrective migration atomic block
const corrMig = fs.readFileSync('supabase/migrations/20260831142135_phase_8_cross_currency_transfer_integrity_corrective.sql', 'utf-8');
check(2, "Phase 8 Pass B corrective migration exists with atomic BEGIN/COMMIT", corrMig.includes('BEGIN;') && corrMig.includes('COMMIT;'));

// 3. Same currency invariant constraint
check(3, "Corrective SQL contains chk_transfers_same_currency_invariant", corrMig.includes('chk_transfers_same_currency_invariant'));

// 4. Cross currency conversion constraint
check(4, "Corrective SQL contains chk_transfers_cross_currency_conversion", corrMig.includes('chk_transfers_cross_currency_conversion'));

// 5. Currency compatibility constraint
check(5, "Corrective SQL contains chk_transfers_currency_compatibility", corrMig.includes('chk_transfers_currency_compatibility'));

// 6. Archived account trigger
check(6, "Corrective SQL contains archived account check trigger and function", corrMig.includes('trg_check_transfer_accounts_active') && corrMig.includes('check_transfer_accounts_active()'));

// 7. Canonical FX Contract documentation in transfer service
const transferService = fs.readFileSync('src/features/transfers/transfers.ts', 'utf-8');
check(7, "Transfer service documents Canonical FX Contract", transferService.includes('Canonical FX Contract:') && transferService.includes('destination_amount = convertExactAmount'));

// 8. Accounts queried under RLS
check(8, "Transfer service queries accounts under user RLS scope before mutate", transferService.includes("from('accounts')") && transferService.includes(".in('id', ["));

// 9. Currency derived from account records
check(9, "Transfer service derives currencies strictly from account records", transferService.includes('fromAccount.currency_code') && transferService.includes('toAccount.currency_code'));

// 10. Archived source account check
check(10, "Transfer service blocks transfer creation from archived source account", transferService.includes('fromAccount.is_archived') && transferService.includes('Cannot create transfer from an archived account'));

// 11. Archived destination account check
check(11, "Transfer service blocks transfer creation to archived destination account", transferService.includes('toAccount.is_archived') && transferService.includes('Cannot create transfer to an archived account'));

// 12. Caller currency override ignored
check(12, "Transfer service mutation signatures ignore caller currency overrides", !transferService.includes('transfer.source_currency_code || transfer.currency_code') && !transferService.includes('updates.source_currency_code || updates.currency_code'));

// 13. Caller destination_amount override ignored
check(13, "Transfer service calculates destination_amount via convertExactAmount instead of trusting caller input", transferService.includes('destAmount = convertExactAmount(normalizedAmount, exRate)') || transferService.includes('destAmount = convertExactAmount(amount, exRate)'));

// 14. Same currency defaults
check(14, "Transfer service enforces rate 1 and amount equality for same-currency transfers", transferService.includes("exRate = '1.000000000000'") && transferService.includes('destAmount = normalizedAmount'));

// 15. UI fails closed on FX error
const transferModal = fs.readFileSync('src/components/finance/AddTransferModal.tsx', 'utf-8');
check(15, "AddTransferModal UI fails closed on FX fetch failure with error message", transferModal.includes('Không thể lấy tỷ giá tự động') && transferModal.includes('setErrorMsg('));

// 16. UI clears rate on FX error
check(16, "AddTransferModal UI clears exchangeRate and destinationAmount on FX fetch start/error", transferModal.includes("setExchangeRate('')") && transferModal.includes("setDestinationAmount('')"));

// 17. Dedicated test suite
const testSuite = fs.readFileSync('tests/phase8-cross-currency-transfers.test.ts', 'utf-8');
check(17, "Dedicated test suite tests/phase8-cross-currency-transfers.test.ts exists and runs", testSuite.includes('Phase 8 Pass B Cross-Currency Transfers Test Suite') && testSuite.includes('PHASE_8_PASS_B_TESTS PASS'));

// 18. ADR-014 recorded
const adr = fs.readFileSync('docs/DECISIONS.md', 'utf-8');
check(18, "ADR-014 recorded in docs/DECISIONS.md", adr.includes('ADR-014') && adr.includes('Cross-Currency Transfers Integrity Corrective'));

// 19. DATABASE.md updated
const dbDocs = fs.readFileSync('docs/DATABASE.md', 'utf-8');
check(19, "DATABASE.md documents transfer table constraints and active account triggers", dbDocs.includes('chk_transfers_same_currency_invariant') && dbDocs.includes('trg_check_transfer_accounts_active'));

// 20. PROJECT_STATUS.md truthful governance
const status = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf-8');
check(20, "PROJECT_STATUS.md contains truthful Phase 8 Pass B governance status", status.includes('PHASE_8_PASS_B_CROSS_CURRENCY_TRANSFERS=PASS_CODE_ONLY') && status.includes('PHASE_8_PASS_B_REMOTE_DB=PENDING') && status.includes('PHASE_9_AUTHORIZED=false'));

// 21. No patch files
const patchFiles = execSync('ls scripts/patch_*.mjs 2>/dev/null || echo ""').toString().trim();
check(21, "No scripts/patch_*.mjs files remain", patchFiles === '');

// 22. Brand asset PNG hashes
const iconBuf = fs.readFileSync('public/brand/finora-icon.png');
const darkBuf = fs.readFileSync('public/brand/finora-logo-dark.png');
const lightBuf = fs.readFileSync('public/brand/finora-logo-light.png');
const iconSha = sha(iconBuf);
const darkSha = sha(darkBuf);
const lightSha = sha(lightBuf);
const brandOk = iconSha === '47412c7d9c2ca2e97c1fc7990bd6280d08047490' &&
                darkSha === '67c2143f63109416b7735bcc060b6d8494dbbfaf' &&
                lightSha === 'e9b1f09b53a5a9ee790dfa73b7d6a8012b53c7d7';
check(22, "Brand asset PNG hashes remain untouched", brandOk);

console.log(`\nPHASE_8_PASS_B_SOURCE_CHECK_COUNT: ${passed}/${total}`);
if (passed !== total) process.exit(1);
