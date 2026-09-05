import 'server-only';

/**
 * Finora AI Foundation — Production Gemini Provider Adapter
 * Phase 10 — Server-Only Google Gen AI Production Adapter
 *
 * The ONLY production file permitted to import @google/genai.
 * Marked with 'server-only' to guarantee build-time boundary enforcement.
 * Credentials must be injected via parameter; direct process.env lookups are forbidden.
 */

import { GoogleGenAI } from '@google/genai';
import {
  GeminiProviderCore,
  type GeminiClientFactory,
  type GeminiClientLike,
} from './gemini-core';

export {
  normalizeGeminiError,
  type GeminiClientFactory,
  type GeminiClientLike,
  type GeminiCoreOptions,
} from './gemini-core';

export interface GeminiProviderOptions {
  clientFactory?: GeminiClientFactory;
}

export class GeminiProvider extends GeminiProviderCore {
  constructor(options?: GeminiProviderOptions) {
    super({
      clientFactory:
        options?.clientFactory ??
        ((credential) => {
          const ai = new GoogleGenAI({
            apiKey: credential.value,
            httpOptions: {
              retryOptions: { attempts: 1 },
            },
          });
          return {
            models: {
              generateContent: (params: Parameters<GeminiClientLike['models']['generateContent']>[0]) =>
                (ai as unknown as GeminiClientLike).models.generateContent(params),
            },
          };
        }),
    });
  }
}
