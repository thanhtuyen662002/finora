# Finora — Database

## Status

**Database implementation:** NOT_STARTED

This document records the planned data model and invariants. Executable Supabase migrations will become the schema source of truth once database work begins.

## Database Platform

- PostgreSQL via Supabase
- Supabase Auth for user identity
- Supabase Storage for future user-owned files such as receipt images or imports

## Planned Core Tables

The initial design is expected to include the following concepts as implementation phases require them:

- `profiles`
- `user_settings`
- `accounts`
- `categories`
- `transactions`
- `transfers`
- `budgets`
- `goals`
- `recurring_rules`
- `income_sources`
- `exchange_rates`
- `ai_usage`

Private/server-only configuration may later include:

- system AI settings;
- encrypted AI credentials;
- feature configuration.

Do not create all tables in Phase 0. Add schema only when the relevant phase requires it.

## Ownership Model

Every user-owned record must have a clear ownership relationship to the authenticated user.

RLS must enforce isolation. Frontend filters are not authorization.

Expected invariant:

```text
User A cannot SELECT, UPDATE, or DELETE User B's financial records.
```

For exposed tables, policies must include ownership predicates rather than only checking that the Postgres role is `authenticated`.

## Money Representation

Do not use floating-point PostgreSQL types for authoritative monetary values.

Prefer `numeric`/`decimal` with an explicitly reviewed scale where stored monetary precision requires it.

Important transaction concepts:

- original amount;
- original currency;
- exchange rate;
- base amount;
- base currency.

## Currency Model

Each user has a base currency, defaulting initially to `VND`.

Accounts have a primary currency.

Initial UI support should include at least:

- VND
- USD
- EUR
- JPY
- CNY
- KRW

The data model must not hard-code the system to this list.

## Historical FX Invariant

A historical transaction must preserve the exchange rate used when that transaction was recorded.

Example:

```text
1,000 USD × 26,200 VND/USD = 26,200,000 VND
```

If the current rate later changes, the historical base value must not silently change.

## Current FX Valuation

Current foreign-currency account balances may be valued using the latest available exchange rate for current net-worth calculations.

Current valuation and historical reporting are separate concerns.

## Transfer Invariant

A same-currency transfer between the user's own accounts must not change total net worth.

Example:

```text
Before: 100,000,000 VND net worth
Transfer: 5,000,000 VND from VCB to MB
After: 100,000,000 VND net worth
```

Cross-currency transfers must preserve both sides and the actual conversion used.

## AI Credential Security

Private Gemini API credentials must not be stored in normal client-readable tables.

When credential storage is implemented:

- keep it server-only;
- encrypt stored secret material appropriately;
- never return full saved credentials to the client;
- never expose Supabase secret/service-role keys to the browser.

## Migration Rules

- All schema changes must be source controlled under `supabase/migrations/`.
- Prefer additive migrations once user data may exist.
- Review RLS whenever user-owned schema changes.
- Do not disable RLS to work around application bugs.
- Verify migrations against the target Supabase environment before marking a database phase complete.
