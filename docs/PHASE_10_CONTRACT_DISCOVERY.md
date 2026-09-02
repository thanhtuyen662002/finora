# Finora — Phase 10 Contract Discovery & Candidate Analysis

## 1. Repository & Product State Audit

Following the completion and closure of **Phase 9 (Income Sources & Revenue Attribution)**, an in-depth audit of the repository was conducted to inspect all persistent surfaces, data models, routes, and user workflows.

### Authoritative Architecture Summary
- **Frontend / Application:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Lucide icons, Motion, Responsive PWA structure.
- **Backend / Storage:** Supabase (PostgreSQL 15+, Supabase Auth, Row-Level Security, Database Views with `security_invoker = true`).
- **Core Invariants:** Exact string decimals (`numeric(20,4)` money, `numeric(30,12)` rates), dual-currency transaction model, database-enforced RLS, fail-closed financial summaries, zero JavaScript float math on balance/net-worth calculations.

### Current Implementation Status Matrix

| Module / Surface | Current State | Completeness & Quality | Notes |
| :--- | :--- | :--- | :--- |
| **Auth & Profiles (Phase 2)** | Fully Real & Persistent | Complete (PASS) | Email/password, OAuth, RLS, user settings, profile updates. |
| **Accounts & Categories (Phase 3)** | Fully Real & Persistent | Complete (PASS) | Multi-type accounts, custom categories, soft archive, RLS. |
| **Transactions (Phase 4)** | Fully Real & Persistent | Complete (PASS) | INCOME/EXPENSE, soft void, exact decimal math, RLS. |
| **Transfers (Phase 5 & 8)** | Fully Real & Persistent | Complete (PASS) | Same-currency & cross-currency transfers, immutable rates, void/restore balance rollback. |
| **Dashboard & Reports (Phase 6 & 8)**| Fully Real & Persistent | Complete (PASS) | Net worth, cash flow, multi-currency views, 6M trend charts, fail-closed BASE conversion. |
| **Budgets & Goals & Recurring (Phase 7)**| Fully Real & Persistent | Complete (PASS) | Period budgets, financial targets with milestone tracking, recurring bills engine. |
| **Multi-Currency & FX Engine (Phase 8)**| Fully Real & Persistent | Complete (PASS) | Historical immutable rates, current asset revaluation, fallback handling. |
| **Income Sources (Phase 9)** | Fully Real & Persistent | Complete (PASS) | Source types (Salary, YouTube, Freelance, Investment, Other), streams, revenue attribution. |
| **CSV Import & User Export (Phase 14 in Roadmap)** | Partial / Stubbed | UI Preview Only | CSV upload preview exists, full user backup/export and batch import engine incomplete. |
| **Admin Shell (Phase 13 in Roadmap)** | Mock / Prototype Only | UI Prototype Only | `/admin` page uses `MOCK_ADMIN_METRICS`, `MOCK_ADMIN_USERS`, unpersisted mock feature flags. |
| **AI Layer & LLM Automation (Phase 10-12 in Roadmap)** | Not Started | Zero Backend Logic | `AGENTS.md` outlines distinct phases: Phase 10 (AI Foundation), Phase 11 (AI Credentials), Phase 12 (AI Features). |

---

## 2. Candidate Scopes Analysis

We evaluated 4 plausible candidate scopes for the next milestone based on user value, architectural dependencies, data-model readiness, security implications, and implementation risk.

---

### Candidate 1: AI Foundation — Provider Abstraction, Router, Error Normalization & Structured Results (Phase 10)
- **Candidate Name:** AI Foundation — Provider Abstraction, Router, Error Normalization & Structured Results
- **User Value:** Foundational / Architectural. Establishes a clean, provider-agnostic AI subsystem (`src/lib/ai/`) that enables downstream natural-language parsing, smart categorization, and financial explanations without locking the application to any single vendor and without compromising deterministic finance logic.
- **Current Repository Gap:** Zero AI infrastructure exists in the codebase.
- **Required DB Work:** **NONE**. Zero database changes, zero migrations, zero tables, zero RLS policies.
- **Required UI Work:** **NONE**. Phase 10 is purely an application foundation layer; user-facing AI interfaces belong strictly to Phase 12.
- **Security / RLS Implications:** Strict server-only boundary. All AI provider adapters and execution logic must reside exclusively on the server side. No SDKs, API keys, or credentials may be leaked into client bundles or browser code.
- **Exact-Money & Multi-Currency Implications:** AI foundation schemas must enforce that monetary values in structured outputs are strictly typed as exact string decimals (`string`), never JavaScript `number`.
- **Dependencies:** Built on standard TypeScript/Node runtime without modifying any Phase 1–9 entities.
- **Verification Complexity:** Low-Medium. Fully verifiable via deterministic unit tests with mocked provider adapters; requires zero live network calls and zero production credentials.
- **Risk:** Minimal. Purely additive library layer with zero database mutation risk.
- **Estimated Size:** Small-Medium.

