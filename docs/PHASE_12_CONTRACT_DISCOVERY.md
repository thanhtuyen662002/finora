# Finora Phase 12 — AI Features Contract Discovery & Implementation Pass Decomposition

## 1. Executive Summary & Architectural Baseline

Finora is a private-first personal finance application governed by a foundational tenet:
> **Finora is AI-assisted, never AI-dependent.**
> Financial calculations, ledger invariants, and mutations remain 100% deterministic, server-enforced, and isolated behind PostgreSQL RLS and domain engines.

Phase 10 established the provider-neutral AI foundation (`AiRouter`, `GeminiProvider`, `AiError`, `AiStructuredResult`, centralized `AI_OPERATION_CONFIG`).
Phase 11 established the multi-source encrypted credential subsystem with hardware-standard AES-256-GCM in a private database schema, fail-closed source resolution (`PERSONAL > ADMIN_ASSIGNED > SYSTEM`), and a zero-leak server-only security perimeter.

Phase 12 delivers user-facing AI features on top of this foundation without compromising financial integrity, user isolation, or privacy.

---

## 2. Authoritative Roadmap & Pass Decomposition

### 2.1 Pass Evaluation & Dependency Ordering

Phase 12 encompasses distinct AI functional requirements across transaction entry, computer vision, and reporting. To ensure minimal risk, bounded blast radius, and zero regression of core financial flows, Phase 12 is decomposed into three sequential, independently auditable passes:

1. **Phase 12A — Natural-Language Transaction Draft & Smart Category Suggestion**
   - **Scope:** Natural-language transaction parsing into a structured client-editable draft + candidate-bounded category & account matching.
   - **User Value:** High daily utility. Reduces friction in logging cash and card transactions.
   - **Complexity & Risk:** Low-Medium. Strictly read-only AI interpretation returning an in-memory draft to UI. Zero database writes.
   - **Provider Call Budget:** Exactly 1 structured Gemini call per explicit user parse action.
   - **Recommended First Pass:** **Phase 12A**.

2. **Phase 12B — Ephemeral Receipt Vision to Transaction Draft**
   - **Scope:** Receipt image upload (JPEG/PNG/WebP), ephemeral server-side base64/multimodal transformation, extraction of merchant, date, amount, currency, and line-item hints into a structured transaction draft.
   - **User Value:** Medium-High. Accelerates receipt entry.
   - **Complexity & Risk:** Medium. Image payload handling, token consumption, OCR ambiguity.
   - **Privacy Stance:** Ephemeral in-memory processing only. Zero Supabase Storage persistence.

3. **Phase 12C — Read-Only Financial Assistant & Report Summarization**
   - **Scope:** Natural-language financial explanations and period report summaries based on pre-computed, deterministic report engine DTOs.
   - **User Value:** High explanatory value.
   - **Complexity & Risk:** Medium-High. Requires strict prompt injection guards, deterministic context serialization, and zero financial hallucination safeguards.
   - **Mutation Authority:** Absolute zero. Strictly read-only context.

### 2.2 Pass Decomposition Matrix

| Pass | Feature | Provider Operations | DB Schema Changes | Writes Financial Rows? | Privacy Risk | Live Smoke Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **12A** | Natural-Language Transaction Draft & Smart Category Suggestion | `transaction_parser` | **NONE** | **NO (Draft only)** | Low (User text + candidate labels only) | Real text parse -> UI draft -> User confirm save |
| **12B** | Ephemeral Receipt Vision -> Draft | `receipt_vision` | **NONE** | **NO (Draft only)** | Medium (Receipt image text, no image persistence) | Real receipt upload -> UI draft -> User confirm save |
| **12C** | Read-Only Financial Assistant & Report Summary | `financial_assistant`, `report_summary` | **NONE** | **NO (Explanatory only)** | Low-Medium (Deterministic report aggregates only) | Real query against report data -> Explanatory text |

---

## 3. Phase 12A Contract: Transaction Draft & Categorization

### 3.1 The Preview-and-Confirm Invariant

AI parsing must **never** execute a financial mutation or insert a row into `transactions` or `transfers`.

```text
[User Prompt] 
     ↓
[Authenticated Server Action] (Reads user candidate metadata via authenticated RLS client)
     ↓
[Phase 10 AI Router + Phase 11 Credential Resolver] (Resolves API key server-side)
     ↓
[Gemini Provider] (Executes structured prompt with ephemeral opaque tokens)
     ↓
[Server-Side Post-Processor] (Validates schema, normalizes exact decimal, maps tokens to UUIDs)
     ↓
[Structured In-Memory Draft DTO]
     ↓
[AddTransactionModal UI Preview] (Populates form fields; highlights parsed values & warnings)
     ↓
[User Edits / Reviews] (User retains full manual override)
     ↓
[Explicit User Click: "Lưu giao dịch"]
     ↓
[Standard Finora Mutation Engine] (`createTransaction()` with existing domain & RLS validation)
```

