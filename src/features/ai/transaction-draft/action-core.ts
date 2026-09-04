import 'server-only';

/**
 * Finora AI Feature Module — Testable Action Core Logic
 * Phase 12A — Transaction Draft Orchestration Engine
 *
 * Invariants:
 * 1. Zero Financial Mutation Authority:
 *    This module NEVER mutates transactions, transfers, accounts, or financial tables.
 *    PHASE_12A_AI_FINANCIAL_WRITE_CAPABILITY=false.
 * 2. Strict Input Validation:
 *    Empty prompt or prompt > 300 characters fails closed with AI_INVALID_REQUEST.
 * 3. Strict Auth Enforcement:
 *    Missing or invalid user ID fails closed with AUTH_REQUIRED.
 * 4. Error Sanitization:
 *    Maps internal AI error codes to clear, safe Vietnamese user messages.
 * 5. Full Testability:
 *    Accepts injected SupabaseClient, AiRouter, and AiCredentialProvider for 100%
 *    deterministic testing without live network calls.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiCredentialProvider } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import { readCandidateContext } from './candidates';
import { crossValidateTransactionDraft } from './domain';
import { buildTransactionParserPrompt } from './prompt';
import type { ParseTransactionDraftResult } from './types';
import { aiTransactionParseOutputValidator } from './validator';

export const AI_ERROR_MESSAGES: Record<string, string> = {
  AI_NOT_CONFIGURED:
    'Hệ thống AI chưa được cấu hình. Vui lòng liên hệ quản trị viên hoặc thiết lập API key cá nhân.',
  AI_AUTH_FAILED:
    'Xác thực API AI không thành công. Khóa API có thể đã hết hạn hoặc không hợp lệ.',
  AI_RATE_LIMITED:
    'Đã vượt quá giới hạn lượt gọi AI. Vui lòng thử lại sau vài giây.',
  AI_QUOTA_EXHAUSTED:
    'Hạn ngạch AI đã sử dụng hết. Vui lòng kiểm tra gói dịch vụ hoặc cập nhật API key.',
  AI_TIMEOUT:
    'Yêu cầu AI đã hết thời gian phản hồi (15s). Vui lòng thử lại.',
  AI_INVALID_REQUEST:
    'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại nội dung.',
  AI_STRUCTURED_OUTPUT_INVALID:
    'Mô hình AI không thể xuất dữ liệu đúng cấu trúc yêu cầu. Vui lòng thử lại.',
  AI_PROVIDER_UNAVAILABLE:
    'Nhà cung cấp AI tạm thời không phản hồi. Vui lòng thử lại sau.',
  AI_OPERATION_DISABLED:
    'Tính năng phân tích giao dịch bằng AI hiện đang tạm tắt.',
  AI_SAFETY_BLOCKED:
    'Nội dung bị chặn bởi bộ lọc an toàn của mô hình.',
};

export const DEFAULT_AI_ERROR_MESSAGE =
  'Không thể xử lý yêu cầu AI. Vui lòng nhập giao dịch thủ công.';

export function getLocalizedAiErrorMessage(code: string): string {
  return AI_ERROR_MESSAGES[code] || DEFAULT_AI_ERROR_MESSAGE;
}

export interface ParseTransactionTextCoreParams {
  readonly prompt: string;
  readonly userId: string;
  readonly supabase: SupabaseClient;
  readonly router: AiRouter;
  readonly credentialProvider: AiCredentialProvider;
  readonly now?: Date;
  readonly userSettings?: {
    readonly baseCurrency?: string;
    readonly timezone?: string;
    readonly locale?: string;
  };
}

export async function parseTransactionTextCore(
  params: ParseTransactionTextCoreParams
): Promise<ParseTransactionDraftResult> {
  // 1. Validate prompt text
  if (typeof params.prompt !== 'string' || params.prompt.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: 'AI_INVALID_REQUEST',
        message: 'Nội dung yêu cầu không được để trống.',
      },
    };
  }

  const promptText = params.prompt.trim();
  if (promptText.length > 300) {
    return {
      ok: false,
      error: {
        code: 'AI_INVALID_REQUEST',
        message: 'Nội dung yêu cầu không được vượt quá 300 ký tự.',
      },
    };
  }

  // 2. Validate authentication context
  if (
    typeof params.userId !== 'string' ||
    params.userId.trim().length === 0
  ) {
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      },
    };
  }

  // 3. Resolve user settings (base currency, timezone, locale)
  let baseCurrency = params.userSettings?.baseCurrency;
  let timezone = params.userSettings?.timezone;
  let locale = params.userSettings?.locale;

  if (!baseCurrency || !timezone || !locale) {
    try {
      const { data: settingsData } = await params.supabase
        .from('user_settings')
        .select('base_currency, timezone, locale')
        .eq('user_id', params.userId)
        .maybeSingle();

      if (settingsData) {
        baseCurrency = baseCurrency || settingsData.base_currency;
        timezone = timezone || settingsData.timezone;
        locale = locale || settingsData.locale;
      }
    } catch {
      // Fall back to standard defaults if settings lookup fails
    }
  }

  const resolvedSettings = {
    baseCurrency: baseCurrency || 'VND',
    timezone: timezone || 'Asia/Ho_Chi_Minh',
    locale: locale || 'vi-VN',
  };

  // 4. Read candidates via authenticated RLS
  const candidates = await readCandidateContext(params.supabase, params.userId);

  // 5. Build prompt & system instruction
  const { prompt, systemInstruction } = buildTransactionParserPrompt({
    promptText,
    candidates,
    userSettings: resolvedSettings,
    now: params.now,
  });

  // 6. Execute router
  const result = await params.router.execute<unknown, any>(
    {
      operation: 'transaction_parser',
      prompt,
      systemInstruction,
      responseMode: 'structured',
      outputValidator: aiTransactionParseOutputValidator,
      temperature: 0.1,
      maxTokens: 1024,
    },
    {
      userId: params.userId,
      credentialProvider: params.credentialProvider,
      timeoutMs: 15000,
    }
  );

  // 7. Handle failure
  if (!result.ok) {
    const code = result.error.code;
    return {
      ok: false,
      error: {
        code,
        message: getLocalizedAiErrorMessage(code),
      },
    };
  }

  // 8. Cross-validate raw output into safe application draft
  const draft = crossValidateTransactionDraft({
    rawOutput: result.data,
    candidates,
    baseCurrency: resolvedSettings.baseCurrency,
  });

  return {
    ok: true,
    draft,
    rawText: promptText,
  };
}