---

### Candidate 2: User Data Interoperability, Import & Export Engine (Phase 14 in AGENTS.md)
- **Candidate Name:** Full CSV/JSON Import Engine, Column Mapping & Comprehensive Data Export
- **User Value:** Medium-High. Allows users to migrate transaction histories from bank exports and download complete backups.
- **Current Repository Gap:** CSV export exists for filtered transactions, but batch import, CSV column mapping, category auto-matching, and complete account/budget backup archives are absent.
- **Required DB Work:** Minimal. Uses existing transactional tables; optional `import_batches` audit table.
- **Required UI Work:** Stepper modal for CSV upload, interactive header-to-column mapping, validation preview grid, duplicate detection warnings.
- **Security / RLS Implications:** Low-Medium. Standard user-scoped inserts. Must prevent batch insertion exceeding transaction limits or bypassing validation.
- **Exact-Money & Multi-Currency Implications:** High complexity in parsing varying bank decimal formats into exact strings.
- **Dependencies:** Requires accounts, categories, income sources (already complete).
- **Verification Complexity:** Medium (Many parsing edge cases for banking CSV formats).
- **Risk:** Low-Medium.
- **Estimated Size:** Medium.

---

### Candidate 3: Multi-User Workspace & Family Sharing
- **Candidate Name:** Shared Family Workspace & Multi-User Collaboration
- **User Value:** Medium. Enables sharing specific accounts or budgets with family members.
- **Current Repository Gap:** The system is strictly isolated per `user_id` across all tables.
- **Required DB Work:** Extensive. Requires changing every primary table from `user_id` ownership to `workspace_id` or adding role-based junction tables (`workspace_members`, `account_permissions`).
- **Required UI Work:** Workspace switcher, invitation flows, member permission toggles.
- **Security / RLS Implications:** Very High. Complete rewrite of all RLS policies across Phase 2–9 tables.
- **Exact-Money & Multi-Currency Implications:** Low.
- **Dependencies:** Violates baseline private-first design in `AGENTS.md` Section 1 ("Finora is not intended to be a commercial fintech SaaS platform... avoid premature enterprise complexity").
- **Verification Complexity:** Extremely High.
- **Risk:** High. Substantial architectural disruption and risk of RLS regressions.
- **Estimated Size:** Very Large.

---

### Candidate 4: Real Admin Panel & System Governance (Phase 13 in AGENTS.md)
- **Candidate Name:** Database-Enforced Admin Management & Operational Analytics
- **User Value:** Low-Medium. Primarily useful for instance administrators to monitor operational health.
- **Current Repository Gap:** `/admin` is entirely mock data.
- **Required DB Work:** Admin role flag in `profiles` or `user_roles`, server-side RPCs to read aggregate operational metrics without bypassing user financial privacy.
- **Required UI Work:** Connect `/admin` tabs to real database aggregates.
- **Security / RLS Implications:** High. Must ensure admin users CANNOT inspect private financial transactions of other users without explicit authorization.
- **Exact-Money & Multi-Currency Implications:** Low.
- **Dependencies:** Best implemented after core user and AI features are established.
- **Verification Complexity:** Medium.
- **Risk:** Low-Medium.
- **Estimated Size:** Small-Medium.

---

## 3. Candidate Ranking & Recommendation

### Ranking Matrix

1. **Rank 1 (P1): Candidate 1 — AI Foundation (Phase 10)**
2. **Rank 2 (P2): Candidate 2 — User Data Interoperability, Import & Export Engine**
3. **Rank 3 (P3): Candidate 4 — Real Admin Panel & System Governance**
4. **Rank 4 (P4): Candidate 3 — Multi-User Workspace & Family Sharing (Deferred)**