**Mandatory Invariants:**
1. **Zero Direct AI Mutation:** The AI execution layer must not import, reference, or invoke `createTransaction`, `updateTransaction`, `voidTransaction`, or `restoreTransaction`.
2. **No Auto-Save:** There is no automated confirmation, background saving, or "high-confidence auto-persist" bypass.
3. **Graceful Degradation:** If AI parsing fails, times out, or returns invalid data, the modal displays a clear, localized warning and preserves the user's manual input form.

### 3.2 Exact Transaction Draft Schema

```typescript
export interface ParsedTransactionDraft {
  /**
   * Deterministic transaction type inferred from text semantics.
   * Null if ambiguous.
   */
  readonly type: 'INCOME' | 'EXPENSE' | null;

  /**
   * Exact monetary string normalized to standard decimal representation (e.g., "85000.0000", "4.5000").
   * MANDATORY INVARIANT: Must NEVER be a JavaScript number.
   * Null if amount is missing or cannot be deterministically normalized.
   */
  readonly amount: string | null;

  /**
   * Standard 3-letter ISO-4217 uppercase currency code (e.g., "VND", "USD").
   * Defaults to user base currency or inferred currency from text.
   */
  readonly currency_code: string | null;

  /**
   * Validated real UUID of matched user account.
   * Null if no high-confidence match found among user's active accounts.
   */
  readonly account_id: string | null;

  /**
   * Validated real UUID of matched category.
   * Null if no high-confidence match found among user's active categories.
   */
  readonly category_id: string | null;

  /**
   * Cleaned merchant or counterparty name (max 100 chars).
   */
  readonly merchant: string | null;

  /**
   * Extracted note or description details (max 255 chars).
   */
  readonly note: string | null;

  /**
   * Date in ISO format 'YYYY-MM-DD'.
   * Calculated relative to trusted server-provided context (today/yesterday).
   * Null if ambiguous or unparseable.
   */
  readonly occurred_on: string | null;

  /**
   * Validated real UUID of matched income source (if type=INCOME).
   */
  readonly income_source_id: string | null;

  /**
   * Validated real UUID of matched income stream (if type=INCOME and source has streams).
   */
  readonly income_source_stream_id: string | null;

  /**
   * Human-readable warnings indicating missing, ambiguous, or unmapped fields.
   */
  readonly warnings: readonly string[];

  /**
   * Any leftover text that could not be parsed into structured fields.
   */
  readonly unmatched_text: string | null;
}
```

### 3.3 Strict Money Handling & Abbreviation Grammar

Money produced by AI is strictly treated as a raw string until validated by Finora's money domain layer (`src/lib/money.ts`).

1. **Supported Semantic Notations in Prompt:**
   - Vietnamese colloquial: `85k`, `85 nghìn`, `85 ngàn` -> `85000`
   - Millions: `1.5tr`, `1.5 triệu`, `2m`, `2tr` -> `1500000`, `2000000`
   - Billions: `1 tỷ`, `1.2 tỷ`, `1b` -> `1000000000`, `1200000000`
   - Standard international decimals: `4.50 USD`, `1,250.00 EUR` -> `4.5000`, `1250.0000`
   - Vietnamese dot-thousands notation: `50.000 VND`, `1.200.000 đ` -> `50000`, `1200000`
2. **Server-Side Deterministic Validation:**
   - The server validates the parsed money string against `isPositiveExactDecimal(val)`.
   - String is normalized to Finora's 4-decimal format (`toExactDecimal(val)`).
   - Zero, negative numbers, `NaN`, `Infinity`, or expressions with unparseable separators are rejected to `amount = null` with a descriptive warning.

### 3.4 Temporal & Calendar Context Resolution

To prevent date hallucinations (e.g., model assuming training cutoff year or arbitrary timestamps):
- Every parser request payload includes trusted server-derived temporal context:
  - `server_today_iso`: Current date in user's timezone (`YYYY-MM-DD`).
  - `server_timezone`: User's configured timezone (e.g., `Asia/Ho_Chi_Minh`).
  - `server_locale`: User's configured locale (e.g., `vi-VN`).
