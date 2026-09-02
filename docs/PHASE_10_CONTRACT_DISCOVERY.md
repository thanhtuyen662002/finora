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
| **AI Layer & LLM Automation (Phase 10-12 in Roadmap)** | Placeholder / Unimplemented | Zero Backend Logic | `AGENTS.md` outlines AI Foundation, AI Credentials, and Natural-Language Transaction Parsing. |

---

## 2. Candidate Scopes Analysis

We evaluated 4 plausible candidates for Phase 10 based on user value, architectural dependencies, data-model readiness, security implications, and implementation risk.

---

### Candidate 1: AI Foundation & Secure Credential Router (Phase 10 in AGENTS.md)
- **Candidate Name:** AI Foundation, Provider Abstraction & Secure Credential Resolution
- **User Value:** High. Enables automated text-to-transaction parsing, smart categorization, receipt interpretation, and natural language query assistance without making core financial operations AI-dependent.
- **Current Repository Gap:** Currently, AI settings in `/settings` and `/admin` are mock stubs. No server-side `@google/genai` abstraction exists, no secure encrypted credential storage table exists, and no usage logging is implemented.
- **Required DB Work:**
  - Create `user_ai_credentials` table (encrypted personal Gemini API keys, masked read-back).
  - Create `ai_usage_logs` table (tracking operation type, tokens, latency, status).
  - Create server-enforced RLS policies ensuring credentials can only be decrypted/read by server-side API routes or the owning user.
- **Required UI Work:**
  - Update `/settings` to configure personal Gemini API keys with validation tests and masked display (`AIza••••••••••92K`).
  - Add AI transaction assistant / natural language quick-entry modal (`Ăn trưa 85k tiền mặt` -> parsed transaction preview with user confirmation).
- **Security / RLS Implications:** High security sensitivity. Private API keys must never be exposed to browser bundles or client localStorage. Server-side decryption in Next.js App Router API routes (`/api/ai/*`).
- **Exact-Money & Multi-Currency Implications:** AI output must strictly output validated string amounts and currency codes conforming to existing domain rules; financial math remains 100% deterministic in the finance engine.
- **Dependencies:** Built on top of complete Phase 1–9 financial entities (accounts, categories, income sources).
- **Verification Complexity:** Medium-High (Server route unit tests, mocked provider responses, credential encryption/decryption tests, security audit on bundle leaks).
- **Risk:** Low (AI operations are completely isolated; failure of AI provider fails gracefully without blocking core finance).
- **Estimated Size:** Medium.

---

### Candidate 2: User Data Interoperability, Import & Export Engine
- **Candidate Name:** Full CSV/JSON Import Engine, Column Mapping & Comprehensive Data Export
- **User Value:** Medium-High. Allows users to migrate transaction histories from bank exports (VCB, MB, etc.) and download complete encrypted/JSON backups.
- **Current Repository Gap:** CSV export exists for filtered transactions, but batch import, CSV column mapping, category auto-matching, and complete account/budget backup archives are absent.
- **Required DB Work:** Minimal. Uses existing transactional tables; optional `import_batches` audit table.
- **Required UI Work:** Stepper modal for CSV upload, interactive header-to-column mapping, validation preview grid, duplicate detection warnings.
- **Security / RLS Implications:** Low-Medium. Standard user-scoped inserts. Must prevent batch insertion exceeding transaction limits or bypassing validation.
- **Exact-Money & Multi-Currency Implications:** High complexity in parsing varying bank decimal formats (commas vs dots, negative notation `(100.00)` vs `-100.00`) into exact strings.
- **Dependencies:** Requires accounts, categories, income sources (already complete).
- **Verification Complexity:** Medium (Many parsing edge cases for banking CSV formats).
- **Risk:** Low-Medium (Data import parsing errors could generate malformed transactions if not properly previewed).
- **Estimated Size:** Medium.

---

### Candidate 3: Multi-User Workspace & Family Sharing
- **Candidate Name:** Shared Family Workspace & Multi-User Collaboration
- **User Value:** Medium. Enables sharing specific accounts or budgets with family members.
- **Current Repository Gap:** The system is strictly isolated per `user_id`. No workspace or shared ledger concept exists.
- **Required DB Work:** Extensive. Requires changing every primary table from `user_id` ownership to `workspace_id` or adding role-based junction tables (`workspace_members`, `account_permissions`).
- **Required UI Work:** Workspace switcher, invitation flows, member permission toggles.
- **Security / RLS Implications:** Very High. Complete rewrite of all RLS policies across Phase 2–9 tables.
- **Exact-Money & Multi-Currency Implications:** Low.
- **Dependencies:** Breaks baseline single-user simplicity outlined in `AGENTS.md` Section 1 ("Finora is not intended to be a commercial fintech SaaS platform... avoid premature enterprise complexity").
- **Verification Complexity:** Extremely High.
- **Risk:** High. Substantial architectural disruption and risk of RLS regressions.
- **Estimated Size:** Very Large.

---

### Candidate 4: Real Admin Panel & System Governance
- **Candidate Name:** Database-Enforced Admin Management & Operational Analytics
- **User Value:** Low-Medium. Only valuable for the instance administrator to monitor users and configure global flags.
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

1. **Rank 1 (P1): Candidate 1 — AI Foundation, Provider Abstraction & Secure Credential Router (Phase 10)**
2. **Rank 2 (P2): Candidate 2 — User Data Interoperability, Import & Export Engine**
3. **Rank 3 (P3): Candidate 4 — Real Admin Panel & System Governance**
4. **Rank 4 (P4): Candidate 3 — Multi-User Workspace & Family Sharing (Deferred per Master Architecture Guidelines)**

