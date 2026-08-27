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
