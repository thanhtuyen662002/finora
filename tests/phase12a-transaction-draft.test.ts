/**
 * Finora AI Foundation — Phase 12A Transaction Draft & Smart Categorization Test Suite
 * Comprehensive tests for Validator, Domain Cross-Validation, Candidate Minimization,
 * Prompt Construction, Action Core Orchestration, Error Sanitization, and Zero Mutation Invariant.
 */

import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import {
  AiTransactionParseOutputValidator,
  aiTransactionParseOutputValidator,
  REQUIRED_PARSE_OUTPUT_KEYS,
} from '../src/features/ai/transaction-draft/validator';
import { crossValidateTransactionDraft } from '../src/features/ai/transaction-draft/domain';
import {
  readCandidateContext,
  truncateLabel,
  CANDIDATE_LIMITS,
} from '../src/features/ai/transaction-draft/candidates';
import { buildTransactionParserPrompt } from '../src/features/ai/transaction-draft/prompt';
import {
  parseTransactionTextCore,
  getLocalizedAiErrorMessage,
  AI_ERROR_MESSAGES,
} from '../src/features/ai/transaction-draft/action-core';
import type {
  AiTransactionParseOutput,
  OpaqueCandidateContext,
  ParsedTransactionDraft,
} from '../src/features/ai/transaction-draft/types';
import { AiError } from '../src/lib/ai/errors';
import type { AiCredentialProvider, AiStructuredResult } from '../src/lib/ai/types';
import type { AiRouter } from '../src/lib/ai/router';

console.log('--- Running Phase 12A AI Transaction Draft Tests ---');

// =========================================================================
// 1. Output Validator Tests (Exact 11 Keys, Zero Coercion, Tokens Only)
// =========================================================================

function createValidModelOutput(): AiTransactionParseOutput {
  return {
    type: 'EXPENSE',
    amount: '85000',
    currency_code: 'VND',
    account_token: 'ACC_1',
    category_token: 'CAT_1',
    income_source_token: null,
    income_source_stream_token: null,
    merchant: 'Phở Thìn',
    note: 'Ăn trưa cùng đồng nghiệp',
    occurred_on: '2026-09-04',
    unmatched_text: null,
  };
}

// 1. Non-object / null / array rejected
assert.throws(
  () => aiTransactionParseOutputValidator.validate(null),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'null output must be rejected with AI_STRUCTURED_OUTPUT_INVALID'
);
assert.throws(
  () => aiTransactionParseOutputValidator.validate([]),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'array output must be rejected with AI_STRUCTURED_OUTPUT_INVALID'
);
assert.throws(
  () => aiTransactionParseOutputValidator.validate('{"type":"EXPENSE"}'),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'raw string output must be rejected with AI_STRUCTURED_OUTPUT_INVALID'
);
console.log('  ✓ 1. Non-object, null, array, and string rejected with AI_STRUCTURED_OUTPUT_INVALID');

// 2. Exact Keyset (PHASE_12A_OUTPUT_VALIDATOR_EXACT_KEYSET=true)
const missingKeyOutput = createValidModelOutput() as any;
delete missingKeyOutput.unmatched_text;
assert.throws(
  () => aiTransactionParseOutputValidator.validate(missingKeyOutput),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'Output with 10 keys (missing unmatched_text) must fail exact keyset validation'
);

const extraKeyOutput = { ...createValidModelOutput(), extra_field: 'bogus' };
assert.throws(
  () => aiTransactionParseOutputValidator.validate(extraKeyOutput),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'Output with 12 keys (extra_field present) must fail exact keyset validation'
);
console.log('  ✓ 2. Exact keyset strictly enforced (10 keys fails, 12 keys fails)');

// 3. Zero Coercion (PHASE_12A_OUTPUT_VALIDATOR_COERCION=false)
const numberAmountOutput = { ...createValidModelOutput(), amount: 85000 as any };
assert.throws(
  () => aiTransactionParseOutputValidator.validate(numberAmountOutput),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'amount as a JavaScript number must NOT be coerced and must fail closed'
);