### Recommendation Rationale
We recommend **Candidate 1: AI Foundation — Provider Abstraction, Router, Error Normalization & Structured Results** as Phase 10 because:
1. **Strict Alignment with Authoritative Roadmap (`AGENTS.md` Section 35)**:
   - `Phase 10 — AI Foundation`: Provider abstraction, AI router, error handling, structured results.
   - `Phase 11 — AI Credentials`: Personal, admin-assigned, and system Gemini credentials securely.
   - `Phase 12 — AI Features`: Natural-language transaction parsing, categorization, financial assistant.
2. **Proper Architectural Layering**: Building the provider-agnostic router and structured validation runtime first guarantees that credential management (Phase 11) and user-facing features (Phase 12) plug into a clean, testable contract.
3. **Zero Risk to Core Finance Invariants**: Phase 10 has zero database footprint, zero migration dependencies, and zero impact on deterministic finance calculations.

---

## 4. Finalized Phase 10 Implementation Contract

```text
PHASE_10_SCOPE=AI_FOUNDATION_PROVIDER_ABSTRACTION_ROUTER_STRUCTURED_RESULTS
PHASE_10_CONTRACT=PASS
PHASE_10_IMPLEMENTATION_AUTHORIZED=true
```

### 1. Goals
- **Provider Abstraction (`src/lib/ai/provider.ts`)**: Define a provider-neutral interface (`AiProvider`) separating provider identity, model selection, execution context, structured input/output, timeout/cancellation, normalized errors, and usage metadata.
- **AI Router (`src/lib/ai/router.ts`)**: Implement a central router (`AiRouter`) that dispatches logical AI operations to the appropriate configured provider and model, ensuring finance components never reference vendor-specific SDKs or model names directly.
- **Central Model Configuration (`src/lib/ai/config.ts`)**: Provide a single server-side configuration layer mapping operations (e.g. `transaction_parser`, `categorization`, `financial_assistant`, `receipt_vision`, `report_summary`) to providers, default models, timeouts, and structured output strategies.
- **Gemini Provider Adapter (`src/lib/ai/providers/gemini.ts`)**: Implement an official server-only adapter using `@google/genai`. The adapter must receive credentials strictly via dependency injection (conforming to `AiCredentialContext`) without implementing key resolution or storage.
- **Server-Only Boundary**: Enforce strict server execution (Next.js server-only / API routes). Ensure zero Gemini SDK imports, zero credential dependencies, and zero secret values exist in client bundles.
- **Normalized Error Taxonomy (`src/lib/ai/errors.ts`)**: Define standardized error codes (`AI_NOT_CONFIGURED`, `AI_PROVIDER_UNAVAILABLE`, `AI_AUTH_FAILED`, `AI_RATE_LIMITED`, `AI_TIMEOUT`, `AI_ABORTED`, `AI_INVALID_REQUEST`, `AI_INVALID_RESPONSE`, `AI_STRUCTURED_OUTPUT_INVALID`, `AI_PROVIDER_ERROR`) to prevent vendor SDK error leaks.
- **Structured Results Runtime Validation (`src/lib/ai/structured-result.ts`)**: Implement runtime validation for AI responses (`AiStructuredResult<T>`), failing closed on malformed or schema-violating output.
- **Exact-Money String Boundary**: Enforce that any monetary values in structured schemas are strictly strings (`string`), preventing IEEE-754 floating-point inaccuracies.
- **Finance Non-Dependency**: Ensure that all core financial calculations, balance aggregations, RLS, and transaction mutations remain 100% deterministic, exact-decimal, and fully functional if AI is unavailable.
- **Phase 11 Credential Dependency Interface (`src/lib/ai/types.ts`)**: Define the `AiCredentialProvider` interface/port for Phase 11 dependency injection without providing the production credential resolution implementation.

### 2. Non-Goals (Explicitly Excluded from Phase 10)
- **NO Database Work**: DO NOT create tables (`user_ai_credentials`, `ai_usage_logs`), functions, triggers, or migrations (`DATABASE_CHANGE=NONE`, `MIGRATION_REQUIRED=false`).
- **NO Credential Storage / RLS**: DO NOT implement personal/admin key database persistence, encryption, or RLS policies (reserved for Phase 11).
- **NO Credential Resolution Implementation**: DO NOT implement multi-tier priority resolution logic (reserved for Phase 11).
- **NO User-Facing AI Features or API Routes**: DO NOT create `/api/ai/parse-transaction`, `/api/ai/suggest-category`, natural-language transaction modals, receipt vision, or chat UI (reserved for Phase 12).
- **NO Settings Key UI**: DO NOT implement API key management screens in `/settings` (reserved for Phase 11).
- **NO Financial Calculation by AI**: AI must never compute account balances, net worth, historical FX conversions, or budget consumptions.
- **NO Silent Mutations**: AI must never insert, update, or delete financial records directly.

