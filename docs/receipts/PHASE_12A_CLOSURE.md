# Finora — Phase 12A Closure Receipt

## 1. Scope & Execution Overview

- **Project:** Finora
- **Phase:** Phase 12A — Natural-Language Transaction Draft & Smart Category Suggestion
- **Repository:** `thanhtuyen662002/finora`
- **Branch:** `main`
- **Accepted Implementation SHA:** `8430212af02417a79dcc0a2f048437b719d0d186`
- **Accepted Implementation Tree:** `0d6369fae0fa23485e6e371ade7ec36a8551bf1a`
- **Production Deployment:** `dpl_3cajAVrkUEtNcWfSYAzEgoSAjYwt`
- **Deployment State:** `READY`
- **Deployment Target:** `production`
- **Exact Deployed Git SHA:** `8430212af02417a79dcc0a2f048437b719d0d186`
- **Live Finora Origin:** `https://finora-orpin-nu.vercel.app`
- **Target Supabase Project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Scope Identifier:** `AI_TRANSACTION_DRAFT_AND_FAST_PATH`

---

## 2. Accepted Architectural Contract

Phase 12A establishes the natural-language transaction drafting subsystem and deterministic fast path under the following non-negotiable architectural invariants:

1. **AI-Assisted, Never AI-Dependent:** Core financial workflows function completely without AI. AI produces non-authoritative drafts only.
2. **Single Authenticated Server Action Entrypoint:** All parsing requests are processed exclusively through `parseTransactionTextAction` / `parseTransactionTextCore`.
3. **Authoritative Identity:** User identity is verified via `supabase.auth.getUser()`. The actor claim is strictly derived from the verified session, never from client input.
4. **Zero Direct Client AI Calls:** The browser never calls the Gemini API or credential subsystem directly.
5. **Authenticated RLS Financial Reads:** Context candidates (accounts, categories, income sources, income streams) are queried exclusively through the caller's authenticated Supabase RLS client.
6. **Isolated Credential Subsystem:** The Phase 11 service-role credential resolver (`resolveDecryptedAiCredentialForService`) remains private and server-only.
7. **Zero Financial Mutation Authority:** The AI parser and deterministic fast path have strictly zero mutation authority (0 `INSERT`, 0 `UPDATE`, 0 `DELETE` operations on financial tables).
8. **Drafts Only:** Parsing produces interactive drafts only. Draft lifecycle is `Text Input -> Parse (Deterministic / Gemini) -> Preview -> User Edit / Review -> Apply -> Explicit Save`.
9. **Explicit Save Requirement:** Only the existing, user-initiated standard transaction creation path (`addTransactionAction`) can persist records to the database.
10. **Canonical Exact Money:** Monetary amounts are strictly represented as canonical 4-decimal strings (`numeric(20,4)` e.g. `85000.0000`). Floating-point coercion and arithmetic are strictly prohibited.
11. **Privacy-Preserving Telemetry:** Raw user transaction prompts, responses, and credentials are never stored in telemetry or logs. Only structured execution timings and diagnostic metadata are emitted.
12. **Opaque Candidate Tokens:** Database UUIDs are never sent across the LLM boundary. Only sanitized, opaque candidate tokens (`ACC_...`, `CAT_...`, `SRC_...`, `STR_...`) are exchanged.
13. **Authoritative Runtime Validator:** Both deterministic and Gemini execution paths are gated by the shared `aiTransactionParseOutputValidator.validate()` before domain cross-validation.
14. **Mandatory Post-Parse Revalidation:** All candidate references returned by the parser are revalidated against the user's active accounts, categories, and income streams under RLS before populating the draft.
15. **Single-Call Boundary:** Maximum Gemini API invocations per parse action is exactly 0 (fast path) or 1 (fallback).

---

## 3. Deterministic Fast Path Architecture & Fail-Safe Protections

### 3.1 Execution Strategy
- **Simple / High-Confidence Prompts:**
  ```text
  User Text
  ↓
  Deterministic Parser (fast-path.ts)
  ↓
  [0 Credential Resolution | 0 AI Router Calls | 0 Gemini Network Calls]
  ↓
  Authoritative Output Validator (validator.ts)
  ↓
  Domain Cross-Validation (domain.ts)
  ↓
  Authenticated RLS Revalidation
  ↓
  Interactive UI Preview (parse_source = DETERMINISTIC)
  ```
