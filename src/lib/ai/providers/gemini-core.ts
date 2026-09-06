/**
 * Finora AI Foundation — Gemini Provider Core
 * Phase 10 — Testable Provider-Neutral Core Logic
 *
 * Contains provider mapping, error normalization, and generation logic.
 * Dependency-injected client factory allows 100% deterministic, zero-network unit testing.
 * Does NOT import Google Gen AI SDK directly.
 */

import { AiError, type AiErrorCode } from '../errors';
import type { AiProvider } from '../provider';
import type {
  AiCredential,
  AiExecutionContext,
  AiProviderExecutionRequest,
  AiProviderResponse,
  AiUsage,
} from '../types';

export interface GeminiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string | Array<unknown>;
      config?: {
        systemInstruction?: string;
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
        abortSignal?: AbortSignal;
      };
    }): Promise<{
      text?: string | null;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    }>;
  };
}

export type GeminiClientFactory = (credential: AiCredential) => GeminiClientLike;

export interface GeminiCoreOptions {
  clientFactory: GeminiClientFactory;
}

export function normalizeGeminiError(err: unknown): AiError {
  if (err instanceof AiError) {
    return err;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const lowerMsg = rawMessage.toLowerCase();

  let code: AiErrorCode = 'AI_PROVIDER_ERROR';

  if (
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('401') ||
    lowerMsg.includes('403') ||
    lowerMsg.includes('permission_denied')
  ) {
    code = 'AI_AUTH_FAILED';
  } else if (
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('rate limit')
  ) {
    code = 'AI_RATE_LIMITED';
  } else if (
    lowerMsg.includes('deadline_exceeded') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out')
  ) {
    code = 'AI_TIMEOUT';
  } else if (
    lowerMsg.includes('abort') ||
    lowerMsg.includes('cancelled') ||
    lowerMsg.includes('canceled')
  ) {
    code = 'AI_ABORTED';
  } else if (
    lowerMsg.includes('503') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('service unavailable')
  ) {
    code = 'AI_PROVIDER_UNAVAILABLE';
  } else if (lowerMsg.includes('invalid_argument') || lowerMsg.includes('400')) {
    code = 'AI_INVALID_REQUEST';
  }

  return new AiError({
    code,
    message: rawMessage,
    providerId: 'gemini',
    cause: err,
  });
}

export class GeminiProviderCore implements AiProvider {
  readonly id = 'gemini' as const;
  protected readonly clientFactory: GeminiClientFactory;

  constructor(options: GeminiCoreOptions) {
    if (!options || typeof options.clientFactory !== 'function') {
      throw new Error('GeminiProviderCore requires a valid clientFactory function.');
    }
    this.clientFactory = options.clientFactory;
  }

  async execute<TInput, TOutput>(
    request: AiProviderExecutionRequest<TInput, TOutput>,
    credential: AiCredential,
    context?: AiExecutionContext
  ): Promise<AiProviderResponse> {
    if (!credential || !credential.value || credential.value.trim() === '') {
      throw new AiError({
        code: 'AI_AUTH_FAILED',
        message: 'Missing or empty Gemini API credential.',
        providerId: this.id,
      });
    }

    const signal = request.signal ?? context?.signal;
    if (signal?.aborted) {
      throw new AiError({
        code: 'AI_ABORTED',
        message: 'AI request was aborted before execution started.',
        providerId: this.id,
      });
    }

    if (!request.model || request.model.trim() === '') {
      throw new AiError({
        code: 'AI_INVALID_REQUEST',
        message: 'Missing model identifier in AI request.',
        providerId: this.id,
      });
    }

    const modelName = request.model;

    try {
      const client = this.clientFactory(credential);

      // Build generation config from propagated operation/request parameters
      const config: {
        systemInstruction?: string;
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
        abortSignal?: AbortSignal;
      } = {};

      if (request.systemInstruction) {
        config.systemInstruction = request.systemInstruction;
      }
      if (typeof request.temperature === 'number') {
        config.temperature = request.temperature;
      }
      if (typeof request.maxTokens === 'number') {
        config.maxOutputTokens = request.maxTokens;
      }
      if (signal) {
        config.abortSignal = signal;
      }

      // If output validator provides a JSON schema, configure structured JSON response
      if (request.outputValidator?.jsonSchema) {
        config.responseMimeType = 'application/json';
        config.responseJsonSchema = request.outputValidator.jsonSchema;
      }

      const response = await client.models.generateContent({
        model: modelName,
        contents: request.prompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const text = response.text ?? '';
      const usageMetadata = response.usageMetadata;

      const usage: AiUsage | undefined = usageMetadata
        ? {
            inputTokens: usageMetadata.promptTokenCount,
            outputTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount,
          }
        : undefined;

      return {
        text,
        model: modelName,
        usage,
      };
    } catch (err) {
      if (signal?.aborted) {
        throw new AiError({
          code: 'AI_ABORTED',
          message: 'AI request was aborted by the caller signal.',
          providerId: this.id,
          cause: err,
        });
      }
      throw normalizeGeminiError(err);
    }
  }
}
