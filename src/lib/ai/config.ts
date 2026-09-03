/**
 * Finora AI Foundation — Central Operation & Model Configuration
 * Phase 10 — Centralized Configuration Boundary
 *
 * Model names and provider mappings live exclusively in this module.
 * Domain/UI components must never hardcode vendor model identifiers.
 */

import type { AiModelConfig, AiOperation } from './types';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const AI_OPERATION_CONFIG: Record<string, AiModelConfig> = {
  transaction_parser: {
    providerId: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    timeoutMs: 15000,
    temperature: 0.1,
    maxOutputTokens: 1024,
  },
  categorization: {
    providerId: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    timeoutMs: 10000,
    temperature: 0.1,
    maxOutputTokens: 512,
  },
  financial_assistant: {
    providerId: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    timeoutMs: 30000,
    temperature: 0.3,
    maxOutputTokens: 2048,
  },
  receipt_vision: {
    providerId: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    timeoutMs: 25000,
    temperature: 0.1,
    maxOutputTokens: 2048,
  },
  report_summary: {
    providerId: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    timeoutMs: 20000,
    temperature: 0.2,
    maxOutputTokens: 2048,
  },
};

export function getOperationConfig(operation: AiOperation): AiModelConfig | undefined {
  return AI_OPERATION_CONFIG[operation];
}
