/**
 * Finora AI Foundation — Phase 11 AI Credentials Test Suite
 * Comprehensive tests for AES-256-GCM AEAD, Bytea wire conversions,
 * Master Key Ring, Credential Resolver, and Admin Authority.
 */

import assert from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  decodePostgresBytea,
  encodePostgresBytea,
} from '../src/lib/ai/credentials/bytea';
import {
  AES_AUTH_TAG_BYTES,
  AES_KEY_BYTES,
  AES_NONCE_BYTES,
  buildCanonicalAad,
  decryptCredential,
  ENVELOPE_VERSION,
  encryptCredential,
} from '../src/lib/ai/credentials/crypto';
import {
  getMasterKey,
  resolveMasterKeyRing,
} from '../src/lib/ai/credentials/keyring';
import {
  buildSafeCredentialMetadata,
  sanitizeSafeKeyHint,
  generateKeyHint,
} from '../src/lib/ai/credentials/metadata';
import {
  AiCredentialRepository,
  createAiCredentialRepository,
  hydrateWireRecordToEnvelope,
  validateWireRecord,
  validateWireKeyHint,
  KEY_HINT_MAX_LENGTH,
} from '../src/lib/ai/credentials/repository';
import { AiCredentialResolver } from '../src/lib/ai/credentials/resolver';
import type {
  EncryptedEnvelope,
  EncryptedEnvelopeWire,
  MasterKeyRing,
} from '../src/lib/ai/credentials/types';
import { AiError } from '../src/lib/ai/errors';
import {
  parseAdminUserIds,
  getAuthorizedAdminUserIds,
  isAdminUserId,
  verifyAdminActor,
  ENV_ADMIN_USER_IDS,
} from '../src/lib/auth/admin';
import {
  validateCredentialPlaintext,
  buildCredentialKeyHint,
} from '../src/lib/ai/credentials/crypto';

