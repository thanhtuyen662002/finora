# Finora — Architecture

## Status

This document describes the **target architecture**. At the current repository state, application code has not yet been initialized.

## Architectural Style

Finora uses a **modular monolith**.

The goal is to keep the application simple enough for a single developer to understand and maintain while preserving clear domain boundaries for future growth.

## High-Level Architecture

```text
Responsive Next.js Web / PWA
            |
            +-- User UI
            +-- Admin UI
            |
            v
     Application Layer
            |
   +--------+---------+
   |        |         |
Finance    AI        FX
Engine    Layer     Engine
   |        |         |
   +--------+---------+
            |
         Supabase
     +------+------+ 
     |      |      |
 PostgreSQL Auth  Storage
```

## Core Technology Decisions

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL/Auth/Storage
- Google Gemini API through a server-side provider abstraction
- Progressive Web App before native mobile apps

## Module Boundaries

Expected application modules:

- accounts
- categories
- transactions
- transfers
- budgets
- goals
- recurring transactions / bills
- reports
- currencies / FX
- income sources
- AI
- admin

Financial calculations must not live directly inside UI components.

## Finance Engine

The Finance Engine is deterministic application logic responsible for authoritative calculations such as:

- account balances;
- income and expense totals;
- transfer neutrality;
- net worth;
- savings and saving rate;
- budget usage;
- report aggregation;
- historical currency conversion.

LLMs must not be the source of truth for these calculations.

## AI Layer

The AI layer enhances usability and may support:

- natural-language transaction parsing;
- categorization;
- financial explanations;
- receipt interpretation;
- report summaries.

AI is optional. Core finance operations must remain usable when AI is unavailable.

All private provider credentials must remain server-side.

### AI Credential Architecture (Phase 11)

Credentials for AI providers (e.g. Gemini) are protected via application-level authenticated encryption:
- **Envelope Encryption:** AES-256-GCM authenticated encryption at the application tier before database persistence.
- **Key Ring:** Versioned 256-bit master keys resolved from `FINORA_AI_CREDENTIAL_KEY_RING_JSON`. Supports live key rotation without database migration.
- **Canonical AAD Binding:** Binds version, credential ID, owner user ID, provider, and source. Cryptographically blocks cross-slot and cross-row transplant attacks.
- **Private Schema Isolation:** Stored in `private.ai_credentials`. Schema `private` is completely unexposed to PostgREST and revoked from browser roles (`PUBLIC`, `anon`, `authenticated`).
- **Service-Role RPC Facade:** Database operations are mediated via three dedicated `SECURITY INVOKER` RPCs (`ai_credentials_read_for_service`, `ai_credentials_write_for_service`, `ai_credentials_revoke_for_service`). Browser execution is strictly revoked.
- **Fail-Closed Resolution:** Evaluates `PERSONAL` > `ADMIN_ASSIGNED` > `SYSTEM`. Any corruption or key unavailability fails closed without insecure downgrade.
- **Admin Authority:** Strict UUID allowlist via `FINORA_ADMIN_USER_IDS`. Email addresses, metadata, and client tokens are untrusted.
- **Client Safety:** Zero plaintext or ciphertext is ever returned to browser code; only safe metadata DTOs with masked key hints (`AIza••••••••••92K`) are exposed.

## FX Engine

Currency conversion is abstracted behind an FX service.

The system distinguishes:

- **historical transaction FX** — snapshotted and stable for historical reporting;
- **current FX** — used for current foreign-asset valuation.

External FX providers must be replaceable without changing finance business logic.

## Supabase Security Boundary

Every user-owned table exposed through the Supabase Data API must use Row Level Security.

Authorization must be enforced in the database, not by frontend filtering.

Supabase secret/service-role credentials must never be exposed to browser code.

## Repository Structure Target

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── admin/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── finance/
│   └── charts/
├── features/
├── lib/
│   ├── supabase/
│   ├── money/
│   ├── exchange-rate/
│   ├── ai/
│   ├── auth/
│   └── validation/
├── types/
└── config/

supabase/
└── migrations/

docs/
```

This structure is a target, not permission to create empty placeholder files merely to match the tree.

## Non-Goals for V1

Do not introduce without an explicit architecture decision:

- microservices;
- Redis;
- Kubernetes;
- CQRS;
- event sourcing;
- enterprise RBAC;
- subscription/billing systems;
- native Android/iOS apps.
