/**
 * Finora AI Foundation — Normalized Error Taxonomy
 * Phase 10 — Error Normalization & Security Boundary
 *
 * Normalizes external vendor exceptions into stable application errors.
 * Strictly prevents leaking API credentials, authorization headers, or raw payloads.
 */

export type AiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_AUTH_FAILED'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_ABORTED'
  | 'AI_INVALID_REQUEST'
  | 'AI_INVALID_RESPONSE'
  | 'AI_STRUCTURED_OUTPUT_INVALID'
  | 'AI_PROVIDER_ERROR';

export interface AiErrorOptions {
  readonly code: AiErrorCode;
  readonly message: string;
  readonly providerId?: string;
  readonly details?: string;
  readonly cause?: unknown;
}

/**
 * Sanitizes an error message to ensure no API keys or auth tokens leak.
 */
export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza••••[REDACTED]')
    .replace(/authorization:\s*bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key[:=]\s*)[^\s&,]+/gi, '$1[REDACTED]');
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly providerId?: string;
  readonly details?: string;

  constructor(options: AiErrorOptions) {
    const cleanMessage = sanitizeErrorMessage(options.message);
    super(cleanMessage);
    this.name = 'AiError';
    this.code = options.code;
    this.providerId = options.providerId;
    this.details = options.details ? sanitizeErrorMessage(options.details) : undefined;

    // Ensure proper prototype chain for custom Error subclass
    Object.setPrototypeOf(this, AiError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      providerId: this.providerId,
      details: this.details,
    };
  }
}
