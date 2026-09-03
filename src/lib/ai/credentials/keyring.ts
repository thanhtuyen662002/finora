/**
 * Finora AI Foundation — Master Key Ring Management
 * Phase 11 — Security Core
 *
 * Lazy resolution of AES-256 master keys from environment configuration.
 * Authorized environment variables:
 * - FINORA_AI_CREDENTIAL_ACTIVE_KEY_ID
 * - FINORA_AI_CREDENTIAL_KEY_RING_JSON
 *
 * Each key must be base64-encoded and decode to exactly 32 bytes.
 * Missing or malformed keys throw AI_CREDENTIAL_KEY_UNAVAILABLE without leaking key material.
 */

import { AiError } from '../errors';
import { AES_KEY_BYTES } from './crypto';
import type { MasterKeyRing } from './types';

export const ENV_ACTIVE_KEY_ID = 'FINORA_AI_CREDENTIAL_ACTIVE_KEY_ID';
export const ENV_KEY_RING_JSON = 'FINORA_AI_CREDENTIAL_KEY_RING_JSON';

/**
 * Lazily parses and validates the master key ring from environment variables or custom overrides.
 */
export function resolveMasterKeyRing(options?: {
  readonly activeKeyId?: string;
  readonly keyRingJson?: string;
}): MasterKeyRing {
  const activeKeyId = options?.activeKeyId ?? process.env[ENV_ACTIVE_KEY_ID];
  const rawKeyRingJson = options?.keyRingJson ?? process.env[ENV_KEY_RING_JSON];

  if (!activeKeyId || typeof activeKeyId !== 'string' || activeKeyId.trim() === '') {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: `Active key ID environment variable '${ENV_ACTIVE_KEY_ID}' is not configured.`,
    });
  }

  if (!rawKeyRingJson || typeof rawKeyRingJson !== 'string' || rawKeyRingJson.trim() === '') {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: `Master key ring environment variable '${ENV_KEY_RING_JSON}' is not configured.`,
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawKeyRingJson.trim());
  } catch (err) {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: 'Master key ring JSON is malformed.',
      cause: err,
    });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: 'Master key ring JSON must be a key-value object.',
    });
  }

  const keysMap = new Map<string, Buffer>();

  for (const [keyId, b64Val] of Object.entries(parsed)) {
    if (typeof b64Val !== 'string') {
      throw new AiError({
        code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
        message: `Master key ring value for key '${keyId}' is not a string.`,
      });
    }

    // Strict base64 validation (no hex, no whitespace)
    const trimmed = b64Val.trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      throw new AiError({
        code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
        message: `Master key ring value for key '${keyId}' is not valid base64.`,
      });
    }

    const keyBuf = Buffer.from(trimmed, 'base64');
    if (keyBuf.length !== AES_KEY_BYTES) {
      throw new AiError({
        code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
        message: `Master key '${keyId}' decoded length is ${keyBuf.length} bytes; expected exactly ${AES_KEY_BYTES} bytes.`,
      });
    }

    keysMap.set(keyId, keyBuf);
  }

  const cleanActiveKeyId = activeKeyId.trim();
  if (!keysMap.has(cleanActiveKeyId)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: `Active key ID '${cleanActiveKeyId}' is missing from master key ring.`,
    });
  }

  return {
    activeKeyId: cleanActiveKeyId,
    keys: keysMap,
  };
}

/**
 * Retrieves a specific master key from the key ring by key ID.
 */
export function getMasterKey(keyRing: MasterKeyRing, keyId: string): Buffer {
  const key = keyRing.keys.get(keyId);
  if (!key) {
    throw new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: `Requested key ID '${keyId}' is unavailable in the master key ring.`,
    });
  }
  return key;
}
