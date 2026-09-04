import 'server-only';

/**
 * Finora AI Feature Module — Server Domain Cross-Validator
 * Phase 12A — Token-to-UUID Mapping & Invariant Enforcement
 *
 * Invariants:
 * 1. Token Resolution: Valid tokens map to real UUIDs; unknown or fabricated tokens
 *    map to null with UNKNOWN_MODEL_TOKEN; stale tokens map to null with no-match warnings.
 * 2. Currency Precedence: Explicit prompt currency > Matched account currency > Base currency.
 *    If explicit currency conflicts with account currency, account is rejected (ACCOUNT_CURRENCY_CONFLICT).
 * 3. Type Consistency: Category type must match transaction type, else CATEGORY_TYPE_CONFLICT.
 * 4. Attribution: Income source & stream only active when type=INCOME; stream must belong to source.
 * 5. Overflow Failsafe: When dimension candidates are omitted, sets ID to null and emits warning.
 * 6. Money Normalization: Exact string decimals via src/lib/money/index.ts. Zero floating-point math.
 */

import { isPositiveExactDecimal, toExactDecimal } from '@/lib/money';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  type AiTransactionParseOutput,
  isSupportedCurrencyCode,
  type OpaqueCandidateContext,
  type ParsedTransactionDraft,
  type TransactionDraftWarningCode,
} from './types';
import { isValidCalendarDate } from './validator';
import { ContextLoadError } from './candidates';

export interface CrossValidateParams {
  readonly rawOutput: AiTransactionParseOutput;
  readonly candidates: OpaqueCandidateContext;
  readonly baseCurrency?: string;
}

