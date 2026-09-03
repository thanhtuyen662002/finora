/**
 * Finora AI Foundation — AES-256-GCM Cryptographic Core
 * Phase 11 — Security Core
 *
 * Provides authenticated encryption with associated data (AEAD) using Node.js crypto.
 * Algorithm: AES-256-GCM (32-byte key, 12-byte nonce, 16-byte auth tag).
 * Binds envelope_version, credential_id, owner_user_id, provider, and source into AAD.
 */

import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { AiError } from '../errors';
import type { DatabaseCredentialSource, EncryptedEnvelope } from './types';

export const AES_KEY_BYTES = 32;
export const AES_NONCE_BYTES = 12;
export const AES_AUTH_TAG_BYTES = 16;
export const ENVELOPE_VERSION = 1;
export const MAX_CREDENTIAL_LENGTH = 512;

/**
 * Builds deterministic canonical Additional Authenticated Data (AAD).
 * Format: v{version}|{credentialId}|{ownerUserId}|{provider}|{source}
 */
export function buildCanonicalAad(
  envelopeVersion: number,
  credentialId: string,
  ownerUserId: string,
  provider: string,
  source: string
): Buffer {
  const canonicalString = `v${envelopeVersion}|${credentialId}|${ownerUserId}|${provider}|${source}`;
  return Buffer.from(canonicalString, 'utf8');
}

/**
 * Generates a safe masked key hint from credential plaintext.
 * Guarantees that keyHint NEVER equals plaintext for any credential.
 */
export function buildCredentialKeyHint(plaintext: string): string {
  const normalized = plaintext.trim();
  if (normalized.length > 4) {
    const hint = normalized.slice(-4);
    if (hint === normalized) {
      return '••••';
    }
    return hint;
  }
  const mask = '••••';
  return normalized === mask ? '•••••' : mask;
}

export const generateKeyHint = buildCredentialKeyHint;

/**
 * Strictly validates plaintext credential before encryption.
 * Enforces non-empty string, length bounds, no ASCII control chars, no newlines/CR/NUL.
 */
export function validateCredentialPlaintext(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'Credential plaintext must be a string.',
    });
  }

  const normalized = raw.trim();

  if (normalized.length === 0) {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'Cannot encrypt an empty or whitespace-only credential.',
    });
  }

  if (normalized.length > MAX_CREDENTIAL_LENGTH) {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: `Credential exceeds maximum allowed length of ${MAX_CREDENTIAL_LENGTH} characters.`,
    });
  }

  // Reject ASCII control characters (0-31, 127), including newline, carriage return, NUL
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    throw new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'Credential contains forbidden ASCII control or newline characters.',
    });
  }

  return normalized;
}

export const validatePlaintextApiKey = validateCredentialPlaintext;


export interface EncryptCredentialParams {
  readonly plaintext: string;
  readonly ownerUserId: string;
  readonly source: DatabaseCredentialSource;
  readonly provider: 'GEMINI';
  readonly keyId: string;
  readonly masterKey: Buffer;
  readonly preGeneratedCredentialId?: string;
}

/**
 * Encrypts a plaintext credential using AES-256-GCM with canonical AAD.
 */
export function encryptCredential(params: EncryptCredentialParams): EncryptedEnvelope {
  const {
    plaintext,
    ownerUserId,
    source,
    provider,
    keyId,
    masterKey,
    preGeneratedCredentialId,
  } = params;

  const validPlaintext = validateCredentialPlaintext(plaintext);

  if (!Buffer.isBuffer(masterKey) || masterKey.length !== AES_KEY_BYTES) {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: `Master encryption key must be exactly ${AES_KEY_BYTES} bytes.`,
    });
  }

  if (!keyId || typeof keyId !== 'string' || keyId.trim() === '') {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: 'Missing or empty key ID for credential encryption.',
    });
  }

  const credentialId = preGeneratedCredentialId || randomUUID();
  const nonce = randomBytes(AES_NONCE_BYTES);
  const aad = buildCanonicalAad(ENVELOPE_VERSION, credentialId, ownerUserId, provider, source);

  try {
    const cipher = createCipheriv('aes-256-gcm', masterKey, nonce);
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([
      cipher.update(validPlaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();
    if (authTag.length !== AES_AUTH_TAG_BYTES) {
      throw new Error(`Unexpected auth tag length: ${authTag.length}`);
    }

    const keyHint = buildCredentialKeyHint(validPlaintext);

    return {
      envelopeVersion: ENVELOPE_VERSION,
      credentialId,
      ownerUserId,
      source,
      provider,
      keyId,
      nonce,
      ciphertext,
      authTag,
      keyHint,
    };
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Failed to encrypt credential payload.',
      cause: err,
    });
  }
}

export interface DecryptCredentialParams {
  readonly envelope: EncryptedEnvelope;
  readonly masterKey: Buffer;
}

/**
 * Decrypts an EncryptedEnvelope using AES-256-GCM.
 * Validates integrity via auth tag and AAD bindings. Fails closed on any tampering.
 */
export function decryptCredential(params: DecryptCredentialParams): string {
  const { envelope, masterKey } = params;

  if (envelope.envelopeVersion !== ENVELOPE_VERSION) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Unsupported envelope version: ${envelope.envelopeVersion}`,
    });
  }

  if (!Buffer.isBuffer(masterKey) || masterKey.length !== AES_KEY_BYTES) {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: `Master encryption key must be exactly ${AES_KEY_BYTES} bytes.`,
    });
  }

  if (!Buffer.isBuffer(envelope.nonce) || envelope.nonce.length !== AES_NONCE_BYTES) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Envelope nonce must be exactly ${AES_NONCE_BYTES} bytes.`,
    });
  }

  if (!Buffer.isBuffer(envelope.authTag) || envelope.authTag.length !== AES_AUTH_TAG_BYTES) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Envelope auth tag must be exactly ${AES_AUTH_TAG_BYTES} bytes.`,
    });
  }

  if (!Buffer.isBuffer(envelope.ciphertext) || envelope.ciphertext.length === 0) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Envelope ciphertext is missing or empty.',
    });
  }

  const aad = buildCanonicalAad(
    envelope.envelopeVersion,
    envelope.credentialId,
    envelope.ownerUserId,
    envelope.provider,
    envelope.source
  );

  try {
    const decipher = createDecipheriv('aes-256-gcm', masterKey, envelope.nonce);
    decipher.setAuthTag(envelope.authTag);
    decipher.setAAD(aad);

    const decrypted = Buffer.concat([
      decipher.update(envelope.ciphertext),
      decipher.final(),
    ]);

    const plaintext = decrypted.toString('utf8');
    if (!plaintext || plaintext.trim() === '') {
      throw new Error('Decrypted payload is empty.');
    }

    return plaintext;
  } catch (err) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Cryptographic integrity verification failed during credential decryption.',
      cause: err,
    });
  }
}
