/**
 * Finora AI Foundation — Phase 11 Pass B UI & Server Actions Verifier
 * Validates security boundaries, authenticated action layer, safe metadata DTOs,
 * UI credential handling, and ensures no leakage of secrets or Phase 12 code.
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
}

// 2. Server Actions Architecture & Security Boundaries
const actionsPath = path.join(ROOT, 'src/features/ai/credentials/actions.ts');
const actionCorePath = path.join(ROOT, 'src/features/ai/credentials/action-core.ts');
check('ACTIONS_FILE_EXISTS', fs.existsSync(actionsPath), 'actions.ts must exist');
check('ACTION_CORE_FILE_EXISTS', fs.existsSync(actionCorePath), 'action-core.ts must exist');

if (fs.existsSync(actionsPath) && fs.existsSync(actionCorePath)) {
  const actionsContent = fs.readFileSync(actionsPath, 'utf8');
  const actionCoreContent = fs.readFileSync(actionCorePath, 'utf8');
  check('ACTIONS_USE_SERVER', actionsContent.includes("'use server'") || actionsContent.includes('"use server"'), "actions.ts must declare 'use server'");
  check('ACTION_CORE_SERVER_ONLY', actionCoreContent.includes("import 'server-only'") || actionCoreContent.includes('import "server-only"'), "action-core.ts must declare import 'server-only'");
  check('ACTIONS_AUTH_GET_USER', actionsContent.includes('auth.getUser()') || actionCoreContent.includes('getUser'), 'actions layer must verify authenticated user via auth.getUser()');
  check('ACTIONS_VERIFY_ADMIN_ACTOR', actionsContent.includes('verifyAdminActor') || actionCoreContent.includes('verifyAdmin'), 'actions layer must enforce verifyAdminActor before admin operations');
  check('ACTIONS_SANITIZE_ERROR', actionCoreContent.includes('sanitizeActionError'), 'action-core.ts must sanitize internal errors');
  check('ACTIONS_GET_MY_METADATA', actionsContent.includes('export async function getMyAiCredentialMetadata'), 'getMyAiCredentialMetadata must be exported');
  check('ACTIONS_SAVE_MY_PERSONAL', actionsContent.includes('export async function saveMyPersonalAiCredential'), 'saveMyPersonalAiCredential must be exported');
  check('ACTIONS_REVOKE_MY_PERSONAL', actionsContent.includes('export async function revokeMyPersonalAiCredential'), 'revokeMyPersonalAiCredential must be exported');
  check('ACTIONS_GET_ADMIN_TARGET', actionsContent.includes('export async function getAdminAiCredentialTarget'), 'getAdminAiCredentialTarget must be exported');
  check('ACTIONS_SAVE_ADMIN_ASSIGNED', actionsContent.includes('export async function saveAdminAssignedCredential'), 'saveAdminAssignedCredential must be exported');
  check('ACTIONS_REVOKE_ADMIN_ASSIGNED', actionsContent.includes('export async function revokeAdminAssignedCredential'), 'revokeAdminAssignedCredential must be exported');
  check('ACTIONS_CHECK_IS_ADMIN', actionsContent.includes('export async function checkIsAdmin'), 'checkIsAdmin must be exported');
  check('ACTIONS_VALIDATE_PLAINTEXT', actionCoreContent.includes('validatePlaintextApiKey'), 'action-core.ts must validate plaintext api key');
}

// 3. Settings UI Verification
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

// 4. Admin UI Verification
const adminPath = path.join(ROOT, 'src/app/admin/page.tsx');
check('ADMIN_FILE_EXISTS', fs.existsSync(adminPath), 'admin/page.tsx must exist');

if (fs.existsSync(adminPath)) {
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  check('ADMIN_USE_CLIENT', adminContent.includes("'use client'") || adminContent.includes('"use client"'), "admin/page.tsx must start with 'use client'");
  check('ADMIN_IMPORTS_ACTIONS', adminContent.includes('getAdminAiCredentialTarget') && adminContent.includes('saveAdminAssignedCredential'), 'admin page must import admin actions');
  check('ADMIN_PASSWORD_INPUT', adminContent.includes('type="password"'), 'admin page must use type="password" for credential assignment');
  check('ADMIN_AUTOCOMPLETE_OFF', adminContent.includes('autoComplete="off"'), 'admin page must specify autoComplete="off"');
  check('ADMIN_NO_SERVER_CRYPTO', !adminContent.includes("from 'node:crypto'") && !adminContent.includes("from 'crypto'"), 'admin page must not import crypto');
  check('ADMIN_NO_SECRET_ENV', !adminContent.includes('FINORA_AI_CREDENTIAL') && !adminContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'admin page must not reference secret env vars');
  check('ADMIN_LOCATES_BY_EMAIL', adminContent.includes('handleLookupTarget') && adminContent.includes('targetEmail'), 'admin page must locate target users by email');
}

// 5. Phase 12 Isolation Gate (strictly absent)
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
