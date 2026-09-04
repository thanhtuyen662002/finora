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
import { buildTransactionParserPrompt } from './prompt';
import {
  isSupportedCurrencyCode,
  type ParseTransactionDraftResult,
} from './types';
import { aiTransactionParseOutputValidator } from './validator';

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
        message: FEATURE_ERROR_MESSAGES.AUTH_REQUIRED,
      },
    };
  }

  // 3. Resolve user settings (base currency, timezone, locale)
  let baseCurrency = params.userSettings?.baseCurrency;
  let timezone = params.userSettings?.timezone;
  let locale = params.userSettings?.locale;

  if (!baseCurrency || !timezone || !locale) {
    const { data: settingsData, error: settingsError } = await params.supabase
      .from('user_settings')
      .select('base_currency, timezone, locale')
      .eq('user_id', params.userId)
      .maybeSingle();

    if (settingsError) {
      // Query error fails closed immediately
      return {
        ok: false,
        error: {
          code: 'CONTEXT_LOAD_FAILED',
          message: FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED,
        },
      };
    }

    if (settingsData) {
      baseCurrency = baseCurrency || settingsData.base_currency;
      timezone = timezone || settingsData.timezone;
      locale = locale || settingsData.locale;
    }
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

  // 4. Read candidates via authenticated RLS (fails closed on error)
  let candidates;
  try {
    candidates = await readCandidateContext(params.supabase, params.userId);
  } catch {
    return {
      ok: false,
      error: {
        code: 'CONTEXT_LOAD_FAILED',
        message: FEATURE_ERROR_MESSAGES.CONTEXT_LOAD_FAILED,
      },
    };
  }

  // 5. Build prompt & system instruction
  const { prompt, systemInstruction } = buildTransactionParserPrompt({
    promptText,
    candidates,
    userSettings: resolvedSettings,
    now: params.now,
  });

  // 6. Execute router — Central AI operation config is authority; no duplicate parameters passed
  const result = await params.router.execute<unknown, any>(
    {
      operation: 'transaction_parser',
      prompt,
      systemInstruction,
      responseMode: 'structured',
      outputValidator: aiTransactionParseOutputValidator,
    },
    {
      userId: params.userId,
      credentialProvider: params.credentialProvider,
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

  // 9. Post-AI Stale Revalidation (re-read resolved entities via authenticated RLS client)
  try {
    const revalidatedDraft = await revalidateResolvedCandidates(
      params.supabase,
      params.userId,
      draft
    );

    return {
      ok: true,
      draft: revalidatedDraft,
      rawText: promptText,
    };
  } catch (_err: unknown) {
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

  if (!repoFactory || !resolverFactory || !routerFactory) {
    throw new Error('All dependency factories must be provided for test execution');
  }

  const repository = repoFactory();
  const credentialProvider = resolverFactory({ repository });
  const router = routerFactory();

  return parseTransactionTextCore({
    prompt,
    userId: user.id,
    supabase,
    router,
    credentialProvider,
  });
}

