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

---

## ADR-007 — Supabase SSR Architecture with Next.js 16 Proxy Convention

**Status:** Accepted

**Decision:** Use `@supabase/ssr` (0.12.x+) with Next.js 16 App Router, using separate browser client (`createBrowserClient`), server client (`createServerClient` using `next/headers` cookies), and request-boundary session refresh via `src/proxy.ts` and `src/lib/supabase/proxy.ts` calling `supabase.auth.getClaims()` and propagating cache headers from `setAll(cookiesToSet, headers)`.

**Reason:** Next.js 16 standardizes request interception in `proxy.ts` over legacy `middleware.ts`. Current Supabase SSR guidance uses `getClaims()` for secure, efficient session validation at the edge/request boundary and requires propagating response/cache headers returned by cookie manipulation to prevent stale auth caching.

**Consequences:**

- `src/lib/supabase/client.ts` uses public publishable credentials only (`createBrowserClient`).
- `src/lib/supabase/server.ts` provides async cookie-aware client for Server Components, Route Handlers, and Server Actions.
- `src/proxy.ts` delegates to `src/lib/supabase/proxy.ts` (`updateSession`) calling `supabase.auth.getClaims()` and forwarding Set-Cookie and cache headers.
- `src/config/env.ts` provides strict runtime boundaries preventing server credentials from leaking to client contexts.
- Node runtime contract is established as Node.js 22+ Active LTS.

---

## ADR-008 — Row Level Security and Profile Auto-Provisioning for User Isolation

**Status:** Accepted

**Decision:** Enforce user isolation via PostgreSQL Row Level Security (RLS) on `public.profiles` and `public.user_settings` tied to `auth.uid()`, with automated trigger provisioning on `auth.users` insert.

**Reason:** Finora mandates non-negotiable user isolation (Invariant 1). Relying on client-side or frontend filtering for privacy is unsafe. Automatic provisioning ensures every registered user immediately has a corresponding profile and user settings row with defaults (`VND`, `vi-VN`, `Asia/Ho_Chi_Minh`, `system`).

**Consequences:**

- All user-owned tables enable RLS and require explicit `auth.uid() = id` / `auth.uid() = user_id` policies for SELECT and UPDATE operations.
- Direct row insertions/updates are forbidden for unauthenticated (`anon`) users.
- Route-level middleware (`src/proxy.ts`) protects authenticated application routes, while database RLS provides the authoritative security boundary.
- Open-redirect mitigation enforces relative path targets for OAuth and callback redirects.

---

## ADR-009 — Request Boundary Proxy Pattern, Redirect Origin Hardening, and SSR Recovery Architecture

**Status:** Accepted

**Decision:**
1. Standardize proxy request-boundary session refresh on `supabase.auth.getClaims()`, immediately following client construction, while preserving refreshed cookies and response/cache headers on redirects.
2. Remove any reliance on arbitrary `x-forwarded-host` headers for OAuth and authentication callback redirects, strictly constructing redirect origins from validated request URLs or explicit application environment configuration.
3. Support the official Supabase SSR password recovery and email verification workflow via `/auth/confirm` route handler (for `verifyOtp` with `token_hash` and `type=recovery|signup|email`) and `/auth/callback` (for PKCE `exchangeCodeForSession`), establishing a valid authenticated session before routing to `/reset-password`.
4. Enforce strict, non-zero exit assertion semantics in verification scripts (`verify-phase2-rls.mjs` and `verify-phase2-auth.mjs`) when test credentials or target tables are missing.

**Reason:**
- Satisfies modern Supabase SSR recommendations for edge/request boundary validation without excessive round-trip overhead while maintaining cookie and header consistency.
- Eliminates host-header injection and open redirect attack surfaces.
- Ensures users attempting password recovery have a verified authenticated session before calling `auth.updateUser({ password })`.
- Ensures automated CI/CD and verification gates accurately report `BLOCKED` status rather than false positive passes when credentials or database tables are absent.

**Consequences:**
- Route protection in `src/lib/supabase/proxy.ts` uses `getClaims()` and safe redirect response copying.
- Auth callbacks use validated request origin and sanitized destination paths (`getSafeRedirectUrl`).
- SSR password recovery flow is robust across email link mechanisms (PKCE code vs. OTP token_hash).
- Verification tools act as authoritative test runners for RLS isolation.