- **Ambiguous / Unsupported Prompts:**
  - Safely fail closed to the single-call Gemini fallback (`parse_source = AI`).
  - Fallback model is pinned strictly to the stable model alias: `gemini-3.5-flash-lite`.

### 3.2 Accepted Fail-Safe Protections
The deterministic engine strictly fails closed to Gemini whenever any ambiguity or complexity is detected:
- **Multiple Amounts:** Multiple monetary values in text trigger Gemini fallback.
- **Ranges:** Numeric ranges (e.g. `80-90k`) trigger Gemini fallback.
- **Corrections:** Phrases expressing corrections (e.g. `à không phải`, `nhầm`) trigger Gemini fallback.
- **Multi-Transaction Requests:** Sequential connectors (e.g. `rồi sau đó`, `và`) trigger Gemini fallback.
- **Conflicting Type Semantics:** Mixed income and expense keywords trigger Gemini fallback.
- **Exact-Money Excess Precision:** Non-zero fractional digits beyond 4 decimal places trigger fallback without silent truncation.
- **Complete Monetary Token Consumption:** Unconsumed alphanumeric suffixes on amount tokens trigger fallback.
- **Currency Conflicts:** Multiple explicit currencies or foreign currencies combined with Vietnamese multipliers trigger fallback.
- **Attached Currency Semantics:** Binds attached ISO codes (`USD`, `EUR`, `JPY`, `CNY`, `KRW`, `VND`), names, and symbols (`$`, `€`, `¥`, `đ`, `d`) directly to amount tokens.
- **Vietnamese Multiplier + Foreign Currency Conflict:** Combinations such as `85kUSD`, `85k$`, `1trEUR` fail closed to Gemini.
- **Calendar Date Validation:** ISO, slash (`DD/MM/YYYY`), dash (`DD-MM-YYYY`), Vietnamese long dates, and relative offsets are calendar-validated; invalid dates trigger Gemini fallback.
- **Incomplete / Partial Dates:** Incomplete date claims (e.g. `ngày 4`, `ngày 4 tháng 9`, `tháng 9`) fail closed to Gemini without defaulting to today.
- **Conflicting Date Claims:** Multiple distinct dates detected in a single prompt trigger Gemini fallback.
- **Stale Candidate Revalidation:** Candidate references are re-checked against active RLS query results.
- **Unique-Only Entity Matching:** Non-unique or ambiguous account/category/source names leave fields unresolved for explicit user selection.

---

## 4. Accepted Static & Offline Verification Evidence

All offline verification suites, static analyzers, and regression matrices pass with zero errors:

- **TypeScript Compilation:** `npm run typecheck` — **PASS**
- **ESLint Linting:** `npm run lint` — **PASS**
- **Production Build:** `compile_applet` — **PASS**
- **Phase 12A Test Suite:** `tests/phase12a-transaction-draft.test.ts` — **36/36 PASS**
- **Phase 12A Source Verifier:** `scripts/verify-phase12a-source.mjs` — **110/110 PASS**
- **Phase 10 Regression Suite:** `tests/phase10-ai-foundation.test.ts` — **50/50 PASS**
- **Phase 11 Regression Suite:** `tests/phase11-ai-credentials.test.ts` — **79/79 PASS**

---

## 5. Real Gemini Production Evidence

The initial live Gemini integration was independently verified in the production environment (`https://finora-orpin-nu.vercel.app`):

- **Prompt Class:** Simple transaction text (`Ăn trưa 85k`)
- **Observed Structured Result:**
  - `type = EXPENSE`
  - `amount = 85000.0000`
  - `currency_code = VND`
  - `occurred_on = 2026-09-04`
  - `category = Ăn uống`
  - `account = unresolved` (requires user review and selection)
- **Production Server Timing:**
  - `context_ms = 1011`
  - `ai_provider_ms = 8234`
  - `revalidation_ms = 805`
  - `total_ms = 10071`
- **Financial Mutations:** `0` (Zero mutations created during parse)
- **Draft Application Verification:** User applied draft to form state without saving; database `transaction_count` remained unchanged at `14`.

```text
PHASE_12A_LIVE_GEMINI_PARSE=PASS
PHASE_12A_PARSE_APPLY_ZERO_MUTATION=PASS
```

---

## 6. Deterministic Production Benchmark

The deterministic fast path was benchmarked in the live production environment on the exact same workload:

