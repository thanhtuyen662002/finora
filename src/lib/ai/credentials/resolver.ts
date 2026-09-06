/**
 * Finora AI Foundation — Credential Resolver
 * Phase 11 — Security Core
 *
 * Implements the AiCredentialProvider port with strict source prioritization:
 * PERSONAL > ADMIN_ASSIGNED > SYSTEM
 *
 * Invariants:
 * 1. Requires authenticated userId. Anonymous contexts return null (no SYSTEM fallback).
 * 2. Restricted to providerId='gemini'. Other providers receive no Gemini credentials.
 * 3. Fail-Closed on Selected Source: If the highest active source fails decryption,
 *    integrity check, or key availability, resolution fails immediately without falling back
 *    to a lower source.
 * 4. Plaintext exists only in server memory and is passed directly to the provider.
 */

import 'server-only';
import { AiError } from '../errors';
import type { AiCredential, AiCredentialContext, AiCredentialProvider } from '../types';
import { decryptCredential } from './crypto';
import { getMasterKey, resolveMasterKeyRing } from './keyring';
import {
  AiCredentialRepository,
  hydrateWireRecordToEnvelope,
} from './repository';
import type { MasterKeyRing } from './types';

export const ENV_SYSTEM_GEMINI_API_KEY = 'FINORA_SYSTEM_GEMINI_API_KEY';

export interface AiCredentialResolverOptions {
  readonly repository: AiCredentialRepository;
  readonly keyRing?: MasterKeyRing;
  readonly systemKey?: string;
}

export class AiCredentialResolver implements AiCredentialProvider {
  constructor(private readonly options: AiCredentialResolverOptions) {}

  async resolveCredential(context: AiCredentialContext): Promise<AiCredential | null> {
    // 1. Invariant: Only 'gemini' provider is authorized for Gemini credentials
    if (context.providerId !== 'gemini') {
      return null;
    }

    // 2. Invariant: Authenticated user context required
    // SYSTEM credentials are an authenticated-user fallback, never an anonymous quota
    if (!context.userId || typeof context.userId !== 'string' || context.userId.trim() === '') {
      return null;
    }

    const userId = context.userId.trim();

    // 3. Query active database credentials for the user
    const records = await this.options.repository.readActiveCredentials(userId, 'GEMINI');

    const personalRecord = records.find(
      (r) => r.source === 'PERSONAL' && r.is_active && r.revoked_at === null
    );

    const adminAssignedRecord = records.find(
      (r) => r.source === 'ADMIN_ASSIGNED' && r.is_active && r.revoked_at === null
    );

    // Resolve key ring lazily only if database credentials need to be decrypted
    let ring: MasterKeyRing | undefined = this.options.keyRing;
    const getKeyRing = (): MasterKeyRing => {
      if (!ring) {
        ring = resolveMasterKeyRing();
      }
      return ring;
    };

    // 4. Source Priority 1: PERSONAL
    if (personalRecord) {
      const envelope = hydrateWireRecordToEnvelope(personalRecord);
      const masterKey = getMasterKey(getKeyRing(), envelope.keyId);

      // Decrypt personal credential. If this fails, fail-closed immediately!
      // Strictly NO fallback to ADMIN_ASSIGNED or SYSTEM.
      const plaintext = decryptCredential({ envelope, masterKey });

      return {
        value: plaintext,
        providerId: 'gemini',
      };
    }

    // 5. Source Priority 2: ADMIN_ASSIGNED
    if (adminAssignedRecord) {
      const envelope = hydrateWireRecordToEnvelope(adminAssignedRecord);
      const masterKey = getMasterKey(getKeyRing(), envelope.keyId);

      // Decrypt admin-assigned credential. If this fails, fail-closed immediately!
      // Strictly NO fallback to SYSTEM.
      const plaintext = decryptCredential({ envelope, masterKey });

      return {
        value: plaintext,
        providerId: 'gemini',
      };
    }

    // 6. Source Priority 3: SYSTEM
    const systemKey = this.options.systemKey ?? process.env[ENV_SYSTEM_GEMINI_API_KEY];
    if (systemKey && typeof systemKey === 'string' && systemKey.trim() !== '') {
      return {
        value: systemKey.trim(),
        providerId: 'gemini',
      };
    }

    // 7. No credentials available
    return null;
  }
}
