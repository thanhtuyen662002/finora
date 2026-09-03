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
import { buildSafeCredentialMetadata } from '../src/lib/ai/credentials/metadata';
import {
  AiCredentialRepository,
  hydrateWireRecordToEnvelope,
  validateWireRecord,
} from '../src/lib/ai/credentials/repository';
import { AiCredentialResolver } from '../src/lib/ai/credentials/resolver';
import type {
  EncryptedEnvelope,
  EncryptedEnvelopeWire,
  MasterKeyRing,
} from '../src/lib/ai/credentials/types';
import { AiError } from '../src/lib/ai/errors';
import {
  getAuthorizedAdminUserIds,
  isAdminUserId,
  verifyAdminActor,
} from '../src/lib/auth/admin';

async function runTests() {
  console.log('--- Running Phase 11 AI Credentials Tests ---');
  let totalTests = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      const res = fn();
      if (res && typeof (res as Promise<void>).then === 'function') {
        return (res as Promise<void>).then(() => {
          console.log(`  ✓ ${name}`);
        });
      }
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}`);
      throw err;
    }
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

  // --- ADMIN TESTS (Section 57) ---

  const admin1 = 'c8b4e720-21a4-4780-928d-195992982d61';
  const admin2 = 'd7c3b2a1-1234-4567-89ab-cdef01234567';
  const nonAdmin = '11111111-2222-3333-4444-555555555555';

  test('38. Authorized admin UUID accepted', () => {
    const allowlistEnv = `${admin1}, ${admin2}`;
    assert.strictEqual(isAdminUserId(admin1, allowlistEnv), true);
    assert.strictEqual(isAdminUserId(admin2, allowlistEnv), true);
  });

  test('39. Non-admin UUID rejected', () => {
    const allowlistEnv = `${admin1}, ${admin2}`;
    assert.strictEqual(isAdminUserId(nonAdmin, allowlistEnv), false);
  });

  test('40. Email match alone does NOT authorize admin access', () => {
    const allowlistEnv = `${admin1}`;
    // Passing email as userId is rejected because it is not a valid admin UUID
    assert.strictEqual(isAdminUserId('admin@example.com', allowlistEnv), false);
  });

  test('41. Profile metadata does not authorize', () => {
    // Authority is solely FINORA_ADMIN_USER_IDS, profile objects have zero influence
    const fakeProfile = { id: nonAdmin, is_admin: true, role: 'admin' };
    assert.strictEqual(isAdminUserId(fakeProfile.id, `${admin1}`), false);
  });

  test('42. Client-supplied actor ID does not authorize in verifyAdminActor', async () => {
    const fakeClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: nonAdmin } },
          error: null,
        }),
      },
    } as any;

    const result = await verifyAdminActor(fakeClient, `${admin1}`);
    assert.strictEqual(result.isAdmin, false);
    assert.strictEqual(result.userId, nonAdmin);
  });

  test('43. Missing admin env fails closed', () => {
    assert.strictEqual(isAdminUserId(admin1, ''), false);
    assert.strictEqual(isAdminUserId(admin1, '  '), false);
    assert.deepStrictEqual(getAuthorizedAdminUserIds(''), []);
  });

  test('44. Malformed allowlist entries filtered deterministically', () => {
    const mixedEnv = `invalid-not-uuid, ${admin1}, also_not_uuid, ${admin2},   `;
    const parsed = getAuthorizedAdminUserIds(mixedEnv);
    assert.deepStrictEqual(parsed, [admin1, admin2]);
  });

  test('45. Admin actor verification succeeds for authorized user from session', async () => {
    const fakeClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: admin1 } },
          error: null,
        }),
      },
    } as any;

    const result = await verifyAdminActor(fakeClient, `${admin1}`);
    assert.strictEqual(result.isAdmin, true);
    assert.strictEqual(result.userId, admin1);
  });

  // --- REPOSITORY & WIRE BOUNDARY TESTS ---

  test('46. Valid wire record validation passes', () => {
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
  });

  test('47. Wire record with invalid source rejected with AI_CREDENTIAL_CORRUPTED', () => {
    const record = {
      id: randomUUID(),
      owner_user_id: userA,
      source: 'INVALID_SOURCE',
      provider: 'GEMINI',
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
  });

  test('50. Hydrating inactive wire record rejected', () => {
    const wire: EncryptedEnvelopeWire = {
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
      key_hint: '1234',
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

    // Verify properties strictly do not contain ciphertext, nonce, auth_tag, key_id
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

  console.log(`\nAll ${totalTests} Phase 11 AI Credentials tests passed successfully!`);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