- **Production Telemetry:**
  - `execution_path = deterministic`
  - `fast_path_ms = 36`
  - `context_ms = 972`
  - `ai_provider_ms = 0`
  - `revalidation_ms = 825`
  - `total_ms = 1833`
  - `warning_count = 1`
- **UI Result:**
  - `parse_source = DETERMINISTIC`
  - `badge = "Phân tích nhanh"`
  - `type = EXPENSE`
  - `amount = 85000.0000`
  - `currency_code = VND`
  - `category = Ăn uống`
  - `occurred_on = 2026-09-04`
  - `account = unresolved` (explicit user selection preserved)
- **Production Server Latency Reduction:** `10071 ms -> 1833 ms` (approx. **81.8% server-side latency reduction**).
- **Zero Mutation Invariant:** Database `transaction_count` remained unchanged at `14`.

```text
PHASE_12A_FAST_PATH_REAL_SMOKE=PASS
PHASE_12A_FAST_PATH_AI_PROVIDER_CALLS=0
PHASE_12A_FAST_PATH_PARSE_MUTATION=0
```

---

## 7. Explicit Save Production Evidence

The complete parse-to-persistence workflow was validated in production to confirm explicit user save authority:

1. **Before Explicit Save:** `transaction_count = 14`
2. **User Action:** Exactly one explicit user click on the standard modal Save button.
3. **After Explicit Save:** `transaction_count = 15`
4. **Created Rows:** Exactly `1`
5. **Duplicate Rows:** `0`
6. **Persisted Record Verification:**
   - `type = EXPENSE`
   - `amount = 85000.0000`
   - `currency_code = VND`
   - `occurred_on = 2026-09-04`
   - `merchant = "Phase 12A smoke"`
   - `note = "Ăn trưa"`
   - `exact_matching_smoke_rows = 1`

This verifies that:
- Parse did not persist financial data;
- Preview did not persist financial data;
- Apply did not persist financial data;
- Explicit user Save was required to commit the transaction;
- Save created exactly one record with zero duplicates.

```text
PHASE_12A_EXPLICIT_SAVE_SMOKE=PASS
PHASE_12A_EXPLICIT_SAVE_CREATED_ROWS=1
PHASE_12A_EXPLICIT_SAVE_DUPLICATES=0
```

---

## 8. Final Accepted Gates

```text
PHASE_12_CONTRACT=PASS

PHASE_12A_SOURCE_GATE=PASS
PHASE_12A_MODEL_POLICY=PASS

PHASE_12A_LIVE_GEMINI_PARSE=PASS
PHASE_12A_PARSE_APPLY_ZERO_MUTATION=PASS

PHASE_12A_PERFORMANCE_AND_MONEY_CORRECTIVE=PASS

PHASE_12A_DETERMINISTIC_FAST_PATH_SOURCE_GATE=PASS
PHASE_12A_FAST_PATH_CORRECTIVE_1=PASS
PHASE_12A_FAST_PATH_CORRECTIVE_2=PASS

PHASE_12A_FAST_PATH_REAL_SMOKE=PASS
PHASE_12A_FAST_PATH_AI_PROVIDER_CALLS=0
PHASE_12A_FAST_PATH_PARSE_MUTATION=0

PHASE_12A_EXPLICIT_SAVE_SMOKE=PASS
PHASE_12A_EXPLICIT_SAVE_CREATED_ROWS=1
PHASE_12A_EXPLICIT_SAVE_DUPLICATES=0

PHASE_12A_FUNCTIONAL_RUNTIME_GATE=PASS

PHASE_12A_OVERALL=PASS
FINORA_PHASE_12A=PASS
PHASE_12A_CLOSED=true
```

---

## 9. Next Phase Authorization Boundary

Formal closure of Phase 12A authorizes discovery and architectural planning for Phase 12B:

```text
PHASE_12B_CONTRACT_DISCOVERY_AUTHORIZED=true
PHASE_12B_IMPLEMENTATION_AUTHORIZED=false
PHASE_12C_IMPLEMENTATION_AUTHORIZED=false
```

- **Phase 12 Overall Status:** `PARTIAL`
- **Phase 12A Status:** `CLOSED / PASS`
- **Phase 12B Status:** `CONTRACT_DISCOVERY_AUTHORIZED`
- *Implementation of Phase 12B (Receipt Vision) or Phase 12C (Chat Assistant) remains strictly unauthorized until the respective contracts are formally reviewed and approved.*
