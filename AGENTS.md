# FINORA — MASTER PROJECT INSTRUCTION

## 1. Project Identity

**Project Name:** Finora  
**Repository:** `finora`

Finora is a private-first personal finance web application designed primarily for personal use and sharing with trusted friends and family.

Finora is **not** intended to be a commercial fintech SaaS platform.

The product should remain:

- simple to operate;
- easy to maintain;
- secure by default;
- responsive on desktop and mobile;
- installable as a PWA;
- multi-user;
- multi-currency;
- AI-assisted but never AI-dependent;
- extensible without premature enterprise complexity.

The long-term product concept is:

> A lightweight Personal Finance OS that helps users understand what they own, where their money goes, how their finances change over time, and how they are progressing toward financial goals.

---

# 2. Primary Product Goals

Finora must help the user answer these questions quickly:

1. How much money and assets do I currently have?
2. How much do I owe?
3. What is my current net worth?
4. How much did I earn this month?
5. How much did I spend this month?
6. Where did my money go?
7. Am I exceeding my budgets?
8. How much am I saving?
9. How are my financial goals progressing?
10. How has my net worth changed over time?
11. How much income comes from each source?
12. What is the value of foreign-currency assets in my base currency?
13. Can AI help classify, explain, and input financial data faster?

---

# 3. Technology Stack

The default architecture is fixed unless an explicit architecture decision changes it.

## Frontend / Application

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Responsive Web
- Progressive Web App

## Backend / Data

- Supabase
  - PostgreSQL
  - Authentication
  - Storage

## AI

Primary provider:

- Google Gemini API

AI provider implementation must be abstracted so another provider can be introduced later without rewriting finance business logic.

## Source Control

- Git
- GitHub

GitHub is the authoritative source of application code.

---

# 4. Architecture Principles

Use a modular monolith.

DO NOT introduce the following without an explicit requirement:

- microservices;
- Kubernetes;
- message queues;
- Redis;
- CQRS;
- event sourcing;
- separate native Android application;
- separate native iOS application;
- enterprise RBAC;
- subscription billing;
- payment gateways;
- organization-level SaaS infrastructure.

Prefer the simplest architecture that satisfies the current requirements.

Expected architecture:

```text
Next.js / PWA
      |
      +-- User UI
      |
      +-- Admin UI
      |
      +-- Application Layer
              |
              +-- Finance Engine
              +-- AI Layer
              +-- FX Engine
              |
              +-- Supabase
                    |
                    +-- PostgreSQL
                    +-- Auth
                    +-- Storage
```

---

# 5. Source Code Structure

Prefer the following layout:

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── admin/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── finance/
│   └── charts/
│
├── features/
│   ├── accounts/
│   ├── transactions/
│   ├── transfers/
│   ├── categories/
│   ├── budgets/
│   ├── goals/
│   ├── recurring/
│   ├── reports/
│   ├── currencies/
│   ├── income-sources/
│   └── ai/
│
├── lib/
│   ├── supabase/
│   ├── money/
│   ├── exchange-rate/
│   ├── ai/
│   ├── auth/
│   └── validation/
│
├── types/
│
└── config/

supabase/
└── migrations/

docs/
├── ARCHITECTURE.md
├── PROJECT_STATUS.md
├── DECISIONS.md
└── DATABASE.md
```

Do not reorganize the entire repository merely for stylistic reasons.

---

# 6. Required Project Documentation

The repository must maintain four living documents.

## `docs/PROJECT_STATUS.md`

This is the authoritative implementation progress ledger.

It must contain:

- current phase;
- phase status;
- completed features;
- incomplete features;
- blockers;
- latest verification results;
- known bugs;
- next recommended action.

Example:

```text
Current Phase: Phase 4 — Transactions
Status: IN_PROGRESS

Completed:
- Account CRUD
- Category CRUD
- RLS isolation tests

Pending:
- Transaction editing
- Transaction filters

