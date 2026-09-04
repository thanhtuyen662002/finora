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
import { normalizeReceiptImage } from './image';
import { executeReceiptVisionCore } from './action-core';
import type { ReceiptVisionActionResult } from './types';

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

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: {
        code: 'RECEIPT_IMAGE_REQUIRED',
        message: 'Vui lòng chọn một tệp ảnh hóa đơn.',
      },
    };
  }

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
