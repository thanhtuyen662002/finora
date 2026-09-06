'use server';

import { createClient } from '@/lib/supabase/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createDefaultServerRouter } from '@/lib/ai/server';
import { processReceiptCore } from './action-core';
import type { ReceiptTransactionDraft } from './types';
import { sanitizeActionError } from '@/features/ai/credentials/action-core';

export interface ProcessReceiptResult {
  readonly ok: boolean;
  readonly draft?: ReceiptTransactionDraft;
  readonly error?: string;
  readonly code?: string;
}

export async function processReceiptAction(formData: FormData): Promise<ProcessReceiptResult> {
  // 1. Auth check must strictly precede all file reading, image processing, category queries, and router/credential instantiation
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'Unauthenticated', code: 'UNAUTHENTICATED' };
  }

  // 2. Exactly one file entry named 'file'
  const fileEntries = formData.getAll('file');
  if (fileEntries.length === 0) {
    return { ok: false, error: 'No file provided.', code: 'INVALID_FILE_COUNT' };
  }
  if (fileEntries.length > 1) {
    return {
      ok: false,
      error: 'Multiple files provided. Exactly one file is required.',
      code: 'INVALID_FILE_COUNT',
    };
  }

  const file = fileEntries[0];
  if (!(file instanceof File) || typeof file === 'string') {
    return { ok: false, error: 'Invalid file payload.', code: 'INVALID_FILE_TYPE' };
  }

  try {
    const repository = createAiCredentialRepository();
    const credentialProvider = new AiCredentialResolver({ repository });
    const router = createDefaultServerRouter();
    const result = await processReceiptCore(file, supabase, credentialProvider, router, user.id);

    if (result.ok) {
      return { ok: true, draft: result.draft };
    } else {
      const sanitized = sanitizeActionError(result.error, 'An error occurred during receipt processing.');
      if (!sanitized.ok) {
        return { ok: false, error: sanitized.message, code: sanitized.code };
      }
      return { ok: false, error: 'Unknown error', code: 'UNKNOWN' };
    }
  } catch (err: unknown) {
    const sanitized = sanitizeActionError(err, 'An error occurred during receipt processing.');
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.message, code: sanitized.code };
    }
    return { ok: false, error: 'Unknown error', code: 'UNKNOWN' };
  }
}