- Semantic expressions are anchored relative to `server_today_iso`:
  - `hôm nay`, `today` -> `server_today_iso`
  - `hôm qua`, `yesterday` -> `server_today_iso - 1 day`
  - `hôm kia`, `day before yesterday` -> `server_today_iso - 2 days`
  - Explicit dates (e.g., `ngày 15/8`, `15/08`) use the current year if unspecified, or previous year if the date is in the future.

---

## 4. Opaque Token Mapping & Data Minimization

### 4.1 Ephemeral Request-Scoped Opaque Tokens

To prevent exposing raw database UUIDs to third-party AI APIs and prevent the model from hallucinating non-existent database identifiers:
1. Server queries user's active entities via the authenticated RLS Supabase client.
2. Server assigns short, ephemeral, request-scoped tokens:
   - Accounts: `ACC_1`, `ACC_2`, ...
   - Categories: `CAT_1`, `CAT_2`, ...
   - Income Sources: `SRC_1`, `SRC_2`, ...
   - Income Streams: `STR_1`, `STR_2`, ...
3. Model receives only the token and public descriptive label (e.g., `{"token": "CAT_1", "name": "Ăn uống", "type": "EXPENSE"}`).
4. Model outputs the matched token (e.g., `"category_token": "CAT_1"`).
5. Server maps `CAT_1` back to the real `category_id` UUID in server memory. If the model returns an unrecognized token, the server safely resolves the field to `null` with a warning.

```text
[Database UUIDs] ──(Server Memory Map)──> [Opaque Tokens: ACC_1, CAT_1]
                                                    │
                                                    ▼
                                            [Gemini Prompt]
                                                    │
                                                    ▼
[Real UUIDs in Draft] <──(Server Lookup)── [Gemini Output: CAT_1]
```

### 4.2 Data Minimization Matrix

| AI Operation | Data Sent to Model | Data Strictly Excluded |
| :--- | :--- | :--- |
| `transaction_parser` | - User input string<br>- Server current date (`YYYY-MM-DD`)<br>- Server timezone & locale<br>- Base currency code<br>- Active account candidate labels + tokens<br>- Active category candidate labels + tokens<br>- Active income source/stream candidate labels + tokens | - User Auth ID / UUIDs<br>- Email / Personal metadata<br>- Account balances / Net worth<br>- Historical transaction rows<br>- Budgets, goals, or recurring bills<br>- Encrypted credentials / API keys |
| `categorization` | - Merchant name / description<br>- Transaction type (`INCOME`/`EXPENSE`)<br>- Active category candidate labels + tokens | - Full financial history<br>- Account balances<br>- Amount / Value (if not required for semantic category) |
| `financial_assistant` | - Pre-calculated report DTO summary<br>- Period label (e.g., "Tháng 08/2026")<br>- User query string | - Raw transaction database rows<br>- Raw database IDs<br>- User credentials or private schema data |

---

## 5. Security Architecture, User Isolation & Prompt Boundaries

### 5.1 Authentication & Boundary Enforcement

1. **Server Authentication Required:** All AI server actions (`'use server'`) strictly verify the caller via `auth.getUser()`. Unauthenticated requests fail closed with `AI_AUTH_FAILED`.
2. **RLS Context for Domain Data:** All candidate entities (accounts, categories, income sources) are fetched using the authenticated user's RLS Supabase client (`createClient()`). Service-role is strictly forbidden from fetching financial data.
3. **Phase 11 Credential Resolution:** The verified `userId` is passed to `AiCredentialResolver`. Credential resolution adheres to Phase 11 invariants (`PERSONAL > ADMIN_ASSIGNED > SYSTEM`), failing closed on corrupted keys with zero cross-user leakage.
4. **Server-Only Module Boundary:** All AI execution, prompts, schemas, and provider logic reside in server-only files (`import 'server-only'`). No AI SDK (`@google/genai`), provider instance, or decrypted key is accessible in browser bundles.

### 5.2 Prompt Injection & Adversarial Input Defense

User-provided text (transaction prompts, merchant names, notes) is treated as untrusted data:
1. **System Instruction Isolation:** Clear system instructions declare that user input must only be analyzed as data, and cannot alter parsing schemas, execute commands, request system keys, or bypass candidate validation.
2. **Zero Execution Privileges:** Gemini is not given any tool definitions, function calling capabilities, or database mutation endpoints.
3. **Structured JSON Mode:** Model is constrained to strict JSON Schema output validation via Phase 10 `AiOutputValidator`. Markdown, code blocks, and non-JSON tokens are rejected.

---

## 6. Cost, Rate Limiting & Resource Protection

