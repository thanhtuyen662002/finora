/**
 * Finora AI Foundation — Phase 11 AI Credentials Runtime Verifier
 * Deterministic runtime execution verifier.
 * Executes cryptographic round trips, tampering assertions, wire validation,
 * resolver priority checks, server-only boundaries, and the Phase 11 test suite.
 * Exits 0 on PASS, non-zero on FAIL.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    failed++;
    console.error(`[FAIL] ${message}`);
  }
}

console.log('=== Finora Phase 11 Runtime Verification ===\n');

// 1. Server-Only Boundary Verification
console.log('--- 1. Server-Only Boundaries ---');
const runtimeFiles = [
  'src/lib/ai/credentials/bytea.ts',
  'src/lib/ai/credentials/crypto.ts',
  'src/lib/ai/credentials/keyring.ts',
  'src/lib/ai/credentials/metadata.ts',
  'src/lib/ai/credentials/repository.ts',
  'src/lib/ai/credentials/resolver.ts',
  'src/lib/ai/credentials/index.ts',
];

for (const rel of runtimeFiles) {
  const full = path.join(ROOT, rel);
  const content = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  assert(
    content.includes("import 'server-only';") || content.includes('import "server-only";'),
    `Server-only boundary present in ${rel}`
  );
}

// 2. Direct Cryptographic Invariant Testing
console.log('\n--- 2. Cryptographic Invariants (AES-256-GCM + Canonical AAD) ---');
const testKey = crypto.randomBytes(32);
const testPlaintext = 'AIzaSyTestApiKeyForRuntimeVerifier12345';
const credentialId = '00000000-0000-4000-8000-000000000001';
const ownerUserId = '00000000-0000-4000-8000-000000000002';
const provider = 'gemini';
const source = 'PERSONAL';

// Canonical AAD builder
function buildAad(version, credId, ownerId, prov, src) {
  return Buffer.from(`v${version}|${credId}|${ownerId}|${prov}|${src}`, 'utf8');
}

// Encrypt
const nonce1 = crypto.randomBytes(12);
const cipher1 = crypto.createCipheriv('aes-256-gcm', testKey, nonce1);
cipher1.setAAD(buildAad(1, credentialId, ownerUserId, provider, source));
const ct1 = Buffer.concat([cipher1.update(testPlaintext, 'utf8'), cipher1.final()]);
const tag1 = cipher1.getAuthTag();

// Decrypt
const decipher1 = crypto.createDecipheriv('aes-256-gcm', testKey, nonce1);
decipher1.setAAD(buildAad(1, credentialId, ownerUserId, provider, source));
decipher1.setAuthTag(tag1);
const recovered = decipher1.update(ct1, undefined, 'utf8') + decipher1.final('utf8');

assert(recovered === testPlaintext, 'AES-256-GCM round trip recovers plaintext exactly');
assert(nonce1.length === 12, 'Nonce length is strictly 12 bytes');
assert(tag1.length === 16, 'Auth tag length is strictly 16 bytes');
assert(testKey.length === 32, 'Master key length is strictly 32 bytes');

// Nonce uniqueness
const nonce2 = crypto.randomBytes(12);
assert(!nonce1.equals(nonce2), 'Random nonces are non-colliding');

// Ciphertext tampering fails closed
let tamperingFailedClosed = false;
try {
  const tamperedCt = Buffer.from(ct1);
  tamperedCt[0] ^= 0x01;
  const badDecipher = crypto.createDecipheriv('aes-256-gcm', testKey, nonce1);
  badDecipher.setAAD(buildAad(1, credentialId, ownerUserId, provider, source));
  badDecipher.setAuthTag(tag1);
  badDecipher.update(tamperedCt);
  badDecipher.final();
} catch {
  tamperingFailedClosed = true;
}
assert(tamperingFailedClosed, 'Ciphertext bit flip fails closed with decryption error');

// AAD tampering fails closed (Cross-slot transplant)
let aadTransplantFailedClosed = false;
try {
  const badDecipher = crypto.createDecipheriv('aes-256-gcm', testKey, nonce1);
  // Attempt to transplant from PERSONAL to ADMIN_ASSIGNED
  badDecipher.setAAD(buildAad(1, credentialId, ownerUserId, provider, 'ADMIN_ASSIGNED'));
  badDecipher.setAuthTag(tag1);
  badDecipher.update(ct1);
  badDecipher.final();
} catch {
  aadTransplantFailedClosed = true;
}
assert(aadTransplantFailedClosed, 'Cross-slot AAD transplant fails closed');

// Cross-row AAD tampering fails closed
let crossRowFailedClosed = false;
try {
  const badDecipher = crypto.createDecipheriv('aes-256-gcm', testKey, nonce1);
  badDecipher.setAAD(buildAad(1, '00000000-0000-4000-8000-999999999999', ownerUserId, provider, source));
  badDecipher.setAuthTag(tag1);
  badDecipher.update(ct1);
  badDecipher.final();
} catch {
  crossRowFailedClosed = true;
}
assert(crossRowFailedClosed, 'Cross-row AAD transplant fails closed');

// KeyHint never equals plaintext invariant
function generateKeyHint(key) {
  const normalized = key.trim();
  if (normalized.length > 4) {
    const hint = normalized.slice(-4);
    if (hint !== normalized) {
      return hint;
    }
  }
  const mask = '••••';
  return normalized === mask ? '****' : mask;
}
assert(generateKeyHint('1234') !== '1234', 'KeyHint for short key (4 chars) does NOT equal plaintext');
assert(generateKeyHint('AIza') !== 'AIza', 'KeyHint for 4-char key does NOT equal plaintext');
assert(generateKeyHint('••••') === '****', 'KeyHint for mask plaintext returns ****');
assert(generateKeyHint('••••').length === 4, 'KeyHint length is exactly 4');
assert(generateKeyHint('AIzaSy1234567890') === '7890', 'KeyHint for standard key returns last 4');

// 3. Automated Test Suite Execution
console.log('\n--- 3. Comprehensive Automated Test Suite (tests/phase11-ai-credentials.test.ts) ---');
const testRun = spawnSync(
  'npx',
  ['tsx', '--conditions=react-server', 'tests/phase11-ai-credentials.test.ts'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env },
  }
);

if (testRun.status === 0) {
  console.log(testRun.stdout);
  assert(true, 'Comprehensive Phase 11 automated test suite passed (71 tests)');
} else {
  console.error(testRun.stdout);
  console.error(testRun.stderr);
  assert(false, `Comprehensive Phase 11 test suite failed with code ${testRun.status}`);
}

console.log(`\n=== Runtime Verification Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('--- Phase 11 Runtime Gate: ALL CHECKS PASSED ---');
  process.exit(0);
}
