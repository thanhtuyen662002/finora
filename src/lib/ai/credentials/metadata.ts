/**
 * Finora AI Foundation — Credential Safe Metadata DTO
 * Phase 11 — Security Core
 *
 * Constructs browser-safe metadata DTOs without leaking secret material.
 * Strictly guarantees that ciphertext, nonces, auth tags, key IDs, and plaintext
 * never enter client-facing data structures.
 */

import type { AiCredentialSafeMetadata, AiCredentialSource, EncryptedEnvelopeWire } from './types';

export interface ResolveMetadataOptions {
  readonly records: readonly EncryptedEnvelopeWire[];
  readonly hasSystemKeyConfigured: boolean;
}

/**
 * Builds safe metadata summary from wire records and system configuration.
 */
export function buildSafeCredentialMetadata(options: ResolveMetadataOptions): AiCredentialSafeMetadata {
  const { records, hasSystemKeyConfigured } = options;

  let hasPersonalCredential = false;
  let personalKeyHint: string | null = null;
  let personalKeyUpdatedAt: string | null = null;

  let hasAdminAssignedCredential = false;
  let adminAssignedKeyHint: string | null = null;
  let adminAssignedKeyUpdatedAt: string | null = null;

  for (const record of records) {
    if (!record.is_active || record.revoked_at !== null) continue;

    if (record.source === 'PERSONAL') {
      hasPersonalCredential = true;
      personalKeyHint = record.key_hint;
      personalKeyUpdatedAt = record.updated_at;
    } else if (record.source === 'ADMIN_ASSIGNED') {
      hasAdminAssignedCredential = true;
      adminAssignedKeyHint = record.key_hint;
      adminAssignedKeyUpdatedAt = record.updated_at;
    }
  }

  let activeResolvedSource: AiCredentialSource | null = null;
  if (hasPersonalCredential) {
    activeResolvedSource = 'PERSONAL';
  } else if (hasAdminAssignedCredential) {
    activeResolvedSource = 'ADMIN_ASSIGNED';
  } else if (hasSystemKeyConfigured) {
    activeResolvedSource = 'SYSTEM';
  }

  return {
    hasPersonalCredential,
    personalKeyHint,
    personalKeyUpdatedAt,
    hasAdminAssignedCredential,
    adminAssignedKeyHint,
    adminAssignedKeyUpdatedAt,
    hasSystemKeyConfigured,
    activeResolvedSource,
  };
}
