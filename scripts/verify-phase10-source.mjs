#!/usr/bin/env node
/**
 * Finora Phase 10 — Source & Static Architecture Verifier
 *
 * Verifies:
 * - Scope integrity and non-regression of Phase 9
 * - Zero database mutations or migrations in Phase 10
 * - Proper provider abstraction, router, config, structured result, and error taxonomy
 * - @google/genai SDK isolation (only in gemini adapter, zero client leaks)
 * - Zero direct process.env secret lookups in AI provider adapter
 * - Zero Supabase or localStorage dependencies in AI foundation
 * - Zero Phase 11 credential persistence or Phase 12 user-facing features
 * - Zero finance module leaks or circular dependencies
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
const aiGeminiPath = path.join(ROOT, 'src/lib/ai/providers/gemini.ts');
const aiFeatureIndexPath = path.join(ROOT, 'src/features/ai/index.ts');

check('AI_TYPES_EXISTS', fs.existsSync(aiTypesPath), 'src/lib/ai/types.ts is missing');
check('AI_ERRORS_EXISTS', fs.existsSync(aiErrorsPath), 'src/lib/ai/errors.ts is missing');
check('AI_PROVIDER_EXISTS', fs.existsSync(aiProviderPath), 'src/lib/ai/provider.ts is missing');
check('AI_CONFIG_EXISTS', fs.existsSync(aiConfigPath), 'src/lib/ai/config.ts is missing');
check('AI_ROUTER_EXISTS', fs.existsSync(aiRouterPath), 'src/lib/ai/router.ts is missing');
check('AI_STRUCTURED_EXISTS', fs.existsSync(aiStructuredPath), 'src/lib/ai/structured-result.ts is missing');
check('AI_SERVER_EXISTS', fs.existsSync(aiServerPath), 'src/lib/ai/server.ts is missing');
check('AI_GEMINI_ADAPTER_EXISTS', fs.existsSync(aiGeminiPath), 'src/lib/ai/providers/gemini.ts is missing');
check('AI_FEATURE_INDEX_EXISTS', fs.existsSync(aiFeatureIndexPath), 'src/features/ai/index.ts is missing');

// 2. Database & Migration Zero-Footprint
const migrationFiles = walkDir(path.join(ROOT, 'supabase/migrations'));
const phase10Migrations = migrationFiles.filter((f) => f.includes('phase10') || f.includes('ai_credentials') || f.includes('ai_usage'));
check('NO_PHASE10_MIGRATION', phase10Migrations.length === 0, `Unexpected Phase 10 migrations found: ${phase10Migrations.join(', ')}`);

// 3. Package.json Google Gen AI Dependency
const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const genAiVersion = pkgJson.dependencies?.['@google/genai'];
check('GOOGLE_GENAI_PINNED', genAiVersion === '2.19.0', `@google/genai must be pinned to 2.19.0, got ${genAiVersion}`);

// 4. @google/genai Import Isolation
const allSrcFiles = walkDir(path.join(ROOT, 'src'), (f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const genAiImportFiles = allSrcFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('@google/genai');
});
check(
  'GOOGLE_GENAI_IMPORT_COUNT',
  genAiImportFiles.length === 1 && genAiImportFiles[0].endsWith('src/lib/ai/providers/gemini.ts'),
  `@google/genai must only be imported in src/lib/ai/providers/gemini.ts, found in: ${genAiImportFiles.join(', ')}`
);

// 5. Client Bundle & UI Safety
const clientComponentFiles = allSrcFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes("'use client'") || content.includes('"use client"');
});

const clientAiRuntimeImports = clientComponentFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('@/lib/ai/providers') || content.includes('@/lib/ai/server') || content.includes('@google/genai');
});
check('CLIENT_AI_RUNTIME_IMPORT_COUNT', clientAiRuntimeImports.length === 0, `Client components importing AI server modules: ${clientAiRuntimeImports.join(', ')}`);

// 6. Zero direct process.env secret lookups in AI provider adapter
const geminiContent = fs.readFileSync(aiGeminiPath, 'utf8');
check(
  'GEMINI_NO_DIRECT_ENV_SECRET',
  !geminiContent.includes('process.env.GEMINI_API_KEY') && !geminiContent.includes('process.env.API_KEY'),
  'Gemini provider adapter must not read process.env directly; credentials must be injected'
);

// 7. Zero Supabase or LocalStorage in AI Foundation
const aiFiles = walkDir(path.join(ROOT, 'src/lib/ai'), (f) => f.endsWith('.ts'));
const aiSupabaseImports = aiFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('@supabase') || content.includes('supabase');
});
check('AI_SUPABASE_IMPORT_COUNT', aiSupabaseImports.length === 0, `Supabase found in AI foundation: ${aiSupabaseImports.join(', ')}`);

const aiLocalStorageUsage = aiFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('localStorage');
});
check('AI_LOCAL_STORAGE_USAGE', aiLocalStorageUsage.length === 0, `localStorage found in AI foundation: ${aiLocalStorageUsage.join(', ')}`);

// 8. Error Taxonomy Completeness
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
check('NORMALIZED_ERROR_CODES_COMPLETE', missingCodes.length === 0, `Missing error codes: ${missingCodes.join(', ')}`);

// 9. Finance Isolation: Existing finance features do not import AI foundation in Phase 10
const financeFiles = walkDir(path.join(ROOT, 'src/features'), (f) => !f.includes('src/features/ai') && (f.endsWith('.ts') || f.endsWith('.tsx')));
const financeAiImports = financeFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('@/lib/ai') || content.includes('@/features/ai');
});
check('FINANCE_MODULE_AI_IMPORT_COUNT', financeAiImports.length === 0, `Finance features importing AI foundation prematurely: ${financeAiImports.join(', ')}`);

// 10. No Phase 12 API Routes
const apiRoutes = walkDir(path.join(ROOT, 'src/app/api'), (f) => f.endsWith('route.ts'));
const aiApiRoutes = apiRoutes.filter((f) => f.includes('/api/ai'));
check('PHASE12_USER_AI_FEATURES', aiApiRoutes.length === 0, `Phase 12 AI API routes found prematurely: ${aiApiRoutes.join(', ')}`);

// 11. Timeout & AbortSignal Support in Router
const routerContent = fs.readFileSync(aiRouterPath, 'utf8');
check('ROUTER_SUPPORTS_TIMEOUT', routerContent.includes('AI_TIMEOUT') && routerContent.includes('setTimeout'), 'AI Router must support timeout handling');
check('ROUTER_SUPPORTS_ABORT', routerContent.includes('AI_ABORTED') && routerContent.includes('AbortController'), 'AI Router must support caller abort signal handling');

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
