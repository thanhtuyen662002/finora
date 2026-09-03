/**
 * Finora AI Foundation — Central AI Router
 * Phase 10 — Router & Dispatch Layer
 *
 * Dispatches logical AI operations to configured providers with:
 * - Central configuration resolution (fail-closed on unknown operations)
 * - Single source of truth for models (no fallback model literals)
 * - Propagation of central generation parameters (temperature, maxOutputTokens, timeoutMs)
 * - Dependency injection of credentials (Phase 11 port)
 * - Strict timeout and caller cancellation handling
 * - Fail-closed runtime structured output validation and empty-text validation
 * - Normalized application error responses
 */

import { getOperationConfig } from './config';
import { AiError } from './errors';
import type { AiProvider } from './provider';
import { parseAndValidateJson } from './structured-result';
import type {
  AiExecutionContext,
  AiProviderId,
  AiRequest,
  AiStructuredRequest,
  AiStructuredResult,
  AiTextRequest,
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

  registerProvider(provider: AiProvider, options?: { allowOverride?: boolean }): void {
    if (!provider || !provider.id) {
      throw new Error('Cannot register provider without a valid id');
    }
    if (this.providers.has(provider.id) && !options?.allowOverride) {
      throw new Error(`Duplicate AI provider registration for id '${provider.id}'. Use allowOverride to replace.`);
    }
    this.providers.set(provider.id, provider);
  }

  getProvider(id: AiProviderId): AiProvider | undefined {
    return this.providers.get(id);
  }

  async execute<TInput, TOutput>(
    request: AiStructuredRequest<TInput, TOutput>,
    context?: AiExecutionContext
  ): Promise<AiStructuredResult<TOutput>>;

  async execute<TInput>(
    request: AiTextRequest<TInput>,
    context?: AiExecutionContext
  ): Promise<AiStructuredResult<string>>;

  async execute<TInput, TOutput = string>(
    request: AiRequest<TInput, TOutput>,
    context?: AiExecutionContext
  ): Promise<AiStructuredResult<string | TOutput>> {
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

    // 1. Resolve operation configuration — Unknown operation must ALWAYS fail closed
    const opConfig = getOperationConfig(request.operation);
    if (!opConfig) {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_INVALID_REQUEST',
          message: `Unknown AI operation '${request.operation}' with no configuration.`,
        }),
      };
    }

    const providerId = opConfig.providerId;
    const model = opConfig.model;

    if (!model || model.trim() === '') {
      return {
        ok: false,
        error: new AiError({
          code: 'AI_INVALID_REQUEST',
          message: `Model not configured for operation '${request.operation}'.`,
          providerId,
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
      if (err instanceof AiError) {
        return {
          ok: false,
          error: err,
        };
      }
      return {
        ok: false,
        error: new AiError({
          code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
          message: 'Failed to resolve AI credential from credential provider.',
          providerId,
          cause: err,
        }),
      };
    }

    if (!credential || !credential.value || credential.value.trim() === '') {
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
    const effectiveTemperature = request.temperature ?? opConfig.temperature;
    const effectiveMaxTokens = request.maxTokens ?? opConfig.maxOutputTokens;
    const timeoutMs = request.timeoutMs ?? context?.timeoutMs ?? opConfig.timeoutMs ?? 20000;

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
      const isStructuredMode =
        (request as AiStructuredRequest<TInput, TOutput>).responseMode === 'structured' ||
        Boolean((request as { outputValidator?: unknown }).outputValidator);

      const outputValidator = (request as { outputValidator?: import('./types').AiOutputValidator<TOutput> }).outputValidator;

      if (isStructuredMode && !outputValidator) {
        clearTimeout(timeoutTimer);
        return {
          ok: false,
          error: new AiError({
            code: 'AI_INVALID_REQUEST',
            message: 'Structured response mode requires an outputValidator.',
            providerId,
          }),
        };
      }

      const response = await provider.execute(
        {
          ...request,
          model,
          temperature: effectiveTemperature,
          maxTokens: effectiveMaxTokens,
          timeoutMs,
          signal: compositeController.signal,
          outputValidator,
        },
        credential,
        {
          ...context,
          signal: compositeController.signal,
        }
      );

      clearTimeout(timeoutTimer);

      // 5. Output processing & runtime schema validation
      if (isStructuredMode && outputValidator) {
        return parseAndValidateJson(response.text, outputValidator, {
          provider: provider.id,
          model: response.model || model,
          usage: response.usage,
        });
      }

      // Text response mode validation
      if (!response.text || typeof response.text !== 'string' || response.text.trim() === '') {
        return {
          ok: false,
          error: new AiError({
            code: 'AI_INVALID_RESPONSE',
            message: 'AI provider returned an empty or whitespace-only response payload.',
            providerId: provider.id,
          }),
        };
      }

      return {
        ok: true,
        data: response.text,
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
