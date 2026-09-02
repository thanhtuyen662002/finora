/**
 * Finora AI Foundation — Central AI Router
 * Phase 10 — Router & Dispatch Layer
 *
 * Dispatches logical AI operations to configured providers with:
 * - Central configuration resolution
 * - Dependency injection of credentials
 * - Strict timeout and caller cancellation handling
 * - Fail-closed runtime structured output validation
 * - Normalized application error responses
 */

import { getOperationConfig } from './config';
import { AiError } from './errors';
import type { AiProvider } from './provider';
import { parseAndValidateJson } from './structured-result';
import type {
  AiExecutionContext,
  AiOperation,
  AiProviderId,
  AiRequest,
  AiStructuredResult,
} from './types';

export interface AiRouterOptions {
  readonly providers?: Array<AiProvider>;
}

export class AiRouter {
  private readonly providers = new Map<string, AiProvider>();

  constructor(options?: AiRouterOptions) {
    if (options?.providers) {
      for (const provider of options.providers) {
        this.registerProvider(provider);
      }
    }
  }

  registerProvider(provider: AiProvider): void {
    if (!provider || !provider.id) {
      throw new Error('Cannot register provider without a valid id');
    }
    this.providers.set(provider.id, provider);
  }

  getProvider(id: AiProviderId): AiProvider | undefined {
    return this.providers.get(id);
  }

  async execute<TInput, TOutput>(
    request: AiRequest<TInput, TOutput>,
    context?: AiExecutionContext
  ): Promise<AiStructuredResult<TOutput>> {
    const callerSignal = request.signal ?? context?.signal;
    if (callerSignal?.aborted) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_ABORTED',
          message: 'AI operation aborted by caller prior to execution.',
        }),
      };
    }

    // 1. Resolve operation configuration
    const opConfig = getOperationConfig(request.operation);
    const providerId = opConfig?.providerId ?? ('gemini' as AiProviderId);
    const model = request.overrideModel ?? opConfig?.model ?? 'gemini-2.5-flash';

    if (!opConfig && !request.overrideModel) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_INVALID_REQUEST',
          message: `Unknown AI operation '${request.operation}' with no configuration or override model.`,
        }),
      };
    }

    // 2. Resolve provider adapter
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_PROVIDER_UNAVAILABLE',
          message: `AI provider '${providerId}' is not registered in AI Router.`,
          providerId,
        }),
      };
    }

    // 3. Resolve credentials via injected credential provider port
    if (!context?.credentialProvider) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_NOT_CONFIGURED',
          message: 'No AI credential provider supplied in execution context.',
          providerId,
        }),
      };
    }

    let credential;
    try {
      credential = await context.credentialProvider.resolveCredential({
        providerId,
        userId: context.userId,
        operation: request.operation,
      });
    } catch (err) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_AUTH_FAILED',
          message: 'Failed to resolve AI credential from credential provider.',
          providerId,
          cause: err,
        }),
      };
    }

    if (!credential || !credential.value) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_NOT_CONFIGURED',
          message: `AI credentials not configured for provider '${providerId}'.`,
          providerId,
        }),
      };
    }

    // 4. Setup timeout and cancellation orchestration
    const timeoutMs = request.timeoutMs ?? context?.timeoutMs ?? opConfig?.timeoutMs ?? 20000;
    const timeoutController = new AbortController();
    let isTimeoutTriggered = false;

    const timeoutTimer = setTimeout(() => {
      isTimeoutTriggered = true;
      timeoutController.abort();
    }, timeoutMs);

    // Combined abort controller linking caller signal + internal timeout
    const compositeController = new AbortController();
    const handleCallerAbort = () => compositeController.abort();
    const handleTimeoutAbort = () => compositeController.abort();

    if (callerSignal) {
      callerSignal.addEventListener('abort', handleCallerAbort, { once: true });
    }
    timeoutController.signal.addEventListener('abort', handleTimeoutAbort, { once: true });

    try {
      const response = await provider.execute(
        {
          ...request,
          overrideModel: model,
          signal: compositeController.signal,
        },
        credential,
        {
          ...context,
          signal: compositeController.signal,
        }
      );

      clearTimeout(timeoutTimer);

      // 5. Output processing & runtime schema validation
      if (request.outputValidator) {
        return parseAndValidateJson(response.text, request.outputValidator, {
          provider: provider.id,
          model: response.model || model,
          usage: response.usage,
        });
      }

      return {
        ok: true,
        data: response.text as unknown as TOutput,
        provider: provider.id,
        model: response.model || model,
        usage: response.usage,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);

      if (isTimeoutTriggered) {
        return {
          ok: false,
          error: new AiError({
            code: 'AI_TIMEOUT',
            message: `AI operation '${request.operation}' timed out after ${timeoutMs}ms.`,
            providerId,
          }),
        };
      }

      if (callerSignal?.aborted) {
        return {
          ok: false,
          error: new AiError({
            code: 'AI_ABORTED',
            message: 'AI operation was aborted by caller.',
            providerId,
          }),
        };
      }

      if (err instanceof AiError) {
        return {
          ok: false,
          error: err,
        };
      }

      return {
        ok: false,
        error: new AiError({
          code: 'AI_PROVIDER_ERROR',
          message: err instanceof Error ? err.message : String(err),
          providerId,
          cause: err,
        }),
      };
    } finally {
      if (callerSignal) {
        callerSignal.removeEventListener('abort', handleCallerAbort);
      }
      timeoutController.signal.removeEventListener('abort', handleTimeoutAbort);
    }
  }
}

export function createAiRouter(options?: AiRouterOptions): AiRouter {
  return new AiRouter(options);
}
