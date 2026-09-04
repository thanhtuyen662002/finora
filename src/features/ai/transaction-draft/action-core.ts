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
 * 4. Error Sanitization & Exact Taxonomy:
 *    Maps internal Phase 10 AiErrorCodes to clear, safe Vietnamese user messages.
 * 5. Bounded & Fail-Closed Context:
 *    Database read errors fail closed immediately (CONTEXT_LOAD_FAILED).
 * 6. Central Config Authority:
 *    Reuses central AI_OPERATION_CONFIG for model/timeout/tokens/temperature.
 * 7. Post-AI Stale Revalidation:
 *    Re-reads matched entities to ensure state validity before returning draft.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AiErrorCode } from '@/lib/ai/errors';
import type { AiCredentialProvider } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import { readCandidateContext } from './candidates';
import {
  crossValidateTransactionDraft,
  revalidateResolvedCandidates,
} from './domain';
import { tryDeterministicFastPath } from './fast-path';
import { buildTransactionParserPrompt } from './prompt';
import {
  isSupportedCurrencyCode,
  type ParseTransactionDraftResult,
  type AiTimingTelemetry,
} from './types';
import { aiTransactionParseOutputValidator } from './validator';

export { type AiTimingTelemetry };

export function emitTimingTelemetry(
  telemetry: AiTimingTelemetry,
  onTiming?: (timing: AiTimingTelemetry) => void
): void {
  try {
    if (onTiming) {
      onTiming(telemetry);
    }
  } catch {
    // Ignore callback errors
  }
  console.info(JSON.stringify(telemetry));
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED:
    'Hệ thống AI chưa được cấu hình. Vui lòng liên hệ quản trị viên hoặc thiết lập API key cá nhân.',
  AI_PROVIDER_UNAVAILABLE:
    'Nhà cung cấp AI tạm thời không phản hồi. Vui lòng thử lại sau.',
  AI_AUTH_FAILED:
    'Xác thực API AI không thành công. Khóa API có thể đã hết hạn hoặc không hợp lệ.',
  AI_RATE_LIMITED:
    'Đã vượt quá giới hạn lượt gọi AI. Vui lòng thử lại sau vài giây.',
  AI_TIMEOUT:
    'Yêu cầu AI đã hết thời gian phản hồi. Vui lòng thử lại.',
  AI_ABORTED:
    'Yêu cầu AI đã bị hủy.',
  AI_INVALID_REQUEST:
    'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại nội dung.',
  AI_INVALID_RESPONSE:
    'Nhận được phản hồi không hợp lệ từ dịch vụ AI. Vui lòng thử lại.',
  AI_STRUCTURED_OUTPUT_INVALID:
    'Mô hình AI không thể xuất dữ liệu đúng cấu trúc yêu cầu. Vui lòng thử lại.',
  AI_PROVIDER_ERROR:
    'Đã xảy ra lỗi từ nhà cung cấp dịch vụ AI. Vui lòng thử lại sau.',
  AI_CREDENTIAL_CORRUPTED:
    'Khóa API AI lưu trữ bị lỗi dữ liệu mã hóa. Vui lòng cấu hình lại khóa.',
  AI_CREDENTIAL_KEY_UNAVAILABLE:
    'Khóa giải mã hệ thống hiện không khả dụng. Vui lòng thử lại sau.',
  AI_CREDENTIAL_RESOLUTION_FAILED:
    'Không thể giải quyết thông tin xác thực AI. Vui lòng thử lại sau.',
};

export const FEATURE_ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  CONTEXT_LOAD_FAILED:
    'Không thể tải dữ liệu tài khoản và danh mục. Vui lòng thử lại sau hoặc nhập thủ công.',
};

export const DEFAULT_AI_ERROR_MESSAGE =
  'Không thể xử lý yêu cầu AI. Vui lòng nhập giao dịch thủ công.';