Verification:
- TypeScript: PASS
- Lint: PASS
- Build: PASS
```

Update this file after every meaningful implementation session.

---

## `docs/ARCHITECTURE.md`

Record current system architecture and important module boundaries.

Update only when architecture actually changes.

---

## `docs/DECISIONS.md`

Record important architectural decisions.

Format:

```text
ADR-001
Decision:
Use Supabase Auth.

Reason:
...

Consequences:
...
```

Do not silently make major architectural decisions.

---

## `docs/DATABASE.md`

Document:

- tables;
- major columns;
- relationships;
- RLS ownership model;
- financial invariants;
- currency behavior.

Database migrations remain the executable source of truth.

---

# 7. Git Rules

Never perform unrelated refactors inside feature work.

Prefer:

```text
one concern
→ one logical change
→ one understandable commit
```

Suggested commit conventions:

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

Examples:

```text
feat(accounts): add account CRUD
feat(transactions): support income and expenses
fix(fx): preserve historical transaction rate
docs(status): update phase 4 progress
```

Do not commit:

- secrets;
- API keys;
- service-role credentials;
- local environment files;
- generated temporary files.

---

# 8. Development Workflow

Before implementing a task:

1. Inspect the existing repository.
2. Read `AGENTS.md`.
3. Read `docs/PROJECT_STATUS.md`.
4. Identify the current phase.
5. Inspect existing related implementation.
6. Determine which files must change.
7. Avoid assumptions when the repository already contains authoritative behavior.

Then:

```text
READ
↓
UNDERSTAND
↓
PLAN
↓
IMPLEMENT
↓
VERIFY
↓
UPDATE DOCUMENTATION
↓
REPORT
```

Do not rewrite working modules unless necessary.

---

# 9. Definition of Done

A feature is not complete merely because the UI appears correct.

For every meaningful implementation:

- feature behavior works;
- TypeScript passes;
- lint passes;
- production build passes;
- no relevant console errors;
- responsive behavior is verified;
- secrets are not exposed;
- existing behavior is not unintentionally broken;
- database migration exists when schema changes;
- RLS is reviewed when user-owned data changes;
- documentation is updated.

For UI work verify at minimum:

- 390px;
- 768px;
- 1024px;
- 1440px.

---

# 10. Authentication

Support initially:

- Google authentication;
- email/password authentication;
- persistent session;
- logout;
- protected application routes.

A user profile should be associated with the Supabase Auth user.

Suggested tables:

```text
profiles

id
display_name
avatar_url
created_at
updated_at
```

and:

```text
user_settings

user_id
base_currency
locale
timezone
theme
```

Default configuration:

```text
base_currency = VND
locale = vi-VN
timezone = Asia/Ho_Chi_Minh
```

---

# 11. User Data Isolation

Security is non-negotiable even though Finora is a personal/private project.

Every user-owned financial record must be isolated.

User A must never be able to read, update, or delete User B's financial records.

Every exposed user-owned Supabase table must use RLS.

Do not rely only on frontend filtering.

Incorrect:

```text
SELECT everything
→ hide other users in frontend
```

Correct:

```text
Database authorization
→ only authorized rows are returned
```

Authorization data must not rely on user-editable metadata.

Never expose Supabase secret/service-role credentials to browser code.

---

# 12. Core Financial Modules

The initial core modules are:

1. Dashboard
2. Accounts
3. Transactions
4. Transfers
5. Categories
6. Budgets
7. Goals
8. Recurring transactions / bills
9. Reports
10. Income sources
11. Multi-currency

AI must remain optional.

---

# 13. Account Model

Supported account types should initially include:

```text
CASH
BANK
EWALLET
SAVINGS
CREDIT_CARD
INVESTMENT
OTHER
```

Each account has one primary currency.

Example:

```text
Cash             VND
Vietcombank      VND
MB Bank          VND
PayPal           USD
Wise             USD
```

Never assume all accounts use VND.

---

# 14. Money Rules

Financial correctness is more important than UI convenience.

Do not use floating-point database types for money.

Prefer PostgreSQL numeric/decimal types.

Money calculations must live in a reusable money layer.

Avoid uncontrolled JavaScript floating-point arithmetic for important monetary calculations.

Important concepts:

```text
original amount
original currency

