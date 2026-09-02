/**
 * Finora AI Foundation — Provider-Neutral Type Definitions
 * Phase 10 — Server-Only Architecture
 *
 * All financial calculations remain 100% deterministic and isolated.
 * Monetary outputs must always use string decimals, never JavaScript numbers.
 */

export type AiOperation =
  | 'transaction_parser'
  | 'categorization'
  | 'financial_assistant'
  | 'receipt_vision'
  | 'report_summary'
  | (string & {});

export type AiProviderId =
  | 'gemini'
  | (string & {});

export interface AiModelConfig {
  readonly providerId: AiProviderId;
  readonly model: string;
  readonly timeoutMs: number;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface AiOutputValidator<T> {
  readonly name?: string;
  readonly jsonSchema?: Record<string, unknown>;
  validate(value: unknown): T;
}

export interface AiRequest<TInput = unknown, TOutput = unknown> {
  readonly operation: AiOperation;
  readonly input?: TInput;
  readonly prompt: string;
  readonly systemInstruction?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly outputValidator?: AiOutputValidator<TOutput>;
  readonly overrideModel?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface AiCredential {
  readonly value: string;
  readonly providerId?: AiProviderId;
}

export interface AiCredentialContext {
  readonly providerId: AiProviderId;
  readonly userId?: string;
  readonly operation?: AiOperation;
}

/**
 * Phase 11 Dependency Port:
 * Resolves credentials at runtime. Implemented in Phase 11.
 */
export interface AiCredentialProvider {
  resolveCredential(context: AiCredentialContext): Promise<AiCredential | null>;
}

export interface AiExecutionContext {
  readonly userId?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly credentialProvider?: AiCredentialProvider;
}

export interface AiUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface AiProviderResponse {
  readonly text: string;
  readonly model: string;
  readonly rawJson?: unknown;
  readonly usage?: AiUsage;
}

export type AiStructuredResult<T> =
  | {
      readonly ok: true;
      readonly data: T;
      readonly provider: string;
      readonly model: string;
      readonly usage?: AiUsage;
    }
  | {
      readonly ok: false;
      readonly error: import('./errors').AiError;
    };
