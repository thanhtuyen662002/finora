/**
 * Finora AI Feature Module — Credential Action & Metadata Types
 * Phase 11 — Client-Safe Contracts
 *
 * Types in this module are safe for import by client and server components.
 * Zero secret or cryptographic material is exposed.
 */

import type { AiCredentialSafeMetadata, AiCredentialSource } from '@/lib/ai/credentials/types';

export type { AiCredentialSafeMetadata, AiCredentialSource };

export interface ActionSuccess<T = undefined> {
  readonly ok: true;
  readonly metadata: AiCredentialSafeMetadata;
  readonly data?: T;
}

export interface ActionFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export interface AdminTargetUserDTO {
  readonly email: string;
  readonly metadata: AiCredentialSafeMetadata;
}
