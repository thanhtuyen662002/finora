import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiCredentialProvider, AiStructuredRequest } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';
import { AiError } from '@/lib/ai/errors';
import { processReceiptImage } from './image';
import { getCategoryCandidates, revalidateCategoryToken } from './categories';
import { buildReceiptVisionPrompt } from './prompt';
import { receiptVisionOutputValidator } from './schema';
import { deriveReceiptDraft } from './domain';
import { ReceiptVisionError } from './errors';
import {
  emitReceiptVisionTelemetry,
  getInputBytesBucket,
  getImageDimensionBucket,
  type ReceiptVisionTelemetrySink,
} from './telemetry';
import type {
  ReceiptDocumentKind,
  ReceiptTransactionDraft,
  ReceiptVisionParseOutput,
} from './types';

export async function processReceiptCore(
  file: File,
  supabase: SupabaseClient,
  credentialProvider: AiCredentialProvider,
  router: AiRouter,
  userId: string,
  telemetrySink?: ReceiptVisionTelemetrySink
): Promise<
  | { readonly ok: true; readonly draft: ReceiptTransactionDraft }
  | { readonly ok: false; readonly error: ReceiptVisionError | AiError }
> {
  const startTime = performance.now();
  let preprocessMs = 0;
  let contextMs = 0;
  let aiProviderMs = 0;
  let revalidationMs = 0;

  let inputFormat: 'jpeg' | 'png' | 'webp' | undefined;
  let originalBytes = file.size;
  let originalWidth: number | undefined;
  let originalHeight: number | undefined;

  const emitTiming = async (
    success: boolean,
    completion?: {
      readonly warningCount: number;
      readonly documentKind: ReceiptDocumentKind;
    }
  ): Promise<void> => {
    await emitReceiptVisionTelemetry(
      {
        operation: 'receipt_vision',
        success,
        input_bytes_bucket: getInputBytesBucket(originalBytes),
        ...(inputFormat !== undefined &&
        originalWidth !== undefined &&
        originalHeight !== undefined
          ? {
              input_format: inputFormat,
              image_width_bucket: getImageDimensionBucket(originalWidth),
              image_height_bucket: getImageDimensionBucket(originalHeight),
            }
          : {}),
        preprocess_ms: preprocessMs,
        context_ms: contextMs,
        ai_provider_ms: aiProviderMs,
        revalidation_ms: revalidationMs,
        total_ms: Math.max(0, Math.round(performance.now() - startTime)),
        ...(success && completion
          ? {
              warning_count: completion.warningCount,
              document_kind: completion.documentKind,
            }
          : {}),
      },
      telemetrySink
    );
  };

  try {
    // 1. Array buffer boundary + sharp processing in memory
    const t0 = performance.now();
    const processedImage = await processReceiptImage(file);
    preprocessMs = Math.max(0, Math.round(performance.now() - t0));

    inputFormat = processedImage.format;
    originalBytes = processedImage.originalBytes;
    originalWidth = processedImage.originalWidth;
    originalHeight = processedImage.originalHeight;

    // 2. Fetch category candidates using authenticated RLS client
    const t1 = performance.now();
    const candidates = await getCategoryCandidates(supabase, userId);

    // 3. Build prompt with opaque tokens CAT_n and JSON boundary
    const prompt = buildReceiptVisionPrompt(candidates);
    contextMs = Math.max(0, Math.round(performance.now() - t1));

    // 4. Dispatch structured request via AI router
    const t2 = performance.now();
    const request: AiStructuredRequest<unknown, ReceiptVisionParseOutput> = {
      operation: 'receipt_vision',
      responseMode: 'structured',
      prompt,
      media: [processedImage.mediaPart],
      outputValidator: receiptVisionOutputValidator,
    };

    const result = await router.execute(request, { credentialProvider, userId });
    aiProviderMs = Math.max(0, Math.round(performance.now() - t2));

    if (!result.ok) {
      await emitTiming(false);
      return result;
    }

    const output = result.data;

    // 5. Revalidate resolved category against active user categories under RLS
    const t3 = performance.now();
    const categoryResolution = await revalidateCategoryToken(
      supabase,
      output.category_token,
      candidates,
      userId
    );

    // 6. Derive draft with deterministic warnings calculation
    const draft = deriveReceiptDraft(output, categoryResolution);
    revalidationMs = Math.max(0, Math.round(performance.now() - t3));

    await emitTiming(true, {
      warningCount: draft.warnings.length,
      documentKind: draft.document_kind,
    });

    return { ok: true, draft };
  } catch (err: unknown) {
    if (err instanceof ReceiptVisionError) {
      await emitTiming(false);
      return { ok: false, error: err };
    }

    if (err instanceof AiError) {
      await emitTiming(false);
      return { ok: false, error: err };
    }

    const unexpectedError = new AiError({
      code: 'AI_PROVIDER_ERROR',
      message: 'An unexpected error occurred during receipt processing.',
    });

    await emitTiming(false);

    return { ok: false, error: unexpectedError };
  }
}
