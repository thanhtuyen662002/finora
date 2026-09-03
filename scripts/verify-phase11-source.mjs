/**
 * Finora AI Foundation — Phase 11 AI Credentials Source Verifier
 * Static architecture and source gate verifier.
 * Checks migration source, crypto implementation, security boundaries,
 * RPC signatures, environment variables, and ensures Phase 12 is absent.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

let failedChecks = 0;
let passedChecks = 0;

function check(id, condition, failureMessage) {
  if (condition) {
    passedChecks++;
    console.log(`[PASS] ${id}`);
  } else {
    failedChecks++;
    console.error(`[FAIL] ${id}: ${failureMessage}`);
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

console.log('--- Finora Phase 11 Source & Architecture Static Verification ---');

// 1. Exact Migration File Existence
const migrationPath = path.join(
  ROOT,
  'supabase/migrations/20260903110000_phase_11_ai_credentials.sql'
);
check(
  'PHASE_11_MIGRATION_SOURCE_EXISTS',
  fs.existsSync(migrationPath),
  'Migration file 20260903110000_phase_11_ai_credentials.sql must exist'
);

const migrationSql = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, 'utf8')
  : '';

// 2. Private Schema Boundary
check(
  'PRIVATE_SCHEMA_CREATED',
  /CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+private/i.test(migrationSql),
  'Migration must create schema private'
);

check(
  'PRIVATE_SCHEMA_REVOKED_FROM_BROWSER',
  /REVOKE\s+ALL\s+ON\s+SCHEMA\s+private\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
    migrationSql
  ),
  'Migration must revoke all on schema private from PUBLIC, anon, authenticated'
);

check(
  'PRIVATE_SCHEMA_USAGE_SERVICE_ROLE',
  /GRANT\s+USAGE\s+ON\s+SCHEMA\s+private\s+TO\s+service_role/i.test(migrationSql),
  'Migration must grant usage on schema private to service_role'
);

// 3. Default Privileges
check(
  'DEFAULT_PRIVILEGES_TABLES_REVOKED',
  /ALTER\s+DEFAULT\s+PRIVILEGES.*IN\s+SCHEMA\s+private\s+REVOKE\s+ALL\s+ON\s+TABLES\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/is.test(
    migrationSql
  ),
  'Default privileges on tables in schema private must be revoked'
);

check(
  'DEFAULT_PRIVILEGES_SERVICE_ROLE_TABLES',
  /ALTER\s+DEFAULT\s+PRIVILEGES.*IN\s+SCHEMA\s+private\s+GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+TABLES\s+TO\s+service_role/is.test(
    migrationSql
  ),
  'Default privileges on tables in schema private must grant SELECT, INSERT, UPDATE to service_role'
);

// 4. private.ai_credentials Table Schema (Fail-Closed)
check(
  'PRIVATE_AI_CREDENTIALS_TABLE_FAIL_CLOSED',
  /CREATE\s+TABLE\s+private\.ai_credentials/i.test(migrationSql) &&
    !/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+private\.ai_credentials/i.test(migrationSql),
  'Migration must create table private.ai_credentials with fail-closed CREATE TABLE (no IF NOT EXISTS)'
);

// Check typed crypto columns
const requiredColumns = [
  'id uuid',
  'owner_user_id uuid',
  'source text',
  'provider text',
  'assigned_by_user_id uuid',
  'envelope_version smallint',
  'key_id text',
  'nonce bytea',
  'ciphertext bytea',
  'auth_tag bytea',
  'key_hint text',
  'is_active boolean',
  'created_at timestamptz',
  'updated_at timestamptz',
  'revoked_at timestamptz',
];

for (const col of requiredColumns) {
  const [name, type] = col.split(' ');
  const regex = new RegExp(`\\b${name}\\s+${type}\\b`, 'i');
  check(
    `COLUMN_${name.toUpperCase()}_EXISTS`,
    regex.test(migrationSql),
    `Column ${col} missing or wrong type in private.ai_credentials`
  );
}

// 5. Zero Plaintext Key Columns in Migration
const forbiddenPlaintextPatterns = [
  /\bapi_key\b/i,
  /\bplaintext_key\b/i,
  /\bsecret_value\b/i,
  /\braw_key\b/i,
  /\bcredential_value\b/i,
];

for (const pat of forbiddenPlaintextPatterns) {
  check(
    `NO_PLAINTEXT_COLUMN_${pat.source}`,
    !pat.test(migrationSql),
    `Forbidden plaintext column matching ${pat} found in migration`
  );
}

// 6. Foreign Key Delete Actions
check(
  'OWNER_FK_CASCADE',
  /owner_user_id\s+uuid.*REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/is.test(
    migrationSql
  ),
  'owner_user_id must reference auth.users(id) ON DELETE CASCADE'
);

check(
  'ASSIGNED_BY_FK_SET_NULL',
  /assigned_by_user_id\s+uuid.*REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/is.test(
    migrationSql
  ),
  'assigned_by_user_id must reference auth.users(id) ON DELETE SET NULL'
);

// 7. Provenance & Slot Constraints
check(
  'UNIQUE_SLOT_CONSTRAINT',
  /UNIQUE\s*\(\s*owner_user_id\s*,\s*provider\s*,\s*source\s*\)/i.test(
    migrationSql
  ),
  'Must have UNIQUE(owner_user_id, provider, source) slot constraint'
);

check(
  'ASSIGNMENT_PROVENANCE_CHECK',
  /source\s*=\s*'PERSONAL'\s+AND\s+assigned_by_user_id\s+IS\s+NULL/i.test(
    migrationSql
  ) &&
    /source\s*=\s*'ADMIN_ASSIGNED'.*is_active\s*=\s*false.*assigned_by_user_id\s+IS\s+NOT\s+NULL/is.test(
      migrationSql
    ),
  'Provenance CHECK must enforce PERSONAL has no assigner and active ADMIN_ASSIGNED has assigner'
);

check(
  'CRYPTO_MATERIAL_INTEGRITY_CHECK',
  /is_active\s*=\s*true.*octet_length\s*\(\s*nonce\s*\)\s*=\s*12.*octet_length\s*\(\s*auth_tag\s*\)\s*=\s*16/is.test(
    migrationSql
  ) &&
    /is_active\s*=\s*false.*revoked_at\s+IS\s+NOT\s+NULL.*nonce\s+IS\s+NULL.*ciphertext\s+IS\s+NULL/is.test(
      migrationSql
    ),
  'Crypto material CHECK must validate 12-byte nonce, 16-byte auth tag when active, and erased material when revoked'
);

// 8. RLS and Zero Browser Policies
check(
  'RLS_ENABLED_ON_PRIVATE_TABLE',
  /ALTER\s+TABLE\s+private\.ai_credentials\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
    migrationSql
  ),
  'RLS must be enabled on private.ai_credentials'
);

check(
  'ZERO_BROWSER_POLICIES_ON_PRIVATE_TABLE',
  !/CREATE\s+POLICY.*ON\s+private\.ai_credentials/i.test(migrationSql),
  'There must be zero policies on private.ai_credentials'
);

// 9. Minimal Table Privileges to service_role
check(
  'TABLE_PRIVILEGES_REVOKED_FROM_BROWSER',
  /REVOKE\s+ALL\s+ON\s+TABLE\s+private\.ai_credentials\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
    migrationSql
  ),
  'All privileges on private.ai_credentials must be revoked from PUBLIC, anon, authenticated'
);

check(
  'SERVICE_ROLE_TABLE_PRIVILEGES_EXACT',
  /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+TABLE\s+private\.ai_credentials\s+TO\s+service_role/i.test(
    migrationSql
  ),
  'Must grant only SELECT, INSERT, UPDATE to service_role'
);

check(
  'NO_SERVICE_ROLE_DELETE_OR_TRUNCATE',
  !/GRANT.*DELETE.*ON\s+TABLE\s+private\.ai_credentials/i.test(migrationSql) &&
    !/GRANT.*TRUNCATE.*ON\s+TABLE\s+private\.ai_credentials/i.test(migrationSql),
  'Must not grant DELETE or TRUNCATE on private.ai_credentials to service_role'
);

// 10. Service-Role RPC Facade
const rpcReadRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.ai_credentials_read_for_service/i;
const rpcWriteRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.ai_credentials_write_for_service/i;
const rpcRevokeRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.ai_credentials_revoke_for_service/i;

check('RPC_READ_EXISTS', rpcReadRegex.test(migrationSql), 'ai_credentials_read_for_service must exist');
check('RPC_WRITE_EXISTS', rpcWriteRegex.test(migrationSql), 'ai_credentials_write_for_service must exist');
check('RPC_REVOKE_EXISTS', rpcRevokeRegex.test(migrationSql), 'ai_credentials_revoke_for_service must exist');

check(
  'RPC_SECURITY_INVOKER',
  (migrationSql.match(/SECURITY\s+INVOKER/gi) || []).length >= 3,
  'All three RPCs must specify SECURITY INVOKER'
);

check(
  'RPC_SEARCH_PATH_EMPTY',
  (migrationSql.match(/SET\s+search_path\s*=\s*''/gi) || []).length >= 3,
  "All three RPCs must specify SET search_path = ''"
);

check(
  'RPC_BROWSER_EXECUTE_REVOKED',
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.ai_credentials_read_for_service.*FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
    migrationSql
  ) &&
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.ai_credentials_write_for_service.*FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
      migrationSql
    ) &&
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.ai_credentials_revoke_for_service.*FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
      migrationSql
    ),
  'RPC execute must be revoked from PUBLIC, anon, authenticated'
);

check(
  'RPC_SERVICE_ROLE_EXECUTE_GRANTED',
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.ai_credentials_read_for_service.*TO\s+service_role/i.test(
    migrationSql
  ) &&
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.ai_credentials_write_for_service.*TO\s+service_role/i.test(
      migrationSql
    ) &&
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.ai_credentials_revoke_for_service.*TO\s+service_role/i.test(
      migrationSql
    ),
  'RPC execute must be granted to service_role'
);

// 11. Existing Security Advisor Hardening
check(
  'SECURITY_DEFINER_BASELINE_HARDENING',
  /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.handle_new_user\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
    migrationSql
  ) &&
    /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rls_auto_enable\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(
      migrationSql
    ),
  'handle_new_user() and rls_auto_enable() execute must be revoked from browser roles'
);

// 12. TypeScript Source Verification
const cryptoTsPath = path.join(ROOT, 'src/lib/ai/credentials/crypto.ts');
const keyringTsPath = path.join(ROOT, 'src/lib/ai/credentials/keyring.ts');
const byteaTsPath = path.join(ROOT, 'src/lib/ai/credentials/bytea.ts');
const repoTsPath = path.join(ROOT, 'src/lib/ai/credentials/repository.ts');
const resolverTsPath = path.join(ROOT, 'src/lib/ai/credentials/resolver.ts');
const metadataTsPath = path.join(ROOT, 'src/lib/ai/credentials/metadata.ts');
const adminAuthTsPath = path.join(ROOT, 'src/lib/auth/admin.ts');

check('CRYPTO_TS_EXISTS', fs.existsSync(cryptoTsPath), 'crypto.ts must exist');
check('KEYRING_TS_EXISTS', fs.existsSync(keyringTsPath), 'keyring.ts must exist');
check('BYTEA_TS_EXISTS', fs.existsSync(byteaTsPath), 'bytea.ts must exist');
check('REPO_TS_EXISTS', fs.existsSync(repoTsPath), 'repository.ts must exist');
check('RESOLVER_TS_EXISTS', fs.existsSync(resolverTsPath), 'resolver.ts must exist');
check('METADATA_TS_EXISTS', fs.existsSync(metadataTsPath), 'metadata.ts must exist');
check('ADMIN_AUTH_TS_EXISTS', fs.existsSync(adminAuthTsPath), 'admin.ts must exist');

const cryptoTs = fs.existsSync(cryptoTsPath) ? fs.readFileSync(cryptoTsPath, 'utf8') : '';
const keyringTs = fs.existsSync(keyringTsPath) ? fs.readFileSync(keyringTsPath, 'utf8') : '';
const repoTs = fs.existsSync(repoTsPath) ? fs.readFileSync(repoTsPath, 'utf8') : '';
const resolverTs = fs.existsSync(resolverTsPath) ? fs.readFileSync(resolverTsPath, 'utf8') : '';
const adminTs = fs.existsSync(adminAuthTsPath) ? fs.readFileSync(adminAuthTsPath, 'utf8') : '';

// 13. Crypto Parameters
check(
  'AES_256_GCM_NODE_BUILTIN',
  cryptoTs.includes("createCipheriv('aes-256-gcm'") && cryptoTs.includes('node:crypto'),
  'crypto.ts must use node:crypto AES-256-GCM'
);
check('NONCE_12_BYTES', cryptoTs.includes('AES_NONCE_BYTES = 12'), 'Nonce must be 12 bytes');
check('AUTH_TAG_16_BYTES', cryptoTs.includes('AES_AUTH_TAG_BYTES = 16'), 'Auth tag must be 16 bytes');
check('KEY_32_BYTES', cryptoTs.includes('AES_KEY_BYTES = 32'), 'Key must be 32 bytes');

check(
  'CANONICAL_AAD_BINDINGS',
  cryptoTs.includes('buildCanonicalAad') &&
    cryptoTs.includes('v${envelopeVersion}|${credentialId}|${ownerUserId}|${provider}|${source}'),
  'AAD must bind envelope_version, credential_id, owner_user_id, provider, and source'
);

// 14. Authorized Environment Variables
check(
  'KEYRING_ENV_NAMES_EXACT',
  keyringTs.includes('FINORA_AI_CREDENTIAL_KEY_RING_JSON') &&
    keyringTs.includes('FINORA_AI_CREDENTIAL_ACTIVE_KEY_ID'),
  'Key ring must strictly use FINORA_AI_CREDENTIAL_KEY_RING_JSON and FINORA_AI_CREDENTIAL_ACTIVE_KEY_ID'
);

check(
  'SYSTEM_KEY_ENV_NAME_EXACT',
  resolverTs.includes('FINORA_SYSTEM_GEMINI_API_KEY'),
  'System key must strictly use FINORA_SYSTEM_GEMINI_API_KEY'
);

check(
  'ADMIN_AUTH_ENV_NAME_EXACT',
  adminTs.includes('FINORA_ADMIN_USER_IDS'),
  'Admin authority must strictly use FINORA_ADMIN_USER_IDS'
);

// 15. Zero FINORA_ADMIN_EMAILS in codebase
const allSrcFiles = walkDir(path.join(ROOT, 'src'), (f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const adminEmailRefs = allSrcFiles.filter((f) => {
  const c = fs.readFileSync(f, 'utf8');
  return c.includes('FINORA_ADMIN_EMAILS');
});
check(
  'ZERO_ADMIN_EMAILS_ENV_REFS',
  adminEmailRefs.length === 0,
  `Found FINORA_ADMIN_EMAILS in: ${adminEmailRefs.join(', ')}`
);

// 16. Zero Direct Private Schema PostgREST Queries
const directPrivateQueries = allSrcFiles.filter((f) => {
  const c = fs.readFileSync(f, 'utf8');
  return c.includes(".schema('private')") || c.includes('.from("private.') || c.includes(".from('private.");
});
check(
  'ZERO_DIRECT_PRIVATE_SCHEMA_QUERIES',
  directPrivateQueries.length === 0,
  `Direct private schema queries found in: ${directPrivateQueries.join(', ')}`
);

// 17. Zero Client Secrets
const clientFiles = allSrcFiles.filter((f) => {
  const c = fs.readFileSync(f, 'utf8');
  return c.includes("'use client'") || c.includes('"use client"');
});
const clientSecretLeaks = clientFiles.filter((f) => {
  const c = fs.readFileSync(f, 'utf8');
  return (
    c.includes('FINORA_AI_CREDENTIAL') ||
    c.includes('FINORA_SYSTEM_GEMINI_API_KEY') ||
    c.includes('FINORA_ADMIN_USER_IDS') ||
    c.includes('SUPABASE_SERVICE_ROLE_KEY')
  );
});
check(
  'ZERO_CLIENT_SECRET_LEAKS',
  clientSecretLeaks.length === 0,
  `Client components referencing server secrets: ${clientSecretLeaks.join(', ')}`
);

// 18. Phase 10 Error Codes Extended Safely
const errorsTs = fs.readFileSync(path.join(ROOT, 'src/lib/ai/errors.ts'), 'utf8');
check(
  'PHASE_11_ERROR_CODES_PRESENT',
  errorsTs.includes("'AI_CREDENTIAL_CORRUPTED'") &&
    errorsTs.includes("'AI_CREDENTIAL_KEY_UNAVAILABLE'") &&
    errorsTs.includes("'AI_CREDENTIAL_RESOLUTION_FAILED'"),
  'errors.ts must include all Phase 11 credential error codes'
);

// 19. Router Preserves AiError
const routerTs = fs.readFileSync(path.join(ROOT, 'src/lib/ai/router.ts'), 'utf8');
check(
  'ROUTER_PRESERVES_CREDENTIAL_AIERROR',
  routerTs.includes('if (err instanceof AiError)') &&
    routerTs.includes("code: 'AI_CREDENTIAL_RESOLUTION_FAILED'"),
  'Router must preserve AiError instances and map generic resolver errors to AI_CREDENTIAL_RESOLUTION_FAILED'
);

// 20. Phase 12 Features Absent
const phase12Files = allSrcFiles.filter((f) => {
  return (
    f.includes('receipt-ocr') ||
    f.includes('financial-assistant') ||
    f.includes('financial-chat')
  );
});
check(
  'PHASE_12_FEATURES_ABSENT',
  phase12Files.length === 0,
  `Premature Phase 12 features found in: ${phase12Files.join(', ')}`
);

// 21. Governance: UNAPPLIED Migration and PARTIAL Status in PROJECT_STATUS.md
const projectStatusContent = fs.readFileSync(path.join(ROOT, 'docs/PROJECT_STATUS.md'), 'utf8');
check(
  'PROJECT_STATUS_UNAPPLIED_MIGRATION',
  projectStatusContent.includes('PHASE_11_MIGRATION=UNAPPLIED') &&
    projectStatusContent.includes('Phase status:** PARTIAL') &&
    projectStatusContent.includes('PHASE_11_OVERALL=PARTIAL'),
  'PROJECT_STATUS.md must state that Phase 11 is PARTIAL and migration is UNAPPLIED'
);

// 22. Strict Wire UUID Validation
check(
  'STRICT_WIRE_UUID_VALIDATION',
  repoTs.includes('isValidUuid(r.id)') &&
    repoTs.includes('isValidUuid(r.owner_user_id)') &&
    repoTs.includes('isValidUuid(r.assigned_by_user_id)'),
  'repository.ts must strictly validate UUIDs for id, owner_user_id, and assigned_by_user_id'
);

// 23. Strict Wire Timestamp Validation
check(
  'STRICT_WIRE_TIMESTAMP_VALIDATION',
  repoTs.includes('isValidTimestamp(r.created_at)') &&
    repoTs.includes('isValidTimestamp(r.updated_at)'),
  'repository.ts must strictly validate timestamps for created_at and updated_at'
);

// 24. Exact Envelope Version === 1 Check
check(
  'EXACT_ENVELOPE_VERSION_CHECK',
  repoTs.includes('r.envelope_version !== 1') &&
    (cryptoTs.includes('envelope.envelopeVersion !== 1') ||
      cryptoTs.includes('envelope.envelopeVersion !== ENVELOPE_VERSION')),
  'Envelope version must be checked strictly === 1 without coercion or default'
);

// 25. Plaintext Input Validation
check(
  'PLAINTEXT_INPUT_VALIDATOR',
  repoTs.includes('validatePlaintextApiKey') &&
    cryptoTs.includes('validateCredentialPlaintext') &&
    cryptoTs.includes('MAX_CREDENTIAL_LENGTH'),
  'repository.ts and crypto.ts must validate plaintext rejecting empty, length bounds, and control characters'
);

// 26. Safe Key-Hint Generator
const metadataTs = fs.readFileSync(metadataTsPath, 'utf8');
check(
  'SAFE_KEY_HINT_GENERATOR',
  metadataTs.includes('generateKeyHint') &&
    cryptoTs.includes('buildCredentialKeyHint') &&
    cryptoTs.includes("defaultMask = '****'") &&
    !cryptoTs.includes('••••'),
  'metadata.ts and crypto.ts must ensure keyHint never equals plaintext and contains no unicode bullet mask'
);

check(
  'KEY_HINT_WRITER_PRINTABLE_ASCII_ONLY',
  cryptoTs.includes('PRINTABLE_ASCII_KEY_HINT') &&
    cryptoTs.includes('[\\x20-\\x7E]') &&
    cryptoTs.includes("defaultMask = '****'") &&
    cryptoTs.includes("normalized === defaultMask") &&
    cryptoTs.includes("'####'"),
  'crypto.ts buildCredentialKeyHint must output printable ASCII only and preserve keyHint !== plaintext'
);

const credFiles = fs.readdirSync(path.join(ROOT, 'src/lib/ai/credentials')).map((f) => path.join(ROOT, 'src/lib/ai/credentials', f));
let unicodeMaskRuntimeCount = 0;
for (const f of credFiles) {
  if (fs.readFileSync(f, 'utf8').includes('••••')) {
    unicodeMaskRuntimeCount++;
  }
}
check(
  'KEY_HINT_UNICODE_MASK_RUNTIME_COUNT=0',
  unicodeMaskRuntimeCount === 0,
  `Expected 0 runtime credential files containing unicode bullet mask, found ${unicodeMaskRuntimeCount}`
);

check(
  'WIRE_KEY_HINT_PRINTABLE_ASCII_ONLY',
  repoTs.includes('validateWireKeyHint') &&
    repoTs.includes('PRINTABLE_ASCII_KEY_HINT') &&
    repoTs.includes('KEY_HINT_MAX_LENGTH') &&
    !repoTs.includes('••••'),
  'repository.ts validateWireKeyHint must strictly validate printable ASCII 1..4 without mutating string'
);

check(
  'METADATA_KEY_HINT_PRINTABLE_ASCII_ONLY',
  metadataTs.includes('sanitizeSafeKeyHint') &&
    metadataTs.includes('PRINTABLE_ASCII_KEY_HINT') &&
    metadataTs.includes("personalKeyHint = safeHint ?? '****'") &&
    !metadataTs.includes('••••'),
  'metadata.ts sanitizeSafeKeyHint must accept only printable ASCII 1..4 and fall back to ASCII mask'
);

// 27. Admin Authority Environment-Only
check(
  'ADMIN_AUTHORITY_ENVIRONMENT_ONLY',
  adminTs.includes('getAuthorizedAdminUserIds()') &&
    !adminTs.includes('customEnv?:'),
  'admin.ts authority functions must strictly read from process.env and not accept caller overrides'
);

// 28. Zero findTargetUserIdByEmail
const emailTargetSearch = allSrcFiles.filter((f) => {
  const c = fs.readFileSync(f, 'utf8');
  return c.includes('findTargetUserIdByEmail');
});
check(
  'ZERO_FIND_TARGET_USER_BY_EMAIL',
  emailTargetSearch.length === 0,
  `findTargetUserIdByEmail found in: ${emailTargetSearch.join(', ')}`
);

// 29. Async Test Runner Awaits All Tests
const testSuiteTs = fs.readFileSync(path.join(ROOT, 'tests/phase11-ai-credentials.test.ts'), 'utf8');
check(
  'ASYNC_TEST_RUNNER_AWAITS_ALL',
  testSuiteTs.includes('pendingTests') &&
    testSuiteTs.includes('Promise.all(pendingTests)'),
  'tests/phase11-ai-credentials.test.ts must collect and await all async tests via Promise.all'
);

// 30. Server-Only Boundaries on All Credential Runtime Modules
const allCredentialRuntime = [
  'src/lib/ai/credentials/bytea.ts',
  'src/lib/ai/credentials/crypto.ts',
  'src/lib/ai/credentials/keyring.ts',
  'src/lib/ai/credentials/metadata.ts',
  'src/lib/ai/credentials/repository.ts',
  'src/lib/ai/credentials/resolver.ts',
  'src/lib/ai/credentials/index.ts',
];
let serverOnlyAllPass = true;
for (const rel of allCredentialRuntime) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    serverOnlyAllPass = false;
    break;
  }
  const c = fs.readFileSync(p, 'utf8');
  if (!c.includes("import 'server-only';") && !c.includes('import "server-only";')) {
    serverOnlyAllPass = false;
    break;
  }
}
check(
  'SERVER_ONLY_BOUNDARIES_ALL_CREDENTIAL_MODULES',
  serverOnlyAllPass,
  'All credential runtime modules must declare import "server-only"'
);

// 31. Structural and Runtime Verifiers Exist & Structural Script Completeness
const structuralPath = path.join(ROOT, 'scripts/verify-phase11-structural.sql');
check(
  'STRUCTURAL_VERIFIER_EXISTS',
  fs.existsSync(structuralPath),
  'scripts/verify-phase11-structural.sql must exist'
);
check(
  'RUNTIME_VERIFIER_EXISTS',
  fs.existsSync(path.join(ROOT, 'scripts/verify-phase11-runtime.mjs')),
  'scripts/verify-phase11-runtime.mjs must exist'
);

const structuralSql = fs.existsSync(structuralPath)
  ? fs.readFileSync(structuralPath, 'utf8')
  : '';

// Substantive structural verifier contract assertions
check(
  'STRUCTURAL_MIGRATION_HISTORY_ASSERTION',
  structuralSql.includes('supabase_migrations.schema_migrations') &&
    structuralSql.includes('20260903110000'),
  'Structural verifier must check supabase_migrations.schema_migrations for version 20260903110000'
);

check(
  'STRUCTURAL_OWNER_FK_CASCADE',
  /owner_user_id.*REFERENCES\s+auth\\?\.users.*ON\s+DELETE\s+CASCADE/i.test(
    structuralSql
  ),
  'Structural verifier must assert owner_user_id references auth.users(id) ON DELETE CASCADE'
);

check(
  'STRUCTURAL_ASSIGNED_BY_FK_SET_NULL',
  /assigned_by_user_id.*REFERENCES\s+auth\\?\.users.*ON\s+DELETE\s+SET\s+NULL/i.test(
    structuralSql
  ),
  'Structural verifier must assert assigned_by_user_id references auth.users(id) ON DELETE SET NULL'
);

check(
  'STRUCTURAL_EXACT_UNIQUE_SLOT',
  /UNIQUE\s*\\?\(\s*owner_user_id\s*,\s*provider\s*,\s*source\s*\\?\)/i.test(
    structuralSql
  ),
  'Structural verifier must assert exact UNIQUE (owner_user_id, provider, source) constraint'
);

check(
  'STRUCTURAL_SOURCE_CHECK',
  /source.*(?:PERSONAL.*ADMIN_ASSIGNED|ADMIN_ASSIGNED.*PERSONAL)/i.test(
    structuralSql
  ),
  'Structural verifier must assert source IN (PERSONAL, ADMIN_ASSIGNED)'
);

check(
  'STRUCTURAL_PROVIDER_CHECK',
  /provider\s*=\s*(?:''|')GEMINI(?:''|')/i.test(structuralSql),
  'Structural verifier must assert provider = GEMINI'
);

check(
  'STRUCTURAL_ENVELOPE_VERSION_CHECK',
  /envelope_version\s*=\s*1/i.test(structuralSql),
  'Structural verifier must assert envelope_version = 1'
);

check(
  'STRUCTURAL_PROVENANCE_CHECK',
  /source.*PERSONAL.*assigned_by_user_id/is.test(structuralSql) &&
    /source.*ADMIN_ASSIGNED.*assigned_by_user_id/is.test(structuralSql),
  'Structural verifier must assert assignment provenance constraint'
);

check(
  'STRUCTURAL_CRYPTO_MATERIAL_CHECK',
  /octet_length.*nonce.*12/is.test(structuralSql) &&
    /octet_length.*auth_tag.*16/is.test(structuralSql) &&
    /is_active.*false/is.test(structuralSql),
  'Structural verifier must assert crypto material integrity'
);

check(
  'STRUCTURAL_KEY_HINT_BOUND',
  /key_hint.*length.*key_hint.*BETWEEN/is.test(structuralSql),
  'Structural verifier must assert active key_hint length BETWEEN 1 AND 4'
);

check(
  'STRUCTURAL_KEY_HINT_PRINTABLE_ASCII_ASSERTION',
  structuralSql.includes('[ -~') &&
    structuralSql.includes('STRUCTURAL_KEY_HINT_PRINTABLE_ASCII=PASS'),
  'Structural verifier must assert printable ASCII check on active key_hint'
);

check(
  'STRUCTURAL_EXACT_RPC_SIGNATURES',
  structuralSql.includes('ai_credentials_read_for_service') &&
    structuralSql.includes('ai_credentials_write_for_service') &&
    structuralSql.includes('ai_credentials_revoke_for_service') &&
    /smallint.*text.*bytea.*bytea.*bytea/i.test(structuralSql),
  'Structural verifier must assert exact identity signatures for all 3 RPC facade functions'
);

check(
  'STRUCTURAL_REFERENCES_ABSENT',
  structuralSql.includes('REFERENCES') &&
    /service_role.*NOT\s+have.*REFERENCES/i.test(structuralSql),
  'Structural verifier must assert absence of REFERENCES privilege for service_role'
);

check(
  'STRUCTURAL_TRIGGER_ABSENT',
  structuralSql.includes('TRIGGER') &&
    /service_role.*NOT\s+have.*TRIGGER/i.test(structuralSql),
  'Structural verifier must assert absence of TRIGGER privilege for service_role'
);

check(
  'STRUCTURAL_FINAL_PASS_MARKER',
  structuralSql.includes("RAISE NOTICE 'PHASE_11_STRUCTURAL_GATE=PASS';"),
  'Structural verifier must output PHASE_11_STRUCTURAL_GATE=PASS notice upon completion'
);

check(
  'MIGRATION_KEY_HINT_BOUNDED',
  /key_hint\s+IS\s+NOT\s+NULL\s+AND\s+length\s*\(\s*key_hint\s*\)\s+BETWEEN\s+1\s+AND\s+4/i.test(
    migrationSql
  ),
  'Migration crypto material CHECK must enforce length(key_hint) BETWEEN 1 AND 4'
);

check(
  'MIGRATION_KEY_HINT_PRINTABLE_ASCII_CHECK',
  /key_hint\s*~\s*'\^\[ -~\]\{1,4\}\$'/i.test(migrationSql),
  'Migration crypto material CHECK must restrict key_hint to printable ASCII ^[ -~]{1,4}$'
);

console.log(`\nPhase 11 Verification: ${passedChecks} passed, ${failedChecks} failed.`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('--- Phase 11 Source Gate: ALL CHECKS PASSED ---');
}