exchange rate

base amount
base currency
```

---

# 15. Transactions

Initial transaction types:

```text
INCOME
EXPENSE
```

Suggested transaction model:

```text
id
user_id
account_id
category_id

type

amount
currency_code

exchange_rate
base_amount
base_currency

merchant
description
note

occurred_at

income_source_id

created_at
updated_at
```

A transaction may exist without AI.

AI must never be required for normal transaction creation.

---

# 16. Transfers

Transfers are not income and are not expenses.

Example:

```text
VCB
-5,000,000 VND

↓

MB
+5,000,000 VND
```

Net worth before and after must remain equal.

Transfers must also support cross-currency movement.

Example:

```text
Wise
-1,000 USD

↓

VCB
+26,200,000 VND
```

Store enough information to preserve the actual conversion.

---

# 17. Multi-Currency

Multi-currency support is a core architectural requirement from the beginning.

Initially support at least:

```text
VND
USD
EUR
JPY
CNY
KRW
```

Do not hard-code the application around this list.

Currencies should be extensible.

Each user has a base currency.

Default:

```text
VND
```

---

# 18. Historical vs Current Exchange Rates

These are different concepts and must not be mixed.

## Historical transaction rate

Example:

```text
Income:
1,000 USD

Transaction rate:
26,200 VND/USD

Historical value:
26,200,000 VND
```

If the exchange rate later becomes:

```text
27,000 VND/USD
```

the historical income remains:

```text
26,200,000 VND
```

Historical reports must not change because today's FX rate changed.

---

## Current asset valuation

If a user currently owns:

```text
3,500 USD
```

and today's rate is:

```text
26,500 VND/USD
```

current valuation may be:

```text
92,750,000 VND
```

Use current exchange rates for:

- current net worth;
- foreign account valuation.

Use stored historical exchange rates for:

- historical income;
- historical expense;
- historical reports.

---

# 19. Exchange Rate Engine

FX logic must be behind an abstraction.

Example interface:

```text
getCurrentRate(from, to)

getHistoricalRate(from, to, date)
```

Do not scatter external FX provider calls throughout components.

The external provider should be replaceable.

Users must also be able to override automatic FX rates manually.

Example:

```text
Automatic rate:
26,200

Actual bank rate:
25,950
```

The real transaction may use the manual rate.

---

# 20. Income Sources

Income should support source tracking.

Examples:

```text
Salary

YouTube
├── Channel A
├── Channel B
└── Channel C

Freelance

Investment

Other
```

This enables reports such as:

```text
Salary
25,000,000 VND

YouTube Channel A
860 USD

YouTube Channel B
420 USD
```

Do not integrate YouTube or AdSense APIs in the first version.

Manual recording comes first.

Future states may include:

```text
ESTIMATED
CONFIRMED
RECEIVED
```

but do not overbuild this before required.

---

# 21. Finance Engine

Financial calculations must be deterministic application logic.

Examples:

- account balance;
- net worth;
- income totals;
- expense totals;
- savings;
- saving rate;
- budget consumption;
- debt calculations;
- currency conversion;
- report aggregation.

Do NOT delegate authoritative financial calculations to an LLM.

Correct:

```text
Database
↓
Finance Engine
↓
structured financial result
↓
AI explanation
```

Incorrect:

```text
raw transactions
↓
LLM
↓
LLM guesses totals
```

---

# 22. AI Architecture

AI enhances Finora.

AI does not control Finora.

Core finance functions must continue working when:

- Google Gemini is unavailable;
- quota is exhausted;
- API credentials are invalid;
- AI functionality is disabled.

AI capabilities may include:

- natural-language transaction parsing;
- transaction categorization;
- receipt interpretation;
- financial explanations;
- financial assistant;
- report summarization.

---

# 23. AI Provider Abstraction

Never hard-code model names across application code.

Use an AI configuration layer.

Concept:

```text
AI Router

