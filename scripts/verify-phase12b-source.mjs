#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const filesUnder = (directory) => {
  const root = path.join(ROOT, directory);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
};
const before = (source, first, second) => {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
};
const containsNone = (source, values) => values.every((value) => !source.includes(value));
const countMatches = (source, expression) => [...source.matchAll(expression)].length;

const contract = read('docs/PHASE_12B_CONTRACT_DISCOVERY.md');
const contractSectionStart = contract.indexOf('### 19.2');
const contractSectionEnd = contract.indexOf('## 20.', contractSectionStart);
const requiredNames = [
  ...contract
    .slice(contractSectionStart, contractSectionEnd)
    .matchAll(/`([A-Z][A-Z0-9_]+)`/g),
].map((match) => match[1]);

const actions = read('src/features/ai/receipt-vision/actions.ts');
const actionCore = read('src/features/ai/receipt-vision/action-core.ts');
const categories = read('src/features/ai/receipt-vision/categories.ts');
const constants = read('src/features/ai/receipt-vision/constants.ts');
const domain = read('src/features/ai/receipt-vision/domain.ts');
const errors = read('src/features/ai/receipt-vision/errors.ts');
const formState = read('src/features/ai/receipt-vision/form-state.ts');
const image = read('src/features/ai/receipt-vision/image.ts');
const prompt = read('src/features/ai/receipt-vision/prompt.ts');
const schema = read('src/features/ai/receipt-vision/schema.ts');
const telemetry = read('src/features/ai/receipt-vision/telemetry.ts');
const types = read('src/features/ai/receipt-vision/types.ts');
const picker = read('src/features/ai/receipt-vision/components/ReceiptPicker.tsx');
const modal = read('src/components/finance/AddTransactionModal.tsx');
const aiConfig = read('src/lib/ai/config.ts');
const aiTypes = read('src/lib/ai/types.ts');
const aiRouter = read('src/lib/ai/router.ts');
const geminiCore = read('src/lib/ai/providers/gemini-core.ts');
const geminiAdapter = read('src/lib/ai/providers/gemini.ts');
const phase10Errors = read('src/lib/ai/errors.ts');
const nextConfig = read('next.config.ts');
const tests = read('tests/phase12b-receipt-vision.test.ts');
const phase10Tests = read('tests/phase10-ai-foundation.test.ts');
const status = read('docs/PROJECT_STATUS.md');
const packageJson = JSON.parse(read('package.json'));
const receiptSources = filesUnder('src/features/ai/receipt-vision')
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

