/**
 * Finora Phase 10 — AI Foundation Unit Tests
 *
 * Deterministic test suite verifying:
 * - Provider abstraction and registration (fail-closed on duplicates)
 * - AI Router operation dispatch & model resolution (single model source of truth)
 * - Fail-closed on unknown operations
 * - Central generation configuration propagation (temperature, maxTokens, timeout)
 * - Credential dependency injection (Phase 11 port)
 * - Separation of Text and Structured response modes
 * - Structured result runtime validation & fail-closed error handling
 * - Error taxonomy normalization and secret sanitization
 * - Timeout and caller abort orchestration (signal forwarding)
 * - Gemini adapter core mapping with responseJsonSchema and injectable fake client
 * - Exact money string validation boundary
 *
 * Zero real network calls. Zero production credentials required.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  AI_OPERATION_CONFIG,
  DEFAULT_GEMINI_MODEL,
  getOperationConfig,
} from '../src/lib/ai/config';
import { AiError, sanitizeErrorMessage } from '../src/lib/ai/errors';
import type { AiProvider } from '../src/lib/ai/provider';
import {
  GeminiProviderCore,
  normalizeGeminiError,
} from '../src/lib/ai/providers/gemini-core';
import { AiRouter, createAiRouter } from '../src/lib/ai/router';
import { parseAndValidateJson } from '../src/lib/ai/structured-result';
import type {
  AiCredential,
  AiCredentialProvider,
  AiExecutionContext,
  AiOutputValidator,
  AiProviderExecutionRequest,
  AiProviderResponse,
  AiRequest,
  AiStructuredRequest,
  AiTextRequest,
} from '../src/lib/ai/types';

let testsPassed = 0;

function it(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      testsPassed++;
      console.log(`[PASS] ${name}`);
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      process.exit(1);
    }
  })();
}

class FakeProvider implements AiProvider {
  readonly id: string;
  responseToReturn?: string;
  errorToThrow?: Error;
  lastRequest?: AiProviderExecutionRequest;
  delayMs?: number;

  constructor(id: string = 'fake-provider') {
    this.id = id;
  }

  async execute<TInput, TOutput>(
    request: AiProviderExecutionRequest<TInput, TOutput>,
    credential: AiCredential,
    context?: AiExecutionContext
  ): Promise<AiProviderResponse> {
    this.lastRequest = request as AiProviderExecutionRequest;

    if (this.delayMs && this.delayMs > 0) {
      const signal = request.signal ?? context?.signal;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), this.delayMs);
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('Operation aborted'));
            },
            { once: true }
          );
        }
      });
    }

    if (this.errorToThrow) {
      throw this.errorToThrow;
    }

    return {
      text: this.responseToReturn ?? '{"status": "ok"}',
      model: request.model,
      usage: {
        inputTokens: 120,
        outputTokens: 45,
        totalTokens: 165,
      },
    };
  }
}

class FakeCredentialProvider implements AiCredentialProvider {
  credentialToReturn: AiCredential | null = { value: 'fake-api-key-12345' };
  shouldThrow = false;

  async resolveCredential(): Promise<AiCredential | null> {
    if (this.shouldThrow) {
      throw new Error('Credential storage unavailable');
    }
    return this.credentialToReturn;
  }
}

interface ParsedTransactionOutput {
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string;
}

const transactionValidator: AiOutputValidator<ParsedTransactionOutput> = {
  name: 'TransactionParser',
  jsonSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
      amount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      description: { type: 'string' },
    },
    required: ['type', 'amount', 'description'],
  },
  validate(val: unknown): ParsedTransactionOutput {
    if (!val || typeof val !== 'object') {
      throw new Error('Expected JSON object');
    }
    const obj = val as Record<string, unknown>;
    if (obj.type !== 'INCOME' && obj.type !== 'EXPENSE') {
      throw new Error(`Invalid transaction type: ${String(obj.type)}`);
    }
    if (typeof obj.amount !== 'string' || !/^\d+(\.\d+)?$/.test(obj.amount)) {
      throw new Error(`Amount must be exact string decimal, got: ${String(obj.amount)}`);
    }
    if (typeof obj.description !== 'string' || obj.description.trim() === '') {
      throw new Error('Description must be non-empty string');
    }
    return {
      type: obj.type,
      amount: obj.amount,
      description: obj.description.trim(),
    };
  },
};

async function runAllTests() {
  console.log('--- Phase 10 AI Foundation Test Suite ---');

  // --- 1. Configuration & Operations ---
  await it('1. Central configuration defines known operations and default models', () => {
    assert.strictEqual(DEFAULT_GEMINI_MODEL, 'gemini-2.5-flash');
    assert.ok(AI_OPERATION_CONFIG.transaction_parser);
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.providerId, 'gemini');
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.model, 'gemini-2.5-flash');
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.timeoutMs, 15000);
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.temperature, 0.1);
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.maxOutputTokens, 1024);

    assert.ok(AI_OPERATION_CONFIG.categorization);
    assert.ok(AI_OPERATION_CONFIG.financial_assistant);
    assert.ok(AI_OPERATION_CONFIG.receipt_vision);
    assert.ok(AI_OPERATION_CONFIG.report_summary);

    const retrieved = getOperationConfig('transaction_parser');
    assert.strictEqual(retrieved?.model, 'gemini-2.5-flash');
  });

  await it('2. Central configuration returns undefined for unknown operations', () => {
    const nonExistent = getOperationConfig('non_existent_op');
    assert.strictEqual(nonExistent, undefined);
  });

  // --- 2. Router Provider Registration & Fail-Closed Registry ---
  await it('3. AI Router registers and looks up providers correctly', () => {
    const router = createAiRouter();
    const fake = new FakeProvider('custom-test-provider');
    router.registerProvider(fake);

    const lookup = router.getProvider('custom-test-provider');
    assert.strictEqual(lookup, fake);
    assert.strictEqual(lookup?.id, 'custom-test-provider');
  });

  await it('4. AI Router constructor supports batch provider initialization', () => {
    const p1 = new FakeProvider('p1');
    const p2 = new FakeProvider('p2');
    const router = new AiRouter({ providers: [p1, p2] });

    assert.strictEqual(router.getProvider('p1'), p1);
    assert.strictEqual(router.getProvider('p2'), p2);
    assert.strictEqual(router.getProvider('non-existent'), undefined);
  });

  await it('5. AI Router throws when registering invalid provider without ID', () => {
    const router = createAiRouter();
    try {
      router.registerProvider({} as unknown as AiProvider);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
    }
  });

  await it('6. DUPLICATE_PROVIDER_REGISTRATION_REJECTED: Router rejects duplicate provider registrations by default', () => {
    const router = createAiRouter();
    const p1 = new FakeProvider('gemini');
    const p2 = new FakeProvider('gemini');
    router.registerProvider(p1);

    try {
      router.registerProvider(p2);
      assert.fail('Should have thrown on duplicate provider registration');
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('Duplicate AI provider registration'));
    }

    // Explicit override allowed
    router.registerProvider(p2, { allowOverride: true });
    assert.strictEqual(router.getProvider('gemini'), p2);
  });

  // --- 3. Operation Dispatch & Fail-Closed Routing ---
  await it('7. AI Router dispatches known operation to configured provider and model', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.responseToReturn = '{"parsed": true}';

    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'Ăn trưa 85k',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.provider, 'gemini');
      assert.strictEqual(res.model, 'gemini-2.5-flash');
      assert.strictEqual(res.data, '{"parsed": true}');
      assert.strictEqual(res.usage?.inputTokens, 120);
      assert.strictEqual(res.usage?.outputTokens, 45);
      assert.strictEqual(res.usage?.totalTokens, 165);
    }
  });

  await it('8. MODEL_COMES_ONLY_FROM_OPERATION_CONFIG: Provider receives model resolved from config', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    await router.execute(
      {
        operation: 'financial_assistant',
        prompt: 'How is my savings rate?',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.ok(fakeGemini.lastRequest);
    assert.strictEqual(fakeGemini.lastRequest.model, 'gemini-2.5-flash');
  });

  await it('9. UNKNOWN_OPERATION_WITH_MODEL_OVERRIDE_FAILS_CLOSED: Unknown operation fails closed even if arbitrary properties are present', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'unknown_op_bypass',
        prompt: 'test',
        overrideModel: 'gemini-arbitrary',
      } as unknown as AiTextRequest,
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_REQUEST');
      assert.ok(res.error.message.includes("Unknown AI operation 'unknown_op_bypass'"));
    }
  });

  await it('10. UNKNOWN_OPERATION_WITHOUT_CONFIG_FAILS_CLOSED: Normal unknown operation fails closed', async () => {
    const router = createAiRouter();
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'unregistered_future_op',
        prompt: 'test',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_REQUEST');
    }
  });

  // --- 4. Central Generation Config Propagation ---
  await it('11. CONFIG_TEMPERATURE_PROPAGATES: Router forwards operation config temperature', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(fakeGemini.lastRequest?.temperature, 0.1);
  });

  await it('12. CONFIG_MAX_OUTPUT_TOKENS_PROPAGATES: Router forwards operation config maxOutputTokens', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(fakeGemini.lastRequest?.maxTokens, 1024);
  });

  await it('13. REQUEST_TEMPERATURE_OVERRIDE_BEHAVIOR: Request temperature overrides operation default', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        temperature: 0.7,
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(fakeGemini.lastRequest?.temperature, 0.7);
  });

  await it('14. REQUEST_MAX_TOKEN_OVERRIDE_BEHAVIOR: Request maxTokens overrides operation default', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        maxTokens: 256,
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(fakeGemini.lastRequest?.maxTokens, 256);
  });

  // --- 5. Credential Dependency & Error Normalization ---
  await it('15. AI Router returns AI_NOT_CONFIGURED when execution context lacks credential provider', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });

    const res = await router.execute({
      operation: 'transaction_parser',
      prompt: 'test',
    });

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_NOT_CONFIGURED');
    }
  });

  await it('16. AI Router returns AI_NOT_CONFIGURED when credential provider returns null/empty key', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();
    credProvider.credentialToReturn = null;

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_NOT_CONFIGURED');
    }
  });

  await it('17. AI Router returns AI_AUTH_FAILED when credential resolution throws an error', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();
    credProvider.shouldThrow = true;

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_AUTH_FAILED');
    }
  });

  await it('18. AI Router returns AI_PROVIDER_UNAVAILABLE when requested provider is missing', async () => {
    const router = createAiRouter(); // No providers registered
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_PROVIDER_UNAVAILABLE');
      assert.strictEqual(res.error.providerId, 'gemini');
    }
  });

  // --- 6. Text Mode & Empty Response Handling ---
  await it('19. TEXT_MODE_RETURNS_STRING_ONLY: Text request returns string data', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.responseToReturn = 'Summary text output from AI';

    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'report_summary',
        prompt: 'Summarize spending',
        responseMode: 'text',
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(typeof res.data, 'string');
      assert.strictEqual(res.data, 'Summary text output from AI');
    }
  });

  await it('20. TEXT_MODE_EMPTY_RESPONSE_FAILS: Text request fails closed on empty string response', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.responseToReturn = '';

    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'report_summary',
        prompt: 'Summarize spending',
        responseMode: 'text',
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_RESPONSE');
    }
  });

  await it('21. TEXT_MODE_WHITESPACE_RESPONSE_FAILS: Text request fails closed on whitespace-only response', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.responseToReturn = '   \n\t  ';

    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'report_summary',
        prompt: 'Summarize spending',
        responseMode: 'text',
      },
      { credentialProvider: credProvider }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_RESPONSE');
    }
  });

  // --- 7. Structured Runtime Validation ---
  await it('22. STRUCTURED_MODE_REQUIRES_VALIDATOR: Structured request fails closed if validator is missing', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.responseToReturn = '{"data": 123}';

    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        responseMode: 'structured',
      } as unknown as AiStructuredRequest<unknown, unknown>,
      { credentialProvider: credProvider }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_REQUEST');
      assert.ok(res.error.message.includes('Structured response mode requires an outputValidator'));
    }
  });

  await it('23. STRUCTURED_MODE_VALID_RESPONSE: Structured result runtime validates matching output successfully', () => {
    const validJson = JSON.stringify({
      type: 'EXPENSE',
      amount: '85000',
      description: 'Ăn trưa',
    });

    const res = parseAndValidateJson(validJson, transactionValidator, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      usage: { totalTokens: 50 },
    });

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.data.type, 'EXPENSE');
      assert.strictEqual(res.data.amount, '85000');
      assert.strictEqual(res.data.description, 'Ăn trưa');
      assert.strictEqual(res.provider, 'gemini');
      assert.strictEqual(res.usage?.totalTokens, 50);
    }
  });

  await it('24. STRUCTURED_MODE_MARKDOWN_CODEBLOCK: Structured result handles markdown code block wrapped JSON cleanly', () => {
    const markdownJson = '```json\n{"type": "INCOME", "amount": "25000000", "description": "Lương tháng 9"}\n```';

    const res = parseAndValidateJson(markdownJson, transactionValidator, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.data.type, 'INCOME');
      assert.strictEqual(res.data.amount, '25000000');
    }
  });

  await it('25. STRUCTURED_MODE_MALFORMED_JSON: Structured result fails closed on malformed JSON', () => {
    const malformed = '{"type": "EXPENSE", amount: 85000'; // syntax error

    const res = parseAndValidateJson(malformed, transactionValidator, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_STRUCTURED_OUTPUT_INVALID');
      assert.ok(res.error.message.includes('Failed to parse AI provider output as valid JSON'));
    }
  });

  await it('26. STRUCTURED_MODE_SCHEMA_INVALID: Structured result fails closed on schema validation error (number instead of string)', () => {
    const invalidSchema = JSON.stringify({
      type: 'EXPENSE',
      amount: 85000, // Number instead of string decimal
      description: 'Ăn trưa',
    });

    const res = parseAndValidateJson(invalidSchema, transactionValidator, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_STRUCTURED_OUTPUT_INVALID');
      assert.ok(res.error.message.includes("AI structured output failed schema validation for 'TransactionParser'"));
      assert.ok(res.error.details?.includes('Amount must be exact string decimal'));
    }
  });

  await it('27. STRUCTURED_MODE_EMPTY_RESPONSE_FAILS: Structured result fails closed on empty text response', () => {
    const res = parseAndValidateJson('', transactionValidator, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_RESPONSE');
    }
  });

  await it('28. AI Router executes end-to-end structured validation with provider', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.responseToReturn = JSON.stringify({
      type: 'EXPENSE',
      amount: '45000.5000',
      description: 'Cà phê sáng',
    });

    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute<unknown, ParsedTransactionOutput>(
      {
        operation: 'transaction_parser',
        prompt: 'Cà phê sáng 45k5',
        responseMode: 'structured',
        outputValidator: transactionValidator,
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.data.type, 'EXPENSE');
      assert.strictEqual(res.data.amount, '45000.5000');
      assert.strictEqual(res.data.description, 'Cà phê sáng');
    }
  });

  // --- 8. Timeouts and Caller Abort Orchestration ---
  await it('29. CALLER_ABORT: Pre-aborted caller signal returns AI_ABORTED', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const controller = new AbortController();
    controller.abort(); // Pre-aborted

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        signal: controller.signal,
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_ABORTED');
    }
  });

  await it('30. CALLER_ABORT_IN_FLIGHT: In-flight abort returns AI_ABORTED', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.delayMs = 150;
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        signal: controller.signal,
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_ABORTED');
    }
  });

  await it('31. TIMEOUT: Request exceeding timeoutMs returns AI_TIMEOUT', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.delayMs = 200;
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        timeoutMs: 40,
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_TIMEOUT');
      assert.ok(res.error.message.includes('timed out after 40ms'));
    }
  });

  // --- 9. Error Sanitization & Security ---
  await it('32. SECRET_SANITIZATION_API_KEY: Strips AIza-style keys', () => {
    const secretKey = 'AIzaSyD-1234567890abcdefghijklmnopqrstuv';
    const rawError = `Authentication failed for key ${secretKey}`;

    const err = new AiError({
      code: 'AI_AUTH_FAILED',
      message: rawError,
      providerId: 'gemini',
    });

    assert.strictEqual(err.code, 'AI_AUTH_FAILED');
    assert.strictEqual(err.message.includes(secretKey), false);
    assert.ok(err.message.includes('AIza••••[REDACTED]'));
  });

  await it('33. SECRET_SANITIZATION_BEARER_TOKEN: Strips Bearer authorization tokens', () => {
    const rawError = 'Failed request with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
    const err = new AiError({
      code: 'AI_AUTH_FAILED',
      message: rawError,
      providerId: 'gemini',
    });

    assert.strictEqual(err.message.includes('eyJhbGciOiJIUzI1Ni'), false);
    assert.ok(err.message.includes('Authorization: Bearer [REDACTED]'));
  });

  await it('34. SECRET_SANITIZATION_GENERIC_KEY: Strips api_key= query parameters', () => {
    const rawError = 'Request failed on url https://generativelanguage.googleapis.com/v1/models?api_key=secretKey123&other=true';
    const sanitized = sanitizeErrorMessage(rawError);
    assert.strictEqual(sanitized.includes('secretKey123'), false);
    assert.ok(sanitized.includes('api_key=[REDACTED]'));
  });

  await it('35. AiError toJSON provides clean serializable structure', () => {
    const err = new AiError({
      code: 'AI_RATE_LIMITED',
      message: 'Quota exceeded',
      providerId: 'gemini',
      details: 'Rate limit bucket empty',
    });

    const json = err.toJSON();
    assert.strictEqual(json.name, 'AiError');
    assert.strictEqual(json.code, 'AI_RATE_LIMITED');
    assert.strictEqual(json.message, 'Quota exceeded');
    assert.strictEqual(json.providerId, 'gemini');
    assert.strictEqual(json.details, 'Rate limit bucket empty');
  });

  // --- 10. Gemini Provider Core with Fake Client ---
  await it('36. GEMINI_CORE_PASSES_CONFIG_AND_EXTRACTS_RESPONSE: Passes parameters and returns response data', async () => {
    let capturedParams: unknown;

    const fakeClientFactory = (cred: AiCredential) => {
      assert.strictEqual(cred.value, 'test-injected-gemini-key');
      return {
        models: {
          async generateContent(params: unknown) {
            capturedParams = params;
            return {
              text: '{"result": "success"}',
              usageMetadata: {
                promptTokenCount: 15,
                candidatesTokenCount: 30,
                totalTokenCount: 45,
              },
            };
          },
        },
      };
    };

    const provider = new GeminiProviderCore({ clientFactory: fakeClientFactory });
    const response = await provider.execute(
      {
        operation: 'transaction_parser',
        model: 'gemini-2.5-flash',
        prompt: 'Test prompt for gemini',
        systemInstruction: 'You are a financial parsing engine.',
        temperature: 0.1,
        maxTokens: 1024,
        outputValidator: transactionValidator,
      },
      { value: 'test-injected-gemini-key' }
    );

    assert.strictEqual(response.text, '{"result": "success"}');
    assert.strictEqual(response.model, 'gemini-2.5-flash');
    assert.strictEqual(response.usage?.inputTokens, 15);
    assert.strictEqual(response.usage?.outputTokens, 30);
    assert.strictEqual(response.usage?.totalTokens, 45);

    const params = capturedParams as {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
      };
    };
    assert.strictEqual(params.model, 'gemini-2.5-flash');
    assert.strictEqual(params.contents, 'Test prompt for gemini');
    assert.strictEqual(params.config?.systemInstruction, 'You are a financial parsing engine.');
    assert.strictEqual(params.config?.temperature, 0.1);
    assert.strictEqual(params.config?.maxOutputTokens, 1024);
  });

  await it('37. GEMINI_JSON_SCHEMA_USES_RESPONSE_JSON_SCHEMA: Maps JSON Schema to responseJsonSchema', async () => {
    let capturedConfig: unknown;

    const fakeClientFactory = () => ({
      models: {
        async generateContent(params: { config?: unknown }) {
          capturedConfig = params.config;
          return { text: '{"type": "INCOME", "amount": "1000", "description": "Bonus"}' };
        },
      },
    });

    const provider = new GeminiProviderCore({ clientFactory: fakeClientFactory });
    await provider.execute(
      {
        operation: 'transaction_parser',
        model: 'gemini-2.5-flash',
        prompt: 'Test prompt',
        outputValidator: transactionValidator,
      },
      { value: 'test-key' }
    );

    const config = capturedConfig as {
      responseMimeType?: string;
      responseJsonSchema?: unknown;
    };
    assert.strictEqual(config.responseMimeType, 'application/json');
    assert.strictEqual(config.responseJsonSchema, transactionValidator.jsonSchema);
  });

  await it('38. GEMINI_PROVIDER_REJECTS_EMPTY_CREDENTIAL: Empty credential throws AI_AUTH_FAILED', async () => {
    const provider = new GeminiProviderCore({
      clientFactory: () => ({ models: { generateContent: async () => ({ text: 'ok' }) } }),
    });
    try {
      await provider.execute(
        { operation: 'categorization', model: 'gemini-2.5-flash', prompt: 'test' },
        { value: '' }
      );
      assert.fail('Should have thrown on empty credential');
    } catch (err) {
      assert.ok(err instanceof AiError);
      assert.strictEqual(err.code, 'AI_AUTH_FAILED');
    }
  });

  await it('39. GEMINI_PROVIDER_REJECTS_MISSING_MODEL: Missing model throws AI_INVALID_REQUEST', async () => {
    const provider = new GeminiProviderCore({
      clientFactory: () => ({ models: { generateContent: async () => ({ text: 'ok' }) } }),
    });
    try {
      await provider.execute(
        { operation: 'categorization', model: '', prompt: 'test' },
        { value: 'valid-key' }
      );
      assert.fail('Should have thrown on missing model');
    } catch (err) {
      assert.ok(err instanceof AiError);
      assert.strictEqual(err.code, 'AI_INVALID_REQUEST');
    }
  });

  await it('40. NORMALIZE_GEMINI_ERROR_CLASSIFICATION: Correctly classifies Google SDK error strings', () => {
    const errAuth = normalizeGeminiError(new Error('API_KEY_INVALID: User api key not valid'));
    assert.strictEqual(errAuth.code, 'AI_AUTH_FAILED');

    const err403 = normalizeGeminiError(new Error('HTTP 403: Forbidden unauthenticated'));
    assert.strictEqual(err403.code, 'AI_AUTH_FAILED');

    const errQuota = normalizeGeminiError(new Error('Resource_exhausted: 429 quota exceeded'));
    assert.strictEqual(errQuota.code, 'AI_RATE_LIMITED');

    const errTimeout = normalizeGeminiError(new Error('Deadline_exceeded: request timed out'));
    assert.strictEqual(errTimeout.code, 'AI_TIMEOUT');

    const errUnavailable = normalizeGeminiError(new Error('Service Unavailable: 503 backend overloaded'));
    assert.strictEqual(errUnavailable.code, 'AI_PROVIDER_UNAVAILABLE');

    const errInvalidArg = normalizeGeminiError(new Error('Invalid_argument: prompt format malformed 400'));
    assert.strictEqual(errInvalidArg.code, 'AI_INVALID_REQUEST');

    const errGeneric = normalizeGeminiError(new Error('Socket disconnected unexpectedly'));
    assert.strictEqual(errGeneric.code, 'AI_PROVIDER_ERROR');
  });

  await it('41. GEMINI_ABORT_SIGNAL_FORWARDING: Forwards AbortSignal to Google SDK call', async () => {
    let capturedAbortSignal: AbortSignal | undefined;

    const fakeClientFactory = () => ({
      models: {
        async generateContent(params: { config?: { abortSignal?: AbortSignal } }) {
          capturedAbortSignal = params.config?.abortSignal;
          return { text: 'ok' };
        },
      },
    });

    const provider = new GeminiProviderCore({ clientFactory: fakeClientFactory });
    const controller = new AbortController();

    await provider.execute(
      {
        operation: 'transaction_parser',
        model: 'gemini-2.5-flash',
        prompt: 'test',
        signal: controller.signal,
      },
      { value: 'fake-key' }
    );

    assert.strictEqual(capturedAbortSignal, controller.signal);
  });

  await it('42. GENERIC_PROVIDER_ERROR_NORMALIZATION_PRESERVES_AIERROR: Preserves pre-normalized AiError', () => {
    const original = new AiError({
      code: 'AI_RATE_LIMITED',
      message: 'Already normalized rate limit',
      providerId: 'gemini',
    });
    const normalized = normalizeGeminiError(original);
    assert.strictEqual(normalized, original);
    assert.strictEqual(normalized.code, 'AI_RATE_LIMITED');
  });

  await it('43. SANITIZE_ERROR_MESSAGE_SAFELY_HANDLES_EDGE_CASES: Handles empty and non-string safely', () => {
    assert.strictEqual(sanitizeErrorMessage(''), '');
    assert.strictEqual(sanitizeErrorMessage(undefined as unknown as string), '');
    assert.strictEqual(sanitizeErrorMessage('No secrets in this message'), 'No secrets in this message');
  });

  await it('44. EXACT_MONEY_BOUNDARY_REJECTS_FLOATS: Validates that monetary amounts strictly reject numbers, floats, and scientific notation', () => {
    // Rejects JavaScript numbers
    assert.throws(
      () => transactionValidator.validate({ type: 'EXPENSE', amount: 15000, description: 'Lunch' }),
      /Amount must be exact string decimal/
    );

    // Rejects floating point objects
    assert.throws(
      () => transactionValidator.validate({ type: 'EXPENSE', amount: 15000.5, description: 'Lunch' }),
      /Amount must be exact string decimal/
    );

    // Rejects non-numeric strings
    assert.throws(
      () => transactionValidator.validate({ type: 'EXPENSE', amount: 'fifteen thousand', description: 'Lunch' }),
      /Amount must be exact string decimal/
    );

    // Rejects scientific notation
    assert.throws(
      () => transactionValidator.validate({ type: 'EXPENSE', amount: '1.5e4', description: 'Lunch' }),
      /Amount must be exact string decimal/
    );

    // Accepts exact integer string decimal
    const res1 = transactionValidator.validate({ type: 'EXPENSE', amount: '15000', description: 'Lunch' });
    assert.strictEqual(res1.amount, '15000');

    // Accepts exact fractional string decimal
    const res2 = transactionValidator.validate({ type: 'EXPENSE', amount: '15000.5000', description: 'Lunch' });
    assert.strictEqual(res2.amount, '15000.5000');
  });

  await it('45. SERVER_PRODUCTION_WRAPPER_IS_SERVER_ONLY: Asserts that production wrapper modules contain server-only boundary', () => {
    const geminiProdContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/ai/providers/gemini.ts'), 'utf8');
    assert.ok(geminiProdContent.includes("import 'server-only'"), 'gemini.ts must import server-only');

    const serverEntryContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/ai/server.ts'), 'utf8');
    assert.ok(serverEntryContent.includes("import 'server-only'"), 'server.ts must import server-only');

    const featureServerContent = fs.readFileSync(path.join(process.cwd(), 'src/features/ai/server.ts'), 'utf8');
    assert.ok(featureServerContent.includes("import 'server-only'"), 'features/ai/server.ts must import server-only');
  });

  console.log(`\n=== All Phase 10 AI Foundation Tests Passed (${testsPassed}/${testsPassed}) ===`);
}

runAllTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