1. **Explicit User Trigger:** AI parsing is triggered exclusively by explicit user interaction (e.g., clicking "Phân tích" or pressing Enter in the AI input box). No background polling or auto-typing triggers.
2. **Bounded Model Call Budget:** Exactly **1 Gemini call** per transaction parse action. Category matching is performed within the single `transaction_parser` call by supplying candidate category tokens, eliminating redundant multi-call latency.
3. **Input & Output Constraints:**
   - Max prompt text length: **300 characters** (enforced on both client and server).
   - Operation timeout: **15,000 ms** (enforced by `AiRouter`).
   - Max output tokens: **1,024 tokens**.
4. **No Unnecessary Storage Infrastructure:** Since Finora is a private personal finance OS, no new database tables (e.g., `ai_request_logs`, `ai_conversations`) are required for Phase 12A. Memory-bounded rate limiting and standard HTTP abort signals suffice.

---

## 7. Error Handling & UX Contract

When an AI operation encounters an error, the system must translate `AiError` into clear, actionable Vietnamese UI feedback while preserving all existing form state:

| Error Code | User-Facing Message (Vietnamese) | UI Behavior |
| :--- | :--- | :--- |
| `AI_NOT_CONFIGURED` | "Chưa cấu hình API Key AI. Vui lòng thêm Gemini API Key trong Cài đặt hoặc liên hệ quản trị viên." | Display warning banner in modal; leave manual form interactive. |
| `AI_CREDENTIAL_CORRUPTED` | "Khóa API đã lưu không hợp lệ hoặc bị lỗi giải mã. Vui lòng cập nhật lại khóa trong Cài đặt." | Display error toast/alert with link to Settings. |
| `AI_AUTH_FAILED` | "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." | Redirect / prompt re-auth. |
| `AI_RATE_LIMITED` | "Đã vượt hạn mức yêu cầu AI. Vui lòng thử lại sau giây lát hoặc nhập thủ công." | Display temporary warning; keep input text intact. |
| `AI_TIMEOUT` | "Yêu cầu AI quá thời gian phản hồi. Bạn có thể thử lại hoặc tiếp tục nhập thủ công." | Reset parse button state; retain form input. |
| `AI_INVALID_RESPONSE` / `AI_STRUCTURED_OUTPUT_INVALID` | "Không thể phân tích giao dịch từ nội dung này. Vui lòng kiểm tra lại câu lệnh hoặc nhập thủ công." | Show descriptive hint; keep user text in input. |

---

## 8. Threat Model & Security Mitigations

```text
+----------------------------------------------------------------------------------------------------+
|                                     FINORA PHASE 12 THREAT MODEL                                   |
+----+-------------------------------+-----------------------------------+---------------------------+
| ID | Threat                        | Boundary                          | Mitigation                |
+----+-------------------------------+-----------------------------------+---------------------------+
| T1 | Cross-User Data Leakage       | Server Action / Auth              | Verify session via RLS;   |
|    |                               |                                   | pass verified userId only |
+----+-------------------------------+-----------------------------------+---------------------------+
| T2 | API Key Leakage               | Browser / Server Boundary         | Server-only execution;    |
|    |                               |                                   | zero plaintext to browser |
+----+-------------------------------+-----------------------------------+---------------------------+
| T3 | Prompt Injection              | User Input Sanitization           | Structured output mode;   |
|    |                               |                                   | zero tool/mutation rights |
+----+-------------------------------+-----------------------------------+---------------------------+
| T4 | Hallucinated Financial Totals | Financial Calculation Layer       | Exact money string math;  |
|    |                               |                                   | deterministic validation  |
+----+-------------------------------+-----------------------------------+---------------------------+
| T5 | Arbitrary Database ID Inject  | Entity Resolution                 | Request-scoped opaque     |
|    |                               |                                   | candidate tokens (CAT_1)  |
+----+-------------------------------+-----------------------------------+---------------------------+
| T6 | Direct/Silent Financial Write | Transaction Mutation Layer        | Zero AI mutation code;    |
|    |                               |                                   | explicit user save only   |
+----+-------------------------------+-----------------------------------+---------------------------+
| T7 | Excessive Token/Cost Drain    | Model Execution                   | 300 char input cap;       |
|    |                               |                                   | 1 call per user action    |
+----+-------------------------------+-----------------------------------+---------------------------+
| T8 | Denial of Service / Hanging   | AI Router Timeout                 | 15s AbortController       |
|    |                               |                                   | timeout fail-closed       |
+----+-------------------------------+-----------------------------------+---------------------------+
| T9 | Sensitive Data in Server Logs | Logging Layer                     | Zero prompt/key logging;  |
|    |                               |                                   | sanitized error logging   |
+----+-------------------------------+-----------------------------------+---------------------------+
| T10| Malformed Output Rejection    | Structured Validator              | Zod/Schema validation     |
|    |                               |                                   | before returning to UI    |
+----+-------------------------------+-----------------------------------+---------------------------+
| T11| Credential Fallback Bypass    | Phase 11 Credential Resolver      | Strict PERSONAL > ADMIN > |
|    |                               |                                   | SYSTEM fail-closed logic  |
+----+-------------------------------+-----------------------------------+---------------------------+
| T12| AI Outage Disrupts Finance    | AddTransactionModal UX            | AI input is 100% optional;|
|    |                               |                                   | manual form always works  |
+----+-------------------------------+-----------------------------------+---------------------------+
```

