'use server';

/**
 * Finora AI Feature Module — Transaction Draft Server Actions
 * Phase 12A — Authenticated Natural Language Transaction Parsing
 *
 * Invariants:
 * 1. Auth First: Derives caller identity strictly from server-side authenticated
 *    session via supabase.auth.getUser(). Unauthenticated callers are rejected before
 *    any repository or router initialization.
 * 2. Zero Financial Mutation Authority: Never executes INSERT/UPDATE/DELETE on
 *    transactions, transfers, accounts, or budgets.
 * 3. Safe Draft Return: Returns validated in-memory ParsedTransactionDraft only.
 */

import { createClient } from '@/lib/supabase/server';
import { createAiCredentialRepository } from '@/lib/ai/credentials/repository';
import { AiCredentialResolver } from '@/lib/ai/credentials/resolver';
import { createDefaultServerRouter } from '@/lib/ai/server';
import { parseTransactionTextCore } from './action-core';
import type { ParseTransactionDraftResult } from './types';

export async function parseTransactionDraftAction(
  prompt: string
): Promise<ParseTransactionDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      },
    };
  }

  const repository = createAiCredentialRepository();
  const credentialProvider = new AiCredentialResolver({ repository });
  const router = createDefaultServerRouter();

  return parseTransactionTextCore({
    prompt,
    userId: user.id,
    supabase,
    router,
    credentialProvider,
  });
}
