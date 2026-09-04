import 'server-only';

/**
 * Finora AI Receipt Vision — Action Core
 * Phase 12B — Multimodal Vision Execution Core & Orchestration
 *
 * Dependency-injected core logic for 100% deterministic, zero-network unit testing.
 * Strictly separates authentication, image normalization, provider dispatch, and validation.
 */

import type { AiCredentialProvider } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import type { AiErrorCode } from '@/lib/ai/errors';
import { canonicalizeReceiptAmount } from './money';
import { RECEIPT_VISION_PROMPT, RECEIPT_VISION_SYSTEM_INSTRUCTION } from './prompt';
import { ReceiptVisionOutputValidator } from './validator';
import {
  ReceiptImageError,
  type NormalizedReceiptImage,
  type normalizeReceiptImage,
} from './image';
import type {
  ReceiptVisionActionResult,
  ReceiptVisionErrorCode,
  ReceiptVisionExtractionResult,
} from './types';

export interface ReceiptVisionCoreDeps {
  readonly router: AiRouter;
  readonly credentialProvider: AiCredentialProvider;
  readonly normalizeImage: typeof normalizeReceiptImage;
}

const AI_TO_RECEIPT_ERROR_MAP: Record<AiErrorCode, { code: ReceiptVisionErrorCode; message: string }> = {
  AI_NOT_CONFIGURED: {
    code: 'AI_NOT_CONFIGURED',
    message: 'Chưa cấu hình API key AI. Vui lòng cấu hình API key cá nhân hoặc liên hệ quản trị viên.',
  },
  AI_PROVIDER_UNAVAILABLE: {
    code: 'AI_PROVIDER_UNAVAILABLE',
    message: 'Dịch vụ AI hiện không khả dụng. Vui lòng thử lại sau.',
  },
  AI_AUTH_FAILED: {
    code: 'AI_AUTH_FAILED',
    message: 'Xác thực với dịch vụ AI không thành công. Vui lòng kiểm tra lại API key.',
  },
  AI_RATE_LIMITED: {
    code: 'AI_RATE_LIMITED',
    message: 'Đã vượt quá giới hạn lượt gọi AI. Vui lòng thử lại sau giây lát.',
  },
  AI_TIMEOUT: {
    code: 'AI_TIMEOUT',
    message: 'Thời gian xử lý ảnh quá lâu. Vui lòng thử lại với ảnh rõ nét hơn.',
  },
  AI_ABORTED: {
    code: 'AI_ABORTED',
    message: 'Yêu cầu phân tích ảnh đã bị hủy.',
  },
  AI_INVALID_REQUEST: {
    code: 'AI_INVALID_REQUEST',
    message: 'Yêu cầu phân tích không hợp lệ.',
  },
  AI_INVALID_RESPONSE: {
    code: 'AI_INVALID_RESPONSE',
    message: 'Phản hồi từ dịch vụ AI không hợp lệ.',
  },
  AI_STRUCTURED_OUTPUT_INVALID: {
    code: 'AI_STRUCTURED_OUTPUT_INVALID',
    message: 'Dữ liệu trích xuất từ hóa đơn không khớp với cấu trúc mong đợi.',
  },
  AI_PROVIDER_ERROR: {
    code: 'AI_PROVIDER_ERROR',
    message: 'Đã xảy ra lỗi từ nhà cung cấp AI khi phân tích hóa đơn.',
  },
  AI_CREDENTIAL_CORRUPTED: {
    code: 'AI_CREDENTIAL_CORRUPTED',
    message: 'Thông tin xác thực AI bị lỗi. Vui lòng lưu lại API key.',
  },
  AI_CREDENTIAL_KEY_UNAVAILABLE: {
    code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
    message: 'Khóa giải mã API key không khả dụng.',
  },
  AI_CREDENTIAL_RESOLUTION_FAILED: {
    code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
    message: 'Không thể giải mã API key AI.',
  },
};

/**
 * Executes Receipt Vision analysis core with injected dependencies.
 */
export async function executeReceiptVisionCore(
  fileBytes: Uint8Array | Buffer,
  fileMeta: { name?: string; type?: string; size?: number },
  user: { id: string } | null | undefined,
  deps: ReceiptVisionCoreDeps
): Promise<ReceiptVisionActionResult> {
  // 1. Authentication check precedes all operations
  if (!user || !user.id || user.id.trim() === '') {
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Bạn cần đăng nhập để sử dụng tính năng phân tích hóa đơn.',
      },
    };
  }

  // 2. Normalize image boundedly
  let normalizedImage: NormalizedReceiptImage;
  try {
    normalizedImage = await deps.normalizeImage(fileBytes, fileMeta);
  } catch (err: unknown) {
    if (err instanceof ReceiptImageError) {
      return {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'RECEIPT_IMAGE_DECODE_FAILED',
        message: 'Lỗi không xác định khi xử lý ảnh hóa đơn.',
      },
    };
  }

  // 3. Dispatch structured multimodal request via AiRouter
  const aiResult = await deps.router.execute(
    {
      operation: 'receipt_vision',
      prompt: RECEIPT_VISION_PROMPT,
      systemInstruction: RECEIPT_VISION_SYSTEM_INSTRUCTION,
      media: [
        {
          kind: 'inline_image',
          mimeType: normalizedImage.mimeType,
          bytes: normalizedImage.bytes,
        },
      ],
      responseMode: 'structured',
      outputValidator: ReceiptVisionOutputValidator,
    },
    {
      userId: user.id,
      credentialProvider: deps.credentialProvider,
    }
  );

  if (!aiResult.ok) {
    const errorCode = aiResult.error.code as AiErrorCode;
    const errorMapping = (errorCode in AI_TO_RECEIPT_ERROR_MAP ? AI_TO_RECEIPT_ERROR_MAP[errorCode] : undefined) || {
      code: 'AI_PROVIDER_ERROR',
      message: 'Không thể phân tích ảnh hóa đơn. Vui lòng thử lại.',
    };

    return {
      ok: false,
      error: {
        code: errorMapping.code,
        message: errorMapping.message,
      },
    };
  }

  const output = aiResult.data;

  // 4. Exact-money canonicalization if amount is present
  let canonicalAmount: string | null = null;
  if (output.amount !== null && output.amount_state === 'PRESENT') {
    try {
      canonicalAmount = canonicalizeReceiptAmount(output.amount);
    } catch {
      return {
        ok: false,
        error: {
          code: 'AI_STRUCTURED_OUTPUT_INVALID',
          message: 'Số tiền trên hóa đơn không thể chuẩn hóa thành định dạng số tiền hợp lệ.',
        },
      };
    }
  }

  const extractionResult: ReceiptVisionExtractionResult = {
    document_kind: output.document_kind,
    merchant: output.merchant,
    occurred_on: output.occurred_on,
    occurred_on_state: output.occurred_on_state,
    amount: output.amount,
    canonical_amount: canonicalAmount,
    amount_state: output.amount_state,
    currency_code: output.currency_code,
    currency_state: output.currency_state,
    category_token: output.category_token,
    note: output.note,
    image_quality: output.image_quality,
  };

  return {
    ok: true,
    data: extractionResult,
    provider: aiResult.provider,
    model: aiResult.model,
  };
}
