'use server';

import { createClient } from '@/lib/supabase/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createDefaultServerRouter } from '@/lib/ai/server';
import { processReceiptCore } from './action-core';
import { ReceiptVisionError } from './errors';
import type { ReceiptVisionTelemetrySink } from './telemetry';
import type { ReceiptTransactionDraft } from './types';
import { sanitizeActionError } from '@/features/ai/credentials/action-core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiCredentialProvider } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';

export interface ProcessReceiptResult {
  readonly ok: boolean;
  readonly draft?: ReceiptTransactionDraft;
  readonly error?: string;
  readonly code?: string;
}

export interface ProcessReceiptActionDeps {
  readonly createClient?: () => Promise<SupabaseClient>;
  readonly createCredentialProvider?: () => AiCredentialProvider;
  readonly createRouter?: () => AiRouter;
  readonly telemetrySink?: ReceiptVisionTelemetrySink;
}

export async function processReceiptAction(
  formData: FormData,
  deps?: ProcessReceiptActionDeps
): Promise<ProcessReceiptResult> {
  // 1. Auth check must strictly precede all file reading, image processing, category queries, and router/credential instantiation
  let supabase: SupabaseClient;
  let user: { id: string } | null = null;
  try {
    supabase = deps?.createClient ? await deps.createClient() : await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return { ok: false, error: 'Authentication is required.', code: 'AUTH_REQUIRED' };
    }
    user = authUser;
  } catch {
    return { ok: false, error: 'Authentication is required.', code: 'AUTH_REQUIRED' };
  }

  // 2. Exactly one file entry named 'file'
  const fileEntries = formData.getAll('file');
  if (fileEntries.length === 0) {
    return { ok: false, error: 'Receipt file is required.', code: 'RECEIPT_FILE_REQUIRED' };
  }

  if (fileEntries.length > 1) {
    return {
      ok: false,
      error: 'Invalid receipt file payload. Exactly one file is required.',
      code: 'RECEIPT_FILE_INVALID',
    };
  }

  const file = fileEntries[0];
  if (!(file instanceof File) || typeof file === 'string') {
    return { ok: false, error: 'Invalid receipt file payload.', code: 'RECEIPT_FILE_INVALID' };
  }

  try {
    const credentialProvider = deps?.createCredentialProvider
      ? deps.createCredentialProvider()
      : new AiCredentialResolver({ repository: createAiCredentialRepository() });
    const router = deps?.createRouter ? deps.createRouter() : createDefaultServerRouter();

    const result = await processReceiptCore(
      file,
      supabase,
      credentialProvider,
      router,
      user.id,
      deps?.telemetrySink
    );

    if (result.ok) {
      return { ok: true, draft: result.draft };
    }

    if (result.error instanceof ReceiptVisionError) {
      return { ok: false, error: result.error.message, code: result.error.code };
    }

    const sanitized = sanitizeActionError(result.error, 'An error occurred during receipt processing.');
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.message, code: sanitized.code };
    }
    return { ok: false, error: 'Unknown error', code: 'UNKNOWN' };
  } catch (err: unknown) {
    if (err instanceof ReceiptVisionError) {
      return { ok: false, error: err.message, code: err.code };
    }

    const sanitized = sanitizeActionError(err, 'An error occurred during receipt processing.');
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.message, code: sanitized.code };
    }
    return { ok: false, error: 'Unknown error', code: 'UNKNOWN' };
  }
}
