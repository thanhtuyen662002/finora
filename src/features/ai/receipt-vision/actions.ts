'use server';

/**
 * Finora AI Receipt Vision — Server Actions
 * Phase 12B — Authenticated Server Actions Boundary
 *
 * Provides the Next.js Server Action entrypoint for receipt vision extraction.
 * Unmounted from live user UI during Pass 12B-1.
 */

import { createClient } from '@/lib/supabase/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createDefaultServerRouter } from '@/lib/ai/server';
import { PHASE_12B_MAX_RECEIPT_FILE_BYTES } from './constants';
import { normalizeReceiptImage } from './image';
import { executeReceiptVisionCore } from './action-core';
import type { ReceiptVisionActionResult } from './types';

/**
 * Validates FormData structure for receipt upload.
 * Enforces:
 * - FormData has no 'file' field and no File anywhere -> RECEIPT_FILE_REQUIRED
 * - 'file' field exists but value is not File -> RECEIPT_FILE_INVALID
 * - File exists only under another field name -> RECEIPT_FILE_INVALID
 * - Multiple Files anywhere -> RECEIPT_FILE_INVALID
 * - File cannot be 0 bytes -> RECEIPT_FILE_REQUIRED
 * - File size cannot exceed application cap before reading bytes -> RECEIPT_FILE_TOO_LARGE
 */
export function validateReceiptFormData(formData: FormData): {
  readonly ok: true;
  readonly file: File;
} | {
  readonly ok: false;
  readonly error: {
    readonly code: 'RECEIPT_FILE_REQUIRED' | 'RECEIPT_FILE_INVALID' | 'RECEIPT_FILE_TOO_LARGE';
    readonly message: string;
  };
} {
  const allEntries = Array.from(formData.entries());
  const fileEntries = allEntries.filter(
    ([, val]) => val instanceof File || (typeof val === 'object' && val !== null && 'size' in val && 'arrayBuffer' in val)
  );

  // 1. If multiple files exist anywhere across the FormData payload
  if (fileEntries.length > 1) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_INVALID',
        message: 'Yêu cầu chỉ được chứa duy nhất một tệp ảnh hóa đơn.',
      },
    };
  }

  // 2. If a file exists only under a non-'file' field name
  if (fileEntries.length === 1 && fileEntries[0][0] !== 'file') {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_INVALID',
        message: 'Tệp tải lên phải được đặt trong trường "file".',
      },
    };
  }

  // 3. If 'file' field is not present at all and no file was found anywhere
  if (!formData.has('file')) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_REQUIRED',
        message: 'Vui lòng chọn một tệp ảnh hóa đơn.',
      },
    };
  }

  const fileVal = formData.get('file');

  // 4. If 'file' field exists but is not a valid File object (e.g. string value)
  const isFile =
    fileVal instanceof File ||
    (typeof fileVal === 'object' && fileVal !== null && 'size' in fileVal && 'arrayBuffer' in fileVal);

  if (!isFile) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_INVALID',
        message: 'Giá trị trong trường "file" không phải là một tệp hợp lệ.',
      },
    };
  }

  const file = fileVal as File;

  // 5. File must not be 0 bytes
  if (file.size === 0) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_REQUIRED',
        message: 'Tệp ảnh hóa đơn không được để trống.',
      },
    };
  }

  // 6. Enforce 4 MiB application cap BEFORE arrayBuffer / decode
  if (file.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_TOO_LARGE',
        message: `Kích thước tệp vượt quá giới hạn cho phép (${(PHASE_12B_MAX_RECEIPT_FILE_BYTES / (1024 * 1024)).toFixed(0)}MB).`,
      },
    };
  }

  return { ok: true, file };
}

export interface AnalyzeReceiptActionDeps {
  getUser?: () => Promise<{ user: { id: string; email?: string } | null; error: unknown }>;
  validateFormData?: typeof validateReceiptFormData;
  normalizeImage?: typeof normalizeReceiptImage;
  createRouter?: () => unknown;
  createCredentialResolver?: () => unknown;
  executeCore?: typeof executeReceiptVisionCore;
}

/**
 * Testable, dependency-injected orchestration for receipt analysis Server Action.
 */
export async function executeAnalyzeReceiptAction(
  formData: FormData,
  deps?: AnalyzeReceiptActionDeps
): Promise<ReceiptVisionActionResult> {
  // 1. Auth check first - MUST complete before byte reading, normalization, or credential resolution
  const getUserFn = deps?.getUser ?? (async () => {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  });

  const { user, error } = await getUserFn();
  if (error || !user) {
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Bạn cần đăng nhập để sử dụng tính năng phân tích hóa đơn.',
      },
    };
  }

  // 2. Authoritative exact-one-file & pre-arrayBuffer size validation
  const validateFn = deps?.validateFormData ?? validateReceiptFormData;
  const validation = validateFn(formData);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
    };
  }

  const { file } = validation;

  // 3. Read arrayBuffer into bytes ONLY after auth and size cap pass
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = Buffer.from(arrayBuffer);

  // 4. Instantiate or resolve router and credential provider
  const router = deps?.createRouter
    ? (deps.createRouter() as ReturnType<typeof createDefaultServerRouter>)
    : createDefaultServerRouter();

  const credentialProvider = deps?.createCredentialResolver
    ? (deps.createCredentialResolver() as AiCredentialResolver)
    : new AiCredentialResolver({ repository: createAiCredentialRepository() });

  const normalizeFn = deps?.normalizeImage ?? normalizeReceiptImage;
  const executeCoreFn = deps?.executeCore ?? executeReceiptVisionCore;

  return executeCoreFn(
    fileBytes,
    { name: file.name, type: file.type, size: file.size },
    user,
    {
      router,
      credentialProvider,
      normalizeImage: normalizeFn,
    }
  );
}

/**
 * Next.js Server Action entrypoint for analyzing an uploaded receipt image.
 */
export async function analyzeReceiptAction(formData: FormData): Promise<ReceiptVisionActionResult> {
  return executeAnalyzeReceiptAction(formData);
}
