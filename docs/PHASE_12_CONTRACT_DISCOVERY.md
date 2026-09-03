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
   - **Provider Call Budget:** Exactly 1 structured Gemini call per explicit user parse action (`PHASE_12A_PROVIDER_CALLS_PER_PARSE=1`, `PHASE_12A_SEPARATE_CATEGORIZATION_CALL=false`).
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
[Phase 10 AiOutputValidator] (Validates AiTransactionParseOutput: tokens only, 0 UUIDs)
     ↓
[Server Domain Cross-Validator] (Maps tokens to UUIDs, validates currency/type/parent, generates warning codes)
     ↓
[Structured In-Memory ParsedTransactionDraft DTO]
     ↓
[AddTransactionModal UI Preview] (Populates form fields; highlights parsed values & warning badges)
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

---

### 3.2 Dual Boundary Schema Specification

To guarantee data minimization, prevent hallucination of internal database identifiers, and maintain robust type safety, Phase 12A defines two strictly distinct boundaries:

#### A. Provider/Model Boundary (`AiTransactionParseOutput`)
The raw structured output schema returned by the model and validated at runtime by the Phase 10 `AiOutputValidator`.
**Mandatory Invariant:** Contains **zero** database UUIDs, **zero** user IDs, and **zero** credential identifiers.

```typescript
export interface AiTransactionParseOutput {
  /**
   * Deterministic transaction type inferred from text semantics.
   * Null if ambiguous or unspecified.
   */
  readonly type: 'INCOME' | 'EXPENSE' | null;

  /**
   * Exact monetary string extracted from text (e.g., "85000", "4.50").
   * MANDATORY INVARIANT: Must NEVER be a JavaScript number.
   * Null if amount is missing or ambiguous.
   */
  readonly amount: string | null;

  /**
   * Standard 3-letter ISO-4217 uppercase currency code (e.g., "VND", "USD").
   * Null if unspecified.
   */
  readonly currency_code: string | null;

  /**
   * Opaque candidate token matching user's active accounts (e.g., "ACC_1").
   * Null if no high-confidence match found among supplied candidates.
   */
  readonly account_token: string | null;

  /**
   * Opaque candidate token matching user's active categories (e.g., "CAT_1").
   * Null if no high-confidence match found among supplied candidates.
   */
  readonly category_token: string | null;

  /**
   * Opaque candidate token matching user's active income sources (e.g., "SRC_1").
   * Null if no high-confidence match or if type=EXPENSE.
   */
  readonly income_source_token: string | null;

  /**
   * Opaque candidate token matching user's active income streams (e.g., "STR_1").
   * Null if no high-confidence match or if type=EXPENSE.
   */
  readonly income_source_stream_token: string | null;

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
   * Calculated relative to trusted server temporal context.
   * Null if ambiguous or unparseable.
   */
  readonly occurred_on: string | null;

  /**
   * Any leftover text that could not be parsed into structured fields (max 255 chars).
   */
  readonly unmatched_text: string | null;
}
```

#### B. Server/Application Draft Boundary (`ParsedTransactionDraft`)
The sanitized, cross-validated DTO returned to the client UI after server-side token-to-UUID lookup and domain validation.

```typescript
export interface ParsedTransactionDraft {
  readonly type: 'INCOME' | 'EXPENSE' | null;
  readonly amount: string | null;
  readonly currency_code: string | null;

  /** Validated real UUID of user's active account (null if unmapped or in conflict) */
  readonly account_id: string | null;

  /** Validated real UUID of user's active category (null if unmapped or in conflict) */
  readonly category_id: string | null;

  /** Validated real UUID of user's active income source (null if unmapped or if type=EXPENSE) */
  readonly income_source_id: string | null;

  /** Validated real UUID of user's active income stream (null if unmapped or parent mismatch) */
  readonly income_source_stream_id: string | null;

  readonly merchant: string | null;
  readonly note: string | null;
  readonly occurred_on: string | null;

  /** Bounded, deterministic warning codes generated exclusively by the server */
  readonly warning_codes: readonly TransactionDraftWarningCode[];

  readonly unmatched_text: string | null;
}
```

---

### 3.3 Warning Code Taxonomy & Confidence Philosophy

Arbitrary model-authored free-form warning strings are **strictly not trusted**. All warnings emitted in `ParsedTransactionDraft` must be drawn from a bounded, server-validated enum. The client UI maps these codes to localized Vietnamese messages.

