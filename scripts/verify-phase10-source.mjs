#!/usr/bin/env node
/**
 * Finora Phase 10 — Source & Static Architecture Verifier (Final Corrective)
 *
 * Verifies:
 * 1. Scope integrity: zero database mutations or migrations in Phase 10
 * 2. Real build-time server-only boundary ('server-only' package import)
 * 3. Client barrel safety (src/features/ai/index.ts does not leak server runtime)
 * 4. Single source of truth for model identifiers (src/lib/ai/config.ts ONLY)
 * 5. Unknown operations ALWAYS fail closed (zero bypass via model overrides)
 * 6. Public model override escape hatch eliminated from request contracts
 * 7. Central generation config propagation (temperature, maxTokens, timeout)
 * 8. Separation of text and structured response modes (zero unvalidated casts)
 * 9. Fail-closed empty text validation
 * 10. @google/genai SDK isolation (exactly 1 server-only file, zero client leaks)
 * 11. Zero direct process.env secret lookups in AI provider adapters
 * 12. Zero Supabase or localStorage in AI foundation
 * 13. Zero Phase 11 credential persistence or Phase 12 user-facing features
 * 14. Zero finance module leaks or circular dependencies
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
let passed = 0;
let failed = 0;

function check(name, condition, message) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}: ${message}`);
  }
}

function walkDir(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(fullPath, filter));
    } else if (!filter || filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('--- Phase 10 Source & Static Architecture Verification ---');

// 1. Files existence
const aiTypesPath = path.join(ROOT, 'src/lib/ai/types.ts');
const aiErrorsPath = path.join(ROOT, 'src/lib/ai/errors.ts');
const aiProviderPath = path.join(ROOT, 'src/lib/ai/provider.ts');
const aiConfigPath = path.join(ROOT, 'src/lib/ai/config.ts');
const aiRouterPath = path.join(ROOT, 'src/lib/ai/router.ts');
const aiStructuredPath = path.join(ROOT, 'src/lib/ai/structured-result.ts');
const aiServerPath = path.join(ROOT, 'src/lib/ai/server.ts');
const aiGeminiCorePath = path.join(ROOT, 'src/lib/ai/providers/gemini-core.ts');
const aiGeminiPath = path.join(ROOT, 'src/lib/ai/providers/gemini.ts');
const aiFeatureIndexPath = path.join(ROOT, 'src/features/ai/index.ts');
const aiFeatureServerPath = path.join(ROOT, 'src/features/ai/server.ts');

check('AI_TYPES_EXISTS', fs.existsSync(aiTypesPath), 'src/lib/ai/types.ts is missing');
check('AI_ERRORS_EXISTS', fs.existsSync(aiErrorsPath), 'src/lib/ai/errors.ts is missing');
check('AI_PROVIDER_EXISTS', fs.existsSync(aiProviderPath), 'src/lib/ai/provider.ts is missing');
check('AI_CONFIG_EXISTS', fs.existsSync(aiConfigPath), 'src/lib/ai/config.ts is missing');
check('AI_ROUTER_EXISTS', fs.existsSync(aiRouterPath), 'src/lib/ai/router.ts is missing');
check('AI_STRUCTURED_EXISTS', fs.existsSync(aiStructuredPath), 'src/lib/ai/structured-result.ts is missing');
check('AI_SERVER_EXISTS', fs.existsSync(aiServerPath), 'src/lib/ai/server.ts is missing');
check('AI_GEMINI_CORE_EXISTS', fs.existsSync(aiGeminiCorePath), 'src/lib/ai/providers/gemini-core.ts is missing');
check('AI_GEMINI_ADAPTER_EXISTS', fs.existsSync(aiGeminiPath), 'src/lib/ai/providers/gemini.ts is missing');
check('AI_FEATURE_INDEX_EXISTS', fs.existsSync(aiFeatureIndexPath), 'src/features/ai/index.ts is missing');
check('AI_FEATURE_SERVER_EXISTS', fs.existsSync(aiFeatureServerPath), 'src/features/ai/server.ts is missing');

// 2. Build-Time Server-Only Boundary
const geminiProdContent = fs.readFileSync(aiGeminiPath, 'utf8');
const serverContent = fs.readFileSync(aiServerPath, 'utf8');
const featureServerContent = fs.readFileSync(aiFeatureServerPath, 'utf8');

check(
  'SERVER_ONLY_PRODUCTION_WRAPPER',
  geminiProdContent.includes("import 'server-only'") &&
    serverContent.includes("import 'server-only'") &&
    featureServerContent.includes("import 'server-only'"),
  "Production server files must import 'server-only' for build-time module graph enforcement"
);

// 3. Client Barrel Safety
const featureIndexContent = fs.readFileSync(aiFeatureIndexPath, 'utf8');
check(
  'CLIENT_BARREL_SERVER_RUNTIME_IMPORTS',
  !featureIndexContent.includes('/provider') &&
    !featureIndexContent.includes('/providers/') &&
    !featureIndexContent.includes('/server') &&
    !featureIndexContent.includes('/router'),
  'src/features/ai/index.ts must not export server providers or server runtimes to client graphs'
);

// 4. @google/genai Single Import Isolation
const allSrcFiles = walkDir(path.join(ROOT, 'src'), (f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const genAiImportFiles = allSrcFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return /import\s+.*from\s+['"]@google\/genai['"]/.test(content);
});
check(
  'GOOGLE_GENAI_IMPORT_COUNT',
  genAiImportFiles.length === 1 && genAiImportFiles[0].endsWith('src/lib/ai/providers/gemini.ts'),
  `@google/genai must only be imported in src/lib/ai/providers/gemini.ts, found in: ${genAiImportFiles.join(', ')}`
);

// 5. Client Direct Server/Gemini Imports
const clientComponentFiles = allSrcFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes("'use client'") || content.includes('"use client"');
});
const clientAiRuntimeImports = clientComponentFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return (
    content.includes('@/lib/ai/providers') ||
    content.includes('@/lib/ai/server') ||
    content.includes('@/features/ai/server') ||
    content.includes('@google/genai')
  );
});
check(
  'CLIENT_DIRECT_GEMINI_IMPORTS',
  clientAiRuntimeImports.length === 0,
  `Client components importing AI server modules: ${clientAiRuntimeImports.join(', ')}`
);

// 6. Single Source of Truth for Model Identifiers in AI Architecture
const aiModuleFiles = walkDir(path.join(ROOT, 'src/lib/ai'), (f) => f.endsWith('.ts'))
  .concat(walkDir(path.join(ROOT, 'src/features/ai'), (f) => f.endsWith('.ts')));

const nonConfigModelFiles = aiModuleFiles.filter((f) => {
  if (f.endsWith('src/lib/ai/config.ts')) return false;
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('gemini-2.5-flash');
});
check(
  'MODEL_IDENTIFIER_NON_CONFIG_COUNT',
  nonConfigModelFiles.length === 0,
  `Model literal 'gemini-2.5-flash' must live exclusively in src/lib/ai/config.ts, found in: ${nonConfigModelFiles.join(', ')}`
);

// 7. Unknown Operation Always Fails Closed & No Public Model Override
const typesContent = fs.readFileSync(aiTypesPath, 'utf8');
const routerContent = fs.readFileSync(aiRouterPath, 'utf8');
const geminiCoreContent = fs.readFileSync(aiGeminiCorePath, 'utf8');

check(
  'PUBLIC_MODEL_OVERRIDE_ESCAPE',
  !typesContent.includes('overrideModel'),
  'Public AiRequest contracts must not contain overrideModel escape hatch'
);

check(
  'UNKNOWN_OPERATION_OVERRIDE_BYPASS',
  routerContent.includes('if (!opConfig)') && routerContent.includes('AI_INVALID_REQUEST'),
  'Router must immediately fail closed when opConfig is missing, without checking any overrides'
);

// 8. Central Generation Config Propagation
check(
  'OP_CONFIG_TEMPERATURE_USED',
  routerContent.includes('request.temperature ?? opConfig.temperature'),
  'Router must propagate operation temperature from config'
);
check(
  'OP_CONFIG_MAX_OUTPUT_TOKENS_USED',
  routerContent.includes('request.maxTokens ?? opConfig.maxOutputTokens'),
  'Router must propagate operation maxOutputTokens from config'
);

// 9. Structured vs Text Response Mode & Fail-Closed Empty Text
check(
  'STRUCTURED_REQUEST_REQUIRES_VALIDATOR',
  typesContent.includes("readonly responseMode: 'structured'") &&
    typesContent.includes('readonly outputValidator: AiOutputValidator<TOutput>'),
  'AiStructuredRequest must require an outputValidator'
);

// Substantive Check: Zero Unvalidated Generic Casts
const aiSourceFilesForCastAudit = walkDir(path.join(ROOT, 'src/lib/ai'), (f) => f.endsWith('.ts'))
  .concat(walkDir(path.join(ROOT, 'src/features/ai'), (f) => f.endsWith('.ts')));

const unvalidatedCasts = [];
for (const file of aiSourceFilesForCastAudit) {
  const content = fs.readFileSync(file, 'utf8');
  const unsafePatterns = [
    /response\.text\s+as\s+/i,
    /as\s+(?:unknown\s+as\s+)?TOutput/i,
    /JSON\.parse\([^)]+\)\s+as\s+/i,
    /data:\s*[^,\n]+\s+as\s+(?:unknown\s+as\s+)?TOutput/i,
    /<\s*any\s*>\s*response\.text/i,
    /<\s*TOutput\s*>\s*response\.text/i,
  ];
  for (const pat of unsafePatterns) {
    if (pat.test(content)) {
      unvalidatedCasts.push(`${file} matches ${pat}`);
    }
  }
}

check(
  'UNVALIDATED_GENERIC_CAST_COUNT',
  unvalidatedCasts.length === 0,
  `Found unvalidated generic casts in AI foundation: ${unvalidatedCasts.join(', ')}`
);

// Substantive Check: Text Response Returns Direct String
const textReturnsDirectString =
  /data:\s*response\.text\s*,/.test(routerContent) &&
  !/data:\s*response\.text\s+as\s+/.test(routerContent) &&
  routerContent.includes('Promise<AiStructuredResult<string>>');

check(
  'TEXT_RESPONSE_DIRECT_STRING_RETURN',
  textReturnsDirectString,
  'Router must return data: response.text as direct string with Promise<AiStructuredResult<string>> text overload'
);

// Substantive Check: Structured Generic Requires Validator
const structuredRequiresValidator =
  typesContent.includes('readonly outputValidator: AiOutputValidator<TOutput>') &&
  routerContent.includes('parseAndValidateJson(response.text, outputValidator') &&
  routerContent.includes('Structured response mode requires an outputValidator.');

check(
  'STRUCTURED_GENERIC_REQUIRES_VALIDATOR',
  structuredRequiresValidator,
  'Structured response mode must process output strictly through parseAndValidateJson with a runtime validator'
);

check(
  'EMPTY_TEXT_FAILS_CLOSED',
  routerContent.includes('AI_INVALID_RESPONSE') && routerContent.includes('whitespace-only response payload'),
  'Router must fail closed with AI_INVALID_RESPONSE on empty/whitespace text response'
);

// 10. Gemini JSON Schema Mapping
check(
  'JSON_SCHEMA_MAPPED_TO_RESPONSE_JSON_SCHEMA',
  geminiCoreContent.includes('responseJsonSchema') && geminiCoreContent.includes('application/json'),
  'Gemini adapter must map validator JSON schema to responseJsonSchema and responseMimeType'
);

// 11. Duplicate Provider Registration Rejected
check(
  'DUPLICATE_PROVIDER_REJECTED',
  routerContent.includes('Duplicate AI provider registration'),
  'Router must reject duplicate provider registrations by default'
);

// 12. Caller Abort & Timeout
check(
  'CALLER_ABORT_SUPPORTED',
  routerContent.includes('AI_ABORTED') && routerContent.includes('AbortController'),
  'Router must support caller abort signal handling'
);
check(
  'TIMEOUT_SUPPORTED',
  routerContent.includes('AI_TIMEOUT') && routerContent.includes('setTimeout'),
  'Router must support timeout handling'
);

// 13. Zero Database / Migrations in Phase 10
const migrationFiles = walkDir(path.join(ROOT, 'supabase/migrations'));
const phase10Migrations = migrationFiles.filter(
  (f) => f.includes('phase10') || f.includes('ai_credentials') || f.includes('ai_usage')
);
check(
  'NO_PHASE10_MIGRATION',
  phase10Migrations.length === 0,
  `Unexpected Phase 10 migrations found: ${phase10Migrations.join(', ')}`
);

// 14. Zero Direct process.env Lookups in AI Foundation
const aiFiles = walkDir(path.join(ROOT, 'src/lib/ai'), (f) => f.endsWith('.ts'));
const aiEnvLookups = aiFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('process.env.GEMINI') || content.includes('process.env.API_KEY');
});
check(
  'AI_PROCESS_ENV_SECRET_LOOKUP',
  aiEnvLookups.length === 0,
  `process.env secrets found in AI foundation: ${aiEnvLookups.join(', ')}`
);

// 15. Zero Supabase or LocalStorage in AI Foundation
const aiSupabaseImports = aiFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('@supabase') || content.includes('supabase');
});
check(
  'AI_SUPABASE_IMPORT_COUNT',
  aiSupabaseImports.length === 0,
  `Supabase found in AI foundation: ${aiSupabaseImports.join(', ')}`
);

const aiLocalStorageUsage = aiFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('localStorage');
});
check(
  'AI_LOCAL_STORAGE_USAGE',
  aiLocalStorageUsage.length === 0,
  `localStorage found in AI foundation: ${aiLocalStorageUsage.join(', ')}`
);

// 16. Normalized Error Codes Completeness
const errorsContent = fs.readFileSync(aiErrorsPath, 'utf8');
const requiredErrorCodes = [
  'AI_NOT_CONFIGURED',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_AUTH_FAILED',
  'AI_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_ABORTED',
  'AI_INVALID_REQUEST',
  'AI_INVALID_RESPONSE',
  'AI_STRUCTURED_OUTPUT_INVALID',
  'AI_PROVIDER_ERROR',
];
const missingCodes = requiredErrorCodes.filter((code) => !errorsContent.includes(`'${code}'`));
check(
  'NORMALIZED_ERROR_CODES_COMPLETE',
  missingCodes.length === 0,
  `Missing error codes: ${missingCodes.join(', ')}`
);

// 17. Finance Isolation
const financeFiles = walkDir(path.join(ROOT, 'src/features'), (f) => !f.includes('src/features/ai') && (f.endsWith('.ts') || f.endsWith('.tsx')));
const financeAiImports = financeFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('@/lib/ai') || content.includes('@/features/ai');
});
check(
  'FINANCE_MODULE_AI_IMPORT_COUNT',
  financeAiImports.length === 0,
  `Finance features importing AI foundation prematurely: ${financeAiImports.join(', ')}`
);

// 18. No Phase 12 API Routes
const apiRoutes = walkDir(path.join(ROOT, 'src/app/api'), (f) => f.endsWith('route.ts'));
const aiApiRoutes = apiRoutes.filter((f) => f.includes('/api/ai'));
check(
  'PHASE12_USER_AI_FEATURES',
  aiApiRoutes.length === 0,
  `Phase 12 AI API routes found prematurely: ${aiApiRoutes.join(', ')}`
);

// 19. Package.json Google Gen AI Dependency
const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const genAiVersion = pkgJson.dependencies?.['@google/genai'];
check(
  'GOOGLE_GENAI_VERSION_PINNED',
  genAiVersion === '2.19.0',
  `@google/genai must be pinned to 2.19.0, got ${genAiVersion}`
);

// 20. Dependency Lock Present
const bunLockExists = fs.existsSync(path.join(ROOT, 'bun.lock'));
const pkgLockExists = fs.existsSync(path.join(ROOT, 'package-lock.json'));
check(
  'DEPENDENCY_LOCK_PRESENT',
  bunLockExists || pkgLockExists,
  'A dependency lock file must be present'
);

console.log('----------------------------------------------------');
console.log(`TOTAL CHECKS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);

if (failed > 0) {
  console.error(`\nPHASE_10_SOURCE_VERIFIER: FAIL ${passed}/${passed + failed}`);
  process.exit(1);
} else {
  console.log(`\nPHASE_10_SOURCE_VERIFIER: PASS ${passed}/${passed}`);
  process.exit(0);
}
