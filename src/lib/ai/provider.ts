/**
 * Finora AI Foundation — Provider Abstraction
 * Phase 10 — Provider-Neutral Adapter Contract
 */

import type {
  AiCredential,
  AiExecutionContext,
  AiProviderExecutionRequest,
  AiProviderId,
  AiProviderResponse,
} from './types';

export interface AiProvider {
  readonly id: AiProviderId;

  execute<TInput, TOutput>(
    request: AiProviderExecutionRequest<TInput, TOutput>,
    credential: AiCredential,
    context?: AiExecutionContext
  ): Promise<AiProviderResponse>;
}
