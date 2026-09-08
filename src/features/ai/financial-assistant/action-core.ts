import 'server-only';

import type { AiCredentialProvider } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import { AiError } from '@/lib/ai/errors';
import { sanitizeFinancialReportSnapshot } from './context';
import { FinancialAssistantError, FINANCIAL_ASSISTANT_MESSAGES } from './errors';
import { buildFinancialAssistantPrompt } from './prompt';
import type {
  FinancialAssistantMode,
  FinancialAssistantResult,
  FinancialReportSnapshot,
} from './types';

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const MAX_RESPONSE_LENGTH = 4_000;

function safeError(code: FinancialAssistantError['code']): FinancialAssistantResult {
  return { ok: false, code, error: FINANCIAL_ASSISTANT_MESSAGES[code] };
}

function normalizeResponse(value: unknown): string {
  if (typeof value !== 'string') throw new FinancialAssistantError('AI_INVALID_RESPONSE');
  const text = value.replace(/```(?:text|markdown)?/gi, '').trim();
  if (!text || text.length > MAX_RESPONSE_LENGTH || UUID_PATTERN.test(text)) {
    throw new FinancialAssistantError('AI_INVALID_RESPONSE');
  }
  return text;
}

export interface FinancialAssistantCoreParams {
  readonly userId: string;
  readonly mode: FinancialAssistantMode;
  readonly question?: string;
  readonly snapshot: unknown;
  readonly router: AiRouter;
  readonly credentialProvider: AiCredentialProvider;
}

export async function runFinancialAssistantCore(
  params: FinancialAssistantCoreParams
): Promise<FinancialAssistantResult> {
  if (!params.userId.trim()) return safeError('AUTH_REQUIRED');
  if (params.mode === 'QUESTION' && (!params.question || !params.question.trim())) {
    return safeError('INVALID_REQUEST');
  }

  let snapshot: FinancialReportSnapshot;
  try {
    snapshot = sanitizeFinancialReportSnapshot(params.snapshot);
  } catch (error) {
    if (error instanceof FinancialAssistantError) return safeError(error.code);
    return safeError('INVALID_CONTEXT');
  }

  let prompt;
  try {
    prompt = buildFinancialAssistantPrompt({
      mode: params.mode,
      question: params.question,
      snapshot,
    });
  } catch {
    return safeError('INVALID_REQUEST');
  }

  const result = await params.router.execute({
    operation: params.mode === 'REPORT_SUMMARY' ? 'report_summary' : 'financial_assistant',
    prompt: prompt.prompt,
    systemInstruction: prompt.systemInstruction,
  }, {
    userId: params.userId,
    credentialProvider: params.credentialProvider,
  });

  if (!result.ok) {
    if (result.error instanceof AiError) {
      if (result.error.code === 'AI_NOT_CONFIGURED') return safeError('AI_NOT_CONFIGURED');
      if (result.error.code === 'AI_PROVIDER_UNAVAILABLE' || result.error.code === 'AI_TIMEOUT') {
        return safeError('AI_UNAVAILABLE');
      }
    }
    return safeError('AI_PROVIDER_ERROR');
  }

  try {
    return {
      ok: true,
      mode: params.mode,
      text: normalizeResponse(result.data),
    };
  } catch (error) {
    return error instanceof FinancialAssistantError
      ? safeError(error.code)
      : safeError('AI_INVALID_RESPONSE');
  }
}
