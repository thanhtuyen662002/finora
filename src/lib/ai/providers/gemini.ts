/**
 * Finora AI Foundation — Gemini Provider Adapter
 * Phase 10 — Server-Only Google Gen AI Adapter
 *
 * The ONLY production file permitted to import @google/genai.
 * Credentials must be injected via parameter; direct process.env lookups are forbidden.
 */

import { GoogleGenAI } from '@google/genai';
import { AiError, type AiErrorCode } from '../errors';
import type { AiProvider } from '../provider';
import type {
  AiCredential,
  AiExecutionContext,
  AiProviderResponse,
  AiRequest,
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
        responseSchema?: unknown;
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

export type GeminiClientFactory = (credential: AiCredential) => GeminiClientLike | GoogleGenAI;

export interface GeminiProviderOptions {
  clientFactory?: GeminiClientFactory;
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

export class GeminiProvider implements AiProvider {
  readonly id = 'gemini' as const;
  private readonly clientFactory: (credential: AiCredential) => GeminiClientLike;

  constructor(options?: GeminiProviderOptions) {
    if (options?.clientFactory) {
      const customFactory = options.clientFactory;
      this.clientFactory = (credential: AiCredential) => {
        const client = customFactory(credential);
        return {
          models: {
            generateContent: (params: Parameters<GeminiClientLike['models']['generateContent']>[0]) =>
              (client as unknown as GeminiClientLike).models.generateContent(params),
          },
        };
      };
    } else {
      this.clientFactory = (credential: AiCredential) => {
        const ai = new GoogleGenAI({ apiKey: credential.value });
        return {
          models: {
            generateContent: (params: Parameters<GeminiClientLike['models']['generateContent']>[0]) =>
              (ai as unknown as GeminiClientLike).models.generateContent(params),
          },
        };
      };
    }
  }

  async execute<TInput, TOutput>(
    request: AiRequest<TInput, TOutput>,
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

    const modelName = request.overrideModel ?? 'gemini-2.5-flash';

    try {
      const client = this.clientFactory(credential);

      // Build generation config
      const config: {
        systemInstruction?: string;
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        responseSchema?: unknown;
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
        config.responseSchema = request.outputValidator.jsonSchema;
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