```typescript
export type TransactionDraftWarningCode =
  | 'TYPE_MISSING'
  | 'AMOUNT_MISSING'
  | 'AMOUNT_INVALID'
  | 'CURRENCY_INFERRED'
  | 'CURRENCY_INVALID'
  | 'ACCOUNT_NOT_MATCHED'
  | 'ACCOUNT_CURRENCY_CONFLICT'
  | 'CATEGORY_NOT_MATCHED'
  | 'CATEGORY_TYPE_CONFLICT'
  | 'DATE_MISSING'
  | 'DATE_AMBIGUOUS'
  | 'DATE_YEAR_INFERRED'
  | 'INCOME_SOURCE_NOT_MATCHED'
  | 'INCOME_STREAM_NOT_MATCHED'
  | 'INCOME_STREAM_PARENT_CONFLICT'
  | 'UNKNOWN_MODEL_TOKEN'
  | 'MODEL_FIELD_INVALID';
```

**Numeric Confidence Decision:**
- `PHASE_12A_NUMERIC_CONFIDENCE=false`
- **Rationale:** Numerical confidence scores (e.g., `0.87`) create an illusion of mathematical precision, tempt arbitrary threshold heuristics, and risk unverified auto-confirmation. In Finora, uncertainty is represented deterministically through `null` fields paired with explicit `warning_codes`, requiring human review.

---

### 3.4 Entity Cross-Validation & Consistency Rules

After the model produces `AiTransactionParseOutput`, the server executes strict post-validation against the user's active domain state:

1. **Account Validation:**
   - The returned `account_token` must exist in the request-scoped candidate map.
   - The mapped account must belong to the authenticated user and be active.
   - If `account_token` is unknown, stale, or absent: set `account_id = null`, append `ACCOUNT_NOT_MATCHED`.
2. **Category Validation:**
   - The returned `category_token` must exist in the candidate map and be active.
   - Category transaction type must match the resolved `type` (e.g., expense category for `EXPENSE`).
   - If `type` is null or if there is a type conflict: set `category_id = null`, append `CATEGORY_TYPE_CONFLICT`.
3. **Income Source Validation:**
   - Income sources are only valid when `type = 'INCOME'`.
   - If `type = 'EXPENSE'` or `type = null`: unconditionally set `income_source_id = null` and `income_source_stream_id = null`.
   - If `type = 'INCOME'` but token is unmapped or unknown: set `income_source_id = null`, append `INCOME_SOURCE_NOT_MATCHED`.
4. **Income Stream Validation:**
   - Must be active, exist in candidate map, and explicitly belong to the resolved `income_source_id` (`stream.source_id === income_source_id`).
   - If parent income source does not match: set `income_source_stream_id = null`, append `INCOME_STREAM_PARENT_CONFLICT`.

---

### 3.5 Currency Precedence & Conflict Resolution

Finora enforces deterministic 3-tier currency precedence:

```text
Tier 1: Explicit valid currency stated by user in prompt (e.g., "USD", "VND", "EUR")
     ↓ (if unspecified)
Tier 2: Currency of a successfully matched account (e.g., PayPal account uses "USD")
     ↓ (if no account matched)
Tier 3: Authenticated user's configured default base currency (e.g., "VND")
```

**Conflict Rule:**
If the user explicitly specifies a currency (e.g., `"USD"`) that conflicts with the currency of the matched account (e.g., VCB account using `"VND"`):
- The explicit currency (`"USD"`) is preserved.
- The account match is rejected: `account_id = null`.
- Warning code `ACCOUNT_CURRENCY_CONFLICT` is appended.
- This prevents generating drafts that violate Finora's core single-currency account constraint.

---

### 3.6 Strict Money Handling & Decimal Normalization

Money calculations must live in Finora's money domain layer (`src/lib/money/index.ts`). No floating-point arithmetic is permitted.

1. **Supported Semantic Notations in Prompt:**
   - Vietnamese colloquial: `85k`, `85 nghìn`, `85 ngàn` -> `85000`
   - Millions: `1.5tr`, `1.5 triệu`, `2m`, `2tr` -> `1500000`, `2000000`
   - Billions: `1 tỷ`, `1.2 tỷ`, `1b` -> `1000000000`, `1200000000`
   - Standard international decimals: `4.50 USD`, `1,250.00 EUR` -> `4.5000`, `1250.0000`
   - Vietnamese dot-thousands notation: `50.000 VND`, `1.200.000 đ` -> `50000`, `1200000`
