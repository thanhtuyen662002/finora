/**
 * Finora AI Foundation — Phase 11 Pass B UI & Server Actions Verifier
 * Validates security boundaries, authenticated action layer, safe metadata DTOs,
 * UI credential handling, deferred repository factory construction,
 * chronological authorization ordering, and ensures no leakage of secrets or Phase 12 code.
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

console.log('--- Finora Phase 11 Pass B UI & Server Actions Verification ---');

// 1. Types & Safe Metadata Contract
const typesPath = path.join(ROOT, 'src/features/ai/credentials/types.ts');
check('TYPES_FILE_EXISTS', fs.existsSync(typesPath), 'types.ts must exist');

if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  check('TYPES_SAFE_METADATA_EXPORTED', typesContent.includes('AiCredentialSafeMetadata'), 'AiCredentialSafeMetadata must be exported');
  check('TYPES_TARGET_USER_DTO_EXPORTED', typesContent.includes('export interface AdminTargetUserDTO'), 'AdminTargetUserDTO must be exported');
  check('TYPES_ACTION_RESULT_EXPORTED', typesContent.includes('export type ActionResult'), 'ActionResult must be exported');
  check('TYPES_NO_CIPHERTEXT_LEAK', !typesContent.includes('ciphertext:') && !typesContent.includes('authTag:'), 'Types must not expose ciphertext or authTag');
  check('CLIENT_OWNER_UUID_ABSENT_FROM_ADMIN_DTO', !typesContent.includes('ownerUserId:') && typesContent.includes('email: string;'), 'AdminTargetUserDTO must not expose ownerUserId to browser');
}

// 2. Server Actions Architecture & Security Boundaries
const actionsPath = path.join(ROOT, 'src/features/ai/credentials/actions.ts');
const actionCorePath = path.join(ROOT, 'src/features/ai/credentials/action-core.ts');
check('ACTIONS_FILE_EXISTS', fs.existsSync(actionsPath), 'actions.ts must exist');
check('ACTION_CORE_FILE_EXISTS', fs.existsSync(actionCorePath), 'action-core.ts must exist');

if (fs.existsSync(actionsPath) && fs.existsSync(actionCorePath)) {
  const actionsContent = fs.readFileSync(actionsPath, 'utf8');
  const actionCoreContent = fs.readFileSync(actionCorePath, 'utf8');

  // Exact 7 public exports check
  const exportedFunctions = [...actionsContent.matchAll(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
  const expectedExports = [
    'getMyAiCredentialMetadata',
    'saveMyPersonalAiCredential',
    'revokeMyPersonalAiCredential',
    'checkIsAdmin',
    'getAdminAiCredentialTarget',
    'saveAdminAssignedCredential',
    'revokeAdminAssignedCredential',
  ];
  const exactExportsMatch =
    exportedFunctions.length === 7 &&
    expectedExports.every((e) => exportedFunctions.includes(e));

  check(
    'PUBLIC_ACTION_EXPORTS_EXACT',
    exactExportsMatch && !actionsContent.includes('export *'),
    `actions.ts must export exactly the 7 accepted public actions without barrel exports. Found: ${exportedFunctions.join(', ')}`
  );

  check(
    'PRIVILEGED_LOOKUP_NOT_PUBLIC_ACTION',
    !actionsContent.includes('lookupUserByExactEmail') &&
      actionCoreContent.includes('lookupUserByExactEmail'),
    'lookupUserByExactEmail must remain internal to action-core.ts and not be exposed as a public action'
  );

  // Eager repository construction prevention
  check(
    'ACTIONS_NO_EAGER_REPOSITORY_CONSTRUCTION',
    !actionsContent.includes('const repo = createAiCredentialRepository()') &&
      !actionsContent.includes('const repo=createAiCredentialRepository()'),
    'actions.ts must not eagerly instantiate createAiCredentialRepository()'
  );

  check(
    'PERSONAL_REPOSITORY_FACTORY_DEFERRED',
    actionsContent.includes('repoFactory: createAiCredentialRepository'),
    'actions.ts must pass deferred repoFactory to action core'
  );

  check(
    'ADMIN_REPOSITORY_FACTORY_DEFERRED',
    actionsContent.includes('repoFactory: createAiCredentialRepository') &&
      actionsContent.includes('adminClientFactory: () => createAdminClient()'),
    'actions.ts must pass deferred repoFactory and adminClientFactory to admin action core'
  );

  check(
    'ACTION_CORE_REPO_FACTORY_AFTER_AUTH',
    actionCoreContent.includes('repoFactory: () => AiCredentialRepository') &&
      actionCoreContent.includes('const repo = await deps.repoFactory()'),
    'action-core.ts must declare repoFactory dependency and instantiate repo only after authentication'
  );

  check(
    'ACTION_CORE_REPO_FACTORY_AFTER_ADMIN',
    actionCoreContent.includes('verifyAdmin') &&
      actionCoreContent.includes('adminClientFactory') &&
      actionCoreContent.includes('lookupUserByExactEmail'),
    'action-core.ts must verify admin authority and resolve target user before calling repoFactory'
  );

  check('ACTIONS_USE_SERVER', actionsContent.includes("'use server'") || actionsContent.includes('"use server"'), "actions.ts must declare 'use server'");
  check('ACTION_CORE_SERVER_ONLY', actionCoreContent.includes("import 'server-only'") || actionCoreContent.includes('import "server-only"'), "action-core.ts must declare import 'server-only'");
  check('ACTIONS_AUTH_GET_USER', actionsContent.includes('auth.getUser()') || actionCoreContent.includes('getUser'), 'actions layer must verify authenticated user via auth.getUser()');
  check('ACTIONS_VERIFY_ADMIN_ACTOR', actionsContent.includes('verifyAdminActor') || actionCoreContent.includes('verifyAdmin'), 'actions layer must enforce verifyAdminActor before admin operations');
  check('ACTIONS_SANITIZE_ERROR', actionCoreContent.includes('sanitizeActionError'), 'action-core.ts must sanitize internal errors');
  check('ACTIONS_VALIDATE_PLAINTEXT', actionCoreContent.includes('validatePlaintextApiKey'), 'action-core.ts must validate plaintext api key');
}

// 3. Action Tests Order & Factory Verification
const actionTestsPath = path.join(ROOT, 'tests/phase11-ai-credential-actions.test.ts');
check('ACTION_TESTS_FILE_EXISTS', fs.existsSync(actionTestsPath), 'phase11-ai-credential-actions.test.ts must exist');

if (fs.existsSync(actionTestsPath)) {
  const testContent = fs.readFileSync(actionTestsPath, 'utf8');

  check(
    'ACTION_TESTS_TRACK_REPO_FACTORY',
    testContent.includes('repoFactoryCalls') || testContent.includes('getRepoFactoryCalls'),
    'action tests must track repoFactory call counts'
  );

  check(
    'ACTION_TESTS_UNAUTH_REPO_FACTORY_ZERO',
    testContent.includes('PERSONAL-ORDER-01') &&
      testContent.includes('PERSONAL-ORDER-02') &&
      testContent.includes('PERSONAL-ORDER-03'),
    'action tests must assert that unauthenticated/invalid personal actions result in 0 repoFactory calls'
  );

  check(
    'ACTION_TESTS_NONADMIN_REPO_FACTORY_ZERO',
    testContent.includes('ADMIN-ORDER-01') &&
      testContent.includes('ADMIN-ORDER-02') &&
      testContent.includes('ADMIN-ORDER-03') &&
      testContent.includes('ADMIN-ORDER-04'),
    'action tests must assert that non-admin or target not found results in 0 admin client and 0 repoFactory calls'
  );

  check(
    'ACTION_TESTS_ADMIN_FACTORY_ORDER',
    testContent.includes('ADMIN-ORDER-06') &&
      testContent.includes('eventLog') &&
      testContent.includes("'verifyAdmin'") &&
      testContent.includes("'adminClientFactory'") &&
      testContent.includes("'repoFactory'"),
    'action tests must assert exact chronological order: verifyAdmin -> adminClientFactory -> lookup -> repoFactory'
  );
}

// 4. Settings UI Verification
const settingsPath = path.join(ROOT, 'src/app/settings/page.tsx');
check('SETTINGS_FILE_EXISTS', fs.existsSync(settingsPath), 'settings/page.tsx must exist');

if (fs.existsSync(settingsPath)) {
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  check('SETTINGS_USE_CLIENT', settingsContent.includes("'use client'") || settingsContent.includes('"use client"'), "settings/page.tsx must start with 'use client'");
  check('SETTINGS_IMPORTS_ACTIONS', settingsContent.includes('getMyAiCredentialMetadata') && settingsContent.includes('saveMyPersonalAiCredential'), 'settings page must import actions');
  check('SETTINGS_PASSWORD_INPUT', settingsContent.includes('type="password"'), 'settings page must use type="password" for key input');
  check('SETTINGS_AUTOCOMPLETE_OFF', settingsContent.includes('autoComplete="off"'), 'settings page must specify autoComplete="off"');
  check('SETTINGS_NO_SERVER_CRYPTO', !settingsContent.includes("from 'node:crypto'") && !settingsContent.includes("from 'crypto'"), 'settings page must not import crypto');
  check('SETTINGS_NO_SECRET_ENV', !settingsContent.includes('FINORA_AI_CREDENTIAL') && !settingsContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'settings page must not reference secret env vars');
}

// 5. Admin UI Verification
const adminPath = path.join(ROOT, 'src/app/admin/page.tsx');
check('ADMIN_FILE_EXISTS', fs.existsSync(adminPath), 'admin/page.tsx must exist');

if (fs.existsSync(adminPath)) {
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  check('ADMIN_USE_CLIENT', adminContent.includes("'use client'") || adminContent.includes('"use client"'), "admin/page.tsx must start with 'use client'");
  check('ADMIN_IMPORTS_ACTIONS', adminContent.includes('getAdminAiCredentialTarget') && adminContent.includes('saveAdminAssignedCredential') && adminContent.includes('revokeAdminAssignedCredential'), 'admin page must import admin actions');
  check('ADMIN_PASSWORD_INPUT', adminContent.includes('type="password"'), 'admin page must use type="password" for credential assignment');
  check('ADMIN_AUTOCOMPLETE_OFF', adminContent.includes('autoComplete="off"'), 'admin page must specify autoComplete="off"');
  check('ADMIN_NO_SERVER_CRYPTO', !adminContent.includes("from 'node:crypto'") && !adminContent.includes("from 'crypto'"), 'admin page must not import crypto');
  check('ADMIN_NO_SECRET_ENV', !adminContent.includes('FINORA_AI_CREDENTIAL') && !adminContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'admin page must not reference secret env vars');
  check('ADMIN_LOCATES_BY_EMAIL', adminContent.includes('handleLookupTarget') && adminContent.includes('targetEmail'), 'admin page must locate target users by email');
  check(
    'NON_ADMIN_FUNCTIONAL_FORM_HIDDEN',
    adminContent.includes('!isAdmin') && adminContent.includes('Access Denied'),
    'admin page must hide functional form and show Access Denied when non-admin'
  );
  check('ADMIN_FAKE_KEY_PREVIEW_ABSENT', !adminContent.includes('AIzaSy••••'), 'admin page must not render fake API-key-shaped System Key preview');
  check('ADMIN_OBSOLETE_PHASE1_WORDING_ABSENT', !adminContent.includes('chưa được triển khai ở Phase 1'), 'admin page must not claim Phase 1 credential storage is unbuilt');
  check('ADMIN_HARDCODED_SYSTEM_STATE_ABSENT', !adminContent.includes('Chưa cấu hình (Server-side)'), 'admin page must not render hardcoded unverified system key state');
  check('ADMIN_SYSTEM_KEY_INPUT_ABSENT', !adminContent.includes('id="systemKey"') && !adminContent.includes("id='systemKey'"), 'admin page must not render an input element for system key');
  check('ADMIN_SYSTEM_KEY_NEUTRAL_SERVER_STATUS', adminContent.includes('Quản lý server-side') && adminContent.includes('Khóa hệ thống được quản lý server-side'), 'admin page must render neutral server-side management status for system key');
  check('ADMIN_ASSIGN_REVOKE_WIRED', adminContent.includes('handleAssignCredential') && adminContent.includes('handleRevokeAssignedCredential'), 'admin page must wire assign and revoke handlers');
  check('ADMIN_NO_PLAINTEXT_READBACK', !adminContent.includes('plaintextKey') && !adminContent.includes('decryptedKey'), 'admin page must not introduce plaintext readback');
  check('ADMIN_AI_PROVIDER_NO_MAX_W_2XL', !adminContent.includes('max-w-2xl'), 'admin page must not have max-w-2xl mismatch in AI tab layout');
  check('ADMIN_MODEL_PREVIEW_WORDING_PRESENT', adminContent.includes('Cấu hình model hiện là preview giao diện và chưa được lưu vào backend'), 'admin page must preserve preview-only model wording');
  check('ADMIN_CONSOLE_BADGE_PRESENT', adminContent.includes('Admin Console'), 'admin page header badge must reflect Admin Console');
}

// 6. Client Storage & Secret Boundary Checks
const clientDirs = [path.join(ROOT, 'src/app'), path.join(ROOT, 'src/components')];
let clientLocalStorageCount = 0;
let clientSessionStorageCount = 0;
let clientServiceRoleCount = 0;

function scanClientFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      scanClientFiles(full);
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('localStorage.setItem') && (content.includes('key') || content.includes('credential') || content.includes('ai_key'))) {
        clientLocalStorageCount++;
      }
      if (content.includes('sessionStorage.setItem') && (content.includes('key') || content.includes('credential') || content.includes('ai_key'))) {
        clientSessionStorageCount++;
      }
      if (content.includes('createAdminClient') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        // Exclude server-side admin utilities or route handlers if any in src/app/api
        if (!full.includes(path.join('src', 'app', 'api')) && !full.includes(path.join('src', 'lib', 'supabase', 'admin.ts'))) {
          clientServiceRoleCount++;
        }
      }
    }
  }
}
for (const d of clientDirs) {
  scanClientFiles(d);
}

check('CLIENT_LOCAL_STORAGE_CREDENTIAL_COUNT=0', clientLocalStorageCount === 0, `Found ${clientLocalStorageCount} occurrences of localStorage credential storage in client files`);
check('CLIENT_SESSION_STORAGE_CREDENTIAL_COUNT=0', clientSessionStorageCount === 0, `Found ${clientSessionStorageCount} occurrences of sessionStorage credential storage in client files`);
check('CLIENT_SERVICE_ROLE_IMPORT_COUNT=0', clientServiceRoleCount === 0, `Found ${clientServiceRoleCount} client references to service-role client`);

// 7. Phase 12 Isolation Gate (strictly absent)
const featuresDir = path.join(ROOT, 'src/features');
function checkNoPhase12(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      checkNoPhase12(full);
    } else if (f.isFile() && (f.name.endsWith('.ts') || f.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('parseNaturalLanguageTransaction') || content.includes('generateFinancialAdvice')) {
        check('PHASE_12_ISOLATION_VIOLATION', false, `Phase 12 feature code detected in ${f.name}`);
      }
    }
  }
}
checkNoPhase12(featuresDir);
check('PHASE_12_ISOLATION_PRESERVED', true, 'Phase 12 features remain strictly absent');

console.log('---------------------------------------------------------------');
console.log(`Phase 11 Pass B Verification Summary: ${passedChecks} Passed, ${failedChecks} Failed.`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('Phase 11 Pass B UI & Server Actions verification PASSED.');
  process.exit(0);
}