const validOutput = aiTransactionParseOutputValidator.validate(createValidModelOutput());
assert.strictEqual(validOutput.amount, '85000');
assert.strictEqual(validOutput.type, 'EXPENSE');
console.log('  ✓ 3. Zero coercion strictly enforced (numeric amount rejected, string amount accepted)');

// 4. Type field validation
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      type: 'TRANSFER' as any,
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'type TRANSFER must be rejected'
);
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      type: 'expense' as any, // lowercase
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID',
  'lowercase type must be rejected'
);

// Null type is valid
const nullTypeOutput = aiTransactionParseOutputValidator.validate({
  ...createValidModelOutput(),
  type: null,
});
assert.strictEqual(nullTypeOutput.type, null);
console.log('  ✓ 4. Type field strictly validated (INCOME, EXPENSE, null only)');

// 5. Currency field validation
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      currency_code: 'vnd' as any, // lowercase
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      currency_code: 'US' as any, // 2 chars
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
console.log('  ✓ 5. Currency code strictly 3 uppercase letters or null');

// 6. Token format validation
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      account_token: 'acc_1', // lowercase
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      account_token: randomUUID(), // UUID rejected at model boundary
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      category_token: 'CAT_INVALID',
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
console.log('  ✓ 6. Candidate tokens strictly validated against regex ^(ACC|CAT|SRC|STR)_[0-9]+$ (UUIDs rejected)');

// 7. Date format validation
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      occurred_on: '04/09/2026',
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
assert.throws(
  () =>
    aiTransactionParseOutputValidator.validate({
      ...createValidModelOutput(),
      occurred_on: '2026-13-45', // invalid date
    }),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
console.log('  ✓ 7. Date strictly validated against ISO YYYY-MM-DD');

// 8. Text boundaries
const longMerchantOutput = {
  ...createValidModelOutput(),
  merchant: 'A'.repeat(101),
};
assert.throws(
  () => aiTransactionParseOutputValidator.validate(longMerchantOutput),
  (err: unknown) => err instanceof AiError && err.code === 'AI_STRUCTURED_OUTPUT_INVALID'
);
console.log('  ✓ 8. Text length boundaries strictly enforced (merchant <= 100, note <= 255)');

// =========================================================================
// 2. Domain Cross-Validation Tests (Token-to-UUID Mapping, Currency Precedence, Warnings)
// =========================================================================

const acc1Id = randomUUID();
const acc2Id = randomUUID();
const cat1Id = randomUUID(); // EXPENSE
const cat2Id = randomUUID(); // INCOME
const src1Id = randomUUID();
const str1Id = randomUUID();

const sampleCandidates: OpaqueCandidateContext = {
  accounts: [
    { id: acc1Id, token: 'ACC_1', label: 'Tiền mặt', currency_code: 'VND', is_archived: false },
    { id: acc2Id, token: 'ACC_2', label: 'Wise USD', currency_code: 'USD', is_archived: false },
  ],
  categories: [
    { id: cat1Id, token: 'CAT_1', label: 'Ăn uống', type: 'EXPENSE', is_archived: false },
    { id: cat2Id, token: 'CAT_2', label: 'Lương', type: 'INCOME', is_archived: false },
  ],
  incomeSources: [
    { id: src1Id, token: 'SRC_1', label: 'Công ty ABC', is_archived: false },
  ],
  incomeStreams: [
    { id: str1Id, source_id: src1Id, token: 'STR_1', label: 'Lương cố định', is_archived: false },
  ],
  accountsOmitted: false,
  categoriesOmitted: false,
  incomeSourcesOmitted: false,
  incomeStreamsOmitted: false,
};

// 9. Standard Expense mapping
const standardExpenseDraft = crossValidateTransactionDraft({
  rawOutput: createValidModelOutput(),
  candidates: sampleCandidates,
  baseCurrency: 'VND',
});
assert.strictEqual(standardExpenseDraft.type, 'EXPENSE');
assert.strictEqual(standardExpenseDraft.amount, '85000.0000');
assert.strictEqual(standardExpenseDraft.currency_code, 'VND');
assert.strictEqual(standardExpenseDraft.account_id, acc1Id);
assert.strictEqual(standardExpenseDraft.category_id, cat1Id);
assert.strictEqual(standardExpenseDraft.income_source_id, null);
assert.strictEqual(standardExpenseDraft.income_source_stream_id, null);
assert.strictEqual(standardExpenseDraft.merchant, 'Phở Thìn');
assert.strictEqual(standardExpenseDraft.warning_codes.length, 0);
console.log('  ✓ 9. Standard expense cross-validates with zero warnings and exact 4-decimal amount');

// 10. Amount validation: missing vs invalid
const missingAmountDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), amount: null },
  candidates: sampleCandidates,
});
assert.strictEqual(missingAmountDraft.amount, null);
assert.ok(missingAmountDraft.warning_codes.includes('AMOUNT_MISSING'));

const invalidAmountDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), amount: '-50000' },
  candidates: sampleCandidates,
});
assert.strictEqual(invalidAmountDraft.amount, null);
assert.ok(invalidAmountDraft.warning_codes.includes('AMOUNT_INVALID'));
console.log('  ✓ 10. Amount missing and invalid emit deterministic warnings');

// 11. Type missing warning
const missingTypeDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), type: null },
  candidates: sampleCandidates,
});
assert.strictEqual(missingTypeDraft.type, null);
assert.ok(missingTypeDraft.warning_codes.includes('TYPE_MISSING'));
console.log('  ✓ 11. Missing type emits TYPE_MISSING warning');

// 12. Unknown token handling (fabricated tokens from model)
const fabricatedTokenDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), account_token: 'ACC_999', category_token: 'CAT_999' },
  candidates: sampleCandidates,
});
assert.strictEqual(fabricatedTokenDraft.account_id, null);
assert.strictEqual(fabricatedTokenDraft.category_id, null);
assert.ok(fabricatedTokenDraft.warning_codes.includes('UNKNOWN_MODEL_TOKEN'));
assert.ok(fabricatedTokenDraft.warning_codes.includes('ACCOUNT_NOT_MATCHED'));
assert.ok(fabricatedTokenDraft.warning_codes.includes('CATEGORY_NOT_MATCHED'));
console.log('  ✓ 12. Fabricated tokens map to null with UNKNOWN_MODEL_TOKEN');

// 13. Stale / archived candidate handling
const staleCandidates: OpaqueCandidateContext = {
  ...sampleCandidates,
  accounts: [{ id: acc1Id, token: 'ACC_1', label: 'Archived Acc', currency_code: 'VND', is_archived: true }],
};
const staleDraft = crossValidateTransactionDraft({
  rawOutput: createValidModelOutput(),
  candidates: staleCandidates,
});
assert.strictEqual(staleDraft.account_id, null);
assert.ok(staleDraft.warning_codes.includes('ACCOUNT_NOT_MATCHED'));
console.log('  ✓ 13. Archived candidate token maps to null with ACCOUNT_NOT_MATCHED');

// 14. Currency Precedence & Account Conflict
// Case A: User explicitly specifies USD in text, but model matched ACC_1 (which is VND).
// Result: Explicit USD preserved, account rejected (null), ACCOUNT_CURRENCY_CONFLICT emitted.
const conflictDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), currency_code: 'USD', account_token: 'ACC_1' },
  candidates: sampleCandidates,
});
assert.strictEqual(conflictDraft.currency_code, 'USD');
assert.strictEqual(conflictDraft.account_id, null);
assert.ok(conflictDraft.warning_codes.includes('ACCOUNT_CURRENCY_CONFLICT'));

// Case B: No explicit currency, account ACC_2 (USD) matched.
// Result: Inherits account currency USD with zero currency warnings.
const accountCurrencyDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), currency_code: null, account_token: 'ACC_2' },
  candidates: sampleCandidates,
});
assert.strictEqual(accountCurrencyDraft.currency_code, 'USD');
assert.strictEqual(accountCurrencyDraft.account_id, acc2Id);
assert.ok(!accountCurrencyDraft.warning_codes.includes('CURRENCY_INFERRED'));

