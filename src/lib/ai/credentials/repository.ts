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
import { createAdminClient } from '@/lib/supabase/admin';
import { AiError } from '../errors';
import { decodePostgresBytea, encodePostgresBytea } from './bytea';
import {
  AES_AUTH_TAG_BYTES,
  AES_NONCE_BYTES,
  PRINTABLE_ASCII_KEY_HINT,
  encryptCredential,
  validateCredentialPlaintext,
  validatePlaintextApiKey,
} from './crypto';
export { validateCredentialPlaintext, validatePlaintextApiKey };
import { getMasterKey, resolveMasterKeyRing } from './keyring';
import { buildSafeCredentialMetadata } from './metadata';
import type {
  AiCredentialSafeMetadata,
  DatabaseCredentialSource,
  EncryptedEnvelope,
  EncryptedEnvelopeWire,
  MasterKeyRing,
} from './types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed);
}

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
 * Strictly verifies types without coercions (no Boolean(), Number() || 1, etc.).
 */
export const KEY_HINT_MAX_LENGTH = 4;

/**
 * Validates untrusted wire key_hint from database/RPC response.
 * Enforces string type, 1 <= length <= 4, and printable ASCII only (^[\x20-\x7E]{1,4}$).
 * Fails closed with AI_CREDENTIAL_CORRUPTED.
 */
export function validateWireKeyHint(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record key_hint must be a string.',
    });
  }
  if (raw.trim().length === 0 || !PRINTABLE_ASCII_KEY_HINT.test(raw)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Wire credential record key_hint must be 1 to ${KEY_HINT_MAX_LENGTH} printable ASCII characters.`,
    });
  }
  return raw;
}

export function validateWireRecord(record: unknown): EncryptedEnvelopeWire {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record is not a valid object.',
    });
  }

  const r = record as Record<string, unknown>;

  // id: valid UUID
  if (!isValidUuid(r.id)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record missing valid UUID id.',
    });
  }

  // owner_user_id: valid UUID
  if (!isValidUuid(r.owner_user_id)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record missing valid UUID owner_user_id.',
    });
  }

  // source: exact PERSONAL | ADMIN_ASSIGNED
  if (r.source !== 'PERSONAL' && r.source !== 'ADMIN_ASSIGNED') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Invalid wire credential source: '${String(r.source)}'.`,
    });
  }

  // provider: exact GEMINI
  if (r.provider !== 'GEMINI') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Unsupported wire credential provider: '${String(r.provider)}'.`,
    });
  }

  // assigned_by_user_id: null OR valid UUID
  let assignedByUserId: string | null = null;
  if (r.assigned_by_user_id !== null && r.assigned_by_user_id !== undefined) {
    if (!isValidUuid(r.assigned_by_user_id)) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Wire credential record assigned_by_user_id is not a valid UUID.',
      });
    }
    assignedByUserId = r.assigned_by_user_id;
  }

  // envelope_version: number/integer exactly 1. NO coercion, NO defaulting.
  if (typeof r.envelope_version !== 'number' || !Number.isInteger(r.envelope_version) || r.envelope_version !== 1) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Unsupported or invalid wire credential envelope_version: '${String(r.envelope_version)}'.`,
    });
  }

  // is_active: actual boolean only
  if (typeof r.is_active !== 'boolean') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record is_active must be a strict boolean.',
    });
  }

  // created_at: valid timestamp string
  if (!isValidTimestamp(r.created_at)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record created_at is not a valid timestamp.',
    });
  }

  // updated_at: valid timestamp string
  if (!isValidTimestamp(r.updated_at)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Wire credential record updated_at is not a valid timestamp.',
    });
  }

  // revoked_at: active -> null; inactive -> valid timestamp
  let revokedAt: string | null = null;
  if (r.is_active) {
    if (r.revoked_at !== null && r.revoked_at !== undefined) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Active wire credential must have null revoked_at.',
      });
    }
  } else {
    if (!isValidTimestamp(r.revoked_at)) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Inactive wire credential must have a valid revoked_at timestamp.',
      });
    }
    revokedAt = r.revoked_at;
  }

  // Active vs inactive crypto fields
  let keyId: string | null = null;
  let nonce: string | null = null;
  let ciphertext: string | null = null;
  let authTag: string | null = null;
  let keyHint: string | null = null;

  if (r.is_active) {
    // key_id: non-empty string
    if (typeof r.key_id !== 'string' || r.key_id.trim() === '') {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Active wire credential must have non-empty key_id.',
      });
    }
    keyId = r.key_id.trim();

    // nonce: canonical bytea string (\x + 24 lowercase hex chars = 12 bytes)
    if (typeof r.nonce !== 'string' || !/^\\x[0-9a-f]{24}$/.test(r.nonce)) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Active wire credential must have a canonical 12-byte hex bytea nonce.',
      });
    }
    nonce = r.nonce;

    // ciphertext: canonical non-empty bytea string (\x + even lowercase hex chars)
    if (
      typeof r.ciphertext !== 'string' ||
      !/^\\x[0-9a-f]+$/.test(r.ciphertext) ||
      (r.ciphertext.length - 2) % 2 !== 0 ||
      r.ciphertext.length <= 2
    ) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Active wire credential must have a canonical non-empty hex bytea ciphertext.',
      });
    }
    ciphertext = r.ciphertext;

    // auth_tag: canonical bytea string (\x + 32 lowercase hex chars = 16 bytes)
    if (typeof r.auth_tag !== 'string' || !/^\\x[0-9a-f]{32}$/.test(r.auth_tag)) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Active wire credential must have a canonical 16-byte hex bytea auth_tag.',
      });
    }
    authTag = r.auth_tag;

    // key_hint: safe bounded masked/suffix metadata (1 <= length <= 4, no control chars)
    keyHint = validateWireKeyHint(r.key_hint);
  } else {
    // Inactive credentials MUST have all crypto fields nullified
    if (
      (r.key_id !== null && r.key_id !== undefined) ||
      (r.nonce !== null && r.nonce !== undefined) ||
      (r.ciphertext !== null && r.ciphertext !== undefined) ||
      (r.auth_tag !== null && r.auth_tag !== undefined) ||
      (r.key_hint !== null && r.key_hint !== undefined)
    ) {
      throw new AiError({
        code: 'AI_CREDENTIAL_CORRUPTED',
        message: 'Inactive wire credential must not retain cryptographic material or key hints.',
      });
    }
  }

  return {
    id: r.id,
    owner_user_id: r.owner_user_id,
    source: r.source,
    provider: r.provider,
    assigned_by_user_id: assignedByUserId,
    envelope_version: r.envelope_version,
    key_id: keyId,
    nonce,
    ciphertext,
    auth_tag: authTag,
    key_hint: keyHint,
    is_active: r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
    revoked_at: revokedAt,
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

  if (wire.envelope_version !== 1) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Unsupported envelope version for hydration: ${wire.envelope_version}`,
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
    envelopeVersion: wire.envelope_version,
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
    if (!ownerUserId || typeof ownerUserId !== 'string' || !isValidUuid(ownerUserId)) {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'A valid ownerUserId UUID is required to read active credentials.',
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

/**
 * Production factory for AiCredentialRepository using server-only admin service client.
 */
export function createAiCredentialRepository(): AiCredentialRepository {
  const adminClient = createAdminClient();
  return new AiCredentialRepository(adminClient);
}
