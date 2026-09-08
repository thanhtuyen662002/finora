'use server';

import { createClient } from '@/lib/supabase/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createDefaultServerRouter } from '@/lib/ai/server';
import { runFinancialAssistantCore } from './action-core';
import type {
  FinancialAssistantRequest,
  FinancialAssistantResult,
} from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiCredentialProvider } from '@/lib/ai/types';
import type { AiRouter } from '@/lib/ai/router';

export interface FinancialAssistantActionDeps {
  readonly createClient?: () => Promise<SupabaseClient>;
  readonly createRouter?: () => AiRouter;
  readonly createCredentialProvider?: () => AiCredentialProvider;
}

export async function runFinancialAssistantActionWithDeps(
  request: FinancialAssistantRequest,
  deps: FinancialAssistantActionDeps
): Promise<FinancialAssistantResult> {
  const supabase = await deps.createClient!();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, code: 'AUTH_REQUIRED', error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
  }
  return runFinancialAssistantCore({
    userId: user.id,
    mode: request.mode,
    question: request.question,
    snapshot: request.snapshot,
    router: deps.createRouter!(),
    credentialProvider: deps.createCredentialProvider!(),
  });
}

export async function runFinancialAssistantAction(
  request: FinancialAssistantRequest
): Promise<FinancialAssistantResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, code: 'AUTH_REQUIRED', error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
  }

  return runFinancialAssistantCore({
    userId: user.id,
    mode: request.mode,
    question: request.question,
    snapshot: request.snapshot,
    router: createDefaultServerRouter(),
    credentialProvider: new AiCredentialResolver({ repository: createAiCredentialRepository() }),
  });
}