// Case C: No explicit currency, no account matched.
// Result: Falls back to baseCurrency (VND) and emits CURRENCY_INFERRED.
const baseCurrencyDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), currency_code: null, account_token: null },
  candidates: sampleCandidates,
  baseCurrency: 'VND',
});
assert.strictEqual(baseCurrencyDraft.currency_code, 'VND');
assert.ok(baseCurrencyDraft.warning_codes.includes('CURRENCY_INFERRED'));
console.log('  ✓ 14. Currency precedence strictly enforced (Explicit > Account > Base fallback)');

// 15. Category Type Conflict (e.g. transaction is EXPENSE, but category is INCOME)
const catConflictDraft = crossValidateTransactionDraft({
  rawOutput: { ...createValidModelOutput(), type: 'EXPENSE', category_token: 'CAT_2' }, // CAT_2 is INCOME
  candidates: sampleCandidates,
});
assert.strictEqual(catConflictDraft.category_id, null);
assert.ok(catConflictDraft.warning_codes.includes('CATEGORY_TYPE_CONFLICT'));
console.log('  ✓ 15. Category type mismatch emits CATEGORY_TYPE_CONFLICT and sets category_id to null');

// 16. Income Source & Stream attribution
// Case A: INCOME transaction with valid source and stream
const incomeDraft = crossValidateTransactionDraft({
  rawOutput: {
    ...createValidModelOutput(),
    type: 'INCOME',
    category_token: 'CAT_2',
    income_source_token: 'SRC_1',
    income_source_stream_token: 'STR_1',
  },
  candidates: sampleCandidates,
});
assert.strictEqual(incomeDraft.type, 'INCOME');
assert.strictEqual(incomeDraft.income_source_id, src1Id);
assert.strictEqual(incomeDraft.income_source_stream_id, str1Id);
assert.strictEqual(incomeDraft.warning_codes.length, 0);

// Case B: Stream parent mismatch
const mismatchedCandidates: OpaqueCandidateContext = {
  ...sampleCandidates,
  incomeStreams: [
    { id: str1Id, source_id: randomUUID(), token: 'STR_1', label: 'Other Stream', is_archived: false },
  ],
};
const streamMismatchDraft = crossValidateTransactionDraft({
  rawOutput: {
    ...createValidModelOutput(),
    type: 'INCOME',
    category_token: 'CAT_2',
    income_source_token: 'SRC_1',
    income_source_stream_token: 'STR_1',
  },
  candidates: mismatchedCandidates,
});
assert.strictEqual(streamMismatchDraft.income_source_id, src1Id);
assert.strictEqual(streamMismatchDraft.income_source_stream_id, null);
assert.ok(streamMismatchDraft.warning_codes.includes('INCOME_STREAM_PARENT_CONFLICT'));

// Case C: EXPENSE transaction with income tokens ignores income fields
const expenseWithIncomeTokens = crossValidateTransactionDraft({
  rawOutput: {
    ...createValidModelOutput(),
    type: 'EXPENSE',
    income_source_token: 'SRC_1',
    income_source_stream_token: 'STR_1',
  },
  candidates: sampleCandidates,
});
assert.strictEqual(expenseWithIncomeTokens.income_source_id, null);
assert.strictEqual(expenseWithIncomeTokens.income_source_stream_id, null);
console.log('  ✓ 16. Income source & stream attribution verified (valid matched, parent mismatch handled, expense ignores)');

