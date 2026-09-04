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
 * - Exactly one file object across the entire FormData payload.
 * - File must be present under the 'file' field name.
 * - File cannot be 0 bytes.
 * - File size cannot exceed application cap before reading bytes.
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

  // 1. Must contain at least one file
  if (fileEntries.length === 0) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_REQUIRED',
        message: 'Vui lòng chọn một tệp ảnh hóa đơn.',
      },
    };
  }

  // 2. Must contain exactly one file across all fields
  if (fileEntries.length > 1) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_INVALID',
        message: 'Yêu cầu chỉ được chứa duy nhất một tệp ảnh hóa đơn.',
      },
    };
  }

  // 3. The single file must be under 'file' key
  const [fileKey, fileVal] = fileEntries[0];
  if (fileKey !== 'file' || !(fileVal instanceof File)) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_INVALID',
        message: 'Tệp tải lên phải được đặt trong trường "file".',
      },
    };
  }

  const file = fileVal;

  // 4. File must not be 0 bytes
  if (file.size === 0) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_FILE_REQUIRED',
        message: 'Tệp ảnh hóa đơn không được để trống.',
      },
    };
  }

  // 5. Enforce 4 MiB application cap BEFORE arrayBuffer / decode
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

/**
 * Server action to analyze an uploaded receipt image.
 */
export async function analyzeReceiptAction(formData: FormData): Promise<ReceiptVisionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Bạn cần đăng nhập để sử dụng tính năng phân tích hóa đơn.',
      },
    };
  }

  // Authoritative exact-one-file & pre-arrayBuffer size validation
  const validation = validateReceiptFormData(formData);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
    };
  }

  const { file } = validation;
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = Buffer.from(arrayBuffer);

  const router = createDefaultServerRouter();
  const repository = createAiCredentialRepository();
  const credentialProvider = new AiCredentialResolver({ repository });

  return executeReceiptVisionCore(
    fileBytes,
    { name: file.name, type: file.type, size: file.size },
    user,
    {
      router,
      credentialProvider,
      normalizeImage: normalizeReceiptImage,
    }
  );
}