transaction_parser → configured model

categorization → configured model

financial_assistant → configured model

receipt_vision → configured model
```

Changing model configuration should not require rewriting business logic.

---

# 24. AI Credential Strategy

Finora supports three credential sources.

Priority:

```text
1. User personal API key
2. Admin-assigned API key
3. System default API key
```

Conceptually:

```text
AI Request
    |
    v
Personal key?
    |
   yes
    |
    v
Use personal key

otherwise
    |
    v
Admin assigned key?

otherwise
    |
    v
System key
```

Users who do not understand API keys should never be forced to configure one.

The admin may assign credentials for them.

Technical users may optionally use their own key.

---

# 25. AI Credential Security

Never expose Gemini API secrets to browser code.

Never store private API keys in localStorage.

Never include private API keys in client JavaScript bundles.

Correct flow:

```text
Browser
↓
Finora server
↓
Resolve encrypted credential
↓
Gemini API
```

Credential data should be stored outside normal publicly queryable user tables.

Prefer a private database schema or another server-only credential mechanism.

Stored credentials must be encrypted appropriately.

UI should only display masked values such as:

```text
AIza••••••••••92K
```

Once saved, never return the full API key to the client.

---

# 26. AI Usage Tracking

Track AI usage for operational visibility.

Suggested fields:

```text
id
user_id
provider
model
operation
status
input_tokens
output_tokens
created_at
```

Operations may include:

```text
transaction_parse
categorization
financial_chat
receipt_ocr
report_analysis
```

AI usage information is primarily for diagnostics and quota awareness, not billing.

---

# 27. AI Transaction Input

Example:

User writes:

```text
Ăn trưa 85k tiền mặt
```

AI may interpret:

```text
type = EXPENSE
amount = 85000
account = Cash
category = Food
```

The UI must present a confirmation step.

AI should not silently create authoritative financial records without user confirmation.

Workflow:

```text
Natural language
↓
AI interpretation
↓
Preview
↓
User confirmation
↓
Transaction creation
```

---

# 28. Admin Panel

The admin panel should remain lightweight.

Initial sections:

```text
Dashboard

Users

AI
├── Provider
├── Models
├── System key
└── Assigned user keys

Currencies
├── Supported currencies
└── FX configuration

System
├── Feature flags
└── general configuration
```

Admin authorization must be server/database enforced.

Do not rely on simply hiding `/admin` links.

---

# 29. Feature Flags

Finora should support simple feature flags.

Potential flags:

```text
AI_ASSISTANT
AI_TRANSACTION_PARSE
RECEIPT_OCR
MULTI_CURRENCY
YOUTUBE_INCOME
INVESTMENT
FAMILY_WORKSPACE
```

Features under development may initially be enabled only for the administrator.

Do not build an enterprise experimentation platform.

---

# 30. Dashboard

Desktop dashboard should prioritize:

```text
Net Worth

Income

Expense

Savings

Saving Rate

Cash Flow

Budget Progress

Account Distribution

Recent Transactions

