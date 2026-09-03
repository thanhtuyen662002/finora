/**
 * Finora AI Foundation — Credential Architecture Types
 * Phase 11 — Security Core & Envelope Types
 */

export type AiCredentialSource = 'PERSONAL' | 'ADMIN_ASSIGNED' | 'SYSTEM';
export type DatabaseCredentialSource = 'PERSONAL' | 'ADMIN_ASSIGNED';
export type AiCredentialProviderId = 'gemini';

export interface EncryptedEnvelope {
  readonly envelopeVersion: 1;
  readonly credentialId: string;
  readonly ownerUserId: string;
  readonly source: DatabaseCredentialSource;
  readonly provider: 'GEMINI';
  readonly keyId: string;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly authTag: Buffer;
  readonly keyHint: string;
}

export interface EncryptedEnvelopeWire {
  readonly id: string;
  readonly owner_user_id: string;
  readonly source: string;
  readonly provider: string;
  readonly assigned_by_user_id: string | null;
  readonly envelope_version: number;
  readonly key_id: string | null;
  readonly nonce: string | null;
  readonly ciphertext: string | null;
  readonly auth_tag: string | null;
  readonly key_hint: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly revoked_at: string | null;
}

/**
 * Browser-safe Metadata DTO.
 * Exposes zero ciphertext, zero nonce, zero auth_tag, zero key_id, and zero plaintext.
 */
export interface AiCredentialSafeMetadata {
  readonly hasPersonalCredential: boolean;
  readonly personalKeyHint: string | null;
  readonly personalKeyUpdatedAt: string | null;
  readonly hasAdminAssignedCredential: boolean;
  readonly adminAssignedKeyHint: string | null;
  readonly adminAssignedKeyUpdatedAt: string | null;
  readonly hasSystemKeyConfigured: boolean;
  readonly activeResolvedSource: AiCredentialSource | null;
}

export interface MasterKeyRing {
  readonly activeKeyId: string;
  readonly keys: ReadonlyMap<string, Buffer>;
}
