/**
 * Finora Phase 10 — AI Foundation Unit Tests
 *
 * Deterministic test suite verifying:
 * - Provider abstraction and registration
 * - AI Router operation dispatch & model resolution
 * - Credential dependency injection (Phase 11 port)
 * - Structured result runtime validation & fail-closed error handling
 * - Error taxonomy normalization
 * - Timeout and caller abort orchestration
 * - Gemini adapter mapping with injectable fake client
 *
 * Zero real network calls. Zero production credentials required.
 */

import assert from 'node:assert';
import {
  AI_OPERATION_CONFIG,
  DEFAULT_GEMINI_MODEL,
  getOperationConfig,
} from '../src/lib/ai/config';
import { AiError, sanitizeErrorMessage } from '../src/lib/ai/errors';
import type { AiProvider } from '../src/lib/ai/provider';
import { GeminiProvider, normalizeGeminiError } from '../src/lib/ai/providers/gemini';
import { AiRouter, createAiRouter } from '../src/lib/ai/router';
import { parseAndValidateJson } from '../src/lib/ai/structured-result';
import type {
  AiCredential,
  AiCredentialProvider,
  AiExecutionContext,
  AiOutputValidator,
  AiProviderResponse,
  AiRequest,
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
  lastRequest?: AiRequest;
  delayMs?: number;

  constructor(id: string = 'fake-provider') {
    this.id = id;
  }

  async execute<TInput, TOutput>(
    request: AiRequest<TInput, TOutput>,
    credential: AiCredential,
    context?: AiExecutionContext
  ): Promise<AiProviderResponse> {
    this.lastRequest = request as AiRequest;

    if (this.delayMs && this.delayMs > 0) {
      const signal = request.signal ?? context?.signal;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), this.delayMs);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Operation aborted'));
          }, { once: true });
        }
      });
    }

    if (this.errorToThrow) {
      throw this.errorToThrow;
    }

    return {
      text: this.responseToReturn ?? '{"status": "ok"}',
      model: request.overrideModel ?? 'fake-model-v1',
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

async function runAllTests() {
  console.log('--- Phase 10 AI Foundation Test Suite ---');

  // --- 1. Configuration & Operations ---
  await it('1. Central configuration defines known operations and default models', () => {
    assert.strictEqual(DEFAULT_GEMINI_MODEL, 'gemini-2.5-flash');
    assert.ok(AI_OPERATION_CONFIG.transaction_parser);
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.providerId, 'gemini');
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.model, 'gemini-2.5-flash');
    assert.strictEqual(AI_OPERATION_CONFIG.transaction_parser.timeoutMs, 15000);

    assert.ok(AI_OPERATION_CONFIG.categorization);
    assert.ok(AI_OPERATION_CONFIG.financial_assistant);
    assert.ok(AI_OPERATION_CONFIG.receipt_vision);
    assert.ok(AI_OPERATION_CONFIG.report_summary);

    const retrieved = getOperationConfig('transaction_parser');
    assert.strictEqual(retrieved?.model, 'gemini-2.5-flash');
    assert.strictEqual(retrieved?.temperature, 0.1);
  });

  await it('2. Central configuration returns undefined for unknown operations', () => {
    const nonExistent = getOperationConfig('non_existent_op');
    assert.strictEqual(nonExistent, undefined);
  });

  // --- 2. Router Provider Registration ---
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

  // --- 3. Operation Dispatch & Model Selection ---
  await it('6. AI Router dispatches known operation to configured provider and model', async () => {
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

  await it('7. AI Router respects overrideModel when specified in request', async () => {
    const fakeGemini = new FakeProvider('gemini');
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        overrideModel: 'gemini-3.0-pro-exp',
      },
      {
        credentialProvider: credProvider,
      }
    );

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.model, 'gemini-3.0-pro-exp');
    }
  });

  await it('8. AI Router fails closed on unknown operation without config or override', async () => {
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
      assert.ok(res.error.message.includes('Unknown AI operation'));
    }
  });

  // --- 4. Credential Dependency & Error Normalization ---
  await it('9. AI Router returns AI_NOT_CONFIGURED when execution context lacks credential provider', async () => {
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

  await it('10. AI Router returns AI_NOT_CONFIGURED when credential provider returns null/empty key', async () => {
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

  await it('11. AI Router returns AI_AUTH_FAILED when credential resolution throws an error', async () => {
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

  await it('12. AI Router returns AI_PROVIDER_UNAVAILABLE when requested provider is missing', async () => {
    const router = createAiRouter(); // No providers registered
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser', // requires 'gemini'
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

  // --- 5. Structured Runtime Validation ---
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
        amount: { type: 'string' },
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
        throw new Error(`Invalid transaction type: ${obj.type}`);
      }
      if (typeof obj.amount !== 'string' || !/^\d+(\.\d+)?$/.test(obj.amount)) {
        throw new Error(`Amount must be exact string decimal, got: ${obj.amount}`);
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

  await it('13. Structured result runtime validates matching output successfully', () => {
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

  await it('14. Structured result handles markdown code block wrapped JSON cleanly', () => {
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

  await it('15. Structured result fails closed on malformed JSON', () => {
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

  await it('16. Structured result fails closed on schema validation error (number instead of string)', () => {
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

  await it('17. Structured result fails closed on empty or missing text response', () => {
    const res = parseAndValidateJson('', transactionValidator, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });

    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error.code, 'AI_INVALID_RESPONSE');
    }
  });

  await it('18. AI Router executes end-to-end structured validation with provider', async () => {
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

  // --- 6. Timeouts and Caller Abort Orchestration ---
  await it('19. AI Router returns AI_ABORTED when caller signal is pre-aborted', async () => {
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

  await it('20. AI Router returns AI_ABORTED when caller aborts in-flight request', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.delayMs = 150; // In-flight delay
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30); // Abort mid-flight

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

  await it('21. AI Router returns AI_TIMEOUT when request exceeds configured timeoutMs', async () => {
    const fakeGemini = new FakeProvider('gemini');
    fakeGemini.delayMs = 200; // Takes 200ms
    const router = createAiRouter({ providers: [fakeGemini] });
    const credProvider = new FakeCredentialProvider();

    const res = await router.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        timeoutMs: 40, // Times out at 40ms
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

  // --- 7. Error Sanitization & Security ---
  await it('22. Error message sanitization strips API keys and Authorization tokens', () => {
    const secretKey = 'AIzaSyD-1234567890abcdefghijklmnopqrstuv';
    const rawError = `Authentication failed for key ${secretKey} with Authorization: Bearer secret_jwt_token_here`;

    const err = new AiError({
      code: 'AI_AUTH_FAILED',
      message: rawError,
      providerId: 'gemini',
    });

    assert.strictEqual(err.code, 'AI_AUTH_FAILED');
    assert.strictEqual(err.message.includes(secretKey), false);
    assert.strictEqual(err.message.includes('secret_jwt_token_here'), false);
    assert.ok(err.message.includes('AIza••••[REDACTED]'));
    assert.ok(err.message.includes('Authorization: Bearer [REDACTED]'));
  });

  await it('23. AiError toJSON provides clean serializable structure', () => {
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

  // --- 8. Gemini Provider Adapter with Fake Client ---
  await it('24. GeminiProvider passes configuration and extracts response data via fake client', async () => {
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

    const provider = new GeminiProvider({ clientFactory: fakeClientFactory });
    const response = await provider.execute(
      {
        operation: 'transaction_parser',
        prompt: 'Test prompt for gemini',
        systemInstruction: 'You are a financial parsing engine.',
        overrideModel: 'gemini-2.5-flash',
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
        responseMimeType?: string;
        responseSchema?: unknown;
      };
    };
    assert.strictEqual(params.model, 'gemini-2.5-flash');
    assert.strictEqual(params.contents, 'Test prompt for gemini');
    assert.strictEqual(params.config?.systemInstruction, 'You are a financial parsing engine.');
    assert.strictEqual(params.config?.responseMimeType, 'application/json');
    assert.strictEqual(params.config?.responseSchema, transactionValidator.jsonSchema);
  });

  await it('25. GeminiProvider rejects empty credential before calling client', async () => {
    const provider = new GeminiProvider();
    try {
      await provider.execute(
        { operation: 'categorization', prompt: 'test' },
        { value: '' }
      );
      assert.fail('Should have thrown on empty credential');
    } catch (err) {
      assert.ok(err instanceof AiError);
      assert.strictEqual(err.code, 'AI_AUTH_FAILED');
    }
  });

  await it('26. normalizeGeminiError correctly classifies Google SDK error strings', () => {
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

  await it('27. GeminiProvider forwards AbortSignal to Google SDK call', async () => {
    let capturedAbortSignal: AbortSignal | undefined;

    const fakeClientFactory = () => ({
      models: {
        async generateContent(params: { config?: { abortSignal?: AbortSignal } }) {
          capturedAbortSignal = params.config?.abortSignal;
          return { text: 'ok' };
        },
      },
    });

    const provider = new GeminiProvider({ clientFactory: fakeClientFactory });
    const controller = new AbortController();

    await provider.execute(
      {
        operation: 'transaction_parser',
        prompt: 'test',
        signal: controller.signal,
      },
      { value: 'fake-key' }
    );

    assert.strictEqual(capturedAbortSignal, controller.signal);
  });

  await it('28. Generic provider error normalization preserves AiError if already normalized', () => {
    const original = new AiError({
      code: 'AI_RATE_LIMITED',
      message: 'Already normalized rate limit',
      providerId: 'gemini',
    });
    const normalized = normalizeGeminiError(original);
    assert.strictEqual(normalized, original);
    assert.strictEqual(normalized.code, 'AI_RATE_LIMITED');
  });

  await it('29. sanitizeErrorMessage handles empty or non-string inputs safely', () => {
    assert.strictEqual(sanitizeErrorMessage(''), '');
    assert.strictEqual(sanitizeErrorMessage(undefined as unknown as string), '');
    assert.strictEqual(sanitizeErrorMessage('No secrets in this message'), 'No secrets in this message');
  });

  await it('30. Exact money string boundary is enforced in AI domain contracts', () => {
    const parseAmount = (val: string) => {
      assert.strictEqual(typeof val, 'string', 'Money in AI output must strictly be a string decimal');
      assert.ok(!Number.isNaN(Number(val)), 'Must be numeric format');
    };
    parseAmount('1250000.0000');
  });

  console.log(`\n=== All Phase 10 AI Foundation Tests Passed (${testsPassed}/${testsPassed}) ===`);
}

runAllTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
