# Finora

Finora is a private-first personal finance web application for personal use and trusted friends/family.

Its goal is to provide a lightweight **Personal Finance OS** with accurate finance tracking, multi-currency support, responsive desktop/mobile UX, and optional AI assistance.

## Status

Finora has completed **Phase 0 — Foundation**.

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

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node 22+)
- npm

### Installation & Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional in Phase 0)
cp .env.example .env.local

# 3. Start development server
npm run dev

# 4. Typecheck codebase
npm run typecheck

# 5. Run linter
npm run lint

# 6. Production build
npm run build
```

The application will be accessible at `http://localhost:3000`.

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