2. **Server-Side Deterministic Normalization:**
   - Validated against `isPositiveExactDecimal(val)`.
   - Formatted to Finora's standard decimal representation via `toExactDecimal(val)`.
   - Negative values, zero, `NaN`, `Infinity`, or malformed numbers are rejected to `amount = null` with `AMOUNT_INVALID`.

---

### 3.7 Temporal Context & Date Inference

To prevent temporal hallucinations:
- Every parser request payload supplies trusted server temporal metadata:
  - `server_today_iso`: Current date in user's timezone (`YYYY-MM-DD`).
  - `server_timezone`: Configured timezone (e.g., `Asia/Ho_Chi_Minh`).
  - `server_locale`: Configured locale (e.g., `vi-VN`).
- Anchored semantics:
  - `hôm nay`, `today` -> `server_today_iso`
  - `hôm qua`, `yesterday` -> `server_today_iso - 1 day`
  - `hôm kia`, `day before yesterday` -> `server_today_iso - 2 days`
- Yearless dates (e.g., `"15/08"`, `"ngày 5 tháng 9"`):
  - Inferred using current calendar year (or previous year if date is in the future).
  - Appends warning code `DATE_YEAR_INFERRED`.
- Ambiguous dates:
  - If date cannot be parsed with certainty: `occurred_on = null`, appends `DATE_AMBIGUOUS`.

---

## 4. Opaque Token Architecture, Candidate Context & Data Minimization

### 4.1 Ephemeral Request-Scoped Opaque Tokens

To prevent exposing internal database UUIDs to AI providers and eliminate model hallucinations of arbitrary IDs:
1. The server reads active categories, accounts, and income sources through the authenticated user's RLS client.
2. The server assigns ephemeral, request-scoped identifiers:
   - Accounts: `ACC_1`, `ACC_2`, ...
   - Categories: `CAT_1`, `CAT_2`, ...
   - Income Sources: `SRC_1`, `SRC_2`, ...
   - Income Streams: `STR_1`, `STR_2`, ...
3. The model prompt receives only the tokens and public labels.
4. Model output returns matched tokens (e.g., `"category_token": "CAT_1"`).
5. The server maps tokens back to real UUIDs in server memory for that request.

```text
[Database UUIDs] ──(Server Memory Map)──> [Opaque Tokens: ACC_1, CAT_1]
                                                    │
                                                    ▼
                                            [Gemini Prompt]
                                                    │
                                                    ▼
[Real UUIDs in Draft] <──(Server Lookup)── [Gemini Output: CAT_1]
```

---

### 4.2 Candidate Limits & Bounding Strategy

To prevent token exhaustion and prompt bloat, candidate sets are strictly bounded:
- Active accounts cap: **30 accounts** (label max 50 chars).
- Active categories cap: **50 categories** (label max 50 chars).
- Active income sources cap: **20 sources** (label max 50 chars).
- Active income streams cap: **30 streams** (label max 50 chars).

**Fail-Safe Omission Rule:**
If a user's candidate collection exceeds the cap, the server **must not** silently truncate the collection and pretend it was complete. Instead, the server omits that candidate dimension from the prompt, returns the corresponding field as `null`, adds a warning code (e.g., `CATEGORY_NOT_MATCHED`), and allows the user to select manually in the UI.

---

### 4.3 Complete Data Minimization Matrix

