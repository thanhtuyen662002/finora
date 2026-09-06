#!/usr/bin/env node

/**
 * Finora Phase 12B Source & Architecture Verification Script
 * Deterministic source checks for Receipt Vision Multimodal Foundation (Section 19.2).
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

console.log('--- Phase 12B Source & Static Architecture Verification ---');

// 1. Lockfile coexistence
const hasPackageLock = fileExists('package-lock.json');
const hasYarnLock = fileExists('yarn.lock');
const hasPnpmLock = fileExists('pnpm-lock.yaml');
const hasBunLock = fileExists('bun.lockb') || fileExists('bun.lock');
check(
  'LOCKFILE_COEXISTENCE',
  hasPackageLock && hasBunLock && !hasYarnLock && !hasPnpmLock,
  'package-lock.json and bun.lock must coexist without yarn/pnpm'
);

// 2. Package.json checks: sharp pinned, test script present, no zod
const packageJson = JSON.parse(readFile('package.json'));
const sharpVersion = packageJson.dependencies?.sharp;
check('SHARP_PINNED_EXACTLY', sharpVersion === '0.35.4', `sharp version is ${sharpVersion}`);

const testScript = packageJson.scripts?.['test:phase12b:vision'];
check(
  'TEST_SCRIPT_PRESENT',
  typeof testScript === 'string' && testScript.includes('tests/phase12b-receipt-vision.test.ts'),
  `test script: ${testScript}`
);

const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
check('NO_ZOD_DEPENDENCY', !allDeps.zod, 'zod found in package.json');

// 3. Centralized model identifiers (only in src/lib/ai/config.ts)
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

// 4. Server-only boundary & zero client Gemini imports
const clientComponentFiles = getFilesRecursively('src/features/ai/receipt-vision/components');
let clientGeminiImports = 0;
for (const f of clientComponentFiles) {
  const content = readFile(f);
  if (content.includes('@google/genai')) {
    clientGeminiImports++;
  }
}
check(
  'ZERO_CLIENT_GEMINI_IMPORTS',
  clientGeminiImports === 0,
  `Found @google/genai in client components: ${clientGeminiImports}`
);

const actionsContent = readFile('src/features/ai/receipt-vision/actions.ts');
check(
  'SERVER_ACTION_DIRECTIVE',
  actionsContent.startsWith("'use server'") || actionsContent.includes("'use server';"),
  'actions.ts must start with use server directive'
);

// 5. Auth check strictly precedes file processing, candidate queries, and credential/router resolution
const authCheckIndex = actionsContent.indexOf('supabase.auth.getUser()');
const fileReadIndex = actionsContent.indexOf("formData.getAll('file')");
const routerInstantiateIndex = actionsContent.indexOf('deps?.createRouter');
check(
  'AUTH_ORDERING_STRICT_PRECEDENCE',
  authCheckIndex !== -1 &&
    fileReadIndex !== -1 &&
    authCheckIndex < fileReadIndex &&
    (routerInstantiateIndex === -1 || fileReadIndex < routerInstantiateIndex),
  'auth.getUser() must strictly precede formData file reading and router resolution'
);

// 6. Router and Phase 11 credential usage
check(
  'ROUTER_AND_CREDENTIAL_RESOLVER_USED',
  actionsContent.includes('createAiCredentialRepository') &&
    actionsContent.includes('AiCredentialResolver') &&
    actionsContent.includes('createDefaultServerRouter'),
  'actions.ts must use Phase 11 credential resolver and AI router'
);

// 7. Exact budgets in constants.ts
const constantsContent = readFile('src/features/ai/receipt-vision/constants.ts');
check(
  'EXACT_FILE_AND_IMAGE_BUDGETS',
  constantsContent.includes('4_194_304') &&
    constantsContent.includes('8192') &&
    constantsContent.includes('20_000_000'),
  'constants.ts must define exact file (4MB), dimension (8192px), and pixel (20M) budgets'
);

// 8. Strict receipt error taxonomy
const errorsContent = readFile('src/features/ai/receipt-vision/errors.ts');
const requiredErrorCodes = [
  'AUTH_REQUIRED',
  'RECEIPT_FILE_REQUIRED',
  'RECEIPT_FILE_TOO_LARGE',
  'RECEIPT_FILE_TYPE_UNSUPPORTED',
  'RECEIPT_FILE_INVALID',
  'RECEIPT_IMAGE_TOO_LARGE',
  'RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED',
  'RECEIPT_IMAGE_NORMALIZED_TOO_LARGE',
  'RECEIPT_IMAGE_DECODE_FAILED',
];
const hasAllErrorCodes = requiredErrorCodes.every((code) => errorsContent.includes(code));
check(
  'RECEIPT_ERROR_TAXONOMY_EXACT_9_CODES',
  hasAllErrorCodes,
  'ReceiptVisionError must define exactly the 9 required taxonomy codes'
);

const libAiErrorsContent = readFile('src/lib/ai/errors.ts');
const pollutesPhase10 = requiredErrorCodes.some(
  (code) => code !== 'AUTH_REQUIRED' && libAiErrorsContent.includes(code)
);
check(
  'PHASE_10_AI_ERROR_CODE_NOT_EXPANDED',
  !pollutesPhase10,
  'Phase 10 AiErrorCode must not be polluted with receipt-vision error codes'
);

// 9. Single-frame and animated rejection
const imageContent = readFile('src/features/ai/receipt-vision/image.ts');
check(
  'SINGLE_FRAME_ENFORCEMENT',
  imageContent.includes('metadata.pages') &&
    imageContent.includes('metadata.pageHeight') &&
    imageContent.includes('RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED'),
  'image.ts must reject multi-frame and animated inputs with RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED'
);

// 10. Image security: signatures, limitInputPixels, no metadata preservation
check(
  'IMAGE_SECURITY_AND_METADATA_STRIPPING',
  imageContent.includes('0xff') &&
    imageContent.includes('0xd8') &&
    imageContent.includes('0x89') &&
    imageContent.includes('0x50') &&
    imageContent.includes('0x52') &&
    imageContent.includes('0x49') &&
    imageContent.includes('limitInputPixels') &&
    !imageContent.includes('withMetadata') &&
    !imageContent.includes('keepIccProfile'),
  'image.ts must enforce binary signatures and strip EXIF/ICC metadata'
);

// 11. Prompt injection boundary
const promptContent = readFile('src/features/ai/receipt-vision/prompt.ts');
check(
  'PROMPT_INJECTION_BOUNDARY',
  promptContent.includes('BEGIN_CATEGORY_CANDIDATES_JSON') &&
    promptContent.includes('END_CATEGORY_CANDIDATES_JSON') &&
    promptContent.includes('JSON.stringify') &&
    promptContent.includes('CRITICAL DATA BOUNDARY INSTRUCTION'),
  'prompt.ts must use JSON delimiters and explicit data boundary instruction'
);

// 12. Exact 11-key schema and document kinds
const typesContent = readFile('src/features/ai/receipt-vision/types.ts');
const schemaContent = readFile('src/features/ai/receipt-vision/schema.ts');
check(
  'UNKNOWN_COMPLETELY_REMOVED',
  !typesContent.includes("'UNKNOWN'") && !schemaContent.includes("'UNKNOWN'"),
  'UNKNOWN document kind must be completely removed'
);

const exactDocKinds = ['PURCHASE_RECEIPT', 'INVOICE', 'CREDIT_NOTE', 'OTHER'];
const hasAllDocKinds = exactDocKinds.every(
  (k) => typesContent.includes(k) && schemaContent.includes(k)
);
check('EXACT_DOCUMENT_KINDS', hasAllDocKinds, 'Missing document_kind enum values');

const exact11Keys = [
  'document_kind',
  'merchant',
  'occurred_on',
  'occurred_on_state',
  'amount',
  'amount_state',
  'currency_code',
  'currency_state',
  'category_token',
  'note',
  'image_quality',
];
const hasAll11Keys = exact11Keys.every(
  (k) => typesContent.includes(k) && schemaContent.includes(k)
);
check('EXACT_11_SCHEMA_KEYS', hasAll11Keys, 'Missing required 11 schema keys');

// 13. State consistency in schema validator
check(
  'SCHEMA_STATE_CONSISTENCY_ENFORCED',
  schemaContent.includes('PRESENT') &&
    schemaContent.includes('MISSING') &&
    schemaContent.includes('AMBIGUOUS'),
  'schema.ts must enforce state consistency between values and state indicators'
);

// 14. Exact-money zero-coercion
check(
  'EXACT_MONEY_ZERO_COERCION',
  (schemaContent.includes('isValidAmountString') || schemaContent.includes('isStrictPositiveDecimal')) &&
    !schemaContent.includes('Number(') &&
    !schemaContent.includes('parseFloat('),
  'schema.ts must validate amount strictly as plain positive decimal without Number/parseFloat'
);

// 15. Category caps and RLS revalidation
const categoriesContent = readFile('src/features/ai/receipt-vision/categories.ts');
check(
  'CATEGORY_CAPS_AND_DISCRIMINATED_RESOLUTION',
  categoriesContent.includes('PHASE_12B_MAX_CATEGORY_CANDIDATES') &&
    categoriesContent.includes('PHASE_12B_MAX_CATEGORY_LABEL_LENGTH') &&
    categoriesContent.includes("status: 'RESOLVED'") &&
    categoriesContent.includes("status: 'UNRESOLVED'") &&
    categoriesContent.includes("status: 'STALE'"),
  'categories.ts must enforce bounds and discriminated resolution'
);

// 16. Warning codes exactness (14 codes)
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

// 17. Single provider call & attempts: 1
const geminiAdapterContent = readFile('src/lib/ai/providers/gemini.ts');
check(
  'PROVIDER_ADAPTER_SINGLE_ATTEMPT',
  geminiAdapterContent.includes('attempts: 1'),
  'gemini.ts must set retryOptions.attempts = 1'
);

const geminiCoreContent = readFile('src/lib/ai/providers/gemini-core.ts');
check(
  'RECEIPT_VISION_EXACTLY_ONE_MEDIA_PART',
  geminiCoreContent.includes('receipt_vision requires exactly one media part.'),
  'gemini-core.ts must enforce exactly one media part for receipt_vision'
);

// 18. Privacy-safe telemetry allowlist
const telemetryContent = readFile('src/features/ai/receipt-vision/telemetry.ts');
const forbiddenTelemetryTerms = [
  'user_id',
  'category_id',
  'account_id',
  'merchant',
  'filename',
  'base64',
  'Uint8Array',
  'data_url',
];
const hasForbiddenTelemetry = forbiddenTelemetryTerms.some((t) =>
  telemetryContent.includes(`'${t}'`)
);
check(
  'TELEMETRY_PRIVACY_ALLOWLIST',
  telemetryContent.includes('TELEMETRY_ALLOWED_KEYS') &&
    telemetryContent.includes('FINORA_RECEIPT_VISION_TIMING') &&
    !hasForbiddenTelemetry,
  'telemetry.ts must enforce allowlisted timing metrics and exclude PII/payloads'
);

// 19. No filesystem write, storage upload, or remote fetch in receipt-vision
let fsOrStorageViolations = 0;
for (const f of receiptVisionFiles) {
  const content = readFile(f);
  if (
    content.includes('fs.write') ||
    content.includes('fs.writeFile') ||
    content.includes('.storage.') ||
    content.includes("from('receipts')") ||
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

// 20. Zero database mutations across receipt-vision
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

// 21. Privacy disclosure in ReceiptPicker
const pickerContent = readFile('src/features/ai/receipt-vision/components/ReceiptPicker.tsx');
check(
  'PRIVACY_DISCLOSURE_PRESENT',
  pickerContent.includes('Finora không lưu ảnh hóa đơn'),
  'ReceiptPicker.tsx must display privacy disclosure'
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