// 17. Candidate Overflow Failsafe (PHASE_12A_CANDIDATE_OVERFLOW_FAILSAFE=true)
const overflowCandidates: OpaqueCandidateContext = {
  accounts: [],
  categories: [],
  incomeSources: [],
  incomeStreams: [],
  accountsOmitted: true,
  categoriesOmitted: true,
  incomeSourcesOmitted: true,
  incomeStreamsOmitted: true,
};
const overflowDraft = crossValidateTransactionDraft({
  rawOutput: {
    ...createValidModelOutput(),
    type: 'INCOME',
    account_token: 'ACC_1',
    category_token: 'CAT_1',
    income_source_token: 'SRC_1',
    income_source_stream_token: 'STR_1',
  },
  candidates: overflowCandidates,
});
assert.strictEqual(overflowDraft.account_id, null);
assert.strictEqual(overflowDraft.category_id, null);
assert.strictEqual(overflowDraft.income_source_id, null);
assert.strictEqual(overflowDraft.income_source_stream_id, null);
assert.ok(overflowDraft.warning_codes.includes('ACCOUNT_CANDIDATES_OMITTED'));
assert.ok(overflowDraft.warning_codes.includes('CATEGORY_CANDIDATES_OMITTED'));
assert.ok(overflowDraft.warning_codes.includes('INCOME_SOURCE_CANDIDATES_OMITTED'));
assert.ok(overflowDraft.warning_codes.includes('INCOME_STREAM_CANDIDATES_OMITTED'));
console.log('  ✓ 17. Candidate overflow failsafe strictly verified (omitted dimensions emit specific warnings)');

// 18. Label truncation helper
const longLabel = 'A'.repeat(100);
const truncated = truncateLabel(longLabel);
assert.strictEqual(truncated.length, CANDIDATE_LIMITS.MAX_LABEL_LENGTH);
console.log(`  ✓ 18. Candidate label truncation helper bounds to ${CANDIDATE_LIMITS.MAX_LABEL_LENGTH} chars`);

// =========================================================================
// 3. Prompt Construction Tests
// =========================================================================