| AI Operation | Allowed Data Sent to Model | Data Strictly Excluded | Raw UUID Policy | Persistence Policy |
| :--- | :--- | :--- | :--- | :--- |
| `transaction_parser` | - User input string (max 300 chars)<br>- Server date (`YYYY-MM-DD`), timezone, locale<br>- Base currency code<br>- Bounded active candidate labels + tokens | - User Auth ID / UUIDs<br>- Email / Personal metadata<br>- Account balances / Net worth<br>- Historical transaction rows<br>- Budgets / Goals / Bills<br>- API keys / Credentials | **Zero UUIDs** (Opaque tokens only: `ACC_1`, `CAT_1`) | **Zero persistence** (In-memory draft only; no DB logs) |
| `categorization` | - Merchant name / description<br>- Transaction type (`INCOME`/`EXPENSE`)<br>- Bounded active category labels + tokens | - Full financial history<br>- Account balances / Net worth<br>- Monetary amounts (if not needed for category classification) | **Zero UUIDs** (Opaque tokens only: `CAT_1`) | **Zero persistence** (Note: In Phase 12A, embedded in `transaction_parser`) |
| `receipt_vision` | - Receipt image bytes (ephemeral multimodal stream)<br>- Server date, timezone, locale<br>- Base currency code<br>- Bounded active candidate labels + tokens | - Supabase Auth identifiers<br>- Full account lists<br>- Historical ledger rows | **Zero UUIDs** (Opaque tokens only) | **Zero persistence** (Zero Supabase Storage writes; stream discarded) |
| `financial_assistant` | - Pre-calculated report engine summary DTO<br>- Period label (e.g., "Tháng 08/2026")<br>- User query string (max 500 chars) | - Raw transaction rows<br>- Raw database UUIDs<br>- Account numbers / Credentials | **Zero UUIDs** (Aggregated domain entities only) | **Zero persistence** (Ephemeral response; no chat history table) |
| `report_summary` | - Pre-calculated report metrics (totals, cash flow, top categories, saving rate)<br>- Period dates | - Granular transaction item rows<br>- Individual receipt details<br>- Private user metadata | **Zero UUIDs** (Aggregated category names only) | **Zero persistence** (Explanatory text only) |

*Phase 12A Single-Call Architecture:*
`PHASE_12A_PROVIDER_CALLS_PER_PARSE=1`
`PHASE_12A_SEPARATE_CATEGORIZATION_CALL=false` (Category matching is performed within the single `transaction_parser` call by passing category candidate tokens).

---

## 5. Security Architecture, User Isolation & Prompt Boundaries

### 5.1 Authentication Boundaries: Application Auth vs. Provider Auth

A strict distinction is maintained between Finora user authentication and AI provider credential resolution:
1. **Application Session Boundary:** All AI server actions verify the user via `auth.getUser()`. Unauthenticated callers fail closed at the server action gate with `AUTH_REQUIRED` before invoking any AI subsystem.
2. **Provider Credential Boundary:** `AI_AUTH_FAILED` indicates that the upstream AI provider rejected the API key. It **never** means the Finora user session expired. The UI must never instruct a user to log in again due to an `AI_AUTH_FAILED` error.

### 5.2 RLS Context & Service-Role Isolation

1. **Domain Context Reads:** All financial context (accounts, categories, income sources) is queried using the authenticated user's RLS Supabase client.
2. **Service-Role Boundary:** The `service_role` client is strictly quarantined to the Phase 11 encrypted credential repository. Service-role access is **never** used to query transactions, accounts, categories, or reports.

### 5.3 Phase 11 Credential Resolution Integration

Every AI request passes the verified `userId` to `AiCredentialResolver.resolve(userId, 'GEMINI')`:
- Preserves exact precedence: `PERSONAL > ADMIN_ASSIGNED > SYSTEM`.
- If a selected credential source is corrupted or its key is unavailable, it fails closed immediately (`AI_CREDENTIAL_CORRUPTED` / `AI_CREDENTIAL_KEY_UNAVAILABLE`) with **zero silent fallback** to lower-priority sources.
- No decrypted key or plaintext credential is ever transmitted to the client.

### 5.4 Server-Only Module Boundaries

All AI execution, prompts, credential handlers, and provider interfaces reside in files with `import 'server-only'`. Zero AI SDK imports (`@google/genai`) or crypto keyring dependencies exist in client-side bundles.

### 5.5 Prompt Injection & Adversarial Defense

User input is treated strictly as untrusted data:
- System instructions enforce that input text cannot override output JSON schemas, alter candidate token lists, or invoke system functions.
- Gemini is given **zero tool definitions** and **zero mutation authority**.
- Model output is validated strictly against JSON schema constraints via Phase 10 `AiOutputValidator`.

---

## 6. Cost, Resource Bounds & Rate Limiting Truthfulness

### 6.1 Call Budget & Invariant Limits

