# Finora

Finora is a private-first personal finance web application for personal use and trusted friends/family.

Its goal is to provide a lightweight **Personal Finance OS** with accurate finance tracking, multi-currency support, responsive desktop/mobile UX, and optional AI assistance.

## Status

Finora is currently at **Phase 0 — Foundation**.

Application code has not yet been initialized.

See [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) for the authoritative progress ledger.

## Planned Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL/Auth/Storage
- Google Gemini API
- Progressive Web App

## Project Governance

Before making changes, read:

1. [`AGENTS.md`](AGENTS.md) — master project instruction
2. [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — current implementation state
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture boundaries
4. [`docs/DATABASE.md`](docs/DATABASE.md) — database rules and invariants
5. [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted architecture decisions

## Development Workflow

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

Do not jump ahead of the current implementation phase.

## Phase 0

The implementation task for Phase 0 is maintained at:

[`prompts/PHASE_0_FOUNDATION.md`](prompts/PHASE_0_FOUNDATION.md)

Phase 0 establishes the Next.js/Supabase application foundation only. It must not implement finance features or AI product features yet.

## Security

Never commit real credentials.

Use `.env.local` for local secrets/configuration and keep only safe placeholders in `.env.example`.