### Recommendation Rationale
We recommend **Candidate 1: AI Foundation & Secure Credential Router** as Phase 10 because:
1. **Architectural Alignment with `AGENTS.md`**: The master project roadmap explicitly defines Phase 10 as *AI Foundation (provider abstraction, AI router, error handling, structured results)* and Phase 11 as *AI Credentials (personal, admin-assigned, system Gemini credentials securely)*.
2. **Completeness of MVP Finance**: With Phase 9 (Income Sources) closed, all fundamental personal finance entities (Accounts, Categories, Transactions, Transfers, Budgets, Goals, Recurring, FX, Income Sources) are 100% real and database-backed. The next logical evolution is bringing intelligent, non-blocking productivity tools to speed up manual transaction entry.
3. **Strict Non-Dependency & Fail-Closed Safety**: AI will act as a pure accelerator; failure of the Gemini API or lack of credentials will fail gracefully, preserving 100% deterministic finance engine functionality.

---

## 4. Draft Phase 10 Implementation Contract

```text
PHASE_10_SCOPE=AI_FOUNDATION_PROVIDER_ABSTRACTION_SECURE_CREDENTIALS
PHASE_10_CONTRACT=DRAFT
PHASE_10_IMPLEMENTATION_AUTHORIZED=false
```

### 1. Goals
- Implement a decoupled, modular AI provider abstraction (`src/lib/ai/`) that interfaces with Google Gemini via the modern `@google/genai` SDK on the server side.
- Implement a three-tier credential resolution router: (1) User Personal API Key, (2) Admin-Assigned Key, (3) System Default Environment Key (`GEMINI_API_KEY`).
- Provide secure encrypted storage in Supabase for user personal API keys with masked client display (`AIza••••••••••92K`) and zero client-bundle secret leaks.
- Build server-side Next.js API routes (`/api/ai/parse-transaction`, `/api/ai/suggest-category`, `/api/ai/validate-key`) returning structured JSON with strict schema validation.
- Provide natural language transaction parsing UI with user confirmation (AI interprets -> user reviews -> user creates transaction).
- Maintain comprehensive, lightweight AI usage logging for operational diagnostics (`ai_usage_logs`).

### 2. Non-Goals
- DO NOT delegate authoritative financial calculations, net worth aggregation, or exchange rates to AI.
- DO NOT silently insert transactions without explicit user confirmation in the UI.
- DO NOT expose unmasked Gemini API keys to client JavaScript or browser DevTools.
- DO NOT make any core finance page (`/transactions`, `/accounts`, `/reports`, `/dashboard`) dependent on AI availability.

### 3. Data Model & Migration Requirements
- Migration `20260903100000_phase_10_ai_foundation_credentials.sql`:
  - Table `public.user_ai_credentials`: `user_id` (PK, FK auth.users), `encrypted_api_key` (text, not null), `key_hint` (text, e.g. `AIza...92K`), `is_active` (boolean default true), `created_at`, `updated_at`.
  - Table `public.ai_usage_logs`: `id` (uuid PK), `user_id` (FK auth.users), `operation` (text, e.g. `TRANSACTION_PARSE`, `CATEGORY_SUGGESTION`), `model` (text), `input_tokens` (integer), `output_tokens` (integer), `status` (text), `created_at`.
  - Database functions / pgcrypto for server-only key handling if necessary, or application-level authenticated encryption using server secrets.

### 4. RLS & Security Policies
- `user_ai_credentials`: `ENABLE ROW LEVEL SECURITY`. Users can SELECT their own `key_hint` and metadata, INSERT/UPDATE their own record, DELETE their own record. Raw encrypted key is never readable by unauthenticated users or cross-user queries.
- `ai_usage_logs`: `ENABLE ROW LEVEL SECURITY`. Users can SELECT only their own usage logs.
- All Gemini API calls occur strictly within server-side API routes (`src/app/api/ai/*`).

### 5. Domain & Multi-Currency Invariants
- AI-parsed amounts must be validated through `isPositiveExactDecimal` and converted to canonical exact strings before displaying to the user.
- AI-suggested currencies must match active currencies or default to the user's `base_currency`.
- Parsed accounts, categories, and income sources must be validated against the user's active database entities.

### 6. Verification Gates for Phase 10
1. `PHASE_10_SOURCE_GATE`: Static analysis verifying zero client-side `@google/genai` imports, exact decimal parsing, and contract adherence.
2. `PHASE_10_STRUCTURAL_GATE`: SQL structural verifier proving table schemas, column types, and security configurations.
3. `PHASE_10_TWO_USER_RLS`: Two-user SQL harness testing credential isolation and usage log isolation.
4. `PHASE_10_UI_GATE`: UI tests for key configuration, masking, natural language parsing modal, error handling when AI is offline.
5. `PHASE_10_LIVE_PERSISTENCE_SMOKE`: Production persistence smoke test with live key validation and transaction parsing confirmation.

---

## 5. Governance State

```text
PHASE_9_OVERALL=PASS
FINORA_PHASE_9=PASS

PHASE_10_AUTHORIZED=true
PHASE_10_SCOPE=AI_FOUNDATION_PROVIDER_ABSTRACTION_SECURE_CREDENTIALS
PHASE_10_CONTRACT=DRAFT
PHASE_10_IMPLEMENTATION_AUTHORIZED=false
```