- **Max User Prompt Length:** 300 characters (validated on client and server).
- **Max Model Calls Per Action:** Exactly **1 call** (`PHASE_12A_PROVIDER_CALLS_PER_PARSE=1`).
- **Automatic Retries:** **0** (No auto-retry loops on failure).
- **Background Invocations:** **0** (No background jobs, polling, or recursive agents).
- **Operation Timeout:** 15,000 ms (enforced by `AiRouter` AbortController).
- **Max Output Tokens:** 1,024 tokens.

### 6.2 Serverless Rate-Limiting Truthfulness

- `PHASE_12A_DURABLE_RATE_LIMIT=false`
- `PHASE_12A_PROCESS_LOCAL_THROTTLE_SECURITY_BOUNDARY=false`
- **Architectural Truth:** In a serverless deployment (e.g., Vercel), in-memory rate limiting is process-local and is **not** an authoritative cross-instance quota or billing boundary.
- **Why Phase 12A requires `DATABASE_CHANGE=NONE`:**
  Finora is a private/small-user personal finance application, not a multi-tenant public SaaS. Cost protection is safely achieved through:
  1. Mandatory authentication before AI calls.
  2. 100% explicit user-triggered actions.
  3. Bounded input (300 chars) and max output tokens (1024).
  4. Zero automatic retries.
  5. Upstream provider quota enforcement (surfaced gracefully via `AI_RATE_LIMITED`).

---

## 7. Complete Error UX Matrix

All 13 `AiErrorCode` values from Phase 10 are mapped to clear, user-friendly, localized Vietnamese feedback while preserving manual form interactivity:

| Error Code | User-Facing Message (Vietnamese) | UI & Form Behavior |
| :--- | :--- | :--- |
| `AI_NOT_CONFIGURED` | "Chưa cấu hình API Key AI. Vui lòng thêm Gemini API Key trong Cài đặt hoặc liên hệ quản trị viên." | Display informational banner; manual form remains fully usable. |
| `AI_PROVIDER_UNAVAILABLE` | "Dịch vụ AI hiện không khả dụng. Vui lòng thử lại sau hoặc nhập thủ công." | Show temporary warning; preserve user input text. |
| `AI_AUTH_FAILED` | "Khóa API AI không hợp lệ hoặc đã bị từ chối bởi nhà cung cấp. Vui lòng kiểm tra lại API Key trong Cài đặt." | Show error banner with link to Settings; manual form remains open. |
| `AI_RATE_LIMITED` | "Đã vượt quá hạn mức yêu cầu AI từ nhà cung cấp. Vui lòng đợi giây lát hoặc nhập thủ công." | Show rate limit warning; preserve input text. |
| `AI_TIMEOUT` | "Yêu cầu AI quá thời gian phản hồi (15s). Vui lòng thử lại hoặc tiếp tục nhập thủ công." | Reset parse button state; retain form input. |
| `AI_ABORTED` | "Yêu cầu phân tích AI đã bị hủy." | Reset loading state cleanly. |
| `AI_INVALID_REQUEST` | "Nội dung yêu cầu không hợp lệ. Vui lòng kiểm tra lại câu lệnh." | Show inline hint; preserve input text. |
| `AI_INVALID_RESPONSE` | "Không thể phân tích phản hồi từ AI. Vui lòng thử lại hoặc nhập thủ công." | Show inline hint; preserve input text. |
| `AI_STRUCTURED_OUTPUT_INVALID` | "Cấu trúc dữ liệu AI trả về không hợp lệ. Vui lòng nhập thủ công." | Show warning badge; allow manual completion. |
| `AI_PROVIDER_ERROR` | "Đã xảy ra lỗi từ nhà cung cấp AI. Vui lòng thử lại sau." | Show temporary alert; keep form interactive. |
| `AI_CREDENTIAL_CORRUPTED` | "Khóa API đã lưu bị lỗi giải mã. Vui lòng cập nhật lại API Key trong Cài đặt." | Display error toast with link to Settings. |
| `AI_CREDENTIAL_KEY_UNAVAILABLE` | "Khóa mã hóa hệ thống hiện không khả dụng. Vui lòng liên hệ quản trị viên." | Display warning alert; keep manual form open. |
| `AI_CREDENTIAL_RESOLUTION_FAILED` | "Không thể xác thực quyền sử dụng khóa AI. Vui lòng kiểm tra lại cấu hình." | Display warning alert. |

*Application Session Error (Separate from AI):*
- `AUTH_REQUIRED`: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." -> Redirects to login.