export function crossValidateTransactionDraft(
  params: CrossValidateParams
): ParsedTransactionDraft {
  const { rawOutput, candidates } = params;
  const baseCurrency = (params.baseCurrency || 'VND').toUpperCase();

  const warningCodes: TransactionDraftWarningCode[] = [];
  const addWarning = (code: TransactionDraftWarningCode) => {
    if (!warningCodes.includes(code)) {
      warningCodes.push(code);
    }
  };

  // 1. Transaction Type
  let resolvedType: 'INCOME' | 'EXPENSE' | null = null;
  if (rawOutput.type === null) {
    addWarning('TYPE_MISSING');
  } else {
    resolvedType = rawOutput.type;
  }

  // 2. Amount Normalization via src/lib/money
  let resolvedAmount: string | null = null;
  if (rawOutput.amount === null) {
    addWarning('AMOUNT_MISSING');
  } else {
    const trimmedAmount = rawOutput.amount.trim();
    if (isPositiveExactDecimal(trimmedAmount)) {
      try {
        resolvedAmount = toExactDecimal(trimmedAmount);
      } catch {
        resolvedAmount = null;
        addWarning('AMOUNT_INVALID');
      }
    } else {
      resolvedAmount = null;
      addWarning('AMOUNT_INVALID');
    }
  }

  // 3. Account Candidate Resolution
  let resolvedAccountId: string | null = null;
  if (candidates.accountsOmitted) {
    addWarning('ACCOUNT_CANDIDATES_OMITTED');
  } else if (rawOutput.account_token !== null) {
    const matchedAccount = candidates.accounts.find(
      (a) => a.token === rawOutput.account_token
    );
    if (!matchedAccount) {
      addWarning('UNKNOWN_MODEL_TOKEN');
      addWarning('ACCOUNT_NOT_MATCHED');
    } else if (matchedAccount.is_archived) {
      addWarning('ACCOUNT_NOT_MATCHED');
    } else {
      resolvedAccountId = matchedAccount.id;
    }
  } else {
    addWarning('ACCOUNT_NOT_MATCHED');
  }

  // 4. Currency Precedence & Account Conflict
  let resolvedCurrency: string | null = null;
  const safeBaseCurrency = isSupportedCurrencyCode(baseCurrency) ? baseCurrency : 'VND';

  if (rawOutput.currency_code !== null) {
    const upperCurrency = rawOutput.currency_code.toUpperCase();
    if (isSupportedCurrencyCode(upperCurrency)) {
      resolvedCurrency = upperCurrency;
      // Cross-validate with matched account currency
      if (resolvedAccountId !== null) {
        const account = candidates.accounts.find((a) => a.id === resolvedAccountId);
        if (account && account.currency_code !== resolvedCurrency) {
          // Explicit user currency takes precedence; reject account match
          resolvedAccountId = null;
          addWarning('ACCOUNT_CURRENCY_CONFLICT');
        }
      }
    } else {
      resolvedCurrency = safeBaseCurrency;
      addWarning('CURRENCY_INVALID');
    }
  } else {
    // Unspecified in prompt -> Tier 2: Account currency, Tier 3: Base currency
    if (resolvedAccountId !== null) {
      const account = candidates.accounts.find((a) => a.id === resolvedAccountId);
      resolvedCurrency = account ? account.currency_code : safeBaseCurrency;
    } else {
      resolvedCurrency = safeBaseCurrency;
      addWarning('CURRENCY_INFERRED');
    }
  }

  // 5. Category Resolution & Type Conflict
  let resolvedCategoryId: string | null = null;
  if (candidates.categoriesOmitted) {
    addWarning('CATEGORY_CANDIDATES_OMITTED');
  } else if (rawOutput.category_token !== null) {
    const matchedCategory = candidates.categories.find(
      (c) => c.token === rawOutput.category_token
    );
    if (!matchedCategory) {
      addWarning('UNKNOWN_MODEL_TOKEN');
      addWarning('CATEGORY_NOT_MATCHED');
    } else if (matchedCategory.is_archived) {
      addWarning('CATEGORY_NOT_MATCHED');
    } else if (resolvedType === null || matchedCategory.type !== resolvedType) {
      addWarning('CATEGORY_TYPE_CONFLICT');
    } else {
      resolvedCategoryId = matchedCategory.id;
    }
  } else {
    addWarning('CATEGORY_NOT_MATCHED');
  }

  // 6. Income Source & Stream Resolution (Only applicable when type === 'INCOME')
  let resolvedSourceId: string | null = null;
  let resolvedStreamId: string | null = null;

  if (resolvedType === 'INCOME') {
    // Income Source
    if (candidates.incomeSourcesOmitted) {
      addWarning('INCOME_SOURCE_CANDIDATES_OMITTED');
    } else if (rawOutput.income_source_token !== null) {
      const matchedSource = candidates.incomeSources.find(
        (s) => s.token === rawOutput.income_source_token
      );
      if (!matchedSource) {
        addWarning('UNKNOWN_MODEL_TOKEN');
        addWarning('INCOME_SOURCE_NOT_MATCHED');
      } else if (matchedSource.is_archived) {
        addWarning('INCOME_SOURCE_NOT_MATCHED');
      } else {
        resolvedSourceId = matchedSource.id;
      }
    } else {
      addWarning('INCOME_SOURCE_NOT_MATCHED');
    }

    // Income Stream
    if (candidates.incomeStreamsOmitted) {
      addWarning('INCOME_STREAM_CANDIDATES_OMITTED');
    } else if (rawOutput.income_source_stream_token !== null) {
      const matchedStream = candidates.incomeStreams.find(
        (st) => st.token === rawOutput.income_source_stream_token
      );
      if (!matchedStream) {
        addWarning('UNKNOWN_MODEL_TOKEN');
        addWarning('INCOME_STREAM_NOT_MATCHED');
      } else if (matchedStream.is_archived) {
        addWarning('INCOME_STREAM_NOT_MATCHED');
      } else if (
        resolvedSourceId === null ||
        matchedStream.income_source_id !== resolvedSourceId
      ) {
        addWarning('INCOME_STREAM_PARENT_CONFLICT');
      } else {
        resolvedStreamId = matchedStream.id;
      }
    }
  }

  // 7. Date Resolution
  let resolvedOccurredOn: string | null = null;
  if (rawOutput.occurred_on === null) {
    addWarning('DATE_MISSING');
  } else {
    const trimmedDate = rawOutput.occurred_on.trim();
    if (isValidCalendarDate(trimmedDate)) {
      resolvedOccurredOn = trimmedDate;
    } else {
      addWarning('DATE_AMBIGUOUS');
    }
  }

  // 8. Clean Merchant, Note, and Unmatched Text
  const merchant =
    rawOutput.merchant !== null && rawOutput.merchant.trim() !== ''
      ? rawOutput.merchant.trim().slice(0, 100)
      : null;

  const note =
    rawOutput.note !== null && rawOutput.note.trim() !== ''
      ? rawOutput.note.trim().slice(0, 255)
      : null;

  const unmatched_text =
    rawOutput.unmatched_text !== null && rawOutput.unmatched_text.trim() !== ''
      ? rawOutput.unmatched_text.trim().slice(0, 255)
      : null;

  return {
    type: resolvedType,
    amount: resolvedAmount,
    currency_code: resolvedCurrency,
    account_id: resolvedAccountId,
    category_id: resolvedCategoryId,
    income_source_id: resolvedSourceId,
    income_source_stream_id: resolvedStreamId,
    merchant,
    note,
    occurred_on: resolvedOccurredOn,
    warning_codes: warningCodes,
    unmatched_text,
  };
}

/**
 * Re-reads matched candidate entities via authenticated RLS client AFTER AI execution
 * to guarantee that any candidate selected by AI is still valid, unarchived, and visible to the user.
 * Zero service-role or privileged escalation.
 */
