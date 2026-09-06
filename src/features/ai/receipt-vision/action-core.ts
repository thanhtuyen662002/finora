import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiCredentialProvider, AiStructuredRequest } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import { AiError } from '@/lib/ai/errors';
import { processReceiptImage } from './image';
import { getCategoryCandidates, revalidateCategoryToken } from './categories';
import { buildReceiptVisionPrompt } from './prompt';
import { receiptVisionOutputValidator } from './schema';
import { deriveReceiptDraft } from './domain';
import { PHASE_12B_CURRENT_RECEIPT_VISION_MODEL } from './constants';
import type { ReceiptTransactionDraft } from './types';

export async function processReceiptCore(
  file: File,
  supabase: SupabaseClient,
  credentialProvider: AiCredentialProvider,
  router: AiRouter,
  userId: string
): Promise<{ ok: true; draft: ReceiptTransactionDraft } | { ok: false; error: AiError }> {
  try {
    // 1. Array buffer boundary + sharp processing
    const mediaPart = await processReceiptImage(file);

    // 2. Fetch candidates using authenticated RLS client
    const candidates = await getCategoryCandidates(supabase);

    // 3. Build prompt
    const prompt = buildReceiptVisionPrompt(candidates);

    // 4. Dispatch via AI router
    const request: AiStructuredRequest<unknown, unknown> = {
      operation: 'receipt_vision',
      responseMode: 'structured',
      prompt,
      media: [mediaPart],
      outputValidator: receiptVisionOutputValidator,
    };

    const result = await router.execute(
      request,
      { credentialProvider, userId }
    );

    if (!result.ok) {
      return result;
    }

    const output = result.data as import('./types').ReceiptVisionParseOutput;

    // 5. Revalidate resolved category
    const resolvedCategoryId = await revalidateCategoryToken(supabase, output.category_token, candidates);

    // 6. Derive draft
    const draft = deriveReceiptDraft(output, resolvedCategoryId);

    return { ok: true, draft };
  } catch (err: unknown) {
    if (err instanceof AiError) {
      return { ok: false, error: err };
    }
    return {
      ok: false,
      error: new AiError({
        code: 'AI_PROVIDER_ERROR',
        message: 'An unexpected error occurred during receipt processing.',
        cause: err,
      }),
    };
  }
}
