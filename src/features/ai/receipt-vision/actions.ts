'use server';

import { analyzeReceiptActionCore } from './action-core';
import type { ReceiptTransactionDraft } from './types';
import { AiError } from '@/lib/ai/errors';
import { createClient } from '@/lib/supabase/server';

export async function analyzeReceiptAction(formData: FormData): Promise<{
  ok: boolean;
  data?: ReceiptTransactionDraft;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
       return { ok: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    
    const data = await analyzeReceiptActionCore(formData, user.id);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: 'Failed to analyze receipt.' };
  }
}