export function getLocalizedAiErrorMessage(code: string): string {
  if (code in AI_ERROR_MESSAGES) {
    return AI_ERROR_MESSAGES[code as AiErrorCode];
  }
  if (code in FEATURE_ERROR_MESSAGES) {
    return FEATURE_ERROR_MESSAGES[code as keyof typeof FEATURE_ERROR_MESSAGES];
  }
  return DEFAULT_AI_ERROR_MESSAGE;
}

export interface ParseTransactionTextCoreParams {
  readonly prompt: string;
  readonly userId: string;
  readonly supabase: SupabaseClient<Database>;
  readonly router?: AiRouter;
  readonly credentialProvider?: AiCredentialProvider;
  readonly getRouter?: () => AiRouter;
  readonly getCredentialProvider?: () => AiCredentialProvider;
  readonly now?: Date;
  readonly userSettings?: {
    readonly baseCurrency?: string;
    readonly timezone?: string;
    readonly locale?: string;
  };
  readonly onTiming?: (telemetry: AiTimingTelemetry) => void;
  readonly skipFastPath?: boolean;
}

export async function parseTransactionTextCore(
  params: ParseTransactionTextCoreParams
): Promise<ParseTransactionDraftResult> {
  const totalStart = performance.now();

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
        message: FEATURE_ERROR_MESSAGES.AUTH_REQUIRED,
      },
    };
  }

  // 3. Pre-AI Context: Read user settings and candidate context concurrently
  const contextStart = performance.now();

  let baseCurrency = params.userSettings?.baseCurrency;
  let timezone = params.userSettings?.timezone;
  let locale = params.userSettings?.locale;

  const needSettingsQuery = !baseCurrency || !timezone || !locale;
  const settingsPromise = needSettingsQuery
    ? params.supabase
        .from('user_settings')
        .select('base_currency, timezone, locale')
        .eq('user_id', params.userId)
        .maybeSingle()
    : Promise.resolve(null);

  const candidatesPromise = readCandidateContext(params.supabase, params.userId);

  let settingsRes;
  let candidates;
  try {
    const [sRes, cRes] = await Promise.all([settingsPromise, candidatesPromise]);
    settingsRes = sRes;
    candidates = cRes;
  } catch (_err) {
    const contextMs = Math.round(performance.now() - contextStart);
    const totalMs = Math.round(performance.now() - totalStart);
    emitTimingTelemetry(
      {
        event: 'FINORA_AI_TIMING',
        operation: 'transaction_parser',
        success: false,
        context_ms: contextMs,
        ai_provider_ms: 0,
        revalidation_ms: 0,
        total_ms: totalMs,
        error_code: 'CONTEXT_LOAD_FAILED',
      },
      params.onTiming
    );

    return {
      ok: false,
      error: {
        code: 'CONTEXT_LOAD_FAILED',
        message: FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED,
      },
    };
  }

  if (settingsRes && 'error' in settingsRes && settingsRes.error) {
    const contextMs = Math.round(performance.now() - contextStart);
    const totalMs = Math.round(performance.now() - totalStart);
    emitTimingTelemetry(
      {
        event: 'FINORA_AI_TIMING',
        operation: 'transaction_parser',
        success: false,
        context_ms: contextMs,
        ai_provider_ms: 0,
        revalidation_ms: 0,
        total_ms: totalMs,
        error_code: 'CONTEXT_LOAD_FAILED',
      },
      params.onTiming
    );

    return {
      ok: false,
      error: {
        code: 'CONTEXT_LOAD_FAILED',
        message: FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED,
      },
    };
  }

  if (settingsRes && 'data' in settingsRes && settingsRes.data) {
    baseCurrency = baseCurrency || settingsRes.data.base_currency;
    timezone = timezone || settingsRes.data.timezone;
    locale = locale || settingsRes.data.locale;
  }

  const safeBaseCurrency =
    baseCurrency && isSupportedCurrencyCode(baseCurrency)
      ? baseCurrency
      : 'VND';

  const resolvedSettings = {
    baseCurrency: safeBaseCurrency,
    timezone: timezone || 'Asia/Ho_Chi_Minh',
    locale: locale || 'vi-VN',
  };

  const contextMs = Math.round(performance.now() - contextStart);

  // 4. Deterministic Fast Path (Phase 12A)
  if (!params.skipFastPath) {
    const fastPathStart = performance.now();
    const fastPathResult = tryDeterministicFastPath({
      text: promptText,
      candidates,
      baseCurrency: resolvedSettings.baseCurrency,
      timezone: resolvedSettings.timezone,
      locale: resolvedSettings.locale,
      now: params.now,
    });
    const fastPathMs = Math.round(performance.now() - fastPathStart);

    if (fastPathResult.eligible && fastPathResult.output) {
      const draft = crossValidateTransactionDraft({
        rawOutput: fastPathResult.output,
        candidates,
        baseCurrency: resolvedSettings.baseCurrency,
      });

      const revalidationStart = performance.now();
      try {
        const revalidatedDraft = await revalidateResolvedCandidates(
          params.supabase,
          params.userId,
          draft
        );
        const revalidationMs = Math.round(performance.now() - revalidationStart);
        const totalMs = Math.round(performance.now() - totalStart);

        emitTimingTelemetry(
          {
            event: 'FINORA_AI_TIMING',
            operation: 'transaction_parser',
            execution_path: 'deterministic',
            fast_path_ms: fastPathMs,
            success: true,
            context_ms: contextMs,
            ai_provider_ms: 0,
            revalidation_ms: revalidationMs,
            total_ms: totalMs,
            warning_count: revalidatedDraft.warning_codes.length,
          },
          params.onTiming
        );

        return {
          ok: true,
          draft: revalidatedDraft,
          rawText: promptText,
          parse_source: 'DETERMINISTIC',
        };
      } catch (_err: unknown) {
        const revalidationMs = Math.round(performance.now() - revalidationStart);
        const totalMs = Math.round(performance.now() - totalStart);

        emitTimingTelemetry(
          {
            event: 'FINORA_AI_TIMING',
            operation: 'transaction_parser',
            execution_path: 'deterministic',
            fast_path_ms: fastPathMs,
            success: false,
            context_ms: contextMs,
            ai_provider_ms: 0,
            revalidation_ms: revalidationMs,
            total_ms: totalMs,
            error_code: 'CONTEXT_LOAD_FAILED',
          },
          params.onTiming
        );

        return {
          ok: false,
          error: {
            code: 'CONTEXT_LOAD_FAILED',
            message: FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED,
          },
        };
      }
    }
  }

  // 5. Fallback to Gemini AI Router (requires lazy initialization of credentials/router)
  const router = params.router ?? params.getRouter?.();
  const credentialProvider = params.credentialProvider ?? params.getCredentialProvider?.();

  if (!router || !credentialProvider) {
    const totalMs = Math.round(performance.now() - totalStart);
    emitTimingTelemetry(
      {
        event: 'FINORA_AI_TIMING',
        operation: 'transaction_parser',
        execution_path: 'gemini',
        success: false,
        context_ms: contextMs,
        ai_provider_ms: 0,
        revalidation_ms: 0,
        total_ms: totalMs,
        error_code: 'AI_NOT_CONFIGURED',
      },
      params.onTiming
    );

    return {
      ok: false,
      error: {
        code: 'AI_NOT_CONFIGURED',
        message: AI_ERROR_MESSAGES.AI_NOT_CONFIGURED,
      },
    };
  }

  // 6. Build prompt & system instruction for Gemini fallback
  const { prompt, systemInstruction } = buildTransactionParserPrompt({
    promptText,
    candidates,
    userSettings: resolvedSettings,
    now: params.now,
  });

  // 7. Execute router — Central AI operation config is authority; no duplicate parameters passed
  const aiStart = performance.now();
  const result = await router.execute<unknown, any>(
    {
      operation: 'transaction_parser',
      prompt,
      systemInstruction,
      responseMode: 'structured',
      outputValidator: aiTransactionParseOutputValidator,
    },
    {
      userId: params.userId,
      credentialProvider,
    }
  );
  const aiProviderMs = Math.round(performance.now() - aiStart);

  // 8. Handle failure
  if (!result.ok) {
    const code = result.error.code;
    const totalMs = Math.round(performance.now() - totalStart);
    emitTimingTelemetry(
      {
        event: 'FINORA_AI_TIMING',
        operation: 'transaction_parser',
        execution_path: 'gemini',
        success: false,
        context_ms: contextMs,
        ai_provider_ms: aiProviderMs,
        revalidation_ms: 0,
        total_ms: totalMs,
        error_code: code,
      },
      params.onTiming
    );

    return {
      ok: false,
      error: {
        code,
        message: getLocalizedAiErrorMessage(code),
      },
    };
  }

  // 9. Cross-validate raw output into safe application draft
  const draft = crossValidateTransactionDraft({
    rawOutput: result.data,
    candidates,
    baseCurrency: resolvedSettings.baseCurrency,
  });

  // 10. Post-AI Stale Revalidation (re-read resolved entities concurrently via authenticated RLS client)
  const revalidationStart = performance.now();
  try {
    const revalidatedDraft = await revalidateResolvedCandidates(
      params.supabase,
      params.userId,
      draft
    );
    const revalidationMs = Math.round(performance.now() - revalidationStart);
    const totalMs = Math.round(performance.now() - totalStart);

    emitTimingTelemetry(
      {
        event: 'FINORA_AI_TIMING',
        operation: 'transaction_parser',
        execution_path: 'gemini',
        success: true,
        context_ms: contextMs,
        ai_provider_ms: aiProviderMs,
        revalidation_ms: revalidationMs,
        total_ms: totalMs,
        warning_count: revalidatedDraft.warning_codes.length,
      },
      params.onTiming
    );

    return {
      ok: true,
      draft: revalidatedDraft,
      rawText: promptText,
      parse_source: 'AI',
    };
  } catch (_err: unknown) {
    const revalidationMs = Math.round(performance.now() - revalidationStart);
    const totalMs = Math.round(performance.now() - totalStart);

    emitTimingTelemetry(
      {
        event: 'FINORA_AI_TIMING',
        operation: 'transaction_parser',
        execution_path: 'gemini',
        success: false,
        context_ms: contextMs,
        ai_provider_ms: aiProviderMs,
        revalidation_ms: revalidationMs,
        total_ms: totalMs,
        error_code: 'CONTEXT_LOAD_FAILED',
      },
      params.onTiming
    );

    return {
      ok: false,
      error: {
        code: 'CONTEXT_LOAD_FAILED',
        message: FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED,
      },
    };
  }
}

