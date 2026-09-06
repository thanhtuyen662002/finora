import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiCredentialProvider, AiStructuredRequest } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import { AiError } from '@/lib/ai/errors';
import { processReceiptImage } from './image';
import { getCategoryCandidates, revalidateCategoryToken } from './categories';
import { buildReceiptVisionPrompt } from './prompt';
import { receiptVisionOutputValidator } from './schema';
import { deriveReceiptDraft } from './domain';
import type { ReceiptTransactionDraft, ReceiptVisionParseOutput } from './types';

export async function processReceiptCore(
  file: File,
  supabase: SupabaseClient,
  credentialProvider: AiCredentialProvider,
  router: AiRouter,
  userId: string
): Promise<{ ok: true; draft: ReceiptTransactionDraft } | { ok: false; error: AiError }> {
  try {
    // 1. Array buffer boundary + sharp processing in memory
    const mediaPart = await processReceiptImage(file);

    // 2. Fetch category candidates using authenticated RLS client
    const candidates = await getCategoryCandidates(supabase);

    // 3. Build prompt with opaque tokens CAT_n
    const prompt = buildReceiptVisionPrompt(candidates);

    // 4. Dispatch structured request via AI router
    const request: AiStructuredRequest<unknown, ReceiptVisionParseOutput> = {
      operation: 'receipt_vision',
      responseMode: 'structured',
      prompt,
      media: [mediaPart],
      outputValidator: receiptVisionOutputValidator,
    };

    const result = await router.execute(request, { credentialProvider, userId });

    if (!result.ok) {
      return result;
    }

    const output = result.data;

    // 5. Revalidate resolved category against active user categories under RLS
    const categoryResolution = await revalidateCategoryToken(
      supabase,
      output.category_token,
      candidates
    );

    // 6. Derive draft with deterministic warnings calculation
    const draft = deriveReceiptDraft(output, categoryResolution);

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
