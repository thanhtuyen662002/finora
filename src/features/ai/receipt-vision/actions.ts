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
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'Unauthenticated', code: 'UNAUTHENTICATED' };
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return { ok: false, error: 'No file provided or invalid file type.', code: 'INVALID_REQUEST' };
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