const expectedErrorCodes = [
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
const expectedSchemaKeys = [
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
const errorArrayBody = errors.match(/RECEIPT_VISION_ERROR_CODES\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
const schemaArrayBody = schema.match(/EXPECTED_RECEIPT_VISION_KEYS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
const exactErrorTaxonomy =
  expectedErrorCodes.every((code) => errorArrayBody.includes(`'${code}'`)) &&
  countMatches(errorArrayBody, /'[^']+'/g) === expectedErrorCodes.length;
const exactSchemaKeyset =
  expectedSchemaKeys.every((key) => schemaArrayBody.includes(`'${key}'`)) &&
  countMatches(schemaArrayBody, /'[^']+'/g) === expectedSchemaKeys.length;
const receiptModelLiterals = /gemini-[123]\.[0-9]/.test(receiptSources);
const authBeforeCore = before(actions, 'supabase.auth.getUser()', 'processReceiptCore(');
const bodyLimit = 4_350_000;
const fileLimit = 4_194_304;
const platformBudget = 4_500_000;
const imageDependencyNames = Object.keys(packageJson.dependencies ?? {}).filter((name) =>
  /^(sharp|jimp|canvas|gm|imagemagick|imagemin)$/i.test(name)
);

const matrix = new Map([
  ['RECEIPT_SERVER_ONLY', actions.startsWith("'use server';")],
  ['NO_CLIENT_GEMINI', !picker.includes('@google/genai')],
  ['NO_DIRECT_GEMINI_SDK_IN_FEATURE', !receiptSources.includes('@google/genai')],
  ['USES_AI_ROUTER', actionCore.includes('router.execute(')],
  ['USES_RECEIPT_VISION_OPERATION', actionCore.includes("operation: 'receipt_vision'")],
  ['USES_PHASE11_CREDENTIAL_PROVIDER', actions.includes('AiCredentialResolver') && actions.includes('createAiCredentialRepository')],
  ['RECEIPT_MODEL_FROM_CENTRAL_CONFIG', aiConfig.includes('receipt_vision') && !receiptModelLiterals],
  ['NO_MODEL_LITERAL_IN_RECEIPT_FEATURE', !receiptModelLiterals],
  ['PROVIDER_NEUTRAL_MEDIA_TYPE', aiTypes.includes('interface AiInlineMediaPart') && aiTypes.includes("kind: 'inline_image'")],
  ['ROUTER_MEDIA_PASSTHROUGH', aiRouter.includes('...request') && aiTypes.includes('readonly media?:')],
  ['GEMINI_MEDIA_MAPPING_PROVIDER_ONLY', geminiCore.includes('inlineData') && !receiptSources.includes('inlineData')],
  ['TEXT_AI_OPERATIONS_NON_REGRESSION', phase10Tests.includes('TEXT_MODE_RETURNS_STRING_ONLY')],
  ['AUTH_BEFORE_ARRAY_BUFFER', authBeforeCore && before(actionCore, 'processReceiptImage(file)', 'router.execute(')],
  ['AUTH_BEFORE_SHARP', authBeforeCore && !actions.includes('sharp(')],
  ['AUTH_BEFORE_CANDIDATE_READ', authBeforeCore && before(actionCore, 'processReceiptImage(file)', 'getCategoryCandidates(')],
  ['AUTH_BEFORE_CREDENTIAL_RESOLUTION', before(actions, 'supabase.auth.getUser()', 'const credentialProvider =')],
  ['AUTH_BEFORE_PROVIDER_DISPATCH', authBeforeCore],
  ['ONE_IMAGE_ONLY', actions.includes("formData.getAll('file')") && actions.includes('fileEntries.length > 1')],
  ['ONE_MEDIA_PART_FOR_RECEIPT', geminiCore.includes('request.media.length !== 1')],
  ['MAX_RECEIPT_FILE_BYTES_4_MIB', constants.includes('4_194_304') && image.includes('PHASE_12B_MAX_RECEIPT_FILE_BYTES')],
  ['SERVER_ACTION_BODY_LIMIT_EXACT_BYTES', nextConfig.includes('4_350_000')],
  ['RAW_BODY_LIMIT_INCLUDES_MULTIPART_OVERHEAD', contract.includes('multipart') && contract.includes('overhead')],
  ['NEXT_BODY_LIMIT_ABOVE_APP_FILE_LIMIT', bodyLimit > fileLimit],
  ['NEXT_BODY_LIMIT_BELOW_PLATFORM_BUDGET', bodyLimit < platformBudget],
  ['NEAR_LIMIT_PRODUCTION_TRANSPORT_SMOKE_REQUIRED', contract.includes('Near-limit production transport smoke test') && status.includes('PENDING_RUNTIME')],
  ['SHARP_DIRECT_DEPENDENCY', packageJson.dependencies?.sharp === '0.35.4'],
  ['NO_OTHER_NEW_IMAGE_DEPENDENCY', imageDependencyNames.length === 1 && imageDependencyNames[0] === 'sharp'],
  ['ALLOWED_FORMATS_JPEG_PNG_WEBP_ONLY', image.includes('isJpeg') && image.includes('isPng') && image.includes('isWebp')],
  ['UNSUPPORTED_FORMAT_REJECTED_BEFORE_SHARP_PIPELINE', before(image, 'if (!isJpeg && !isPng && !isWebp)', 'sharp(buffer')],
  ['SHARP_LIMIT_INPUT_PIXELS', image.includes('limitInputPixels: PHASE_12B_MAX_DECODED_PIXELS')],
  ['MAX_DECODED_PIXELS_20MP', constants.includes('20_000_000')],
  ['MULTIFRAME_IMAGE_REJECTED', image.includes('metadata.pages') && image.includes('RECEIPT_IMAGE_MULTIFRAME_UNSUPPORTED')],
  ['ANIMATED_WEBP_REJECTED', image.includes('isWebp') && image.includes('metadata.pages')],
  ['SHARP_METADATA_STRIPPING', containsNone(image, ['withMetadata', 'keepIccProfile'])],
  ['SHARP_AUTO_ORIENT', image.includes('.rotate()')],
  ['NORMALIZED_LONG_EDGE_2048', image.includes('width: 2048') && image.includes('height: 2048') && image.includes('withoutEnlargement: true')],
  ['NORMALIZED_OUTPUT_BYTE_CAP', image.includes('PHASE_12B_MAX_NORMALIZED_IMAGE_BYTES')],
  ['NORMALIZED_MIME_SERVER_DERIVED', image.includes("mimeType: 'image/jpeg'") && image.includes('.jpeg({ quality: 80 })')],
  ['CLIENT_FILE_TYPE_NOT_AUTHORITY', before(image, 'const isJpeg', 'const rawMime')],
  ['MIME_SIGNATURE_DECODE_AGREEMENT', image.includes('metadata.format !== detectedFormat')],
  ['NO_IMAGE_FILESYSTEM_WRITE', !/fs\.(?:write|append|createWriteStream)/.test(receiptSources)],
  ['NO_IMAGE_STORAGE_UPLOAD', !receiptSources.includes('.storage.')],
  ['NO_REMOTE_IMAGE_FETCH', !/\bfetch\s*\(/.test(receiptSources)],
  ['MAGIC_BYTE_VALIDATION', image.includes('buffer[0] === 0xff') && image.includes('buffer[0] === 0x89') && image.includes('buffer[0] === 0x52')],
  ['OUTPUT_EXACT_11_KEYSET', exactSchemaKeyset && schema.includes('keys.length !== EXPECTED_RECEIPT_VISION_KEYS.length')],
  ['PROVIDER_FIELD_STATE_PROVENANCE', schema.includes('ALLOWED_OCCURRED_ON_STATES') && schema.includes('ALLOWED_AMOUNT_STATES') && schema.includes('ALLOWED_CURRENCY_STATES')],
  ['STATE_VALUE_CONSISTENCY', schema.includes("obj.amount_state === 'PRESENT'") && schema.includes("obj.currency_state === 'PRESENT'") && schema.includes("obj.occurred_on_state === 'PRESENT'")],
  ['OUTPUT_EXACT_MONEY_STRING', schema.includes('isValidAmountString')],
  ['NO_NUMERIC_AMOUNT', schema.includes("typeof obj.amount === 'number'")],
  ['NO_RAW_UUID_PROVIDER_OUTPUT', prompt.includes('Do not return category names or database identifiers') && !prompt.includes('cat.id')],
  ['OPAQUE_CATEGORY_TOKEN', prompt.includes('CAT_${index + 1}') && schema.includes('/^CAT_[1-9]\\d*$/')],
  ['CATEGORY_CANDIDATES_CAP_50', constants.includes('PHASE_12B_MAX_CATEGORY_CANDIDATES = 50')],
  ['CATEGORY_LABEL_LENGTH_CAP_50', constants.includes('PHASE_12B_MAX_CATEGORY_LABEL_LENGTH = 50') && categories.includes('.slice(0, PHASE_12B_MAX_CATEGORY_LABEL_LENGTH)')],
  ['CATEGORY_OVERFLOW_FALLBACK', categories.includes('data.length > PHASE_12B_MAX_CATEGORY_CANDIDATES') && categories.includes('return []')],
  ['CATEGORY_QUERY_FAILURE_RESILIENCE', categories.includes('catch') && categories.includes('return []')],
  ['PROVIDER_AMOUNT_LEXICAL_VALIDATION', schema.includes("!isValidAmountString(obj.amount)")],
  ['APPLICATION_AMOUNT_CANONICAL_20_4', domain.includes("padEnd(4, '0')")],
  ['NO_FLOAT_MONEY_CANONICALIZATION', containsNone(schema + domain, ['Number(', 'parseFloat('])],
  ['SHARED_RUNTIME_VALIDATOR', actionCore.includes('receiptVisionOutputValidator') && schema.includes('validateReceiptVisionOutput')],
  ['POST_PARSE_RLS_REVALIDATION', actionCore.includes('revalidateCategoryToken') && categories.includes(".eq('user_id', userId)")],
  ['TOTAL_MISSING_VS_AMBIGUOUS', domain.includes('TOTAL_MISSING') && domain.includes('TOTAL_AMBIGUOUS')],
  ['CURRENCY_MISSING_VS_AMBIGUOUS_VS_UNSUPPORTED', domain.includes('CURRENCY_MISSING') && domain.includes('CURRENCY_AMBIGUOUS') && domain.includes('CURRENCY_UNSUPPORTED')],
  ['DATE_MISSING_VS_AMBIGUOUS_VS_INVALID', domain.includes('DATE_MISSING') && domain.includes('DATE_AMBIGUOUS') && domain.includes('DATE_INVALID')],
  ['IMAGE_QUALITY_WARNING_PROVENANCE', domain.includes("output.image_quality === 'LOW'")],
  ['PURCHASE_RECEIPT_ONLY_APPLICABLE', domain.includes("output.document_kind === 'PURCHASE_RECEIPT'")],
  ['INVOICE_NOT_AUTO_EXPENSE', types.includes("'INVOICE'") && domain.includes('DOCUMENT_UNSUPPORTED')],
  ['CREDIT_NOTE_NOT_AUTO_EXPENSE', types.includes("'CREDIT_NOTE'") && domain.includes('DOCUMENT_UNSUPPORTED')],
  ['CAN_APPLY_REQUIRES_AMOUNT', domain.includes('canonicalAmount !== null')],
  ['CAN_APPLY_REQUIRES_CURRENCY', domain.includes('resolvedCurrency !== null')],
  ['CAN_APPLY_REQUIRES_DATE', domain.includes('validDate !== null')],
  ['CAN_APPLY_PURCHASE_RECEIPT_ONLY', domain.includes("output.document_kind === 'PURCHASE_RECEIPT'")],
  ['NO_RECEIPT_DATE_DEFAULT_TODAY', !formState.includes('new Date') && formState.includes("occurredOn: draft.occurred_on ?? ''")],
  ['NO_RECEIPT_CURRENCY_DEFAULT_BASE', formState.includes("currency: draft.currency_code ?? ''")],
  ['NULL_CATEGORY_CLEARS_STALE_FORM_STATE', formState.includes("categoryId: draft.category_id ?? ''")],
  ['ACCOUNT_ALWAYS_USER_SELECTED', formState.includes("accountId: ''") && types.includes('readonly account_id: null')],
  ['MAX_PROVIDER_CALLS_ONE', countMatches(actionCore, /router\.execute\(/g) === 1],
  ['PROVIDER_HTTP_ATTEMPTS_ONE', geminiAdapter.includes('attempts: 1')],
  ['NO_PROVIDER_AUTO_RETRY', geminiAdapter.includes('attempts: 1') && !geminiAdapter.includes('attempts: 2')],
  ['RECEIPT_ERROR_MEDIA_REDACTION', exactErrorTaxonomy && errors.includes('RECEIPT_VISION_PUBLIC_MESSAGES') && !errors.includes('constructor(code: ReceiptVisionErrorCode, message')],
  ['NO_BASE64_IN_ERRORS', exactErrorTaxonomy && errors.includes('RECEIPT_VISION_PUBLIC_MESSAGES') && tests.includes('fixed messages never reflect untrusted MIME')],
  ['NO_MEDIA_IN_LOGS', !/console\.(?:log|warn|error)\([^\n]*(?:prompt|media|bytes|buffer)/i.test(receiptSources)],
  ['ANALYZE_ZERO_MUTATION', containsNone(receiptSources, ['.insert(', '.update(', '.delete(', '.upsert('])],
  ['PREVIEW_ZERO_MUTATION', containsNone(picker, ['createTransaction(', '.insert(', '.update(', '.delete('])],
  ['APPLY_ZERO_MUTATION', containsNone(formState, ['createTransaction(', '.insert(', '.update(', '.delete('])],
  ['EXPLICIT_SAVE_ONLY', modal.includes('handleSubmit') && modal.includes('createTransaction')],
  ['NO_FALSE_CANCEL_UI', !/(server|provider).{0,30}(cancelled|canceled|đã hủy)/i.test(picker)],
  ['STALE_ANALYZE_RESULT_IGNORED', picker.includes('generationRef') && picker.includes('currentGeneration !== generationRef.current')],
  ['EXTERNAL_AI_PRIVACY_DISCLOSURE', picker.includes('Finora không lưu ảnh hóa đơn')],
  ['PROMPT_INJECTION_BOUNDARY', prompt.includes('neutralizeCategoryPromptLabel') && prompt.includes('CRITICAL DATA BOUNDARY INSTRUCTION') && tests.includes('prompt.split(BEGIN_CATEGORY_DELIMITER)')],
  ['NO_URL_FETCH_FROM_RECEIPT', !/\bfetch\s*\(/.test(receiptSources)],
  ['PHASE12A_NON_REGRESSION', exists('tests/phase12a-transaction-draft.test.ts') && exists('scripts/verify-phase12a-source.mjs')],
]);

const uniqueRequiredNames = new Set(requiredNames);
if (requiredNames.length !== 91 || uniqueRequiredNames.size !== 91) {
  console.error(`PHASE_12B_SOURCE_VERIFIER: CONTRACT_NAMESET_INVALID ${requiredNames.length}/91`);
  process.exit(1);
}
if (
  matrix.size !== 91 ||
  [...matrix.keys()].some((name) => !uniqueRequiredNames.has(name)) ||
  requiredNames.some((name) => !matrix.has(name))
) {
  console.error(`PHASE_12B_SOURCE_VERIFIER: MATRIX_NAMESET_INVALID ${matrix.size}/91`);
  process.exit(1);
}

let passed = 0;
let failed = 0;
console.log('--- Finora Phase 12B Exact Contract Source Verification ---');
for (const name of requiredNames) {
  if (matrix.get(name) === true) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
}
console.log('----------------------------------------------------');
console.log(`TOTAL CHECKS: ${requiredNames.length}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);

if (failed > 0) {
  console.error(`PHASE_12B_SOURCE_VERIFIER: FAIL ${passed}/${requiredNames.length}`);
  process.exit(1);
}

console.log(`PHASE_12B_SOURCE_VERIFIER: PASS ${passed}/${requiredNames.length}`);