export async function revalidateResolvedCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  draft: ParsedTransactionDraft
): Promise<ParsedTransactionDraft> {
  const updatedWarnings = [...draft.warning_codes];
  const addWarning = (code: TransactionDraftWarningCode) => {
    if (!updatedWarnings.includes(code)) {
      updatedWarnings.push(code);
    }
  };

  let resolvedAccountId = draft.account_id;
  let resolvedCategoryId = draft.category_id;
  let resolvedSourceId = draft.income_source_id;
  let resolvedStreamId = draft.income_source_stream_id;

  // Execute revalidation queries concurrently
  const accountPromise = resolvedAccountId !== null
    ? supabase
        .from('accounts')
        .select('id, user_id, currency_code, is_archived')
        .eq('id', resolvedAccountId)
        .eq('user_id', userId)
        .maybeSingle()
    : Promise.resolve(null);

  const categoryPromise = resolvedCategoryId !== null
    ? supabase
        .from('categories')
        .select('id, user_id, type, is_archived')
        .eq('id', resolvedCategoryId)
        .eq('user_id', userId)
        .maybeSingle()
    : Promise.resolve(null);

  const sourcePromise = resolvedSourceId !== null && draft.type === 'INCOME'
    ? supabase
        .from('income_sources')
        .select('id, user_id, is_archived')
        .eq('id', resolvedSourceId)
        .eq('user_id', userId)
        .maybeSingle()
    : Promise.resolve(null);

  const streamPromise = resolvedStreamId !== null && draft.type === 'INCOME'
    ? supabase
        .from('income_source_streams')
        .select('id, user_id, income_source_id, is_archived')
        .eq('id', resolvedStreamId)
        .eq('user_id', userId)
        .maybeSingle()
    : Promise.resolve(null);

  const [accRes, catRes, srcRes, strRes] = await Promise.all([
    accountPromise,
    categoryPromise,
    sourcePromise,
    streamPromise,
  ]);

  // Check database errors (fail closed)
  if (accRes && 'error' in accRes && accRes.error) {
    throw new ContextLoadError(`Failed to revalidate account: ${accRes.error.message}`, accRes.error);
  }
  if (catRes && 'error' in catRes && catRes.error) {
    throw new ContextLoadError(`Failed to revalidate category: ${catRes.error.message}`, catRes.error);
  }
  if (srcRes && 'error' in srcRes && srcRes.error) {
    throw new ContextLoadError(`Failed to revalidate income source: ${srcRes.error.message}`, srcRes.error);
  }
  if (strRes && 'error' in strRes && strRes.error) {
    throw new ContextLoadError(`Failed to revalidate income stream: ${strRes.error.message}`, strRes.error);
  }

  // 1. Account revalidation
  if (resolvedAccountId !== null && accRes && 'data' in accRes) {
    const acc = accRes.data;
    if (!acc || acc.is_archived) {
      resolvedAccountId = null;
      addWarning('ACCOUNT_NOT_MATCHED');
    } else if (!isSupportedCurrencyCode(acc.currency_code)) {
      resolvedAccountId = null;
      addWarning('ACCOUNT_CURRENCY_CONFLICT');
    } else if (draft.currency_code !== null && acc.currency_code !== draft.currency_code) {
      resolvedAccountId = null;
      addWarning('ACCOUNT_CURRENCY_CONFLICT');
    }
  }

  // 2. Category revalidation
  if (resolvedCategoryId !== null && catRes && 'data' in catRes) {
    const cat = catRes.data;
    if (!cat || cat.is_archived) {
      resolvedCategoryId = null;
      addWarning('CATEGORY_NOT_MATCHED');
    } else if (draft.type !== null && cat.type !== draft.type) {
      resolvedCategoryId = null;
      addWarning('CATEGORY_TYPE_CONFLICT');
    }
  }

  // 3. Income Source revalidation (only if type is INCOME)
  if (resolvedSourceId !== null && draft.type === 'INCOME') {
    const src = srcRes && 'data' in srcRes ? srcRes.data : null;
    if (!src || src.is_archived) {
      resolvedSourceId = null;
      addWarning('INCOME_SOURCE_NOT_MATCHED');
    }
  } else if (draft.type !== 'INCOME') {
    resolvedSourceId = null;
  }

  // 4. Income Stream revalidation (only if type is INCOME and source is valid)
  if (resolvedStreamId !== null && draft.type === 'INCOME') {
    if (resolvedSourceId === null) {
      resolvedStreamId = null;
      addWarning('INCOME_STREAM_PARENT_CONFLICT');
    } else {
      const str = strRes && 'data' in strRes ? strRes.data : null;
      if (!str || str.is_archived) {
        resolvedStreamId = null;
        addWarning('INCOME_STREAM_NOT_MATCHED');
      } else if (str.income_source_id !== resolvedSourceId) {
        resolvedStreamId = null;
        addWarning('INCOME_STREAM_PARENT_CONFLICT');
      }
    }
  } else if (draft.type !== 'INCOME') {
    resolvedStreamId = null;
  }

  return {
    ...draft,
    account_id: resolvedAccountId,
    category_id: resolvedCategoryId,
    income_source_id: resolvedSourceId,
    income_source_stream_id: resolvedStreamId,
    warning_codes: updatedWarnings,
  };
}
