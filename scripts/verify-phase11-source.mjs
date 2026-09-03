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

// 4. private.ai_credentials Table Schema
check(
  'PRIVATE_AI_CREDENTIALS_TABLE_EXISTS',
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?private\.ai_credentials/i.test(
    migrationSql
  ),
  'Migration must create table private.ai_credentials'
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

console.log(`\nPhase 11 Verification: ${passedChecks} passed, ${failedChecks} failed.`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('--- Phase 11 Source Gate: ALL CHECKS PASSED ---');
}