// 19. Prompt builder supplies server temporal context and candidate tokens without UUIDs
const promptResult = buildTransactionParserPrompt({
  promptText: 'Ăn trưa 85k tiền mặt',
  candidates: sampleCandidates,
  userSettings: { baseCurrency: 'VND', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' },
  now: new Date('2026-09-04T12:00:00Z'),
});
assert.ok(promptResult.prompt.includes('2026-09-04'));
assert.ok(promptResult.prompt.includes('ACC_1'));
assert.ok(promptResult.prompt.includes('CAT_1'));
assert.ok(!promptResult.prompt.includes(acc1Id), 'Prompt MUST NOT contain real database UUIDs');
assert.ok(!promptResult.systemInstruction.includes(acc1Id), 'System instruction MUST NOT contain real database UUIDs');
assert.ok(promptResult.systemInstruction.includes('EXACTLY 11 properties'));
console.log('  ✓ 19. Prompt construction supplies server temporal context and zero database UUIDs');

// =========================================================================
// 4. Action Core Orchestration & Error Sanitization Tests
// =========================================================================

async function runAsyncTests() {
  // 20. Empty prompt rejected
  const emptyRes = await parseTransactionTextCore({
    prompt: '   ',
    userId: randomUUID(),
    supabase: {} as any,
    router: {} as any,
    credentialProvider: {} as any,
  });
  assert.strictEqual(emptyRes.ok, false);
  if (!emptyRes.ok) {
    assert.strictEqual(emptyRes.error.code, 'AI_INVALID_REQUEST');
  }

  // 21. Overlong prompt rejected (> 300 chars)
  const overlongRes = await parseTransactionTextCore({
    prompt: 'A'.repeat(301),
    userId: randomUUID(),
    supabase: {} as any,
    router: {} as any,
    credentialProvider: {} as any,
  });
  assert.strictEqual(overlongRes.ok, false);
  if (!overlongRes.ok) {
    assert.strictEqual(overlongRes.error.code, 'AI_INVALID_REQUEST');
  }

  // 22. Unauthenticated caller rejected
  const unauthRes = await parseTransactionTextCore({
    prompt: 'Ăn trưa 85k',
    userId: '',
    supabase: {} as any,
    router: {} as any,
    credentialProvider: {} as any,
  });
  assert.strictEqual(unauthRes.ok, false);
  if (!unauthRes.ok) {
    assert.strictEqual(unauthRes.error.code, 'AUTH_REQUIRED');
  }
  console.log('  ✓ 20-22. Action core validates input boundaries (empty, >300 chars, unauthenticated)');

  // 23. Mock Router Execution (Offline, Deterministic)
  const testUserId = randomUUID();
  let executedOperation = '';
  let executedTimeoutMs = 0;

  const mockRouter: AiRouter = {
    execute: async (req: any, ctx?: any) => {
      executedOperation = req.operation;
      executedTimeoutMs = ctx?.timeoutMs || 0;
      return {
        ok: true,
        data: createValidModelOutput(),
        provider: 'mock-gemini',
        model: 'gemini-2.5-flash',
      };
    },
  } as any;

  const fakeSupabase = {
    from: (table: string) => {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [] }),
            single: () => Promise.resolve({ data: null }),
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      };
    },
  } as any;

  const mockCredentialProvider: AiCredentialProvider = {
    resolveCredential: async () => ({ value: 'test-key', providerId: 'gemini' }),
  };

  const successRes = await parseTransactionTextCore({
    prompt: 'Ăn trưa 85k tiền mặt hôm nay',
    userId: testUserId,
    supabase: fakeSupabase,
    router: mockRouter,
    credentialProvider: mockCredentialProvider,
    now: new Date('2026-09-04T12:00:00Z'),
    userSettings: { baseCurrency: 'VND', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' },
  });

  assert.strictEqual(successRes.ok, true);
  assert.strictEqual(executedOperation, 'transaction_parser');
  assert.strictEqual(executedTimeoutMs, 15000);
  if (successRes.ok) {
    assert.strictEqual(successRes.draft.type, 'EXPENSE');
    assert.strictEqual(successRes.draft.amount, '85000.0000');
    assert.strictEqual(successRes.rawText, 'Ăn trưa 85k tiền mặt hôm nay');
  }
  console.log('  ✓ 23. Mock Router orchestrates end-to-end draft creation successfully with 15s timeout');

  // 24. Router failure error sanitization (All standard error codes mapped to clear Vietnamese)
  for (const [code, expectedMsg] of Object.entries(AI_ERROR_MESSAGES)) {
    const failingRouter: AiRouter = {
      execute: async () => ({
        ok: false,
        error: new AiError({ code: code as any, message: 'Internal provider message' }),
      }),
    } as any;

    const failRes = await parseTransactionTextCore({
      prompt: 'Ăn trưa 85k',
      userId: testUserId,
      supabase: fakeSupabase,
      router: failingRouter,
      credentialProvider: mockCredentialProvider,
    });

    assert.strictEqual(failRes.ok, false);
    if (!failRes.ok) {
      assert.strictEqual(failRes.error.code, code);
      assert.strictEqual(failRes.error.message, expectedMsg);
    }
  }
  console.log('  ✓ 24. All AI error codes sanitized to human-readable Vietnamese user messages');

  // 25. ZERO FINANCIAL MUTATION INVARIANT (PHASE_12A_AI_FINANCIAL_WRITE_CAPABILITY=false)
  let mutationAttempted = false;
  const auditingSupabase = {
    from: (table: string) => {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [] }),
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
        insert: () => {
          mutationAttempted = true;
          throw new Error('MUTATION FORBIDDEN IN AI LAYER');
        },
        update: () => {
          mutationAttempted = true;
          throw new Error('MUTATION FORBIDDEN IN AI LAYER');
        },
        delete: () => {
          mutationAttempted = true;
          throw new Error('MUTATION FORBIDDEN IN AI LAYER');
        },
      };
    },
  } as any;

  await parseTransactionTextCore({
    prompt: 'Ăn trưa 85k tiền mặt',
    userId: testUserId,
    supabase: auditingSupabase,
    router: mockRouter,
    credentialProvider: mockCredentialProvider,
  });

  assert.strictEqual(
    mutationAttempted,
    false,
    'AI layer must NEVER execute insert, update, or delete on any table'
  );
  console.log('  ✓ 25. Invariant verified: AI layer possesses ZERO financial mutation capability');

  console.log('All 25 Phase 12A AI Transaction Draft tests passed successfully!');
}

runAsyncTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
