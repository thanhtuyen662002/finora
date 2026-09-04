/**
 * Finora AI Feature Module — Transaction Draft & Categorization Types
 * Phase 12A — Dual Boundary Specification
 *
 * Types in this module are safe for import by both client and server components.
 * Dual Boundary:
 * 1. Model Boundary: AiTransactionParseOutput (Opaque tokens, exact 11 keys, zero UUIDs)
 * 2. Application Boundary: ParsedTransactionDraft (Resolved real UUIDs after cross-validation)
 */

import type { CurrencyCode } from '@/types/finance';

export const SUPPORTED_CURRENCY_CODES: readonly CurrencyCode[] = [
  'VND',
  'USD',
  'EUR',
  'JPY',
  'CNY',
  'KRW',
] as const;

export function isSupportedCurrencyCode(code: unknown): code is CurrencyCode {
  return (
    typeof code === 'string' &&
    (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(code)
  );
}

/**
 * Raw structured model output validated by Phase 10 AiOutputValidator.
 * MANDATORY: Exactly 11 keys, zero UUIDs, string amounts, tokens only.
 */
export interface AiTransactionParseOutput {
  /**
   * Deterministic transaction type inferred from text semantics.
   * Null if ambiguous or unspecified.
   */
  readonly type: 'INCOME' | 'EXPENSE' | null;

  /**
   * Exact monetary string extracted from text (e.g., "85000", "4.50").
   * MANDATORY INVARIANT: Must NEVER be a JavaScript number.
   * Null if amount is missing or ambiguous.
   */
  readonly amount: string | null;

  /**
   * Standard 3-letter ISO-4217 uppercase currency code (e.g., "VND", "USD").
   * Null if unspecified.
   */
  readonly currency_code: string | null;

  /**
   * Opaque candidate token matching user's active accounts (e.g., "ACC_1").
   * Null if no high-confidence match found among supplied candidates.
   */
  readonly account_token: string | null;

  /**
   * Opaque candidate token matching user's active categories (e.g., "CAT_1").
   * Null if no high-confidence match found among supplied candidates.
   */
  readonly category_token: string | null;

  /**
   * Opaque candidate token matching user's active income sources (e.g., "SRC_1").
   * Null if no high-confidence match or if type=EXPENSE.
   */
  readonly income_source_token: string | null;

  /**
   * Opaque candidate token matching user's active income streams (e.g., "STR_1").
   * Null if no high-confidence match or if type=EXPENSE.
   */
  readonly income_source_stream_token: string | null;

  /**
   * Cleaned merchant or counterparty name (max 100 chars).
   */
  readonly merchant: string | null;

  /**
   * Extracted note or description details (max 255 chars).
   */
  readonly note: string | null;

  /**
   * Date in ISO format 'YYYY-MM-DD'.
   * Calculated relative to trusted server temporal context.
   * Null if ambiguous or unparseable.
   */
  readonly occurred_on: string | null;

  /**
   * Any leftover text that could not be parsed into structured fields (max 255 chars).
   */
  readonly unmatched_text: string | null;
}

/**
 * Bounded server-validated warning codes emitted in ParsedTransactionDraft.
 */
export type TransactionDraftWarningCode =
  | 'TYPE_MISSING'
  | 'AMOUNT_MISSING'
  | 'AMOUNT_INVALID'
  | 'CURRENCY_INFERRED'
  | 'CURRENCY_INVALID'
  | 'ACCOUNT_NOT_MATCHED'
  | 'ACCOUNT_CURRENCY_CONFLICT'
  | 'ACCOUNT_CANDIDATES_OMITTED'
  | 'CATEGORY_NOT_MATCHED'
  | 'CATEGORY_TYPE_CONFLICT'
  | 'CATEGORY_CANDIDATES_OMITTED'
  | 'DATE_MISSING'
  | 'DATE_AMBIGUOUS'
  | 'DATE_YEAR_INFERRED'
  | 'INCOME_SOURCE_NOT_MATCHED'
  | 'INCOME_SOURCE_CANDIDATES_OMITTED'
  | 'INCOME_STREAM_NOT_MATCHED'
  | 'INCOME_STREAM_PARENT_CONFLICT'
  | 'INCOME_STREAM_CANDIDATES_OMITTED'
  | 'UNKNOWN_MODEL_TOKEN'
  | 'MODEL_FIELD_INVALID';

/**
 * Sanitized, cross-validated draft DTO returned to client UI.
 * Contains real UUIDs mapped from opaque tokens, exact string decimal amount,
 * and deterministic server warning codes.
 */
export interface ParsedTransactionDraft {
  readonly type: 'INCOME' | 'EXPENSE' | null;
  readonly amount: string | null;
  readonly currency_code: string | null;

  /** Validated real UUID of user's active account (null if unmapped or conflict) */
  readonly account_id: string | null;

  /** Validated real UUID of user's active category (null if unmapped or conflict) */
  readonly category_id: string | null;

  /** Validated real UUID of user's active income source (null if unmapped or type=EXPENSE) */
  readonly income_source_id: string | null;

  /** Validated real UUID of user's active income stream (null if unmapped or parent mismatch) */
  readonly income_source_stream_id: string | null;

  readonly merchant: string | null;
  readonly note: string | null;
  readonly occurred_on: string | null;

  /** Bounded, deterministic warning codes generated exclusively by the server */
  readonly warning_codes: readonly TransactionDraftWarningCode[];

  readonly unmatched_text: string | null;
}

export interface CandidateAccount {
  readonly id: string;
  readonly token: string;
  readonly label: string;
  readonly currency_code: CurrencyCode;
  readonly is_archived: boolean;
}

export interface CandidateCategory {
  readonly id: string;
  readonly token: string;
  readonly label: string;
  readonly type: 'INCOME' | 'EXPENSE';
  readonly is_archived: boolean;
}

export interface CandidateIncomeSource {
  readonly id: string;
  readonly token: string;
  readonly label: string;
  readonly is_archived: boolean;
}

export interface CandidateIncomeStream {
  readonly id: string;
  readonly income_source_id: string;
  readonly token: string;
  readonly label: string;
  readonly is_archived: boolean;
}

export interface OpaqueCandidateContext {
  readonly accounts: readonly CandidateAccount[];
  readonly categories: readonly CandidateCategory[];
  readonly incomeSources: readonly CandidateIncomeSource[];
  readonly incomeStreams: readonly CandidateIncomeStream[];
  readonly accountsOmitted: boolean;
  readonly categoriesOmitted: boolean;
  readonly incomeSourcesOmitted: boolean;
  readonly incomeStreamsOmitted: boolean;
}

export interface ParseTransactionDraftSuccess {
  readonly ok: true;
  readonly draft: ParsedTransactionDraft;
  readonly rawText: string;
}

export interface ParseTransactionDraftFailure {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type ParseTransactionDraftResult =
  | ParseTransactionDraftSuccess
  | ParseTransactionDraftFailure;

/**
 * Structured privacy-safe timing instrumentation event.
 * Contains ZERO sensitive data (no prompts, UUIDs, credentials, emails, or labels).
 */
export interface AiTimingTelemetry {
  readonly event: 'FINORA_AI_TIMING';
  readonly operation: 'transaction_parser';
  readonly success: boolean;
  readonly context_ms: number;
  readonly ai_provider_ms: number;
  readonly revalidation_ms: number;
  readonly total_ms: number;
  readonly warning_count?: number;
  readonly error_code?: string;
}
