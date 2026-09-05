import { createDefaultServerRouter } from '@/lib/ai/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createAdminClient } from '@/lib/supabase/admin';
import { processReceiptImage } from './image';
import { fetchCategoryCandidates } from './categories';
import { buildReceiptVisionPrompt } from './prompt';
import { deriveReceiptDraft } from './domain';
import { receiptVisionOutputValidator } from './validator';
import type { ReceiptTransactionDraft } from './types';
import { AiError } from '@/lib/ai/errors';

export async function analyzeReceiptActionCore(
  formData: FormData,
  userId: string
): Promise<ReceiptTransactionDraft> {
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    throw new AiError({ code: 'AI_INVALID_REQUEST', message: 'No file provided' });
  }

  // Credential resolution
  const repository = createAiCredentialRepository();
  const credentialProvider = new AiCredentialResolver({ repository });
  
  const mediaPart = await processReceiptImage(file);
  const candidates = await fetchCategoryCandidates(userId);
  const prompt = buildReceiptVisionPrompt(candidates);

  const router = createDefaultServerRouter();
  const result = await router.execute({
    operation: 'receipt_vision',
    responseMode: 'structured',
    prompt,
    media: [mediaPart],
    outputValidator: receiptVisionOutputValidator,
  }, {
    userId,
    credentialProvider,
  });

  if (!result.ok) {
    throw result.error;
  }

  // Revalidate category if selected
  let categoryValid = true;
  if (result.data.category_token) {
    const candidate = candidates.find(c => c.token === result.data.category_token);
    if (candidate) {
      const supabase = await createAdminClient();
      const { data } = await supabase
        .from('categories')
        .select('id')
        .eq('id', candidate.id)
        .eq('user_id', userId)
        .single();
      if (!data) {
        categoryValid = false;
      }
    }
  }

  return deriveReceiptDraft(result.data, candidates, categoryValid);
}

