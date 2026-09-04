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
        httpOptions?: {
          retryOptions?: {
            attempts?: number;
          };
        };
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
        httpOptions?: {
          retryOptions?: {
            attempts?: number;
          };
        };
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

      // Receipt Vision specific single HTTP attempt policy
      if (request.operation === 'receipt_vision') {
        config.httpOptions = {
          retryOptions: {
            attempts: 1,
          },
        };

        // Receipt Vision operation MUST fail closed if media is missing, invalid, or empty
        if (!request.media || request.media.length !== 1) {
          throw new AiError({
            code: 'AI_INVALID_REQUEST',
            message: 'Receipt vision requires exactly one media item.',
            providerId: this.id,
          });
        }
      }

      // Map contents: text-only vs multimodal inline image
      let contents: string | Array<unknown> = request.prompt;
      if (request.media && request.media.length > 0) {
        if (request.media.length !== 1 || request.media[0].kind !== 'inline_image') {
          throw new AiError({
            code: 'AI_INVALID_REQUEST',
            message: 'Gemini provider currently supports exactly one inline image in multimodal requests.',
            providerId: this.id,
          });
        }
        const mediaPart = request.media[0];

        // Runtime MIME validation against allowlist
        const ALLOWED_MIMES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
        if (!ALLOWED_MIMES.includes(mediaPart.mimeType)) {
          throw new AiError({
            code: 'AI_INVALID_REQUEST',
            message: `Unsupported media MIME type: ${String(mediaPart.mimeType)}`,
            providerId: this.id,
          });
        }

        // Runtime empty bytes check
        if (!mediaPart.bytes || mediaPart.bytes.length === 0) {
          throw new AiError({
            code: 'AI_INVALID_REQUEST',
            message: 'Media byte array cannot be empty.',
            providerId: this.id,
          });
        }

        const base64Data = Buffer.from(mediaPart.bytes).toString('base64');
        contents = [
          {
            inlineData: {
              mimeType: mediaPart.mimeType,
              data: base64Data,
            },
          },
          request.prompt,
        ];
      }

      const response = await client.models.generateContent({
        model: modelName,
        contents,
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
      if (request.operation === 'receipt_vision') {
        const normalized = normalizeGeminiError(err);
        const safeMessages: Record<AiErrorCode, string> = {
          AI_AUTH_FAILED: 'Gemini authentication failed during receipt vision analysis.',
          AI_RATE_LIMITED: 'Gemini rate limit exceeded during receipt vision analysis.',
          AI_TIMEOUT: 'Receipt vision analysis timed out.',
          AI_ABORTED: 'Receipt vision analysis was aborted.',
          AI_PROVIDER_UNAVAILABLE: 'Gemini service is currently unavailable for receipt vision.',
          AI_INVALID_REQUEST: 'Invalid request payload sent to receipt vision provider.',
          AI_INVALID_RESPONSE: 'Invalid response received from receipt vision provider.',
          AI_STRUCTURED_OUTPUT_INVALID: 'Failed to validate structured receipt vision output.',
          AI_NOT_CONFIGURED: 'AI credentials not configured for receipt vision.',
          AI_PROVIDER_ERROR: 'An error occurred with the AI provider during receipt vision analysis.',
          AI_CREDENTIAL_CORRUPTED: 'AI credential is corrupted.',
          AI_CREDENTIAL_KEY_UNAVAILABLE: 'AI credential encryption key is unavailable.',
          AI_CREDENTIAL_RESOLUTION_FAILED: 'Failed to resolve AI credential for receipt vision.',
        };
        throw new AiError({
          code: normalized.code,
          message: safeMessages[normalized.code] ?? 'An error occurred during receipt vision analysis.',
          providerId: this.id,
        });
      }
      throw normalizeGeminiError(err);
    }
  }
}