### 3. Target Source File Structure
```text
src/lib/ai/
├── types.ts              # Core types, AiRequest, AiResult, AiUsage, AiCredentialProvider interface
├── errors.ts             # Normalized AiError class and AiErrorCode enum
├── provider.ts           # AiProvider interface and base provider helpers
├── router.ts             # AiRouter implementation (registry, dispatch, error normalization)
├── config.ts             # Central model and operation configuration
├── structured-result.ts  # Runtime schema validation and structured result wrapper
└── providers/
    └── gemini.ts         # Server-side Gemini adapter using @google/genai

src/features/ai/
└── index.ts              # Public feature entrypoint exporting router and types
```

### 4. Testing Contract & Verification Requirements
Phase 10 implementation will require automated, deterministic test suites covering:
1. **Provider Registration & Selection**: Verifying providers can be registered and selected by router.
2. **Operation-to-Model Dispatch**: Asserting operation identifiers resolve to configured models and providers.
3. **Structured Response Validation**: Testing successful schema validation and fail-closed rejection on invalid provider output.
4. **Error Normalization Matrix**: Asserting SDK errors (auth failure, rate limit, timeout, abort, malformed response) map to normalized `AiError` codes without leaking raw exceptions.
5. **Credential Dependency Injection**: Verifying provider execution fails gracefully with `AI_NOT_CONFIGURED` or `AI_AUTH_FAILED` when credential provider is missing or returns invalid credentials.
6. **Mocked Gemini Adapter**: Verifying Gemini adapter maps structured prompts and formats output using a mocked SDK without issuing real network requests.
7. **Server-Only Leak Prevention**: Verifying no AI adapter or SDK code is imported in client-side components or bundles.

### 5. Verification Gates for Phase 10
- `PHASE_10_SOURCE_GATE`: Static analysis verifying domain rules, exact-string money representations, error normalization, and contract adherence.
- `PHASE_10_SERVER_BOUNDARY_GATE`: Verifying zero `@google/genai` imports in client code and zero secret leaks.
- `PHASE_10_STRUCTURED_RESULT_GATE`: Verifying fail-closed runtime schema validation.
- `PHASE_10_PROVIDER_ROUTER_TEST_GATE`: Complete test suite execution for provider abstraction and router.
- `PHASE_10_NON_REGRESSION_GATE`: Full verification that Phase 2–9 tests, types, and builds pass without regression.
- `PHASE_10_REMOTE_DATABASE=NOT_APPLICABLE`
- `PHASE_10_STRUCTURAL_DB_GATE=NOT_APPLICABLE`
- `PHASE_10_TWO_USER_RLS=NOT_APPLICABLE`
- `PHASE_10_LIVE_PERSISTENCE_SMOKE=NOT_APPLICABLE`

---

## 5. Downstream Phase Previews (Non-Authoritative Handoff)

### Phase 11 Preview — AI Credentials (`PHASE_11_PLANNED_SCOPE=AI_CREDENTIALS`)
- **Planned Scope**: Three-tier credential resolution priority ((1) User Personal API Key -> (2) Admin-Assigned Key -> (3) System Default Key), secure server-side encrypted storage outside publicly queryable user tables, database-enforced RLS, masked client display (`AIza••••••••••92K`), key validation, and secret-leak protection.

### Phase 12 Preview — AI Features (`PHASE_12_PLANNED_SCOPE=AI_FEATURES`)
- **Planned Scope**: Natural-language transaction parsing (`Ăn trưa 85k tiền mặt` -> preview -> confirmation), smart category suggestion, receipt OCR interpretation, and financial chat assistant, all following the mandatory preview-and-confirm workflow.

---

## 6. Governance State

```text
PHASE_9_OVERALL=PASS
FINORA_PHASE_9=PASS

PHASE_10_AUTHORIZED=true
PHASE_10_SCOPE=AI_FOUNDATION_PROVIDER_ABSTRACTION_ROUTER_STRUCTURED_RESULTS

PHASE_10_CONTRACT=PASS
PHASE_10_IMPLEMENTATION_AUTHORIZED=true

PHASE_11_AUTHORIZED=false
PHASE_12_AUTHORIZED=false
```