async function runTests() {
  console.log('--- Running Phase 11 AI Credentials Tests ---');
  let totalTests = 0;
  const pendingTests: Promise<void>[] = [];

  function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    const p = Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  ✓ ${name}`);
      })
      .catch((err) => {
        console.error(`  ✗ ${name}`);
        throw err;
      });
    pendingTests.push(p);
  }

  const testKey32A = randomBytes(32);
  const testKey32B = randomBytes(32);
  const keyRingObj = {
    key_v1: testKey32A.toString('base64'),
    key_v2: testKey32B.toString('base64'),
  };
  const testKeyRing: MasterKeyRing = {
    activeKeyId: 'key_v1',
    keys: new Map([
      ['key_v1', testKey32A],
      ['key_v2', testKey32B],
    ]),
  };

  const userA = randomUUID();
  const userB = randomUUID();
  const sampleKey = 'AIzaSyTestApiKeySecret1234567890';

  // --- CRYPTO TESTS (Section 54) ---

  test('1. AES-256-GCM round trip encrypt and decrypt', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const decrypted = decryptCredential({
      envelope,
      masterKey: testKey32A,
    });

    assert.strictEqual(decrypted, sampleKey);
    assert.strictEqual(envelope.envelopeVersion, 1);
    assert.strictEqual(envelope.ownerUserId, userA);
    assert.strictEqual(envelope.source, 'PERSONAL');
    assert.strictEqual(envelope.provider, 'GEMINI');
    assert.strictEqual(envelope.keyHint, '7890');
  });

  test('2. Key must be exactly 32 bytes', () => {
    assert.throws(
      () =>
        encryptCredential({
          plaintext: sampleKey,
          ownerUserId: userA,
          source: 'PERSONAL',
          provider: 'GEMINI',
          keyId: 'key_v1',
          masterKey: randomBytes(16),
        }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_KEY_UNAVAILABLE'
    );
  });

  test('3. Nonce must be exactly 12 bytes', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });
    assert.strictEqual(envelope.nonce.length, AES_NONCE_BYTES);

    const badEnvelope = { ...envelope, nonce: randomBytes(8) };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('4. Fresh random nonce generated per encryption (no nonce reuse)', () => {
    const env1 = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });
    const env2 = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    assert.notDeepStrictEqual(env1.nonce, env2.nonce);
    assert.notDeepStrictEqual(env1.ciphertext, env2.ciphertext);
  });

  test('5. Auth tag must be exactly 16 bytes', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });
    assert.strictEqual(envelope.authTag.length, AES_AUTH_TAG_BYTES);

    const badEnvelope = { ...envelope, authTag: randomBytes(12) };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('6. Wrong master key fails decryption with AI_CREDENTIAL_CORRUPTED', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    assert.throws(
      () => decryptCredential({ envelope, masterKey: testKey32B }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('7. Ciphertext mutation fails decryption with AI_CREDENTIAL_CORRUPTED', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const mutatedCiphertext = Buffer.from(envelope.ciphertext);
    mutatedCiphertext[0] ^= 0xff; // flip bits

    const badEnvelope = { ...envelope, ciphertext: mutatedCiphertext };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('8. Auth tag mutation fails decryption with AI_CREDENTIAL_CORRUPTED', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const mutatedAuthTag = Buffer.from(envelope.authTag);
    mutatedAuthTag[0] ^= 0xaa;

    const badEnvelope = { ...envelope, authTag: mutatedAuthTag };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('9. Credential-ID AAD mutation fails decryption', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const badEnvelope = { ...envelope, credentialId: randomUUID() };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('10. Owner-user-ID AAD mutation fails decryption', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const badEnvelope = { ...envelope, ownerUserId: userB };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('11. Provider AAD mutation fails decryption', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const badEnvelope = { ...envelope, provider: 'OPENAI' as any };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('12. Source AAD mutation fails decryption', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const badEnvelope = { ...envelope, source: 'ADMIN_ASSIGNED' as any };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('13. Version AAD mutation fails decryption', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const badEnvelope = { ...envelope, envelopeVersion: 2 as any };
    assert.throws(
      () => decryptCredential({ envelope: badEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('14. Cross-slot transplant (PERSONAL -> ADMIN_ASSIGNED) fails closed', () => {
    const personalEnvelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const transplantedEnvelope: EncryptedEnvelope = {
      ...personalEnvelope,
      source: 'ADMIN_ASSIGNED',
    };

    assert.throws(
      () => decryptCredential({ envelope: transplantedEnvelope, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('15. Cross-row transplant (Row A -> Row B) fails closed', () => {
    const envelopeA = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const envelopeB = encryptCredential({
      plaintext: 'different_api_key_for_b_9999',
      ownerUserId: userB,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    // Transplant ciphertext and authTag from B into A's envelope
    const transplanted: EncryptedEnvelope = {
      ...envelopeA,
      ciphertext: envelopeB.ciphertext,
      authTag: envelopeB.authTag,
      nonce: envelopeB.nonce,
    };

    assert.throws(
      () => decryptCredential({ envelope: transplanted, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('16. Unknown key_id in key ring fails with AI_CREDENTIAL_KEY_UNAVAILABLE', () => {
    assert.throws(
      () => getMasterKey(testKeyRing, 'nonexistent_key_id'),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_KEY_UNAVAILABLE'
    );
  });

  test('17. Invalid base64 in key ring fails with AI_CREDENTIAL_KEY_UNAVAILABLE', () => {
    assert.throws(
      () =>
        resolveMasterKeyRing({
          activeKeyId: 'k1',
          keyRingJson: JSON.stringify({ k1: 'not-valid-base64!@#$' }),
        }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_KEY_UNAVAILABLE'
    );
  });

  test('18. Key decoded length != 32 bytes fails with AI_CREDENTIAL_KEY_UNAVAILABLE', () => {
    assert.throws(
      () =>
        resolveMasterKeyRing({
          activeKeyId: 'k1',
          keyRingJson: JSON.stringify({ k1: randomBytes(16).toString('base64') }),
        }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_KEY_UNAVAILABLE'
    );
  });

  test('19. Key rotation: decrypt old key, encrypt new key', () => {
    const envelopeV1 = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    // Decrypt with key_v1
    const plaintext = decryptCredential({ envelope: envelopeV1, masterKey: testKey32A });
    assert.strictEqual(plaintext, sampleKey);

    // Re-encrypt with key_v2
    const envelopeV2 = encryptCredential({
      plaintext,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v2',
      masterKey: testKey32B,
    });

    const decryptedV2 = decryptCredential({ envelope: envelopeV2, masterKey: testKey32B });
    assert.strictEqual(decryptedV2, sampleKey);
    assert.strictEqual(envelopeV2.keyId, 'key_v2');
  });

  test('20. Plaintext is absent from encrypted serialization', () => {
    const envelope = encryptCredential({
      plaintext: sampleKey,
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const combined = Buffer.concat([envelope.nonce, envelope.ciphertext, envelope.authTag]);
    assert.strictEqual(combined.includes(Buffer.from(sampleKey)), false);
  });

  // --- BYTEA TESTS (Section 55) ---

  test('21. Buffer to postgres bytea canonical lowercase hex', () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const hex = encodePostgresBytea(buf);
    assert.strictEqual(hex, '\\xdeadbeef');
  });

  test('22. Postgres bytea canonical hex to Buffer', () => {
    const hex = '\\xdeadbeef';
    const buf = decodePostgresBytea(hex);
    assert.deepStrictEqual(buf, Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  });

  test('23. Bytea missing \\x prefix rejected with AI_CREDENTIAL_CORRUPTED', () => {
    assert.throws(
      () => decodePostgresBytea('deadbeef'),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('24. Odd-length bytea hex rejected with AI_CREDENTIAL_CORRUPTED', () => {
    assert.throws(
      () => decodePostgresBytea('\\xabc'),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('25. Non-hex bytea data rejected with AI_CREDENTIAL_CORRUPTED', () => {
    assert.throws(
      () => decodePostgresBytea('\\xzzzz'),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('26. Bytea nonce wrong length rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const wrongNonce = encodePostgresBytea(randomBytes(16));
    assert.throws(
      () => decodePostgresBytea(wrongNonce, AES_NONCE_BYTES),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('27. Bytea auth-tag wrong length rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const wrongTag = encodePostgresBytea(randomBytes(12));
    assert.throws(
      () => decodePostgresBytea(wrongTag, AES_AUTH_TAG_BYTES),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  // --- RESOLVER TESTS (Section 56) ---

  function createMockRepo(records: EncryptedEnvelopeWire[]) {
    return {
      readActiveCredentials: async (_userId: string, _provider: string) => records,
      saveCredential: async () => { throw new Error('Not implemented'); },
      revokeCredential: async () => { throw new Error('Not implemented'); },
      getSafeMetadata: async () => { throw new Error('Not implemented'); },
    } as unknown as AiCredentialRepository;
  }

  function wireRecordFromEnvelope(env: EncryptedEnvelope, assignedBy: string | null = null): EncryptedEnvelopeWire {
    return {
      id: env.credentialId,
      owner_user_id: env.ownerUserId,
      source: env.source,
      provider: env.provider,
      assigned_by_user_id: assignedBy,
      envelope_version: env.envelopeVersion,
      key_id: env.keyId,
      nonce: encodePostgresBytea(env.nonce),
      ciphertext: encodePostgresBytea(env.ciphertext),
      auth_tag: encodePostgresBytea(env.authTag),
      key_hint: env.keyHint,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };
  }

  test('28. Missing userId + SYSTEM configured -> returns null (no anonymous SYSTEM)', async () => {
    const resolver = new AiCredentialResolver({
      repository: createMockRepo([]),
      keyRing: testKeyRing,
      systemKey: 'system_secret_key_123',
    });

    const result = await resolver.resolveCredential({
      providerId: 'gemini',
      userId: undefined,
      operation: 'financial_assistant',
    });

    assert.strictEqual(result, null);
  });

  test('29. Unsupported provider + SYSTEM configured -> returns null', async () => {
    const resolver = new AiCredentialResolver({
      repository: createMockRepo([]),
      keyRing: testKeyRing,
      systemKey: 'system_secret_key_123',
    });

    const result = await resolver.resolveCredential({
      providerId: 'unsupported_provider' as any,
      userId: userA,
      operation: 'financial_assistant',
    });

    assert.strictEqual(result, null);
  });

  test('30. Source Priority: PERSONAL selected over ADMIN_ASSIGNED and SYSTEM', async () => {
    const personalEnv = encryptCredential({
      plaintext: 'personal_key_aaa_1111',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });
    const adminEnv = encryptCredential({
      plaintext: 'admin_assigned_key_bbb_2222',
      ownerUserId: userA,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const repo = createMockRepo([
      wireRecordFromEnvelope(personalEnv),
      wireRecordFromEnvelope(adminEnv, randomUUID()),
    ]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key_ccc_3333',
    });

    const result = await resolver.resolveCredential({
      providerId: 'gemini',
      userId: userA,
      operation: 'financial_assistant',
    });

    assert.ok(result);
    assert.strictEqual(result.value, 'personal_key_aaa_1111');
    assert.strictEqual(result.providerId, 'gemini');
  });

  test('31. Source Priority: ADMIN_ASSIGNED selected over SYSTEM when PERSONAL absent', async () => {
    const adminEnv = encryptCredential({
      plaintext: 'admin_assigned_key_bbb_2222',
      ownerUserId: userA,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const repo = createMockRepo([wireRecordFromEnvelope(adminEnv, randomUUID())]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key_ccc_3333',
    });

    const result = await resolver.resolveCredential({
      providerId: 'gemini',
      userId: userA,
      operation: 'financial_assistant',
    });

    assert.ok(result);
    assert.strictEqual(result.value, 'admin_assigned_key_bbb_2222');
    assert.strictEqual(result.providerId, 'gemini');
  });

  test('32. Source Priority: SYSTEM selected when database credentials absent', async () => {
    const repo = createMockRepo([]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key_ccc_3333',
    });

    const result = await resolver.resolveCredential({
      providerId: 'gemini',
      userId: userA,
      operation: 'financial_assistant',
    });

    assert.ok(result);
    assert.strictEqual(result.value, 'system_key_ccc_3333');
    assert.strictEqual(result.providerId, 'gemini');
  });

  test('33. All sources absent -> returns null', async () => {
    const repo = createMockRepo([]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: undefined,
    });

    const result = await resolver.resolveCredential({
      providerId: 'gemini',
      userId: userA,
      operation: 'financial_assistant',
    });

    assert.strictEqual(result, null);
  });

  test('34. Revoked PERSONAL allows ADMIN_ASSIGNED or SYSTEM fallback', async () => {
    const personalEnv = encryptCredential({
      plaintext: 'personal_key_aaa_1111',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });
    const revokedPersonalWire = {
      ...wireRecordFromEnvelope(personalEnv),
      is_active: false,
      revoked_at: new Date().toISOString(),
    };

    const repo = createMockRepo([revokedPersonalWire]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key_fallback_555',
    });

    const result = await resolver.resolveCredential({
      providerId: 'gemini',
      userId: userA,
      operation: 'financial_assistant',
    });

    assert.ok(result);
    assert.strictEqual(result.value, 'system_key_fallback_555');
  });

  test('35. Corrupted active PERSONAL throws AI_CREDENTIAL_CORRUPTED with NO lower fallback', async () => {
    const personalEnv = encryptCredential({
      plaintext: 'personal_key_aaa_1111',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    // Mutate ciphertext to simulate corruption
    const corruptedWire: EncryptedEnvelopeWire = {
      ...wireRecordFromEnvelope(personalEnv),
      ciphertext: '\\x00112233445566778899aabbccddeeff',
    };

    const repo = createMockRepo([corruptedWire]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key_that_must_never_be_reached',
    });

    await assert.rejects(
      () =>
        resolver.resolveCredential({
          providerId: 'gemini',
          userId: userA,
          operation: 'financial_assistant',
        }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('36. Missing active PERSONAL key_id throws AI_CREDENTIAL_KEY_UNAVAILABLE with NO fallback', async () => {
    const personalEnv = encryptCredential({
      plaintext: 'personal_key_aaa_1111',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const wire: EncryptedEnvelopeWire = {
      ...wireRecordFromEnvelope(personalEnv),
      key_id: 'unregistered_key_v999',
    };

    const repo = createMockRepo([wire]);

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key_that_must_never_be_reached',
    });

    await assert.rejects(
      () =>
        resolver.resolveCredential({
          providerId: 'gemini',
          userId: userA,
          operation: 'financial_assistant',
        }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_KEY_UNAVAILABLE'
    );
  });

  test('37. Unexpected repository failure throws AI_CREDENTIAL_RESOLUTION_FAILED', async () => {
    const repo = {
      readActiveCredentials: async () => {
        throw new AiError({
          code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
          message: 'PostgREST network error',
        });
      },
    } as unknown as AiCredentialRepository;

    const resolver = new AiCredentialResolver({
      repository: repo,
      keyRing: testKeyRing,
      systemKey: 'system_key',
    });

    await assert.rejects(
      () =>
        resolver.resolveCredential({
          providerId: 'gemini',
          userId: userA,
          operation: 'financial_assistant',
        }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_RESOLUTION_FAILED'
    );
  });

  // --- ADMIN AUTHORITY TESTS (Section 57 & Blocker D) ---

  const admin1 = 'c8b4e720-21a4-4780-928d-195992982d61';
  const admin2 = 'd7c3b2a1-1234-4567-89ab-cdef01234567';
  const nonAdmin = '11111111-2222-3333-4444-555555555555';

  test('38. Pure parseAdminUserIds parses comma-separated UUIDs and discards malformed entries', () => {
    const raw = `${admin1}, not-a-uuid, ${admin2},   , 12345`;
    const parsed = parseAdminUserIds(raw);
    assert.strictEqual(parsed.size, 2);
    assert.strictEqual(parsed.has(admin1), true);
    assert.strictEqual(parsed.has(admin2), true);
    assert.strictEqual(parsed.has('not-a-uuid'), false);
  });

  test('39. parseAdminUserIds with null, undefined, or empty returns empty Set', () => {
    assert.strictEqual(parseAdminUserIds(null).size, 0);
    assert.strictEqual(parseAdminUserIds(undefined).size, 0);
    assert.strictEqual(parseAdminUserIds('').size, 0);
    assert.strictEqual(parseAdminUserIds('   ').size, 0);
  });

  test('40. Authorized admin UUID accepted strictly from process.env', () => {
    const orig = process.env[ENV_ADMIN_USER_IDS];
    try {
      process.env[ENV_ADMIN_USER_IDS] = `${admin1}, ${admin2}`;
      assert.strictEqual(isAdminUserId(admin1), true);
      assert.strictEqual(isAdminUserId(admin2), true);
    } finally {
      process.env[ENV_ADMIN_USER_IDS] = orig;
    }
  });

  test('41. Non-admin UUID rejected strictly from process.env', () => {
    const orig = process.env[ENV_ADMIN_USER_IDS];
    try {
      process.env[ENV_ADMIN_USER_IDS] = `${admin1}, ${admin2}`;
      assert.strictEqual(isAdminUserId(nonAdmin), false);
    } finally {
      process.env[ENV_ADMIN_USER_IDS] = orig;
    }
  });

  test('42. Email match alone does NOT authorize admin access', () => {
    const orig = process.env[ENV_ADMIN_USER_IDS];
    try {
      process.env[ENV_ADMIN_USER_IDS] = `${admin1}`;
      assert.strictEqual(isAdminUserId('admin@example.com'), false);
    } finally {
      process.env[ENV_ADMIN_USER_IDS] = orig;
    }
  });

  test('43. Profile metadata does not authorize admin access', () => {
    const orig = process.env[ENV_ADMIN_USER_IDS];
    try {
      process.env[ENV_ADMIN_USER_IDS] = `${admin1}`;
      const fakeProfile = { id: nonAdmin, is_admin: true, role: 'admin' };
      assert.strictEqual(isAdminUserId(fakeProfile.id), false);
    } finally {
      process.env[ENV_ADMIN_USER_IDS] = orig;
    }
  });

  test('44. Client-supplied actor ID does not authorize in verifyAdminActor', async () => {
    const orig = process.env[ENV_ADMIN_USER_IDS];
    try {
      process.env[ENV_ADMIN_USER_IDS] = `${admin1}`;
      const fakeClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: nonAdmin } },
            error: null,
          }),
        },
      } as any;

      const result = await verifyAdminActor(fakeClient);
      assert.strictEqual(result.isAdmin, false);
      assert.strictEqual(result.userId, nonAdmin);
    } finally {
      process.env[ENV_ADMIN_USER_IDS] = orig;
    }
  });

  test('45. Admin actor verification succeeds for authorized user from session', async () => {
    const orig = process.env[ENV_ADMIN_USER_IDS];
    try {
      process.env[ENV_ADMIN_USER_IDS] = `${admin1}`;
      const fakeClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: admin1 } },
            error: null,
          }),
        },
      } as any;

      const result = await verifyAdminActor(fakeClient);
      assert.strictEqual(result.isAdmin, true);
      assert.strictEqual(result.userId, admin1);
    } finally {
      process.env[ENV_ADMIN_USER_IDS] = orig;
    }
  });

  test('45b. Production authority functions reject caller-supplied allowlist overrides', () => {
    assert.strictEqual(isAdminUserId.length, 1);
    assert.strictEqual(verifyAdminActor.length, 1);
  });

  // --- REPOSITORY & WIRE BOUNDARY STRICT VALIDATION TESTS ---

  test('46. Valid wire record validation passes without coercion', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      assigned_by_user_id: null,
      envelope_version: 1,
      key_id: 'key_v1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabbcc',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    const validated = validateWireRecord(record);
    assert.strictEqual(validated.id, record.id);
    assert.strictEqual(validated.source, 'PERSONAL');
    assert.strictEqual(validated.envelope_version, 1);
  });

  test('47. Wire record with invalid source rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'INVALID_SOURCE',
      provider: 'GEMINI',
      envelope_version: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('48. Wire record with invalid provider rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'OPENAI',
      envelope_version: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('49. Wire record hydration to envelope parses bytea hex to Buffers', () => {
    const nonceBuf = randomBytes(12);
    const tagBuf = randomBytes(16);
    const cipherBuf = randomBytes(32);

    const wire: EncryptedEnvelopeWire = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      assigned_by_user_id: null,
      envelope_version: 1,
      key_id: 'key_v1',
      nonce: encodePostgresBytea(nonceBuf),
      ciphertext: encodePostgresBytea(cipherBuf),
      auth_tag: encodePostgresBytea(tagBuf),
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    const envelope = hydrateWireRecordToEnvelope(wire);
    assert.deepStrictEqual(envelope.nonce, nonceBuf);
    assert.deepStrictEqual(envelope.authTag, tagBuf);
    assert.deepStrictEqual(envelope.ciphertext, cipherBuf);
    assert.strictEqual(envelope.envelopeVersion, 1);
  });

  test('50. Hydrating inactive wire record rejected', () => {
    const wire: EncryptedEnvelopeWire = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      assigned_by_user_id: null,
      envelope_version: 1,
      key_id: null,
      nonce: null,
      ciphertext: null,
      auth_tag: null,
      key_hint: null,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(),
    };

    assert.throws(
      () => hydrateWireRecordToEnvelope(wire),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('51. Safe metadata DTO exposes zero crypto material or key IDs', () => {
    const personalEnv = encryptCredential({
      plaintext: 'my_secret_api_key_7777',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const meta = buildSafeCredentialMetadata({
      records: [wireRecordFromEnvelope(personalEnv)],
      hasSystemKeyConfigured: true,
    });

    assert.strictEqual(meta.hasPersonalCredential, true);
    assert.strictEqual(meta.personalKeyHint, '7777');
    assert.strictEqual(meta.activeResolvedSource, 'PERSONAL');
    assert.strictEqual(meta.hasSystemKeyConfigured, true);

    const metaStr = JSON.stringify(meta);
    assert.strictEqual(metaStr.includes('key_v1'), false);
    assert.strictEqual(metaStr.includes('ciphertext'), false);
    assert.strictEqual(metaStr.includes('nonce'), false);
    assert.strictEqual(metaStr.includes('auth_tag'), false);
    assert.strictEqual(metaStr.includes('my_secret_api_key'), false);
  });

  test('52. Safe metadata reflects source priority (ADMIN_ASSIGNED when PERSONAL absent)', () => {
    const adminEnv = encryptCredential({
      plaintext: 'assigned_admin_key_8888',
      ownerUserId: userA,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const meta = buildSafeCredentialMetadata({
      records: [wireRecordFromEnvelope(adminEnv, admin1)],
      hasSystemKeyConfigured: true,
    });

    assert.strictEqual(meta.hasPersonalCredential, false);
    assert.strictEqual(meta.hasAdminAssignedCredential, true);
    assert.strictEqual(meta.adminAssignedKeyHint, '8888');
    assert.strictEqual(meta.activeResolvedSource, 'ADMIN_ASSIGNED');
  });

  test('53. Safe metadata reflects SYSTEM when all DB sources absent', () => {
    const meta = buildSafeCredentialMetadata({
      records: [],
      hasSystemKeyConfigured: true,
    });

    assert.strictEqual(meta.hasPersonalCredential, false);
    assert.strictEqual(meta.hasAdminAssignedCredential, false);
    assert.strictEqual(meta.activeResolvedSource, 'SYSTEM');
  });

  test('54. Safe metadata reflects null when all sources absent', () => {
    const meta = buildSafeCredentialMetadata({
      records: [],
      hasSystemKeyConfigured: false,
    });

    assert.strictEqual(meta.activeResolvedSource, null);
  });

  // --- NEW TESTS: BLOCKER A, B, C, D, E, F SECURITY REQUIREMENTS ---

  test('55. Wire validation strictly rejects non-UUID credential id', () => {
    const baseRecord = {
      id: 'not-a-uuid',
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(baseRecord),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('56. Wire validation strictly rejects non-UUID owner_user_id', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: 'invalid-owner-id',
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('57. Wire validation strictly rejects non-UUID assigned_by_user_id when present', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'ADMIN_ASSIGNED',
      provider: 'GEMINI',
      assigned_by_user_id: 'not-a-valid-admin-uuid',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('58. Wire validation strictly rejects invalid or coerced envelope_version', () => {
    const template = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    // version 0
    assert.throws(
      () => validateWireRecord({ ...template, envelope_version: 0 }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // version 2
    assert.throws(
      () => validateWireRecord({ ...template, envelope_version: 2 }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // string '1' (no coercion allowed)
    assert.throws(
      () => validateWireRecord({ ...template, envelope_version: '1' }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // missing envelope_version
    assert.throws(
      () => validateWireRecord({ ...template, envelope_version: undefined }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('59. Wire validation strictly rejects invalid is_active types (no coercion)', () => {
    const template = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    // string 'true'
    assert.throws(
      () => validateWireRecord({ ...template, is_active: 'true' }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // number 1
    assert.throws(
      () => validateWireRecord({ ...template, is_active: 1 }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // missing
    assert.throws(
      () => validateWireRecord({ ...template, is_active: undefined }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('60. Wire validation strictly rejects invalid timestamps', () => {
    const template = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      revoked_at: null,
    };

    // invalid created_at
    assert.throws(
      () => validateWireRecord({ ...template, created_at: 'not-a-date', updated_at: new Date().toISOString() }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // invalid updated_at
    assert.throws(
      () => validateWireRecord({ ...template, created_at: new Date().toISOString(), updated_at: '' }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('61. Wire validation rejects active record with non-null revoked_at', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(), // forbidden on active
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('62. Wire validation rejects inactive record with null revoked_at', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: null,
      nonce: null,
      ciphertext: null,
      auth_tag: null,
      key_hint: null,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null, // must be non-null on inactive
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('63. Wire validation rejects inactive record retaining cryptographic material', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(),
    };

    assert.throws(
      () => validateWireRecord(record),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('64. Wire validation rejects active record missing crypto fields or non-canonical bytea', () => {
    const template = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      envelope_version: 1,
      key_id: 'k1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    // missing nonce
    assert.throws(
      () => validateWireRecord({ ...template, nonce: null }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // uppercase bytea (non-canonical)
    assert.throws(
      () => validateWireRecord({ ...template, nonce: '\\x0102030405060708090A0B0C' }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // wrong length tag (15 bytes instead of 16)
    assert.throws(
      () => validateWireRecord({ ...template, auth_tag: '\\x0102030405060708090a0b0c0d0e0f' }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('65. Plaintext validation enforces length, non-empty, and ASCII control character rejection', () => {
    // Trim policy
    assert.strictEqual(validateCredentialPlaintext('  valid_key_123  '), 'valid_key_123');

    // Empty / whitespace
    assert.throws(
      () => validateCredentialPlaintext(''),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );
    assert.throws(
      () => validateCredentialPlaintext('   '),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );

    // Exceeds 512 chars
    assert.throws(
      () => validateCredentialPlaintext('A'.repeat(513)),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );

    // Control characters (NUL, newline, carriage return, tabs, DEL)
    assert.throws(
      () => validateCredentialPlaintext('key\x00abc'),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );
    assert.throws(
      () => validateCredentialPlaintext('key\nnewline'),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );
    assert.throws(
      () => validateCredentialPlaintext('key\rcarriage'),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );
    assert.throws(
      () => validateCredentialPlaintext('key\x1fabc'),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );
  });

  test('66. KeyHint strictly ensures keyHint NEVER equals plaintext for short keys', () => {
    // Normal long key (> 4 chars) -> suffix only
    assert.strictEqual(buildCredentialKeyHint('AIzaSyD-secret-9281'), '9281');

    // Exactly 4 chars -> masked with 4 ASCII asterisks, NOT plaintext
    const hint4 = buildCredentialKeyHint('ABCD');
    assert.strictEqual(hint4, '****');
    assert.notStrictEqual(hint4, 'ABCD');

    // 1 char -> masked with 4 asterisks, NOT plaintext
    const hint1 = buildCredentialKeyHint('X');
    assert.strictEqual(hint1, '****');
    assert.notStrictEqual(hint1, 'X');

    // Encrypting a short key produces masked keyHint
    const envShort = encryptCredential({
      plaintext: 'AIza',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });
    assert.strictEqual(envShort.keyHint, '****');
    assert.notStrictEqual(envShort.keyHint, 'AIza');
  });

  test('67. Decryption strictly validates envelopeVersion === 1', () => {
    const env = encryptCredential({
      plaintext: 'my_test_key_123',
      ownerUserId: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      keyId: 'key_v1',
      masterKey: testKey32A,
    });

    const tamperedVersionEnv: EncryptedEnvelope = {
      ...env,
      envelopeVersion: 2 as any,
    };

    assert.throws(
      () => decryptCredential({ envelope: tamperedVersionEnv, masterKey: testKey32A }),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('68. Hydration strictly validates envelope_version === 1', () => {
    const wire: EncryptedEnvelopeWire = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      assigned_by_user_id: null,
      envelope_version: 2,
      key_id: 'key_v1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => hydrateWireRecordToEnvelope(wire),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('69. readActiveCredentials strictly rejects non-UUID ownerUserId', async () => {
    const repo = new AiCredentialRepository({} as any);
    await assert.rejects(
      () => repo.readActiveCredentials('not-a-valid-uuid'),
      (err: any) => err instanceof AiError && err.code === 'AI_INVALID_REQUEST'
    );
  });

  test('70. createAiCredentialRepository factory creates repository with admin client', () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-project.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.service.key';
      const repo = createAiCredentialRepository();
      assert.ok(repo instanceof AiCredentialRepository);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    }
  });

  test('71. DB key_hint containing full credential (> 4 chars) rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const rawWire = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      assigned_by_user_id: null,
      envelope_version: 1,
      key_id: 'key_v1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: 'AIzaSySecretApiKeyLeakedEntirely',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(rawWire),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('72. DB key_hint > allowed length (5 chars) rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const rawWire = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL',
      provider: 'GEMINI',
      assigned_by_user_id: null,
      envelope_version: 1,
      key_id: 'key_v1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '12345',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    assert.throws(
      () => validateWireRecord(rawWire),
      (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED'
    );
  });

  test('73. DB key_hint with newline / control character rejected with AI_CREDENTIAL_CORRUPTED', () => {
    for (const badHint of ['12\n4', '12\r4', '1\x0034', '\x1b[31', '12\t4']) {
      const rawWire = {
        id: randomUUID(),
        owner_user_id: userA,
        source: 'PERSONAL',
        provider: 'GEMINI',
        assigned_by_user_id: null,
        envelope_version: 1,
        key_id: 'key_v1',
        nonce: '\\x0102030405060708090a0b0c',
        ciphertext: '\\xaabb',
        auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
        key_hint: badHint,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revoked_at: null,
      };

      assert.throws(
        () => validateWireRecord(rawWire),
        (err: any) => err instanceof AiError && err.code === 'AI_CREDENTIAL_CORRUPTED',
        `Should reject bad hint: ${JSON.stringify(badHint)}`
      );
    }
  });

  test('74. DB key_hint with valid 4-character hint accepted by validateWireRecord', () => {
    for (const validHint of ['1234', '****', 'abcd', '9999', '####', '7890']) {
      const rawWire = {
        id: randomUUID(),
        owner_user_id: userA,
        source: 'PERSONAL',
        provider: 'GEMINI',
        assigned_by_user_id: null,
        envelope_version: 1,
        key_id: 'key_v1',
        nonce: '\\x0102030405060708090a0b0c',
        ciphertext: '\\xaabb',
        auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
        key_hint: validHint,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revoked_at: null,
      };

      const validated = validateWireRecord(rawWire);
      assert.strictEqual(validated.key_hint, validHint);
    }
  });

  test('75. Safe metadata builder defensively sanitizes key_hint and cannot reproduce credential', () => {
    const fullSecret = 'AIzaSyVerySecretKey1234567890';
    const rawWireWithSecretLeak = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL' as const,
      provider: 'GEMINI' as const,
      assigned_by_user_id: null,
      envelope_version: 1 as const,
      key_id: 'key_v1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: fullSecret, // Corrupted wire with leaked full secret
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };

    const metadata = buildSafeCredentialMetadata({
      records: [rawWireWithSecretLeak],
      hasSystemKeyConfigured: false,
    });

    assert.strictEqual(metadata.hasPersonalCredential, true);
    // Leaked full secret must be defensively replaced with safe fallback mask
    assert.strictEqual(metadata.personalKeyHint, '****');
    assert.notStrictEqual(metadata.personalKeyHint, fullSecret);
    assert.ok(!fullSecret.includes(metadata.personalKeyHint!));
  });

  test('76. buildCredentialKeyHint explicit behavior and invariants', () => {
    // 1-char credential
    const hint1 = buildCredentialKeyHint('x');
    assert.strictEqual(hint1, '****');
    assert.strictEqual(hint1.length, 4);
    assert.notStrictEqual(hint1, 'x');

    // 4-char credential
    const hint4 = buildCredentialKeyHint('abcd');
    assert.strictEqual(hint4, '****');
    assert.strictEqual(hint4.length, 4);
    assert.notStrictEqual(hint4, 'abcd');

    // short ASCII credential "1234" -> ASCII mask -> hint !== plaintext
    const hint1234 = buildCredentialKeyHint('1234');
    assert.strictEqual(hint1234, '****');
    assert.notStrictEqual(hint1234, '1234');

    // plaintext "****" -> different ASCII hint ("####") -> hint !== plaintext
    const hintAsterisks = buildCredentialKeyHint('****');
    assert.strictEqual(hintAsterisks, '####');
    assert.strictEqual(hintAsterisks.length, 4);
    assert.notStrictEqual(hintAsterisks, '****');

    // plaintext "####" -> different ASCII hint ("****") -> hint !== plaintext
    const hintHashes = buildCredentialKeyHint('####');
    assert.strictEqual(hintHashes, '****');
    assert.notStrictEqual(hintHashes, '####');

    // credential ending in non-ASCII characters -> ASCII mask
    const hintNonAscii = buildCredentialKeyHint('AIzaSy1234567\u00e990');
    assert.strictEqual(hintNonAscii, '****');
    assert.notStrictEqual(hintNonAscii, 'AIzaSy1234567\u00e990');

    // normal long credential ending "7890" -> hint "7890"
    const hintLong = buildCredentialKeyHint('AIzaSy1234567890');
    assert.strictEqual(hintLong, '7890');
    assert.strictEqual(hintLong.length, 4);
    assert.notStrictEqual(hintLong, 'AIzaSy1234567890');

    // Invariants for diverse credentials
    const testCases = [
      'a', 'ab', 'abc', 'abcd', 'abcde', 'AIzaSyDUMMY_KEY_XYZ_9999',
      '1234', '****', '####', '12345', 'super-secret-production-token-1234',
      'secret-\u2022\u2022\u2022\u2022', 'key-\u00e9\u00e0\u00f4\u00fb'
    ];
    for (const tc of testCases) {
      const hint = buildCredentialKeyHint(tc);
      assert.ok(hint.length >= 1 && hint.length <= 4, `Length must be 1..4 for ${tc}`);
      assert.ok(/^[\x20-\x7E]{1,4}$/.test(hint), `Hint must be printable ASCII for ${tc}`);
      assert.notStrictEqual(hint, tc.trim(), `Hint must never equal plaintext for ${tc}`);
    }
  });

  test('77. validateWireKeyHint helper strictly enforces contract', () => {
    // Valid hints (1..4 chars, printable ASCII only)
    assert.strictEqual(validateWireKeyHint('7890'), '7890');
    assert.strictEqual(validateWireKeyHint('abcd'), 'abcd');
    assert.strictEqual(validateWireKeyHint('a'), 'a');
    assert.strictEqual(validateWireKeyHint('****'), '****');
    assert.strictEqual(validateWireKeyHint('####'), '####');
    assert.strictEqual(KEY_HINT_MAX_LENGTH, 4);

    // Invalid non-string
    assert.throws(() => validateWireKeyHint(null), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
    assert.throws(() => validateWireKeyHint(1234), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');

    // Invalid empty or all whitespace
    assert.throws(() => validateWireKeyHint(''), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
    assert.throws(() => validateWireKeyHint('   '), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');

    // Invalid > 4 chars
    assert.throws(() => validateWireKeyHint('12345'), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
    assert.throws(() => validateWireKeyHint('ABCDEF'), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');

    // Invalid Unicode bullets (\u2022\u2022\u2022\u2022) -> AI_CREDENTIAL_CORRUPTED
    assert.throws(
      () => validateWireKeyHint('\u2022\u2022\u2022\u2022'),
      (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // Invalid non-ASCII ("éabc") -> AI_CREDENTIAL_CORRUPTED
    assert.throws(
      () => validateWireKeyHint('\u00e9abc'),
      (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // Invalid emoji -> AI_CREDENTIAL_CORRUPTED
    assert.throws(
      () => validateWireKeyHint('\u{1F511}'),
      (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED'
    );

    // Invalid control characters / newline / tab
    assert.throws(() => validateWireKeyHint('ab\nc'), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
    assert.throws(() => validateWireKeyHint('a\x00b'), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
    assert.throws(() => validateWireKeyHint('a\tb'), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
    assert.throws(() => validateWireKeyHint('a\rb'), (err: any) => err.code === 'AI_CREDENTIAL_CORRUPTED');
  });

  test('78. sanitizeSafeKeyHint helper defensively bounds metadata hints', () => {
    // Valid printable ASCII hints (1..4 chars)
    assert.strictEqual(sanitizeSafeKeyHint('7890'), '7890');
    assert.strictEqual(sanitizeSafeKeyHint('abcd'), 'abcd');
    assert.strictEqual(sanitizeSafeKeyHint('****'), '****');
    assert.strictEqual(sanitizeSafeKeyHint('a'), 'a');

    // Unicode hint -> rejected (returns null, never returned unchanged)
    assert.strictEqual(sanitizeSafeKeyHint('\u2022\u2022\u2022\u2022'), null);
    assert.strictEqual(sanitizeSafeKeyHint('\u00e9abc'), null);
    assert.strictEqual(sanitizeSafeKeyHint('\u{1F511}'), null);

    // Unsafe or invalid hints return null
    assert.strictEqual(sanitizeSafeKeyHint(null), null);
    assert.strictEqual(sanitizeSafeKeyHint(undefined), null);
    assert.strictEqual(sanitizeSafeKeyHint(''), null);
    assert.strictEqual(sanitizeSafeKeyHint('   '), null);
    assert.strictEqual(sanitizeSafeKeyHint('12345'), null);
    assert.strictEqual(sanitizeSafeKeyHint('AIzaSySecretLeaked'), null);
    assert.strictEqual(sanitizeSafeKeyHint('ab\ncd'), null);
    assert.strictEqual(sanitizeSafeKeyHint('ab\tcd'), null);

    // When building metadata with Unicode hint on wire, safe fallback mask is used
    const rawWireUnicode = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'PERSONAL' as const,
      provider: 'GEMINI' as const,
      assigned_by_user_id: null,
      envelope_version: 1 as const,
      key_id: 'key_v1',
      nonce: '\\x0102030405060708090a0b0c',
      ciphertext: '\\xaabb',
      auth_tag: '\\x0102030405060708090a0b0c0d0e0f10',
      key_hint: '\u2022\u2022\u2022\u2022',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };
    const metaUnicode = buildSafeCredentialMetadata({
      records: [rawWireUnicode],
      hasSystemKeyConfigured: false,
    });
    // Metadata fallback is ASCII mask '****'
    assert.strictEqual(metaUnicode.personalKeyHint, '****');
    assert.ok(/^[\x20-\x7E]{1,4}$/.test(metaUnicode.personalKeyHint!));
  });

  // Await all collected tests before printing final success message
  await Promise.all(pendingTests);
  console.log(`\nAll ${totalTests} Phase 11 AI Credentials tests passed successfully!`);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

