/**
 * Finora AI Foundation — Structured Result Runtime Validation
 * Phase 10 — Fail-Closed Validation Boundary
 *
 * LLM output is untrusted and must undergo deterministic runtime validation.
 * Direct typecasting without runtime checking is strictly prohibited.
 */

import { AiError } from './errors';
import type { AiOutputValidator, AiStructuredResult, AiUsage } from './types';

export function parseAndValidateJson<T>(
  rawText: string | undefined | null,
  validator: AiOutputValidator<T>,
  metadata: { provider: string; model: string; usage?: AiUsage }
): AiStructuredResult<T> {
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
    return {
      ok: false,
      error: new AiError({
        code: 'AI_INVALID_RESPONSE',
        message: 'AI provider returned an empty or missing response payload.',
        providerId: metadata.provider,
      }),
    };
  }

  // Strip potential markdown codeblock formatting if present (```json ... ```)
  let cleanText = rawText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err) {
    return {
      ok: false,
      error: new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: 'Failed to parse AI provider output as valid JSON.',
        providerId: metadata.provider,
        details: err instanceof Error ? err.message : String(err),
      }),
    };
  }

  try {
    const validatedData = validator.validate(parsed);
    return {
      ok: true,
      data: validatedData,
      provider: metadata.provider,
      model: metadata.model,
      usage: metadata.usage,
    };
  } catch (err) {
    return {
      ok: false,
      error: new AiError({
        code: 'AI_STRUCTURED_OUTPUT_INVALID',
        message: `AI structured output failed schema validation${validator.name ? ` for '${validator.name}'` : ''}.`,
        providerId: metadata.provider,
        details: err instanceof Error ? err.message : String(err),
      }),
    };
  }
}