Financial Goals
```

Avoid overcrowding the first screen.

---

# 31. Responsive Design

Finora is web-first but mobile usage is a first-class requirement.

Desktop may use sidebar navigation.

Mobile should use a compact navigation pattern such as bottom navigation.

Recommended mobile primary navigation:

```text
Home
Transactions
Add
Reports
Settings
```

Do not merely shrink desktop layout into a narrow viewport.

---

# 32. Design Direction

Visual direction:

- modern personal finance;
- clean;
- calm;
- premium but not flashy;
- high information clarity;
- generous spacing;
- accessible contrast;
- minimal visual noise.

Avoid:

- generic enterprise admin dashboard appearance;
- excessive gradients;
- excessive glassmorphism;
- dense accounting software appearance;
- gimmicky animation.

Data clarity takes priority over decoration.

---

# 33. Import / Export

Initial import flow:

```text
Upload CSV
↓
Preview
↓
Column mapping
↓
Optional AI categorization
↓
Validation
↓
Confirmation
↓
Import
```

Never immediately persist imported financial data before preview/confirmation.

Later support Excel if useful.

Export should support at least:

- transactions;
- accounts;
- budgets;
- goals;
- full user backup.

Users must be able to retrieve their own financial data.

---

# 34. PWA

Native Android and iOS applications are not part of the initial roadmap.

Finora must first become a high-quality responsive PWA.

PWA work includes:

- manifest;
- icons;
- installability;
- sensible caching;
- loading states;
- error states;
- empty states;
- mobile-first navigation.

Do not add aggressive offline mutation synchronization until required.

---

# 35. Implementation Phases

Follow these phases unless explicitly instructed otherwise.

## Phase 0 — Foundation

- initialize Next.js;
- TypeScript;
- Tailwind;
- shadcn/ui;
- Supabase client architecture;
- environment configuration;
- repository structure;
- documentation baseline.

---

## Phase 1 — UI Foundation

Build responsive mock-data interfaces for:

- Login
- Onboarding
- Dashboard
- Accounts
- Transactions
- Budgets
- Goals
- Recurring
- Reports
- Settings
- Admin shell

No major finance business logic yet.

---

## Phase 2 — Authentication + RLS

Implement:

- authentication;
- profile;
- user settings;
- route protection;
- RLS baseline;
- user isolation tests.

---

## Phase 3 — Accounts + Categories

Implement complete account and category management.

---

## Phase 4 — Transactions

Implement income and expense transactions.

---

## Phase 5 — Transfers

Implement same-currency and cross-currency transfers.

---

## Phase 6 — Dashboard + Reports

Replace mock data with real finance calculations.

---

## Phase 7 — Budgets + Goals + Recurring

Implement financial planning features.

---

## Phase 8 — Multi-Currency + FX

Complete current/historical currency conversion behavior.

---

## Phase 9 — Income Sources

Implement salary, YouTube, freelance, investment, and custom income sources.

At the completion of Phase 9, Finora should be usable as a real personal finance product.

This milestone is:

```text
MVP FINANCE
```

---

## Phase 10 — AI Foundation

Implement provider abstraction, AI router, error handling, structured results.

---

## Phase 11 — AI Credentials

Implement personal, admin-assigned, and system Gemini credentials securely.

---

## Phase 12 — AI Features

Implement:

- natural-language transaction parsing;
- categorization;
- financial assistant.

Receipt OCR can follow later.

---

## Phase 13 — Admin

Implement functional admin configuration.

---

## Phase 14 — Import / Export

Implement user data interoperability.

---

## Phase 15 — PWA + Hardening

Complete mobile/PWA experience and hardening.

This milestone is:

```text
FINORA V1
```

---

# 36. Mandatory Financial Invariants

These conditions must always hold.

## Invariant 1 — User isolation

```text
User A creates financial record X.

User B cannot read X.
User B cannot update X.
User B cannot delete X.
```

---

## Invariant 2 — Transfer neutrality

```text
Before transfer:
Net Worth = 100M

Transfer 5M:
VCB → MB

After transfer:
Net Worth = 100M
```

---

## Invariant 3 — Historical FX stability

```text
Income:
1,000 USD

Stored rate:
26,200

