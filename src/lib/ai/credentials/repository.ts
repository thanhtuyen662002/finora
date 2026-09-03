/**
 * Finora AI Foundation — Credential Repository Layer
 * Phase 11 — Security Core
 *
 * Server-only repository interfacing with private.ai_credentials strictly through
 * public service-role RPC facade.
 * Direct PostgREST access to private schema is strictly forbidden.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AiError } from '../errors';
import { decodePostgresBytea, encodePostgresBytea } from './bytea';
import {
  AES_AUTH_TAG_BYTES,
  AES_NONCE_BYTES,
  encryptCredential,
} from './crypto';
import { getMasterKey, resolveMasterKeyRing } from './keyring';
import { buildSafeCredentialMetadata } from './metadata';
import type {
  AiCredentialSafeMetadata,
  DatabaseCredentialSource,
  EncryptedEnvelope,
  EncryptedEnvelopeWire,
  MasterKeyRing,
} from './types';

export interface SaveCredentialParams {
  readonly ownerUserId: string;
  readonly source: DatabaseCredentialSource;
  readonly provider: 'GEMINI';
  readonly plaintext: string;
  readonly assignedByUserId?: string | null;
  readonly keyRing?: MasterKeyRing;
  readonly customCredentialId?: string;
}

export interface RevokeCredentialParams {
  readonly ownerUserId: string;
  readonly source: DatabaseCredentialSource;
  readonly provider?: 'GEMINI';
}

/**
 * Validates wire record structure and constraints from the read RPC.
 */
export function validateWireRecord(record: unknown): EncryptedEnvelopeWire {
  if (!record || typeof record !== 'object') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record is not an object.',
    });
  }

  const r = record as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record missing valid id.',
    });
  }

  if (typeof r.owner_user_id !== 'string' || !r.owner_user_id) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record missing valid owner_user_id.',
    });
  }

  if (r.source !== 'PERSONAL' && r.source !== 'ADMIN_ASSIGNED') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Invalid wire credential source: '${r.source}'.`,
    });
  }

  if (r.provider !== 'GEMINI') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Unsupported wire credential provider: '${r.provider}'.`,
    });
  }

  return {
    id: r.id as string,
    owner_user_id: r.owner_user_id as string,
    source: r.source as string,
    provider: r.provider as string,
    assigned_by_user_id: (r.assigned_by_user_id as string) || null,
    envelope_version: Number(r.envelope_version) || 1,
    key_id: (r.key_id as string) || null,
    nonce: (r.nonce as string) || null,
    ciphertext: (r.ciphertext as string) || null,
    auth_tag: (r.auth_tag as string) || null,
    key_hint: (r.key_hint as string) || null,
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
    revoked_at: (r.revoked_at as string) || null,
  };
}

/**
 * Hydrates wire record strings into an EncryptedEnvelope with binary Buffers.
 */
export function hydrateWireRecordToEnvelope(wire: EncryptedEnvelopeWire): EncryptedEnvelope {
  if (!wire.is_active || wire.revoked_at !== null) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Cannot hydrate inactive or revoked credential.',
    });
  }

  if (!wire.key_id || !wire.nonce || !wire.ciphertext || !wire.auth_tag || !wire.key_hint) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Active wire record missing cryptographic envelope fields.',
    });
  }

  const nonce = decodePostgresBytea(wire.nonce, AES_NONCE_BYTES);
  const authTag = decodePostgresBytea(wire.auth_tag, AES_AUTH_TAG_BYTES);
  const ciphertext = decodePostgresBytea(wire.ciphertext);

  return {
    envelopeVersion: 1,
    credentialId: wire.id,
    ownerUserId: wire.owner_user_id,
    source: wire.source as DatabaseCredentialSource,
    provider: 'GEMINI',
    keyId: wire.key_id,
    nonce,
    ciphertext,
    authTag,
    keyHint: wire.key_hint,
  };
}

export class AiCredentialRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Reads active database credentials for a user via service-role RPC.
   */
  async readActiveCredentials(
    ownerUserId: string,
    provider: 'GEMINI' = 'GEMINI'
  ): Promise<EncryptedEnvelopeWire[]> {
    if (!ownerUserId || typeof ownerUserId !== 'string') {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'ownerUserId is required to read active credentials.',
      });
    }

    const { data, error } = await this.supabase.rpc('ai_credentials_read_for_service', {
      p_owner_user_id: ownerUserId,
      p_provider: provider,
    });

    if (error) {
      throw new AiError({
        code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
        message: `Database RPC failed while reading credentials: ${error.message}`,
        cause: error,
      });
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(validateWireRecord);
  }

  /**
   * Encrypts and saves a credential via service-role RPC.
   */
  async saveCredential(params: SaveCredentialParams): Promise<EncryptedEnvelope> {
    const {
      ownerUserId,
      source,
      provider,
      plaintext,
      assignedByUserId = null,
      customCredentialId,
    } = params;

    const ring = params.keyRing ?? resolveMasterKeyRing();
    const activeKey = getMasterKey(ring, ring.activeKeyId);

    const envelope = encryptCredential({
      plaintext,
      ownerUserId,
      source,
      provider,
      keyId: ring.activeKeyId,
      masterKey: activeKey,
      preGeneratedCredentialId: customCredentialId,
    });

    const nonceHex = encodePostgresBytea(envelope.nonce);
    const ciphertextHex = encodePostgresBytea(envelope.ciphertext);
    const authTagHex = encodePostgresBytea(envelope.authTag);

    const { error } = await this.supabase.rpc('ai_credentials_write_for_service', {
      p_id: envelope.credentialId,
      p_owner_user_id: ownerUserId,
      p_source: source,
      p_provider: provider,
      p_assigned_by_user_id: assignedByUserId,
      p_envelope_version: envelope.envelopeVersion,
      p_key_id: envelope.keyId,
      p_nonce: nonceHex,
      p_ciphertext: ciphertextHex,
      p_auth_tag: authTagHex,
      p_key_hint: envelope.keyHint,
    });

    if (error) {
      throw new AiError({
        code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
        message: `Database RPC failed while saving credential: ${error.message}`,
        cause: error,
      });
    }

    return envelope;
  }

  /**
   * Revokes a credential via service-role RPC.
   */
  async revokeCredential(params: RevokeCredentialParams): Promise<void> {
    const { ownerUserId, source, provider = 'GEMINI' } = params;

    const { error } = await this.supabase.rpc('ai_credentials_revoke_for_service', {
      p_owner_user_id: ownerUserId,
      p_source: source,
      p_provider: provider,
    });

    if (error) {
      throw new AiError({
        code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
        message: `Database RPC failed while revoking credential: ${error.message}`,
        cause: error,
      });
    }
  }

  /**
   * Fetches safe credential metadata DTO for a user.
   */
  async getSafeMetadata(
    ownerUserId: string,
    hasSystemKeyConfigured: boolean
  ): Promise<AiCredentialSafeMetadata> {
    const records = await this.readActiveCredentials(ownerUserId, 'GEMINI');
    return buildSafeCredentialMetadata({ records, hasSystemKeyConfigured });
  }
}
