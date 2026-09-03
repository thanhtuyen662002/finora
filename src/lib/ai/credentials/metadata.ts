/**
 * Finora AI Foundation — Credential Safe Metadata DTO
 * Phase 11 — Security Core
 *
 * Constructs browser-safe metadata DTOs without leaking secret material.
 * Strictly guarantees that ciphertext, nonces, auth tags, key IDs, and plaintext
 * never enter client-facing data structures.
 */

import 'server-only';

import { PRINTABLE_ASCII_KEY_HINT, buildCredentialKeyHint } from './crypto';
import type { AiCredentialSafeMetadata, AiCredentialSource, EncryptedEnvelopeWire } from './types';

export interface ResolveMetadataOptions {
  readonly records: readonly EncryptedEnvelopeWire[];
  readonly hasSystemKeyConfigured: boolean;
}

/**
 * Defensively sanitizes an untrusted key_hint.
 * Ensures the hint strictly satisfies:
 * - string type
 * - length between 1 and 4
 * - printable ASCII only (^[\x20-\x7E]{1,4}$)
 * Returns sanitized string or null if invalid.
 */
export function sanitizeSafeKeyHint(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.trim().length === 0) return null;
  if (!PRINTABLE_ASCII_KEY_HINT.test(raw)) return null;
  return raw;
}

/**
 * Builds safe metadata summary from wire records and system configuration.
 * Never trusts arbitrary DB key_hint; defensively validates and bounds all hints.
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
      const safeHint = sanitizeSafeKeyHint(record.key_hint);
      personalKeyHint = safeHint ?? '****';
      personalKeyUpdatedAt = record.updated_at;
    } else if (record.source === 'ADMIN_ASSIGNED') {
      hasAdminAssignedCredential = true;
      const safeHint = sanitizeSafeKeyHint(record.key_hint);
      adminAssignedKeyHint = safeHint ?? '****';
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

export const generateKeyHint = buildCredentialKeyHint;
export { buildCredentialKeyHint };