Historical value:
26.2M VND
```

If current USD/VND becomes 27,000:

```text
historical income remains 26.2M
```

---

## Invariant 4 — Current FX valuation

Foreign-currency assets may use the latest available rate for current net-worth valuation.

---

## Invariant 5 — AI independence

If Gemini is unavailable, users must still be able to:

- add income;
- add expense;
- transfer money;
- manage budgets;
- view reports;
- manage accounts.

---

# 37. Database Change Rules

All schema changes must be represented in source-controlled Supabase migrations.

Do not treat a manually modified remote database as the only source of truth.

Whenever schema changes:

1. understand existing tables;
2. make minimal changes;
3. update migration;
4. review RLS;
5. verify behavior;
6. update `docs/DATABASE.md`.

Do not casually delete or rename financial fields after data may already exist.

Prefer additive migrations.

---

# 38. Security Rules

Never commit or expose:

- Gemini private keys;
- Supabase secret/service-role keys;
- database passwords;
- third-party API secrets.

Never use client-visible environment variables for server secrets.

Do not disable RLS to solve application problems.

Do not use privileged database functions merely to bypass authorization errors.

Fix the authorization model instead.

---

# 39. Error Handling

Every external dependency can fail.

Finora must handle:

```text
Gemini unavailable
FX provider unavailable
network failure
Supabase temporary failure
invalid user input
expired authentication
```

Failures should be understandable to users.

Avoid raw internal error messages in production UI.

---

# 40. Code Quality Rules

Prefer:

- explicit types;
- reusable domain functions;
- small modules;
- clear naming;
- schemas for external input;
- server-side validation;
- predictable error handling.

Avoid:

- `any` unless justified;
- huge components;
- duplicated financial formulas;
- business calculations directly inside UI components;
- hard-coded model names;
- hard-coded currency assumptions;
- hidden side effects.

---

# 41. Rule for Existing Code

Existing working behavior is authoritative unless the current task explicitly changes it.

Before modifying existing functionality:

1. understand why it exists;
2. identify tests and dependencies;
3. preserve unrelated behavior.

Do not perform aesthetic rewrites of functioning code during unrelated tasks.

---

# 42. Work Report Format

After every meaningful implementation task, report:

```text
TASK
<what was implemented>

STATUS
PASS / PARTIAL / BLOCKED

CHANGED
<important files/modules>

DATABASE
<schema/migration changes or NONE>

SECURITY
<RLS/auth/security impact>

VERIFICATION
TypeScript:
Lint:
Build:
Tests:

KNOWN ISSUES
<issues or NONE>

PROJECT STATUS
<current phase and next step>
```

Also update:

```text
docs/PROJECT_STATUS.md
```

before declaring the task complete.

---

# 43. When Requirements Are Ambiguous

Do not invent complex product behavior.

Prefer:

1. existing project conventions;
2. simplest safe implementation;
3. reversible design;
4. documented assumption.

When an assumption has architectural consequences, record it in `docs/DECISIONS.md`.

---

# 44. Scope Discipline

Do not implement future phases merely because they seem useful.

Example:

If working on Phase 4 Transactions:

Do not suddenly implement:

- investment portfolios;
- YouTube API integration;
- receipt OCR;
- native applications;
- family workspaces.

Complete the requested phase cleanly first.

---

# 45. Project Philosophy

Finora should remain:

```text
simple enough for one developer to understand

secure enough for personal financial data

modular enough to evolve

pleasant enough to use every day

accurate enough to trust
```

Do not optimize for hypothetical millions of users.

Do not create enterprise complexity for a private personal application.

Correctness, maintainability, privacy, and usability are the priorities.

---

# 46. Initial Instruction

When this instruction is first loaded into a new Finora repository:

1. inspect the entire repository;
2. determine whether the project is empty or partially initialized;
3. create/update the four project documentation files;
4. determine the current implementation phase;
5. record the current repository state in `docs/PROJECT_STATUS.md`;
6. do not jump ahead to later phases;
7. begin only with the specific phase requested by the user.

Never claim a phase is complete without verification.

# END OF FINORA MASTER PROJECT INSTRUCTION