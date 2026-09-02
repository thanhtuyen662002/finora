/**
 * Finora AI Foundation — Provider Abstraction
 * Phase 10 — Provider-Neutral Adapter Contract
 */

import type {
  AiCredential,
  AiExecutionContext,
  AiProviderId,
  AiProviderResponse,
  AiRequest,
} from './types';

export interface AiProvider {
  readonly id: AiProviderId;

  execute<TInput, TOutput>(
    request: AiRequest<TInput, TOutput>,
    credential: AiCredential,
    context?: AiExecutionContext
  ): Promise<AiProviderResponse>;
}
