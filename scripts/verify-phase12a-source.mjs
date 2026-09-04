#!/usr/bin/env node
/**
 * Finora AI Foundation — Phase 12A Source & Architecture Verification Script
 * Corrective Pass 1 — Runtime Safety, Candidate Integrity & Verification Fidelity
 *
 * Verifies all 16 corrective specifications completely offline:
 * - Scope & file tree integrity (no unexpected schema mutations)
 * - Server-only module boundary enforcement
 * - Income stream database contract (income_source_id)
 * - Bounded candidate queries (CAP + 1, fail-closed)
 * - Strict calendar date validation (leap year & day count)
 * - Supported currency gate (VND, USD, EUR, JPY, CNY, KRW)
 * - Untrusted text hardening & adversarial defense
 * - Central AI operation config authority
 * - Exact Phase 10 AiErrorCode taxonomy (13 codes)
 * - AI ambiguity masking prevention & form state provenance
 * - Auth-before-privileged-factory sequencing
 * - Zero financial mutation invariant
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

let passed = 0;
let failed = 0;

function check(id, condition, failureMessage) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${id}`);
  } else {
    failed++;
    console.error(`[FAIL] ${id}: ${failureMessage}`);
  }
}

console.log('--- Finora Phase 12A Source & Architecture Static Verification ---');

// =========================================================================
// 1. Scope & File Tree Integrity
// =========================================================================

const requiredFiles = [
  'src/features/ai/transaction-draft/types.ts',
  'src/features/ai/transaction-draft/validator.ts',
  'src/features/ai/transaction-draft/candidates.ts',
  'src/features/ai/transaction-draft/domain.ts',
  'src/features/ai/transaction-draft/prompt.ts',
  'src/features/ai/transaction-draft/action-core.ts',
  'src/features/ai/transaction-draft/actions.ts',
  'src/features/ai/transaction-draft/form-state.ts',
  'src/features/ai/transaction-draft/index.ts',
  'src/components/finance/AiTransactionDraftInput.tsx',
  'src/components/finance/AddTransactionModal.tsx',
  'tests/phase12a-transaction-draft.test.ts',
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(ROOT, relPath);
  check(`FILE_EXISTS_${relPath}`, fs.existsSync(fullPath), `${relPath} must exist`);
}

// Ensure zero database migrations were added (schema must remain unchanged)
const migrationsDir = path.join(ROOT, 'supabase/migrations');
const migrationFiles = fs.readdirSync(migrationsDir);
const phase12Migrations = migrationFiles.filter((f) => f.includes('phase_12'));
check(
  'ZERO_DATABASE_MIGRATIONS',
  phase12Migrations.length === 0,
  `Phase 12A must NOT introduce database migrations, found: ${phase12Migrations.join(', ')}`
);

// =========================================================================
// 2. Server-Only & Server Actions Module Boundaries
// =========================================================================

const serverOnlyInternalFiles = [
  'src/features/ai/transaction-draft/validator.ts',
  'src/features/ai/transaction-draft/candidates.ts',
  'src/features/ai/transaction-draft/domain.ts',
  'src/features/ai/transaction-draft/prompt.ts',
  'src/features/ai/transaction-draft/action-core.ts',
];

for (const relPath of serverOnlyInternalFiles) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  check(
    `SERVER_ONLY_${path.basename(relPath)}`,
    content.includes("import 'server-only'"),
    `${relPath} must import 'server-only' to protect server runtime from browser bundles`
  );
}

const actionsContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/actions.ts'),
  'utf8'
);
check(
  'USE_SERVER_ACTIONS_TS',
  actionsContent.startsWith("'use server'") || actionsContent.startsWith('"use server"'),
  "actions.ts must declare 'use server' entry directive"
);

// Client components must NOT import server-only modules directly
const clientInputContent = fs.readFileSync(
  path.join(ROOT, 'src/components/finance/AiTransactionDraftInput.tsx'),
  'utf8'
);
check(
  'CLIENT_INPUT_NO_SERVER_LEAKS',
  !clientInputContent.includes('/action-core') &&
    !clientInputContent.includes('/prompt') &&
    !clientInputContent.includes('/candidates') &&
    !clientInputContent.includes('/domain'),
  'AiTransactionDraftInput must not import internal server-only transaction-draft modules'
);

// =========================================================================
// 3. Income Stream Database Contract (Corrective 1)
// =========================================================================

const typesContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/types.ts'),
  'utf8'
);
const candidatesContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/candidates.ts'),
  'utf8'
);
const domainContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/domain.ts'),
  'utf8'
);
const promptContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/prompt.ts'),
  'utf8'
);

check(
  'INCOME_STREAM_TYPES_CONTRACT',
  typesContent.includes('readonly income_source_id: string;') &&
    !typesContent.includes('readonly source_id: string;'),
  'CandidateIncomeStream must use income_source_id matching PostgreSQL schema'
);

check(
  'INCOME_STREAM_CANDIDATES_QUERY',
  candidatesContent.includes("select('id, income_source_id, name, is_archived')"),
  "candidates.ts must select 'id, income_source_id, name, is_archived' from income_source_streams"
);

check(
  'INCOME_STREAM_DOMAIN_PARENT_CHECK',
  domainContent.includes('income_source_id !== resolvedSourceId'),
  'domain.ts must cross-validate stream parent using income_source_id'
);

check(
  'INCOME_STREAM_PROMPT_RELATION',
  promptContent.includes('st.income_source_id'),
  'prompt.ts must match stream to parent source using st.income_source_id'
);

// =========================================================================
// 4. Bounded Candidate Queries (CAP + 1, Fail-Closed) (Corrective 2)
// =========================================================================

check(
  'BOUNDED_ACCOUNTS_QUERY',
  candidatesContent.includes('.limit(CANDIDATE_LIMITS.MAX_ACCOUNTS + 1)'),
  'candidates.ts must query accounts with limit MAX_ACCOUNTS + 1'
);

check(
  'BOUNDED_CATEGORIES_QUERY',
  candidatesContent.includes('.limit(CANDIDATE_LIMITS.MAX_CATEGORIES + 1)'),
  'candidates.ts must query categories with limit MAX_CATEGORIES + 1'
);

check(
  'BOUNDED_INCOME_SOURCES_QUERY',
  candidatesContent.includes('.limit(CANDIDATE_LIMITS.MAX_INCOME_SOURCES + 1)'),
  'candidates.ts must query income_sources with limit MAX_INCOME_SOURCES + 1'
);

check(
  'BOUNDED_INCOME_STREAMS_QUERY',
  candidatesContent.includes('.limit(CANDIDATE_LIMITS.MAX_INCOME_STREAMS + 1)'),
  'candidates.ts must query income_source_streams with limit MAX_INCOME_STREAMS + 1'
);

check(
  'FAIL_CLOSED_OVERFLOW_ARRAYS_CLEARED',
  /accountsOmitted\s*\?\s*\[\]\s*:/.test(candidatesContent) &&
    /categoriesOmitted\s*\?\s*\[\]\s*:/.test(candidatesContent) &&
    /incomeSourcesOmitted\s*\?\s*\[\]\s*:/.test(candidatesContent) &&
    /incomeStreamsOmitted\s*\?\s*\[\]\s*:/.test(candidatesContent),
  'candidates.ts must clear candidate array when limit is exceeded (fail-closed)'
);

// =========================================================================
// 5. Fail Closed on Context / RLS Read Errors (Corrective 3)
// =========================================================================

check(
  'CONTEXT_LOAD_ERROR_CLASS_DEFINED',
  candidatesContent.includes('class ContextLoadError extends Error'),
  'candidates.ts must define ContextLoadError'
);

check(
  'CANDIDATES_FAIL_CLOSED_ON_QUERY_ERROR',
  candidatesContent.includes('accountsRes.error') &&
    candidatesContent.includes('categoriesRes.error') &&
    candidatesContent.includes('sourcesRes.error') &&
    candidatesContent.includes('streamsRes.error'),
  'candidates.ts must check and throw on every query error'
);

const actionCoreContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/action-core.ts'),
  'utf8'
);

check(
  'ACTION_CORE_CATCHES_CONTEXT_LOAD_ERROR',
  actionCoreContent.includes("code: 'CONTEXT_LOAD_FAILED'") &&
    actionCoreContent.includes('FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED'),
  'action-core.ts must handle ContextLoadError and return CONTEXT_LOAD_FAILED'
);

// =========================================================================
// 6. Post-AI Stale Candidate Revalidation (Corrective 4)
// =========================================================================

check(
  'DOMAIN_EXPORTS_REVALIDATE_CANDIDATES',
  domainContent.includes('export async function revalidateResolvedCandidates'),
  'domain.ts must export revalidateResolvedCandidates function'
);

check(
  'ACTION_CORE_CALLS_REVALIDATE',
  actionCoreContent.includes('revalidateResolvedCandidates('),
  'action-core.ts must call revalidateResolvedCandidates after AI parsing'
);

// =========================================================================
// 7. Supported Currency Gate (Corrective 5)
// =========================================================================

check(
  'SUPPORTED_CURRENCY_CODES_EXPORTED',
  typesContent.includes('SUPPORTED_CURRENCY_CODES') &&
    typesContent.includes('export function isSupportedCurrencyCode'),
  'types.ts must export SUPPORTED_CURRENCY_CODES and isSupportedCurrencyCode'
);

const validatorContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/validator.ts'),
  'utf8'
);

check(
  'VALIDATOR_ENFORCES_SUPPORTED_CURRENCY',
  validatorContent.includes('isSupportedCurrencyCode(rawCurrency)'),
  'validator.ts must enforce isSupportedCurrencyCode'
);

check(
  'DOMAIN_ENFORCES_SUPPORTED_CURRENCY',
  domainContent.includes('isSupportedCurrencyCode(upperCurrency)'),
  'domain.ts must enforce isSupportedCurrencyCode on resolved currency'
);

// =========================================================================
// 8. Strict YYYY-MM-DD Calendar Date Validation (Corrective 6)
// =========================================================================

check(
  'VALIDATOR_EXPORTS_IS_VALID_CALENDAR_DATE',
  validatorContent.includes('export function isValidCalendarDate(dateStr: string): boolean'),
  'validator.ts must export isValidCalendarDate function'
);

check(
  'VALIDATOR_LEAP_YEAR_LOGIC',
  validatorContent.includes('daysInMonth') && validatorContent.includes('Date.UTC'),
  'isValidCalendarDate must implement calendar validation with leap-year handling'
);

check(
  'VALIDATOR_USES_CALENDAR_DATE',
  validatorContent.includes('isValidCalendarDate(rawOccurredOn)'),
  'validator.ts must validate occurred_on using isValidCalendarDate'
);

check(
  'DOMAIN_USES_CALENDAR_DATE',
  domainContent.includes('isValidCalendarDate(trimmedDate)'),
  'domain.ts must validate occurred_on using isValidCalendarDate'
);

// =========================================================================
// 9. Untrusted Candidate & User Text Hardening (Corrective 7)
// =========================================================================

check(
  'CANDIDATES_EXPORTS_SANITIZE_LABEL',
  candidatesContent.includes('export function sanitizeCandidateLabel(label: string): string'),
  'candidates.ts must export sanitizeCandidateLabel'
);

check(
  'PROMPT_SERIALIZES_UNTRUSTED_INPUT',
  promptContent.includes('JSON.stringify(params.promptText)'),
  'prompt.ts must JSON.stringify user input to prevent prompt breakout'
);

check(
  'PROMPT_ADVERSARIAL_DEFENSE_RULE',
  promptContent.includes('UNTRUSTED DATA & ADVERSARIAL DEFENSE:'),
  'prompt.ts must include explicit adversarial defense instructions'
);

// =========================================================================
// 10. Central AI Operation Config Authority (Corrective 8)
// =========================================================================

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

const cleanActionCore = stripComments(actionCoreContent);
const routerCallMatch = /router\.execute(?:<[^>]*>)?\s*\(\s*\{([\s\S]*?)\}/.exec(cleanActionCore);
const routerCallBody = routerCallMatch ? routerCallMatch[1] : '';

check(
  'ACTION_CORE_REUSES_CENTRAL_CONFIG',
  routerCallBody.includes("operation: 'transaction_parser'") &&
    !routerCallBody.includes('temperature') &&
    !routerCallBody.includes('maxTokens') &&
    !routerCallBody.includes('timeoutMs') &&
    !routerCallBody.includes('model'),
  'action-core.ts router.execute call must strictly rely on central config and not pass temperature, maxTokens, timeoutMs, or model overrides'
);

check(
  'CANDIDATE_ACCOUNTS_SUPPORTED_CURRENCY_GATE',
  candidatesContent.includes('isSupportedCurrencyCode(acc.currency_code)') &&
    candidatesContent.includes('currency_code: acc.currency_code as CurrencyCode'),
  'candidates.ts must filter candidate accounts by isSupportedCurrencyCode'
);

check(
  'POST_AI_ACCOUNT_CURRENCY_REVALIDATION',
  domainContent.includes('ACCOUNT_CURRENCY_CONFLICT') &&
    domainContent.includes('isSupportedCurrencyCode(acc.currency_code)') &&
    domainContent.includes('acc.currency_code !== draft.currency_code'),
  'domain.ts revalidateResolvedCandidates must check currency compatibility and emit ACCOUNT_CURRENCY_CONFLICT'
);

check(
  'POST_AI_FAIL_CLOSED_ON_QUERY_ERROR',
  domainContent.includes('throw new ContextLoadError') &&
    actionCoreContent.includes('CONTEXT_LOAD_FAILED'),
  'domain.ts and action-core.ts must fail closed on post-AI database read errors'
);

// =========================================================================
// 11. Exact Phase 10 AiErrorCode Taxonomy (Corrective 9)
// =========================================================================

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
  'AI_CREDENTIAL_CORRUPTED',
  'AI_CREDENTIAL_KEY_UNAVAILABLE',
  'AI_CREDENTIAL_RESOLUTION_FAILED',
];

for (const code of requiredErrorCodes) {
  check(
    `AI_ERROR_CODE_${code}_MAPPED`,
    actionCoreContent.includes(`${code}:`),
    `action-core.ts AI_ERROR_MESSAGES must include mapping for ${code}`
  );
}

// =========================================================================
// 12. AI Ambiguity Masking Fix & Pure Form State (Correctives 10, 14)
// =========================================================================

const formStateContent = fs.readFileSync(
  path.join(ROOT, 'src/features/ai/transaction-draft/form-state.ts'),
  'utf8'
);
const modalContent = fs.readFileSync(
  path.join(ROOT, 'src/components/finance/AddTransactionModal.tsx'),
  'utf8'
);

check(
  'FORM_STATE_CLEARS_UNMATCHED_ACCOUNT',
  formStateContent.includes("nextAccountId = ''"),
  'applyDraftToFormState must clear accountId to empty string when AI match is null'
);

check(
  'FORM_STATE_CLEARS_UNMATCHED_CATEGORY',
  formStateContent.includes("nextCategoryId = ''"),
  'applyDraftToFormState must clear categoryId to empty string when AI match is null'
);

check(
  'FORM_STATE_TRACKS_PROVENANCE',
  formStateContent.includes('accountMatchedByAi: boolean;') &&
    formStateContent.includes('categoryMatchedByAi: boolean;') &&
    formStateContent.includes('requiresManualReview: boolean;') &&
    formStateContent.includes('reviewNotice: string | null;'),
  'applyDraftToFormState must track field provenance and manual review requirements'
);

check(
  'INCOME_ATTRIBUTION_REVIEW_NOTICE',
  formStateContent.includes("'Nguồn thu'") &&
    formStateContent.includes("'Kênh thu'"),
  'form-state.ts must include Nguồn thu and Kênh thu in reviewNotice for incomplete income attribution'
);

check(
  'MODAL_USES_APPLY_DRAFT_TO_FORM_STATE',
  modalContent.includes('applyDraftToFormState('),
  'AddTransactionModal must use applyDraftToFormState pure transformer'
);

check(
  'MODAL_DISPLAYS_DRAFT_NOTICE',
  modalContent.includes('draftNotice && (') &&
    modalContent.includes('{draftNotice}'),
  'AddTransactionModal must display draftNotice banner when manual review is required'
);

// =========================================================================
// 13. Auth-Before-Privileged-Factory Sequencing (Corrective 11)
// =========================================================================

const cleanActions = stripComments(actionsContent);
const fnBodyMatch = /export async function parseTransactionDraftAction\s*\(([^)]*)\)[\s\S]*?\{([\s\S]*)/.exec(cleanActions);
const fnParams = fnBodyMatch ? fnBodyMatch[1].trim() : '';
const fnBody = fnBodyMatch ? fnBodyMatch[2] : '';

check(
  'SERVER_ACTION_NO_DI_EXPOSURE',
  !fnParams.includes('deps') && !fnParams.includes('Dependency') && !fnParams.includes(','),
  'parseTransactionDraftAction must not expose dependency injection parameters to client'
);

const getUserIdx = fnBody.indexOf('getUser()');
const repoIdx = fnBody.indexOf('createAiCredentialRepository');
const resolverIdx = fnBody.indexOf('AiCredentialResolver');
const routerIdx = fnBody.indexOf('createDefaultServerRouter');

check(
  'AUTH_CHECK_PRECEDES_FACTORIES',
  getUserIdx !== -1 &&
    repoIdx !== -1 &&
    resolverIdx !== -1 &&
    routerIdx !== -1 &&
    getUserIdx < repoIdx &&
    getUserIdx < resolverIdx &&
    getUserIdx < routerIdx,
  'parseTransactionDraftAction function body must verify authentication via getUser() before initializing repository, resolver, or router'
);

// =========================================================================
// 14. Zero Financial Mutation Capability Invariant (Corrective 15)
// =========================================================================

check(
  'ZERO_INSERT_MUTATION_IN_AI_FEATURE',
  !actionCoreContent.includes('.insert(') &&
    !candidatesContent.includes('.insert(') &&
    !domainContent.includes('.insert(') &&
    !actionsContent.includes('.insert('),
  'AI feature module must NEVER execute .insert() on Supabase database'
);

check(
  'ZERO_UPDATE_MUTATION_IN_AI_FEATURE',
  !actionCoreContent.includes('.update(') &&
    !candidatesContent.includes('.update(') &&
    !domainContent.includes('.update(') &&
    !actionsContent.includes('.update('),
  'AI feature module must NEVER execute .update() on Supabase database'
);

check(
  'ZERO_DELETE_MUTATION_IN_AI_FEATURE',
  !actionCoreContent.includes('.delete(') &&
    !candidatesContent.includes('.delete(') &&
    !domainContent.includes('.delete(') &&
    !actionsContent.includes('.delete('),
  'AI feature module must NEVER execute .delete() on Supabase database'
);

const cleanClientInput = stripComments(clientInputContent);
check(
  'UI_ZERO_MUTATION_AUTHORITY',
  !cleanClientInput.includes('createTransaction') &&
    !cleanClientInput.includes('updateTransaction') &&
    !cleanClientInput.includes('voidTransaction') &&
    !cleanClientInput.includes('restoreTransaction') &&
    !cleanClientInput.includes('.insert(') &&
    !cleanClientInput.includes('.update(') &&
    !cleanClientInput.includes('.delete('),
  'AiTransactionDraftInput component must have ZERO financial mutation calls or imports'
);

// =========================================================================
// 14. Phase 12A Model Policy & Live Smoke Configuration
// =========================================================================

const aiConfigPath = path.join(ROOT, 'src/lib/ai/config.ts');
const aiConfigContent = fs.readFileSync(aiConfigPath, 'utf8');

check(
  'TRANSACTION_PARSER_MODEL_EXACT',
  aiConfigContent.includes("export const GEMINI_FLASH_LITE_MODEL = 'gemini-3.5-flash-lite'") &&
    /transaction_parser:\s*\{[^}]*model:\s*GEMINI_FLASH_LITE_MODEL/.test(aiConfigContent),
  'transaction_parser operation must configure exact stable model gemini-3.5-flash-lite'
);

check(
  'REJECT_FLOATING_AND_PREVIEW_ALIASES',
  !aiConfigContent.includes('gemini-flash-latest') &&
    !aiConfigContent.includes('gemini-3.1-flash-lite-preview'),
  'Central AI configuration must reject floating aliases and preview model identifiers'
);

// =========================================================================
// 15. Money Presentation & Boundary Integrity (Corrective 2)
// =========================================================================

const moneyIndexPath = path.join(ROOT, 'src/lib/money/index.ts');
const moneyIndexContent = fs.readFileSync(moneyIndexPath, 'utf8');

check(
  'MONEY_WITH_CODE_EXPORTED',
  moneyIndexContent.includes('export function formatMoneyWithCode('),
  'src/lib/money/index.ts must export formatMoneyWithCode'
);

const formatMoneyFns =
  (moneyIndexContent.match(/export function formatMoneyWithCode[\s\S]*?^}/m)?.[0] || '') +
  (moneyIndexContent.match(/export function formatExactMoney[\s\S]*?^}/m)?.[0] || '');

check(
  'EXACT_MONEY_NO_FLOAT_CONVERSION',
  !formatMoneyFns.includes('parseFloat(') && !formatMoneyFns.includes('Number('),
  'Exact money formatting must not convert amounts using parseFloat or Number'
);

check(
  'AI_PREVIEW_NO_RAW_EXACT_MONEY',
  !clientInputContent.includes('${draft.amount}') &&
    clientInputContent.includes('formatMoneyWithCode(draft.amount'),
  'AiTransactionDraftInput preview must format draft.amount using formatMoneyWithCode instead of raw .0000 decimal string'
);

// =========================================================================
// 16. Performance Concurrency & Privacy-Safe Timing Telemetry (Corrective 2)
// =========================================================================

check(
  'CONCURRENT_CANDIDATE_READS',
  candidatesContent.includes('Promise.all([') &&
    candidatesContent.includes("from('accounts')") &&
    candidatesContent.includes("from('categories')") &&
    candidatesContent.includes("from('income_sources')"),
  'candidates.ts must read accounts, categories, and income sources concurrently using Promise.all'
);

check(
  'CONCURRENT_PRE_AI_READS',
  actionCoreContent.includes('Promise.all([settingsPromise, candidatesPromise])'),
  'action-core.ts must read user_settings and candidate context concurrently using Promise.all'
);

check(
  'CONCURRENT_POST_AI_REVALIDATION',
  domainContent.includes('Promise.all([') &&
    domainContent.includes('accountPromise') &&
    domainContent.includes('categoryPromise') &&
    domainContent.includes('sourcePromise') &&
    domainContent.includes('streamPromise'),
  'domain.ts revalidateResolvedCandidates must query accounts, categories, sources, and streams concurrently using Promise.all'
);

// typesContent is already read at top
check(
  'TIMING_INSTRUMENTATION_PRESENT',
  typesContent.includes('export interface AiTimingTelemetry') &&
    actionCoreContent.includes('FINORA_AI_TIMING') &&
    actionCoreContent.includes('context_ms') &&
    actionCoreContent.includes('ai_provider_ms') &&
    actionCoreContent.includes('revalidation_ms') &&
    actionCoreContent.includes('total_ms'),
  'action-core.ts must emit FINORA_AI_TIMING event with context_ms, ai_provider_ms, revalidation_ms, and total_ms'
);

const timingTelemetryMatch = typesContent.match(/export interface AiTimingTelemetry\s*\{([^}]+)\}/);
const telemetryBody = timingTelemetryMatch ? timingTelemetryMatch[1] : '';

check(
  'PRIVACY_SAFE_TELEMETRY',
  !telemetryBody.includes('userId') &&
    !telemetryBody.includes('user_id') &&
    !telemetryBody.includes('prompt') &&
    !telemetryBody.includes('email') &&
    !telemetryBody.includes('merchant') &&
    !telemetryBody.includes('note') &&
    !telemetryBody.includes('apiKey') &&
    !telemetryBody.includes('credential') &&
    !telemetryBody.includes('token: string'),
  'AiTimingTelemetry must strictly exclude all sensitive data (prompts, UUIDs, credentials, emails, notes, merchant, tokens)'
);

// =========================================================================
// Summary
// =========================================================================

console.log(`\nVerification Summary: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\n❌ Phase 12A Source Verification FAILED!');
  process.exit(1);
} else {
  console.log('\n✅ Phase 12A Source Verification PASSED all architectural gates!');
  process.exit(0);
}
