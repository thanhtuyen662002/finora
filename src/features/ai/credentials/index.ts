/**
 * Finora AI Feature Module — Credentials Public API
 * Phase 11 — Client-Safe Contracts and Server Actions
 */

export type {
  AiCredentialSafeMetadata,
  AiCredentialSource,
  ActionResult,
  ActionSuccess,
  ActionFailure,
  AdminTargetUserDTO,
} from './types';

export {
  getMyAiCredentialMetadata,
  saveMyPersonalAiCredential,
  revokeMyPersonalAiCredential,
  checkIsAdmin,
  getAdminAiCredentialTarget,
  saveAdminAssignedCredential,
  revokeAdminAssignedCredential,
} from './actions';
