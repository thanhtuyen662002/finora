export type FinancialAssistantErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_REQUEST'
  | 'INVALID_CONTEXT'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'AI_PROVIDER_ERROR';

export const FINANCIAL_ASSISTANT_MESSAGES: Record<FinancialAssistantErrorCode, string> = {
  AUTH_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_REQUEST: 'Câu hỏi không hợp lệ hoặc vượt quá giới hạn cho phép.',
  INVALID_CONTEXT: 'Dữ liệu báo cáo không hợp lệ. Vui lòng tải lại báo cáo.',
  AI_NOT_CONFIGURED: 'Trợ lý AI chưa được cấu hình. Bạn vẫn có thể xem báo cáo thủ công.',
  AI_UNAVAILABLE: 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.',
  AI_INVALID_RESPONSE: 'Trợ lý AI trả về nội dung không hợp lệ. Vui lòng thử lại.',
  AI_PROVIDER_ERROR: 'Không thể tạo giải thích từ báo cáo lúc này. Vui lòng thử lại sau.',
};

export class FinancialAssistantError extends Error {
  readonly code: FinancialAssistantErrorCode;

  constructor(code: FinancialAssistantErrorCode) {
    super(FINANCIAL_ASSISTANT_MESSAGES[code]);
    this.name = 'FinancialAssistantError';
    this.code = code;
  }
}
