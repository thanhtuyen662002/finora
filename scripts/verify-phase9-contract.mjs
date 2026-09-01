import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function sha(buf) {
  return crypto.createHash('sha1').update('blob ' + buf.length + '\0' + buf).digest('hex');
}

let passed = 0;
let total = 0;

function check(id, description, condition) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${id}. ${description}`);
  } else {
    console.error(`[FAIL] ${id}. ${description}`);
  }
}

console.log('--- Phase 9 Contract Deterministic Verification ---\n');

// 1. Contract file existence
const contractPath = 'docs/PHASE_9_CONTRACT.md';
const contractExists = fs.existsSync(contractPath);
const contractContent = contractExists ? fs.readFileSync(contractPath, 'utf8') : '';
check(1, "PHASE_9_CONTRACT_EXISTS: docs/PHASE_9_CONTRACT.md exists", contractExists);

// 2. Phase 9 naming
check(2, "PHASE_9_NAME: Contract specifies Income Sources & Revenue Attribution",
  contractContent.includes('Income Sources & Revenue Attribution') &&
  contractContent.includes('Phase 9')
);

// 3. Domain tables defined
check(3, "INCOME_SOURCES_DOMAIN_TABLES: Contract specifies public.income_sources and public.income_source_streams",
  contractContent.includes('public.income_sources') &&
  contractContent.includes('public.income_source_streams')
);

// 4. Source types defined
check(4, "SOURCE_TYPES_DEFINED: Contract defines SALARY, YOUTUBE, FREELANCE, INVESTMENT, OTHER",
  contractContent.includes('SALARY') &&
  contractContent.includes('YOUTUBE') &&
  contractContent.includes('FREELANCE') &&
  contractContent.includes('INVESTMENT') &&
  contractContent.includes('OTHER')
);

// 5. No monetary aggregates on source tables
check(5, "SOURCE_HAS_NO_MONETARY_AUTHORITY: Contract explicitly prohibits monetary aggregates on source tables",
  contractContent.includes('current_balance') &&
  contractContent.includes('total_income') &&
  contractContent.includes('monthly_income') &&
  contractContent.includes('MUST NOT own or store')
);

// 6. No intrinsic source currency authority
check(6, "SOURCE_HAS_NO_INTRINSIC_CURRENCY_AUTHORITY: Contract confirms sources have no intrinsic currency authority",
  contractContent.includes('currency_code') &&
  contractContent.includes('intrinsic')
);

// 7. Optional transaction attribution
check(7, "TRANSACTION_ATTRIBUTION_OPTIONAL: Contract specifies nullable, optional income attribution on transactions",
  contractContent.includes('income_source_id') &&
  contractContent.includes('income_source_stream_id') &&
  contractContent.includes('optional')
);

// 8. Expense attribution prohibited
check(8, "EXPENSE_ATTRIBUTION_PROHIBITED: Contract enforces attribution prohibited on expense transactions",
  contractContent.includes("type = 'EXPENSE'") &&
  contractContent.includes('income_source_id IS NULL') &&
  contractContent.includes('income_source_stream_id IS NULL')
);

// 9. Stream requires source
check(9, "STREAM_REQUIRES_SOURCE: Contract enforces stream attribution strictly requires source attribution",
  contractContent.includes('income_source_stream_id IS NULL') ||
  contractContent.includes('income_source_id IS NOT NULL')
);

// 10. Composite ownership FKs & ON DELETE RESTRICT
check(10, "COMPOSITE_OWNERSHIP_CONTRACT: Contract defines composite user_id foreign keys with ON DELETE RESTRICT",
  contractContent.includes('FOREIGN KEY (income_source_id, user_id)') &&
  contractContent.includes('FOREIGN KEY (income_source_stream_id, income_source_id, user_id)') &&
  contractContent.includes('ON DELETE RESTRICT')
);

// 11. Soft archive & active attribution trigger
check(11, "ARCHIVE_ENFORCEMENT_CONTRACT: Contract specifies active attribution enforcement trigger with SECURITY INVOKER and empty search_path",
  contractContent.includes('BEFORE INSERT OR UPDATE OF type, income_source_id, income_source_stream_id') &&
  contractContent.includes('SECURITY INVOKER') &&
  contractContent.includes("search_path = ''")
);

// 12. Transaction details prefix lock
check(12, "TRANSACTION_DETAILS_17_COLUMN_PREFIX_LOCK: Contract locks 17-column prefix and specifies append-only columns 18-22",
  contractContent.includes('17-column prefix') &&
  contractContent.includes('18 income_source_id') &&
  contractContent.includes('19 income_source_stream_id') &&
  contractContent.includes('20 income_source_name') &&
  contractContent.includes('21 income_source_type') &&
  contractContent.includes('22 income_source_stream_name') &&
  contractContent.includes('security_invoker = true')
);

// 13. Exact money / No float rule
check(13, "EXACT_MONEY_RULE: Contract prohibits float arithmetic and enforces exact decimal aggregation",
  contractContent.includes('parseFloat') &&
  contractContent.includes('IEEE 754') &&
  contractContent.includes('exact decimal')
);

// 14. Phase 8 FX reuse
check(14, "PHASE_8_FX_REUSE: Contract mandates reusing Phase 8 FX engine and transaction_fx_snapshots without duplicate providers",
  contractContent.includes('Phase 8 FX') &&
  contractContent.includes('transaction_fx_snapshots')
);

// 15. Generic stream model (no platform-specific tables)
check(15, "YOUTUBE_GENERIC_STREAM_MODEL: Contract models YouTube channels as generic streams without platform-specific tables",
  contractContent.includes('generic and modular') &&
  contractContent.includes('youtube_channels') &&
  contractContent.includes('No provider-specific tables')
);

// 16. YouTube external sync non-goal
check(16, "YOUTUBE_EXTERNAL_SYNC_OUT_OF_SCOPE: Contract excludes YouTube OAuth/API/AdSense synchronization",
  contractContent.includes('YouTube OAuth') &&
  contractContent.includes('AdSense API')
);

// 17. Two-user runtime gate matrix
check(17, "TWO_USER_RUNTIME_GATE_DEFINED: Contract defines complete two-user runtime test matrix",
  contractContent.includes('Two-User Runtime Verification Matrix') &&
  contractContent.includes('Cross-user source attribution rejected') &&
  contractContent.includes('Stream/source mismatch attribution rejected')
);

// 18. Structural gate defined
check(18, "STRUCTURAL_GATE_DEFINED: Contract defines structural database catalog verifier requirements",
  contractContent.includes('Structural Catalog Verifier') &&
  contractContent.includes('RLS enabled') &&
  contractContent.includes('NO DELETE policy')
);

// 19. Phase 8 migration blob locks
const mig1 = sha(fs.readFileSync('supabase/migrations/20260829000002_phase_8_cross_currency_transfers.sql'));
const mig2 = sha(fs.readFileSync('supabase/migrations/20260831142135_phase_8_cross_currency_transfer_integrity_corrective.sql'));
const mig3 = sha(fs.readFileSync('supabase/migrations/20260831144154_phase_8_transfer_trigger_security_hardening.sql'));
const mig4 = sha(fs.readFileSync('supabase/migrations/20260831150000_phase_8_transfer_trigger_search_path_hardening.sql'));

const migLocksMatch =
  mig1 === 'e046ea3f62aaa76f00295e68126ca29a48bfaa9b' &&
  mig2 === '5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18' &&
  mig3 === '3ee23b513bcd65182afa613084dda8fbf5b40293' &&
  mig4 === '78be2172d313935057aee57fccfc98ed73a5b4d4';

check(19, "PHASE_8_MIGRATION_LOCKS: Phase 8 migration blobs match authoritative immutable SHA locks",
  migLocksMatch &&
  contractContent.includes('e046ea3f62aaa76f00295e68126ca29a48bfaa9b') &&
  contractContent.includes('5721bdff4ebe8d2850a6c0fe73eeb6bb66580a18') &&
  contractContent.includes('3ee23b513bcd65182afa613084dda8fbf5b40293') &&
  contractContent.includes('78be2172d313935057aee57fccfc98ed73a5b4d4')
);

// 20. ADR-015 recorded in DECISIONS.md
const decisionsContent = fs.readFileSync('docs/DECISIONS.md', 'utf8');
check(20, "ADR_015_CREATED: ADR-015 recorded in docs/DECISIONS.md",
  decisionsContent.includes('ADR-015 — Income Sources Are Attribution Metadata, Not a Financial Ledger') &&
  decisionsContent.includes('Attribution Metadata Only') &&
  decisionsContent.includes('Authoritative Ledger Unchanged')
);

// 21. PROJECT_STATUS.md authoritative governance status
const statusContent = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf8');
const statusBlocks = [...statusContent.matchAll(/```text([\s\S]*?)```/g)];
const lastStatusBlock = statusBlocks.length > 0 ? statusBlocks[statusBlocks.length - 1][1].trim() : '';

const governancePass =
  lastStatusBlock.includes('PHASE_8_OVERALL=PASS') &&
  lastStatusBlock.includes('FINORA_PHASE_8=PASS') &&
  lastStatusBlock.includes('PHASE_9_AUTHORIZED=true') &&
  lastStatusBlock.includes('PHASE_9_SCOPE=INCOME_SOURCES_REVENUE_ATTRIBUTION') &&
  lastStatusBlock.includes('PHASE_9_CONTRACT=PASS_CODE_ONLY') &&
  lastStatusBlock.includes('PHASE_9_IMPLEMENTATION_AUTHORIZED=false') &&
  lastStatusBlock.includes('PHASE_9_SOURCE_GATE=PENDING') &&
  lastStatusBlock.includes('PHASE_9_REMOTE_DATABASE=PENDING') &&
  lastStatusBlock.includes('PHASE_9_STRUCTURAL_GATE=PENDING') &&
  lastStatusBlock.includes('PHASE_9_TWO_USER_RLS=PENDING') &&
  lastStatusBlock.includes('PHASE_9_LIVE_PERSISTENCE_SMOKE=PENDING') &&
  lastStatusBlock.includes('PHASE_9_OVERALL=PARTIAL') &&
  lastStatusBlock.includes('PHASE_10_AUTHORIZED=false');

check(21, "PROJECT_STATUS_GOVERNANCE: docs/PROJECT_STATUS.md reflects authoritative Phase 9 contract governance baseline", governancePass);

console.log(`\n----------------------------------------------------`);
console.log(`TOTAL CHECKS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${total - passed}`);

if (passed === total) {
  console.log(`PHASE_9_CONTRACT_VERIFIER: PASS ${passed}/${total}`);
  process.exit(0);
} else {
  console.error(`PHASE_9_CONTRACT_VERIFIER: FAIL ${passed}/${total}`);
  process.exit(1);
}