export interface ParseTransactionDraftActionDeps {
  readonly getSupabaseClient?: () => Promise<any>;
  readonly createAiCredentialRepository?: () => any;
  readonly createAiCredentialResolver?: (options: { repository: any }) => any;
  readonly createDefaultServerRouter?: () => any;
}

/**
 * Non-client-callable internal helper for tests requiring dependency injection.
 * Never exposed via 'use server' boundary.
 */
export async function runParseTransactionDraftAction(
  prompt: string,
  deps: ParseTransactionDraftActionDeps
): Promise<ParseTransactionDraftResult> {
  const getClient = deps.getSupabaseClient;
  if (!getClient) {
    throw new Error('getSupabaseClient is required for test execution');
  }
  const supabase = await getClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      },
    };
  }

  const repoFactory = deps.createAiCredentialRepository;
  const resolverFactory = deps.createAiCredentialResolver;
  const routerFactory = deps.createDefaultServerRouter;

  return parseTransactionTextCore({
    prompt,
    userId: user.id,
    supabase,
    getRouter: () => {
      if (!routerFactory) throw new Error('routerFactory is required');
      return routerFactory();
    },
    getCredentialProvider: () => {
      if (!repoFactory || !resolverFactory) throw new Error('credential factories required');
      const repository = repoFactory();
      return resolverFactory({ repository });
    },
  });
}