---

## 8. Threat Model & Verification Matrix

```text
+-------------------------------------------------------------------------------------------------------------------------------+
|                                                 FINORA PHASE 12 THREAT MODEL                                                   |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| ID | Threat                        | Boundary                    | Mitigation                    | Verification Mechanism     |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T1 | Cross-User Data Leakage       | Server Action / Auth        | Authenticated session check;  | Two-user automated test;   |
|    |                               |                             | RLS client queries only       | candidate isolation test   |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T2 | API Key Leakage to Browser    | Browser / Server Boundary   | Server-only execution;        | Client bundle scan; static |
|    |                               |                             | zero plaintext key to client  | import checker test        |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T3 | Prompt Injection / Hijacking  | User Input Processing       | Strict JSON schema mode; zero | Adversarial prompt suite;  |
|    |                               |                             | tool / mutation authority     | unknown token rejection    |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T4 | Hallucinated Financial Totals | Domain Validation Layer     | String-decimal normalization; | Money boundary unit tests  |
|    |                               |                             | src/lib/money exact math      | with invalid string inputs |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T5 | Arbitrary Database ID Inject  | Entity Mapping Layer        | Request-scoped opaque tokens  | Unknown/malicious token    |
|    |                               |                             | (ACC_1, CAT_1); server lookup | rejection unit tests       |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T6 | Direct / Silent AI Mutation   | Transaction Mutation Layer  | AI layer imports 0 mutation   | Static AST import check;   |
|    |                               |                             | functions; explicit user save | DB row count assertion     |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T7 | Excessive Token / Cost Drain  | Router / Provider           | 300 char cap; 1 call per parse| Bounded input unit tests;  |
|    |                               |                             | zero auto-retries             | call-count assertion test  |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T8 | Denial of Service / Hanging   | AI Router Timeout           | 15s AbortController timeout   | Abort / timeout test with  |
|    |                               |                             | failing closed with AI_TIMEOUT| delayed fake provider      |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T9 | Sensitive Data in Server Logs | Logging Layer               | Zero raw prompt/key logging;  | Log sanitizer audit;       |
|    |                               |                             | normalized error codes only   | logger unit tests          |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T10| Malformed Output Rejection    | Structured Output Validator | Phase 10 AiOutputValidator    | Malformed JSON / schema    |
|    |                               |                             | runtime schema validation     | failure unit test suite    |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T11| Credential Fallback Weakening | Credential Resolver         | Strict fail-closed resolution;| Phase 11 regression suite; |
|    |                               |                             | zero fallback on bad key      | corrupted key test         |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
| T12| AI Outage Blocks Finance Flow | AddTransactionModal UX      | AI input is 100% optional;    | UI test verifying manual   |
|    |                               |                             | manual form always works      | save works during AI error |
+----+-------------------------------+-----------------------------+-------------------------------+----------------------------+
```

---

## 9. Comprehensive Testing & Verification Plan (Phase 12A)

Automated tests for Phase 12A require **zero real network calls** to Google Gemini (`REAL_GEMINI_NETWORK_CALL=false`), utilizing deterministic mock/fake providers.

### 9.1 Provider Output Validator Tests
- Valid JSON matching `AiTransactionParseOutput`.
- Missing required fields, invalid enum types, and extra unrecognized top-level fields.
- Rejection of numeric amounts (e.g., `amount: 85000` must be rejected).
- Oversized merchant, note, or unmatched text.
- Invalid currency strings (non-ISO-4217).
- Malformed date strings.

### 9.2 Token Mapping & Domain Cross-Validation Tests
- Correct mapping of valid `ACC_1`, `CAT_1`, `SRC_1`, `STR_1` tokens to actual user UUIDs.
- Unknown or fabricated model tokens safely mapped to `null` with `UNKNOWN_MODEL_TOKEN` warning.
- Category/Type conflict: `EXPENSE` type with income category token resolves to `category_id = null` and `CATEGORY_TYPE_CONFLICT`.
- Account/Currency conflict: Account with `VND` resolved against explicit `USD` prompt resolves to `account_id = null` and `ACCOUNT_CURRENCY_CONFLICT`.
- Income Stream parent conflict: Stream belonging to Source A returned with Source B resolves to `income_source_stream_id = null` and `INCOME_STREAM_PARENT_CONFLICT`.
- `type = 'EXPENSE'` with returned income source token forces `income_source_id = null`.

