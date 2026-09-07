'use server';

import { createClient } from '@/lib/supabase/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createDefaultServerRouter } from '@/lib/ai/server';
import { processReceiptCore } from './action-core';
import {
  RECEIPT_VISION_AI_PUBLIC_MESSAGES,
  ReceiptVisionError,
  type ReceiptVisionErrorCode,
} from './errors';
import type { ReceiptVisionTelemetrySink } from './telemetry';
import type { ReceiptTransactionDraft } from './types';
import { AiError, type AiErrorCode } from '@/lib/ai/errors';
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

function receiptVisionFailure(code: ReceiptVisionErrorCode): ProcessReceiptResult {
  const error = new ReceiptVisionError(code);
  return { ok: false, error: error.message, code: error.code };
}

function aiFailure(code: AiErrorCode): ProcessReceiptResult {
  return { ok: false, error: RECEIPT_VISION_AI_PUBLIC_MESSAGES[code], code };
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
      return receiptVisionFailure('AUTH_REQUIRED');
    }
    user = authUser;
  } catch {
    return receiptVisionFailure('AUTH_REQUIRED');
  }

  // 2. Exactly one file entry named 'file'
  const fileEntries = formData.getAll('file');
  if (fileEntries.length === 0) {
    return receiptVisionFailure('RECEIPT_FILE_REQUIRED');
  }

  if (fileEntries.length > 1) {
    return receiptVisionFailure('RECEIPT_FILE_INVALID');
  }

  const file = fileEntries[0];
  if (!(file instanceof File) || typeof file === 'string') {
    return receiptVisionFailure('RECEIPT_FILE_INVALID');
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

    return aiFailure(result.error.code);
  } catch (err: unknown) {
    if (err instanceof ReceiptVisionError) {
      return { ok: false, error: err.message, code: err.code };
    }

    if (err instanceof AiError) {
      return aiFailure(err.code);
    }
    return aiFailure('AI_PROVIDER_ERROR');
  }
}