---

## 9. Comprehensive Testing & Verification Plan

Automated testing for Phase 12A requires zero real network calls to Google Gemini, utilizing mock/fake providers to verify end-to-end determinism.

1. **Structured Output Validation Unit Tests:**
   - Standard Vietnamese and English natural-language transaction strings.
   - Exact decimal string formatting (`"85000.0000"`, `"4.5000"`).
   - Rejection of numeric amounts, negative values, and invalid currency codes.
   - Ambiguous inputs yielding `null` fields and descriptive warning items.
2. **Opaque Token & Candidate Mapping Tests:**
   - Candidate token generation (`ACC_1`, `CAT_1`, `SRC_1`).
   - Successful mapping from valid tokens to actual user UUIDs.
   - Unrecognized/hallucinated model tokens safely normalized to `null`.
3. **Temporal Calculation Tests:**
   - "Hôm nay", "hôm qua", "hôm kia", "thứ Hai tuần trước" properly resolved against server date.
4. **Mutation Isolation Unit Tests:**
   - Static analysis proving AI parsing modules contain zero imports of `createTransaction` or Supabase mutation queries.
5. **UI & User Flow Integration Tests:**
   - AI draft preview populates `AddTransactionModal` form fields.
   - User edits overwrite parsed values seamlessly.
   - Explicit "Lưu giao dịch" button triggers standard `createTransaction`.

---

## 10. Future Pass Contract Discovery Baseline (Phase 12B & 12C)

### 10.1 Phase 12B — Ephemeral Receipt Vision
- **MIME Types Supported:** `image/jpeg`, `image/png`, `image/webp`.
- **Max Image Size:** 4MB.
- **Privacy & Storage Posture:** In-memory stream processing directly to Gemini multimodal API. **Zero storage in Supabase Storage buckets**. Image bytes are discarded immediately after response completion.
- **Output:** Identical `ParsedTransactionDraft` schema with line-item detail hints in `note`.

### 10.2 Phase 12C — Read-Only Financial Assistant & Report Summaries
- **Deterministic Context Input:** Receives pre-calculated summary DTOs from `src/features/reports/engine.ts` (e.g., `CurrencySummary`, `CategoryExpenseBreakdown`, `MonthlyCashFlowPoint`).
- **Zero Raw Row Access:** The model is never supplied with unaggregated raw transaction tables.
- **Authority Boundary:** Explanatory text only. Assistant responses explicitly remind users that all totals reflect computed ledger records.

---

## 11. Discovery Contract Summary

```text
PHASE_12_SCOPE=AI_FEATURES

PHASE_12_DISCOVERY=PASS

PHASE_12_RECOMMENDED_FIRST_PASS=Phase 12A — Natural-Language Transaction Draft & Smart Category Suggestion

PHASE_12_FIRST_PASS_DATABASE_CHANGE=NONE

PHASE_12_AI_DIRECT_FINANCIAL_MUTATION=false

PHASE_12_PREVIEW_CONFIRM_REQUIRED=true

PHASE_12_SERVER_ONLY=true

PHASE_12_AUTHENTICATED_USER_REQUIRED=true

PHASE_12_FINANCIAL_CONTEXT_RLS=true

PHASE_12_SERVICE_ROLE_FINANCIAL_READS=false

PHASE_12_RAW_UUID_TO_MODEL=false

PHASE_12_PERSIST_RAW_PROMPTS=false

PHASE_12_PERSIST_RAW_RESPONSES=false

PHASE_12_REAL_GEMINI_CALL=false

PHASE_12_CONTRACT=PENDING_INDEPENDENT_AUDIT

PHASE_12_IMPLEMENTATION_AUTHORIZED=false
```