### 9.3 Money & Abbreviation Parsing Tests
- Verification of colloquial expressions: `85k`, `85 nghìn`, `1.5tr`, `1 tỷ`, `4.50 USD`, `50.000 VND`.
- Rejection of invalid values: negative amounts, zero, `NaN`, `Infinity`, more than 4 decimal places.

### 9.4 Authentication & Authorization Tests
- Unauthenticated requests rejected at server action boundary before AI invocation.
- User A authenticated context cannot access User B candidate tokens.
- Spoofed client-provided user IDs are completely ignored.
- Verification that service-role client is not used for financial domain reads.

### 9.5 Phase 11 Credential Integration Tests
- Resolution from `PERSONAL`, `ADMIN_ASSIGNED`, and `SYSTEM` sources.
- Corrupted `PERSONAL` key fails closed without falling back to `ADMIN_ASSIGNED` or `SYSTEM`.

### 9.6 Mutation Isolation Static Tests
- Static AST assertion proving AI parse module does not import `createTransaction`, `updateTransaction`, `voidTransaction`, or `restoreTransaction`.

### 9.7 UI & Interaction Tests
- Populating `AddTransactionModal` form fields from AI draft.
- User manual edits override draft values cleanly.
- Parse failure surfaces localized message without closing modal or wiping form state.
- Manual transaction creation works 100% normally when AI is unconfigured or failing.

---

## 10. Future Pass Baseline (12B & 12C) & Live Smoke Protocol

### 10.1 Phase 12B — Ephemeral Receipt Vision
- **Supported Formats:** `image/jpeg`, `image/png`, `image/webp` (Max 4MB).
- **Privacy Posture:** Ephemeral stream processing directly to Gemini multimodal API. **Zero storage in Supabase Storage**. Stream discarded immediately.

### 10.2 Phase 12C — Read-Only Financial Assistant & Report Summaries
- **Deterministic Context Input:** Receives pre-calculated summary DTOs from `src/features/reports/engine.ts`.
- **Zero Raw Table Access:** Model never receives raw transaction tables.
- **Authority Boundary:** Explanatory text only; zero mutation authority.

### 10.3 Future Phase 12A Production Live Smoke Protocol (Post-Source Acceptance)
After Phase 12A implementation is independently verified and deployed, a live smoke protocol will test real Gemini network execution with strict database verification:

1. Record initial user transaction count: `COUNT_0 = N`.
2. Send natural-language prompt (e.g., `"Ăn trưa 85k tiền mặt hôm nay"`).
3. Verify Gemini returns structured draft in modal.
4. **Assert Database:** `COUNT_1 = N` (Zero rows inserted by AI).
5. User edits/applies draft in form.
6. **Assert Database:** `COUNT_2 = N` (Zero rows inserted by form apply).
7. User explicitly clicks "Lưu giao dịch".
8. **Assert Database:** `COUNT_3 = N + 1` (Exactly one transaction created via standard domain engine).

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

PHASE_12A_MODEL_OUTPUT_USES_OPAQUE_TOKENS=true
PHASE_12A_APPLICATION_DRAFT_UUIDS_POSTVALIDATION_ONLY=true
PHASE_12A_SERVER_WARNING_CODES=true
PHASE_12A_NUMERIC_CONFIDENCE=false

PHASE_12A_PROVIDER_CALLS_PER_PARSE=1
PHASE_12A_SEPARATE_CATEGORIZATION_CALL=false

PHASE_12A_DURABLE_RATE_LIMIT=false
PHASE_12A_PROCESS_LOCAL_THROTTLE_SECURITY_BOUNDARY=false

PHASE_12A_ACCOUNT_CURRENCY_CROSS_VALIDATION=true
PHASE_12A_CATEGORY_TYPE_CROSS_VALIDATION=true
PHASE_12A_INCOME_STREAM_PARENT_CROSS_VALIDATION=true

PHASE_12_ERROR_UX_COMPLETE=true
PHASE_12_THREAT_MODEL_VERIFICATION_DEFINED=true
PHASE_12_TEST_MATRIX_COMPLETE=true

PHASE_12_CONTRACT=PENDING_INDEPENDENT_AUDIT

PHASE_12_IMPLEMENTATION_AUTHORIZED=false
```
