# Finora — Architecture Decision Record

This file records decisions with architectural consequences. New decisions should be appended rather than silently rewriting history.

---

## ADR-001 — Use a Modular Monolith

**Status:** Accepted

**Decision:** Build Finora as a modular monolith rather than microservices.

**Reason:** Finora is a personal/private application intended for the owner and trusted friends/family. Operational simplicity and maintainability matter more than hypothetical large-scale distribution.

**Consequences:**

- One main application codebase.
- Clear feature/domain boundaries inside the repository.
- No microservice infrastructure unless a future verified requirement justifies it.

---

## ADR-002 — Next.js + Supabase

**Status:** Accepted

**Decision:** Use Next.js App Router for the web/PWA application and Supabase for PostgreSQL, Auth, and Storage.

**Reason:** This keeps infrastructure compact while providing authentication, relational data, storage, and server-capable web application development.

**Consequences:**

- Supabase RLS is a critical security boundary.
- Database migrations are source controlled.
- Current Supabase SSR guidance must be verified during implementation rather than copied from stale examples.

---

## ADR-003 — Web/PWA Before Native Apps

**Status:** Accepted

**Decision:** Deliver responsive web and PWA first. Do not build separate Android/iOS applications in V1.

**Reason:** A single codebase is enough for the expected usage and reduces maintenance cost while still supporting desktop and mobile access.

**Consequences:**

- Mobile UX is first-class despite web-first delivery.
- Desktop sidebar layouts may transform into mobile bottom navigation.
- Native-only features are deferred until there is a demonstrated need.

---

## ADR-004 — AI Is Optional, Finance Core Is Deterministic

**Status:** Accepted

**Decision:** Google Gemini is the primary AI provider, but authoritative finance logic remains deterministic and independent from AI availability.

**Reason:** Quota, provider outages, invalid credentials, and model changes must not prevent core finance operations.

**Consequences:**

- Finance calculations live outside LLM prompts.
- AI consumes structured results when explaining finances.
- Manual transaction/account/budget/report workflows must remain available without AI.

---

## ADR-005 — Multi-Currency Is a Core Requirement

**Status:** Accepted

**Decision:** Design accounts and transactions for multiple currencies from the beginning.

**Reason:** Expected future income may be denominated in currencies such as USD, including YouTube-related income.

**Consequences:**

- Users have a base currency.
- Accounts have a primary currency.
- Transactions preserve historical conversion values.
- Current foreign-asset valuation uses current FX separately from historical reports.

---

## ADR-006 — Server-Side Secret Handling

**Status:** Accepted

**Decision:** Gemini private API keys and Supabase secret/service-role credentials must never be sent to browser code.

**Reason:** Users may use personal keys, admin-assigned keys, or a system default key. These are sensitive credentials.

**Consequences:**

- AI requests pass through server-controlled application code.
- Saved credentials are masked in UI and full values are not returned after saving.
- Client-visible environment variables are restricted to intentionally public configuration.
