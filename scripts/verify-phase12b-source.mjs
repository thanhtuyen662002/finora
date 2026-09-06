#!/usr/bin/env node

/**
 * Finora Phase 12B-1 Source & Architecture Verification Script
 * Deterministic source checks for Receipt Vision Multimodal Foundation.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(name, pass, details = '') {
  totalChecks++;
  if (pass) {
    passedChecks++;
    console.log(`[PASS] ${name}`);
  } else {
    failedChecks++;
    console.error(`[FAIL] ${name}${details ? `: ${details}` : ''}`);
  }
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function getFilesRecursively(dir) {
  const fullPath = path.join(ROOT, dir);
  if (!fs.existsSync(fullPath)) return [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(res));
    } else {
      files.push(res);
    }
  }
  return files;
}

console.log('--- Phase 12B-1 Source & Static Architecture Verification ---');

// 1. Exactly one lockfile
const hasPackageLock = fileExists('package-lock.json');
const hasYarnLock = fileExists('yarn.lock');
const hasPnpmLock = fileExists('pnpm-lock.yaml');
const hasBunLock = fileExists('bun.lockb') || fileExists('bun.lock');
const lockCount = [hasPackageLock, hasYarnLock, hasPnpmLock, hasBunLock].filter(Boolean).length;
check('EXACTLY_ONE_LOCKFILE', lockCount === 1 && hasPackageLock, `lockfiles found: ${lockCount}`);

// 2. Package.json checks
const packageJson = JSON.parse(readFile('package.json'));
const sharpVersion = packageJson.dependencies?.sharp;
check('SHARP_PINNED_EXACTLY', sharpVersion === '0.35.4', `sharp version is ${sharpVersion}`);

const testScript = packageJson.scripts?.['test:phase12b:vision'];
check(
  'TEST_SCRIPT_PRESENT',
  typeof testScript === 'string' && testScript.includes('tests/phase12b-receipt-vision.test.ts'),
  `test script: ${testScript}`
);

// 3. No zod or unauthorized dependencies added
const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
check('NO_ZOD_DEPENDENCY', !allDeps.zod, 'zod found in package.json');

// 4. Centralized model identifiers (only in src/lib/ai/config.ts)
const receiptVisionFiles = getFilesRecursively('src/features/ai/receipt-vision');
let modelLiteralsInReceiptVision = 0;
for (const f of receiptVisionFiles) {
  const content = readFile(f);
  if (/gemini-[123]\.[0-9]/.test(content)) {
    modelLiteralsInReceiptVision++;
  }
}
check(
  'ZERO_MODEL_LITERALS_IN_RECEIPT_VISION',
  modelLiteralsInReceiptVision === 0,
  `found ${modelLiteralsInReceiptVision} model literals in receipt-vision`
);

// 5. document_kind exactness (UNKNOWN completely removed)
const typesContent = readFile('src/features/ai/receipt-vision/types.ts');
const schemaContent = readFile('src/features/ai/receipt-vision/schema.ts');

const hasUnknownInTypes = typesContent.includes("'UNKNOWN'");
const hasUnknownInSchema = schemaContent.includes("'UNKNOWN'");
check(
  'UNKNOWN_COMPLETELY_REMOVED',
  !hasUnknownInTypes && !hasUnknownInSchema,
  `UNKNOWN present in types: ${hasUnknownInTypes}, schema: ${hasUnknownInSchema}`
);

const exactDocKinds = ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'OTHER'];
const hasAllDocKinds = exactDocKinds.every(
  (k) => typesContent.includes(k) && schemaContent.includes(k)
);
check('EXACT_DOCUMENT_KINDS', hasAllDocKinds, 'Missing document_kind enum values');

// 6. Exact 14 warning codes in ReceiptWarningCode, no obsolete codes
const requiredWarnings = [
  'DOCUMENT_UNSUPPORTED',
  'TOTAL_MISSING',
  'TOTAL_AMBIGUOUS',
  'CURRENCY_MISSING',
  'CURRENCY_AMBIGUOUS',
  'CURRENCY_UNSUPPORTED',
  'DATE_MISSING',
  'DATE_AMBIGUOUS',
  'DATE_INVALID',
  'MERCHANT_MISSING',
  'CATEGORY_UNRESOLVED',
  'CATEGORY_STALE',
  'ACCOUNT_REQUIRED',
  'IMAGE_QUALITY_LOW',
];
const obsoleteWarnings = ['NOT_A_PURCHASE_RECEIPT', 'AMOUNT_MISSING', 'AMOUNT_AMBIGUOUS'];

const hasAllWarnings = requiredWarnings.every((w) => typesContent.includes(w));
const hasNoObsoleteWarnings = obsoleteWarnings.every((w) => !typesContent.includes(w));
check(
  'EXACT_14_WARNING_CODES',
  hasAllWarnings && hasNoObsoleteWarnings,
  `required: ${hasAllWarnings}, obsolete absent: ${hasNoObsoleteWarnings}`
);

// 7. ReceiptVision requires exactly one media part and converts to base64
const geminiCoreContent = readFile('src/lib/ai/providers/gemini-core.ts');
check(
  'RECEIPT_VISION_EXACTLY_ONE_MEDIA_PART',
  geminiCoreContent.includes('receipt_vision requires exactly one media part.'),
  'Missing single media part enforcement in gemini-core.ts'
);

check(
  'BASE64_CONVERSION_IN_ADAPTER_ONLY',
  geminiCoreContent.includes("Buffer.from(part.bytes).toString('base64')"),
  'Missing base64 conversion in gemini-core.ts'
);

// 8. Provider adapter configures retryOptions.attempts = 1
const geminiAdapterContent = readFile('src/lib/ai/providers/gemini.ts');
check(
  'PROVIDER_ADAPTER_SINGLE_ATTEMPT',
  geminiAdapterContent.includes('attempts: 1'),
  'Missing retryOptions.attempts = 1 in gemini.ts'
);

// 9. Privacy disclosure in ReceiptPicker
const pickerContent = readFile('src/features/ai/receipt-vision/components/ReceiptPicker.tsx');
const privacyString =
  'Ảnh hóa đơn được gửi đến Google Gemini để trích xuất thông tin. Finora không lưu trữ ảnh của bạn.';
check(
  'PRIVACY_DISCLOSURE_PRESENT',
  pickerContent.includes(privacyString),
  'Missing exact privacy disclosure in ReceiptPicker.tsx'
);

// 10. formData.getAll('file') in actions.ts
const actionsContent = readFile('src/features/ai/receipt-vision/actions.ts');
check(
  'FORM_DATA_GET_ALL_FILE',
  actionsContent.includes("formData.getAll('file')"),
  "Missing formData.getAll('file') in actions.ts"
);

// 11. No filesystem write, Storage upload or remote image fetch in receipt-vision
let fsOrStorageViolations = 0;
for (const f of receiptVisionFiles) {
  const content = readFile(f);
  if (
    content.includes('fs.write') ||
    content.includes('fs.writeFile') ||
    content.includes('.storage.') ||
    content.includes('from(\'receipts\')') ||
    /fetch\s*\(/.test(content)
  ) {
    fsOrStorageViolations++;
  }
}
check(
  'NO_FS_STORAGE_OR_REMOTE_FETCH',
  fsOrStorageViolations === 0,
  `Found ${fsOrStorageViolations} violations in receipt-vision`
);

// 12. Zero database mutations across receipt-vision
let dbMutationViolations = 0;
for (const f of receiptVisionFiles) {
  const content = readFile(f);
  if (
    content.includes('.insert(') ||
    content.includes('.update(') ||
    content.includes('.delete(') ||
    content.includes('.upsert(')
  ) {
    dbMutationViolations++;
  }
}
check(
  'ZERO_DATABASE_MUTATIONS',
  dbMutationViolations === 0,
  `Found ${dbMutationViolations} database mutation calls in receipt-vision`
);

// 13. Discriminated category resolution
const categoriesContent = readFile('src/features/ai/receipt-vision/categories.ts');
check(
  'DISCRIMINATED_CATEGORY_RESOLUTION',
  categoriesContent.includes("status: 'RESOLVED'") &&
    categoriesContent.includes("status: 'UNRESOLVED'") &&
    categoriesContent.includes("status: 'STALE'"),
  'Missing discriminated category resolution in categories.ts'
);

// 14. Strict Image Signatures & no metadata preservation
const imageContent = readFile('src/features/ai/receipt-vision/image.ts');
check(
  'IMAGE_SIGNATURES_AND_SECURITY',
  imageContent.includes('0xff') &&
    imageContent.includes('0xd8') &&
    imageContent.includes('0x89') &&
    imageContent.includes('0x50') &&
    imageContent.includes('0x52') &&
    imageContent.includes('0x49') &&
    !imageContent.includes('withMetadata') &&
    !imageContent.includes('keepIccProfile') &&
    imageContent.includes('limitInputPixels'),
  'Image security or signature checks missing in image.ts'
);

console.log('----------------------------------------------------');
console.log(`TOTAL CHECKS: ${totalChecks}`);
console.log(`PASSED: ${passedChecks}`);
console.log(`FAILED: ${failedChecks}`);

if (failedChecks > 0) {
  console.error(`PHASE_12B_SOURCE_VERIFIER: FAIL (${failedChecks} failures)`);
  process.exit(1);
} else {
  console.log(`PHASE_12B_SOURCE_VERIFIER: PASS ${passedChecks}/${totalChecks}`);
  process.exit(0);
}
