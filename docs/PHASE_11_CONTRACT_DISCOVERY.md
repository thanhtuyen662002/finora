# Finora — Phase 11 AI Credentials Contract Discovery & Architecture Analysis

## 1. Executive Summary & Purpose

Phase 11 implements **AI Credentials** for Finora, delivering secure, multi-tier credential storage, server-side encryption at rest, and priority resolution for Google Gemini API keys across three distinct sources:
1. **PERSONAL:** User-owned personal Gemini API key.
2. **ADMIN_ASSIGNED:** Administrator-assigned Gemini API key for a designated user.
3. **SYSTEM:** Server environment default Gemini API key.

Phase 11 is strictly focused on **credentials, cryptographic security, authorization, and resolution**. It does **NOT** implement Phase 12 end-user AI features (natural-language transaction parsing, receipt OCR, smart categorization, chat assistant, or AI transaction generation).

This document audits Finora's current authentication, database, server, settings, and admin architecture, compares storage alternatives, recommends a hardened implementation architecture, and establishes the complete Phase 11 security contract.

---

## 2. Comprehensive Audit of Existing Architecture

### 2.1 Supabase Auth & Session Management
- **Library:** `@supabase/ssr` with Next.js 16 App Router.
- **Request Boundary Proxy:** `src/proxy.ts` delegates to `src/lib/supabase/proxy.ts` (`updateSession`), executing `supabase.auth.getClaims()` at the edge/request boundary and propagating refreshed cookies and cache headers.
- **Server Client (`src/lib/supabase/server.ts`):** Constructs a cookie-aware client via `createServerClient` using `next/headers` cookies. Used in Server Components, Route Handlers, and Server Actions. Provides server-authenticated session resolution via `supabase.auth.getUser()`.
- **Admin Client (`src/lib/supabase/admin.ts`):** `createAdminClient()` imports `server-only` and initializes `@supabase/supabase-js` using `SUPABASE_SERVICE_ROLE_KEY` with `autoRefreshToken: false, persistSession: false`. Used exclusively for trusted background tasks and system-level operations. Never exposed to browser code.
- **Browser Client (`src/lib/supabase/client.ts`):** Constructs a client using public publishable credentials only (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

### 2.2 Profiles & User Settings (Phase 2 Baseline)
- `public.profiles`: Stores display name, avatar, onboarding status; keyed by `id` referencing `auth.users(id)`. Auto-provisioned on signup via trigger.
- `public.user_settings`: Stores `base_currency` (default `VND`), `locale` (`vi-VN`), `timezone` (`Asia/Ho_Chi_Minh`), `theme` (`system`); keyed by `user_id` referencing `auth.users(id)`. Auto-provisioned on signup via trigger.
- Both tables enforce canonical RLS policies using `(SELECT auth.uid()) = user_id` (or `id`), with default table privileges revoked from `anon`, `authenticated`, and `PUBLIC`.

### 2.3 Existing RLS & Security Conventions (Phases 2–9)
- **Zero-Trust Privilege Model:** All application tables (`accounts`, `categories`, `transactions`, `transfers`, `budgets`, `goals`, `recurring_items`, `income_sources`, `income_source_streams`) explicitly revoke all default table grants from `anon`, `authenticated`, and `PUBLIC`.
- **Least-Privilege Column Grants:** `INSERT` and `UPDATE` privileges are granted strictly to specific, safe columns for `authenticated`.
- **No Client User ID Authority:** Foreign keys reference `auth.users(id)`. Tables define `user_id uuid NOT NULL DEFAULT auth.uid()`, and authenticated roles have no `INSERT` or `UPDATE` privilege on `user_id`.
- **No Hard Delete:** `DELETE` privilege is withheld across all transactional tables. Logical archiving (`is_archived`) or voiding (`is_voided`) is enforced.
- **Views with `security_invoker = true`:** All derived read views (`account_balances`, `transaction_details`, `transfer_details`, `budget_progress`, `goal_details`, `recurring_details`) enforce `security_invoker = true` to preserve underlying table RLS.
- **Database Functions:** Functions use `SECURITY INVOKER` (or minimal `SECURITY DEFINER` where strictly necessary) with `SET search_path = ''` to prevent search-path hijacking.

### 2.4 Existing Schema Organization
- Currently, **all application tables reside in the `public` schema**.
- No custom PostgreSQL schemas (such as `private` or `vault`) have been deployed yet.
- By default, Supabase exposes all tables in the `public` schema via PostgREST. Any table created in `public` becomes queryable via the HTTP client unless RLS is enabled and policies/grants are restricted.

### 2.5 Settings Surface (`src/app/settings/page.tsx`)
- Currently contains user profile editing, currency/regional preferences, theme selection, password update, and logout.
- Lines 520–535 display an inactive, disabled mock switch for AI:
  ```tsx
  <div className="flex items-center justify-between opacity-60">
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-foreground">Kích hoạt tính năng AI</p>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">Sắp hỗ trợ</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Hỗ trợ nhập giao dịch tự nhiên và phân tích.
      </p>
    </div>
    <Switch checked={false} disabled />
  </div>
  ```
- **Finding:** No persistent AI configuration or credential management inputs exist on the settings page.

### 2.6 Admin Surface (`src/app/admin/page.tsx`)
- **CRITICAL AUDIT FINDING:** The `/admin` surface is currently a **100% client-side prototype** using static fixtures from `src/lib/mock/admin.ts` (`MOCK_ADMIN_METRICS`, `MOCK_ADMIN_USERS`, `MOCK_FX_RATES`, `MOCK_FEATURE_FLAGS`).
- There is **NO database table for admin roles**, no `is_admin` column in `public.profiles`, no admin claim in Supabase Auth JWTs, and no server-side admin authorization middleware.
- Any authenticated user who navigates to `/admin` currently sees the mock admin prototype.
- **Architectural Consequence:** Phase 11 cannot rely on an existing database admin role. To support `ADMIN_ASSIGNED` credentials without prematurely building enterprise RBAC or Phase 13 (Admin Panel), a minimal, cryptographically secure admin verification mechanism is required.

### 2.7 Phase 10 AI Foundation Subsystem (`src/lib/ai/**`)
- **Router (`src/lib/ai/router.ts`):** Provides central operation routing, timeout management, parameter propagation, and runtime schema validation without unvalidated generic casts.
- **Credential Port (`AiCredentialProvider`):**
  ```typescript
  export interface AiCredentialProvider {
    resolveCredential(operation: AiOperationType): Promise<string | null>;
  }
  ```
- **Gemini Provider (`src/lib/ai/providers/gemini.ts`):** Pinned to `@google/genai` (2.19.0). Requires credential to be injected via execution context (`request.credential`). Does NOT query the database or look up `process.env.GEMINI_API_KEY`.
- **Server-Only Boundary:** `src/lib/ai/server.ts` and `src/features/ai/server.ts` import `'server-only'`, ensuring AI execution logic is never bundled into client components.

---

## 3. Storage Architecture Options Analysis

We analyzed 3 candidate architectures for storing encrypted AI credentials:

| Evaluation Dimension | Option A: Private Schema + Application-Level AES-256-GCM | Option B: Private Schema + Database-Side pgcrypto | Option C: Supabase Vault / Secret Storage Extension |
| :--- | :--- | :--- | :--- |
| **Secret Isolation** | **Highest.** Plaintext never reaches the database. Database dumps, logs, and replication streams contain only ciphertext. | **Medium.** Plaintext is passed in SQL parameters and decrypted in PostgreSQL memory. Plaintext may appear in query logs. | **Medium.** Vault decodes secrets inside PostgreSQL; accessible to Postgres superuser/roles. |
| **Key Management** | **Clean.** Master key (`AI_CREDENTIALS_MASTER_KEY`) resides strictly in server runtime memory (Node.js environment variable). | **Complex.** Encryption key must be passed to SQL functions per query or stored in database settings (`app.settings.enc_key`). | **Platform-bound.** Managed by Supabase Vault KMS/pgodium; local Docker/CI replication is difficult. |
| **PostgREST Exposure** | **Zero.** Private schema is not in PostgREST `db-schemas`. PostgREST cannot route to it. | **Zero.** Private schema is not exposed to PostgREST. | **Low.** Exposes RPC functions or views to authenticated users if misconfigured. |
| **Supabase / Local Compatibility** | **100%.** Pure standard PostgreSQL tables and standard Node.js `crypto` module. Zero extra extensions. | **Good.** Requires `pgcrypto` extension enabled in PostgreSQL. | **Poor / Fragile.** Supabase Vault varies across self-hosted, local CLI, and hosted tiers. |
| **Key Rotation** | **Versioned Envelope.** `version` and `key_id` fields in envelope enable multi-key rollover and online re-encryption. | **Difficult.** Requires database migrations or batch UPDATE scripts with old and new SQL keys. | **Platform-dependent.** Depends on vault re-encryption tools. |
| **Testability** | **Deterministic & Offline.** Fast unit and integration tests with deterministic mock keys. No live database crypto needed. | **Requires PostgreSQL.** Every test must execute SQL against a running Postgres instance with `pgcrypto`. | **Requires hosted Supabase.** Extremely difficult to mock in offline test suites. |
| **Operational Complexity** | **Low.** Simple, standard, auditable. | **Medium.** Database function maintenance and search path security. | **High.** Proprietary extension behavior and migration hazards. |
| **Recovery Risk** | **Low.** Server env secret backed up with standard secret manager. Database backups safely restored anywhere. | **Medium.** Key management coupled to DB configuration. | **High.** Vault corruption or key mismatch bricks all secrets during restore. |

### Recommended Architecture: Option A (Private Schema + Application-Level AES-256-GCM)
**Selection Rationale:**
Option A is mathematically and operationally superior:
1. **Zero-Knowledge Database:** PostgreSQL stores only encrypted ciphertext envelopes. Even if the database is exported, leaked, or compromised, credentials cannot be decrypted without the server's `AI_CREDENTIALS_MASTER_KEY`.
2. **PostgREST Shield:** Tables located in a custom `private` schema are completely invisible to PostgREST. Browser clients cannot query them via `supabase.from()`.
3. **No PostgreSQL Plaintext Handling:** Plaintext API keys never enter PostgreSQL memory, temporary files, query logs (`pg_stat_statements`), or replication streams.
4. **Offline Testability:** All cryptographic operations use Node.js built-in `crypto` module (Active LTS Node 22+), allowing comprehensive offline unit tests and verifiers.

---

## 4. Cryptographic Encryption Contract

### 4.1 Authenticated Encryption Standard
- **Algorithm:** AES-256-GCM (Authenticated Encryption with Associated Data - AEAD).
- **Key Length:** 256 bits (32 bytes).
- **IV / Nonce Length:** 96 bits (12 bytes) cryptographically random per encryption operation, generated via `crypto.randomBytes(12)`. Nonces must **NEVER** be reused across encryptions.
- **Auth Tag Length:** 128 bits (16 bytes), generated via `cipher.getAuthTag()`.
- **Associated Data (AAD):** The user's `owner_user_id` string and `provider` string MUST be bound as Additional Authenticated Data (`cipher.setAAD()`). This mathematically prevents ciphertext transplantation attacks (moving User A's encrypted blob into User B's record).

### 4.2 Envelope Structure
The encrypted credential will be stored as an authenticated envelope object:
```typescript
export interface EncryptedCredentialEnvelope {
  /** Envelope format version for future-proofing */
  version: 1;
  /** Identifier of the master key used to encrypt this envelope */
  key_id: string;
  /** 12-byte initialization vector, base64 encoded */
  nonce: string;
  /** AES-256-GCM ciphertext, base64 encoded */
  ciphertext: string;
  /** 16-byte authentication tag, base64 encoded */
  auth_tag: string;
}
```

### 4.3 Master Key Management
- **Environment Variable:** `AI_CREDENTIALS_MASTER_KEY` (server-side only, 32-byte hex or base64 string).
- **Rules:**
  - MUST NEVER be prefixed with `NEXT_PUBLIC_`.
  - MUST NEVER be imported or accessible in Client Components.
  - MUST NEVER be stored in the database.
  - MUST be verified at application startup or on first cryptographic operation; fails closed if absent or invalid length.
  - Supports multi-key rotation via `AI_CREDENTIALS_KEY_RING` JSON or `AI_CREDENTIALS_MASTER_KEY_ID`.

### 4.4 Encrypt & Decrypt Lifecycles
- **Encrypt Path:**
  1. Validate master key readiness.
  2. Generate unique 12-byte nonce via `randomBytes(12)`.
  3. Initialize `createCipheriv('aes-256-gcm', masterKey, nonce)`.
  4. Bind AAD: `owner_user_id:provider`.
  5. Encrypt plaintext API key.
  6. Extract 16-byte auth tag.
  7. Construct `EncryptedCredentialEnvelope`.
- **Decrypt Path:**
  1. Validate envelope integrity (version, key_id, nonce, ciphertext, auth_tag).
  2. Resolve corresponding master key by `key_id`.
  3. Initialize `createDecipheriv('aes-256-gcm', resolvedKey, nonce)`.
  4. Bind AAD: `owner_user_id:provider`.
  5. Set auth tag.
  6. Decrypt ciphertext. If auth tag verification fails, throw `AI_AUTH_FAILED` (or `AI_CREDENTIAL_CORRUPTED`).
  7. Return plaintext string strictly within the server-side execution context.
- **Key Rotation Path:**
  - Reads envelope with old `key_id`, decrypts using old key, re-encrypts with active `key_id` and fresh nonce, updates record in transaction.

---

## 5. Credential Sources & Multi-Tier Resolution Semantics

### 5.1 Credential Source Definitions

| Source | Ownership & Storage | Administrative Scope | Modification Authority |
| :--- | :--- | :--- | :--- |
| **`PERSONAL`** | Stored in `private.ai_credentials`. Owned by the authenticated user (`owner_user_id = auth.uid()`). `assigned_by_user_id = NULL`. | Scoped strictly to the owning user. | The owning user can set, replace, or revoke their personal key. |
| **`ADMIN_ASSIGNED`** | Stored in `private.ai_credentials`. Owned by target user (`owner_user_id = target_user_id`). `assigned_by_user_id = admin_user_id`. | Assigned to a specific user by an authorized administrator. | Only an authorized administrator can assign, replace, or revoke. Target user cannot modify. |
| **`SYSTEM`** | Server environment variable `GEMINI_API_KEY` (or `FINORA_SYSTEM_GEMINI_API_KEY`). Zero database persistence. | Available globally to any authorized user who has neither personal nor admin-assigned keys. | Managed exclusively via server environment configuration. |

### 5.2 Strict Resolution Priority
When an AI operation is requested, the server-side credential resolver evaluates sources in the following strict order:
```text
1. Check for active PERSONAL credential for user
   └── If present & is_active: RESOLVED_SOURCE = PERSONAL

2. Else, check for active ADMIN_ASSIGNED credential for user
   └── If present & is_active: RESOLVED_SOURCE = ADMIN_ASSIGNED

3. Else, check for configured SYSTEM credential in server environment
   └── If present: RESOLVED_SOURCE = SYSTEM

4. Else:
   └── No credential available → Return null → Router throws AI_NOT_CONFIGURED
```

### 5.3 Mandatory Invariant: NO Silent Fallback on Auth Failure
A fundamental security and billing invariant must be strictly enforced:
> **If a higher-priority credential is selected and configured, but subsequently fails authentication with Gemini (e.g. invalid key, expired key, revoked key), the request MUST FAIL CLOSED with `AI_AUTH_FAILED`. It MUST NEVER silently fall back to a lower-priority credential during that request.**

**Justification:**
- If User A enters an invalid personal key, silently falling back to the admin-assigned or system key would:
  1. Masquerade the user's configuration error, leaving the user unaware their key is broken.
  2. Illegitimately consume instance administrator or system quota/budget without the instance owner's consent.
  3. Violate user intent (the user intended to use their own quota).
- Similarly, if an admin-assigned key fails, falling back to system key would drain system quota.
- **Fallback occurs ONLY because a higher-priority source is absent, unconfigured, or explicitly deactivated/revoked**, NEVER because Gemini returned an authentication error (HTTP 400/401/403).

---

## 6. Admin Authorization Strategy (Solving the Admin Shell Dependency)

### 6.1 Audit Review
The current `/admin` route is completely mock-driven. No database role, claim, or table currently distinguishes an administrator from a regular user.

### 6.2 Phase 11 Minimal Admin Authorization Architecture
To prevent scope creep (avoiding Phase 13 full Admin Panel and avoiding premature enterprise RBAC), Phase 11 will introduce a **server-enforced admin verification strategy**:
1. **Server Environment Admin Allowlist (`FINORA_ADMIN_EMAILS` or `FINORA_ADMIN_USER_IDS`):**
   - A comma-separated list of trusted administrator email addresses or user UUIDs defined in the server environment (e.g., `FINORA_ADMIN_EMAILS=owner@example.com`).
2. **Server-Side Helper (`src/lib/auth/admin.ts`):**
   ```typescript
   export async function isServerAuthorizedAdmin(supabase: SupabaseClient): Promise<boolean> {
     const { data: { user }, error } = await supabase.auth.getUser();
     if (error || !user) return false;
     
     const adminEmails = (process.env.FINORA_ADMIN_EMAILS || '')
       .split(',')
       .map(e => e.trim().toLowerCase())
       .filter(Boolean);
       
     const adminIds = (process.env.FINORA_ADMIN_USER_IDS || '')
       .split(',')
       .map(id => id.trim())
       .filter(Boolean);
       
     return adminEmails.includes(user.email?.toLowerCase() || '') || adminIds.includes(user.id);
   }
   ```
3. **Defense-in-Depth:**
   - Client requests attempting admin credential assignments MUST be verified through `isServerAuthorizedAdmin()` in the Server Action / Route Handler.
   - If the caller is not in the admin allowlist, the operation is immediately rejected with HTTP 403 / `UNAUTHORIZED`.
   - The user cannot elevate themselves to admin by manipulating profile data.

---

## 7. Database Contract & Schema Draft

### 7.1 Schema Isolation
All credential storage will be placed in a dedicated schema: `private`.
```sql
CREATE SCHEMA IF NOT EXISTS private;
```

### 7.2 Table Definition: `private.ai_credentials`
```sql
CREATE TABLE private.ai_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('PERSONAL', 'ADMIN_ASSIGNED')),
  provider text NOT NULL DEFAULT 'GEMINI' CHECK (provider IN ('GEMINI')),
  encrypted_envelope jsonb NOT NULL,
  key_hint text NOT NULL CHECK (length(key_hint) <= 32),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- Integrity rule: A user may have at most ONE active credential per provider per source
CREATE UNIQUE INDEX uq_ai_credentials_active_source 
ON private.ai_credentials (owner_user_id, provider, source) 
WHERE is_active = true;

-- Performance index for resolver lookups
CREATE INDEX idx_ai_credentials_lookup 
ON private.ai_credentials (owner_user_id, provider, is_active);
```

### 7.3 Privilege Hardening (Zero PostgREST Access)
```sql
-- Revoke all privileges on schema and table from anon, authenticated, and public
REVOKE ALL ON SCHEMA private FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE private.ai_credentials FROM anon, authenticated, PUBLIC;

-- Only service_role (used by createAdminClient() on server) has access
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON TABLE private.ai_credentials TO service_role;
```
**Security Guarantee:** PostgREST does NOT expose the `private` schema. Neither `anon` nor `authenticated` Supabase clients can query `private.ai_credentials` directly via HTTP API. All operations MUST be mediated by Finora's server-side repository.

### 7.4 Trigger for `updated_at`
Reuses Finora's existing hardened `public.handle_updated_at()`:
```sql
CREATE TRIGGER trg_ai_credentials_updated_at
BEFORE UPDATE ON private.ai_credentials
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
```

---

## 8. Server-Side Repository & API Surface

### 8.1 Server-Only Credential Repository (`src/lib/ai/credentials/repository.ts`)
Must import `'server-only'` and use `createAdminClient()` from `src/lib/supabase/admin.ts`.

Methods:
1. `getUserCredentialMetadata(userId: string): Promise<UserAiCredentialMetadataDTO>`
   - Queries `private.ai_credentials` where `owner_user_id = userId`.
   - Returns non-secret metadata (masked hint, source, status).
2. `savePersonalCredential(userId: string, plaintextKey: string): Promise<UserAiCredentialMetadataDTO>`
   - Validates key format (e.g., `AIza...`, length, character set).
   - Generates masked hint (e.g. `AIza••••••••••92K`).
   - Encrypts via `encryptCredential(plaintextKey, userId, 'GEMINI')`.
   - In a transaction, deactivates any existing active `PERSONAL` credential for `userId` and inserts the new active record.
3. `revokePersonalCredential(userId: string): Promise<void>`
   - Sets `is_active = false, revoked_at = now()` for active `PERSONAL` credential of `userId`.
4. `adminAssignCredential(adminUserId: string, targetUserId: string, plaintextKey: string): Promise<void>`
   - Verifies `adminUserId` via server admin check.
   - Encrypts via `encryptCredential(plaintextKey, targetUserId, 'GEMINI')`.
   - Inserts or replaces active `ADMIN_ASSIGNED` credential for `targetUserId`.
5. `adminRevokeCredential(adminUserId: string, targetUserId: string): Promise<void>`
   - Verifies `adminUserId`.
   - Sets `is_active = false, revoked_at = now()` for active `ADMIN_ASSIGNED` credential of `targetUserId`.
6. `resolveActivePlaintextCredential(userId: string): Promise<{ plaintextKey: string; source: AiCredentialSource } | null>`
   - Evaluates priority: `PERSONAL -> ADMIN_ASSIGNED -> SYSTEM`.
   - Decrypts database ciphertext using server master key with AAD check.
   - Returns plaintext string to the caller in server execution memory only.

### 8.2 Safe Client Metadata DTO
The browser client receives **ONLY** the following shape:
```typescript
export interface UserAiCredentialMetadataDTO {
  hasPersonalKey: boolean;
  personalKeyHint: string | null;
  personalKeyUpdatedAt: string | null;
  hasAdminAssignedKey: boolean;
  adminAssignedKeyHint: string | null;
  hasSystemKeyConfigured: boolean;
  activeResolvedSource: 'PERSONAL' | 'ADMIN_ASSIGNED' | 'SYSTEM' | 'NONE';
}
```
**CRITICAL:** Under no circumstances does this DTO contain `ciphertext`, `nonce`, `auth_tag`, `master_key_id`, or `plaintextKey`.

---

## 9. Settings UI Workflow (Personal Key Management)

### 9.1 User States in `src/app/settings/page.tsx`
The AI card in settings will present clean, explicit states:
1. **Unconfigured State:**
   - Displays status: *"Hệ thống đang sử dụng cấu hình mặc định (hoặc Chưa có khóa AI)"*.
   - Input field: "Nhập khóa cá nhân Google Gemini API (AIza...)" with password masking toggle.
   - Action: "Lưu khóa cá nhân".
2. **Configured State:**
   - Displays masked hint: `AIza••••••••••92K` with badge `Đang hoạt động (Khóa cá nhân)`.
   - Shows last updated timestamp.
   - Actions:
     - "Thay thế khóa" (opens modal or expands replacement input; never prefills existing plaintext).
     - "Xóa khóa cá nhân" (revokes personal key, reverting to admin or system credential).
3. **Replacement Workflow:**
   - User inputs new API key into replacement field.
   - Server-side validates format, re-encrypts with fresh nonce, archives previous record, activates new record.
   - Client clears input immediately.
4. **Validation Feedback:**
   - If invalid API key format is supplied: clear, actionable validation error before submission.
   - On save error: sanitized message without leaking secrets.

---

## 10. Phase 10 Integration Architecture

The credential resolver integrates seamlessly into Phase 10 via the existing `AiCredentialProvider` port:

```text
User Request (Server Context: userId)
      │
      ▼
Credential Resolver (src/lib/ai/credentials/resolver.ts)
      │
      ├── 1. Check DB for active PERSONAL credential (decrypt via master key)
      ├── 2. Else check DB for active ADMIN_ASSIGNED credential (decrypt)
      └── 3. Else check process.env.GEMINI_API_KEY
      │
      ▼
Inject as AiCredentialProvider into AiRouter
      │
      ▼
AiRouter calls AiCredentialProvider.resolveCredential(operation)
      │
      ▼
AiRouter passes credential string into GeminiProvider.execute(request)
      │
      ▼
GeminiProvider executes request via @google/genai
```

**Boundary Integrity:**
- `GeminiProvider` does NOT know where the credential came from.
- `GeminiProvider` does NOT query Supabase or read environment variables directly.
- Finance business logic does NOT know anything about credentials or AI.

---

## 11. Two-User Runtime Security Test Matrix

| Test ID | Scenario | Expected Outcome |
| :--- | :--- | :--- |
| `RTL-01` | User A saves personal Gemini key | Record created in `private.ai_credentials` with `owner_user_id = User A`. Envelope contains valid AES-256-GCM ciphertext. Plaintext never stored. |
| `RTL-02` | User A requests credential metadata | User A receives masked hint (`AIza••••••••••92K`) and `activeResolvedSource = PERSONAL`. No ciphertext or plaintext in response. |
| `RTL-03` | User B queries metadata | User B sees `hasPersonalKey = false`, `activeResolvedSource = SYSTEM` (or `NONE`). Cannot see User A's hint or status. |
| `RTL-04` | User B attempts to read User A's credential | Server queries enforce `owner_user_id = session.user.id`. User B cannot access User A's row. Direct PostgREST HTTP query fails with permission denied. |
| `RTL-05` | User B attempts to replace/revoke User A's credential | Server mutation validates session user. Rejection without affecting User A's record. |
| `RTL-06` | Priority: Personal over Admin | User has both active personal and admin-assigned keys. Resolver selects `PERSONAL`. |
| `RTL-07` | Priority: Admin over System | User has no personal key, but has admin-assigned key. Server env has system key. Resolver selects `ADMIN_ASSIGNED`. |
| `RTL-08` | Priority: System fallback when Personal revoked | User revokes personal key. Subsequent resolution seamlessly selects `ADMIN_ASSIGNED` (or `SYSTEM`). |
| `RTL-09` | Priority: All absent | No personal, no admin, no system key. Resolver returns null. Router throws `AI_NOT_CONFIGURED`. |
| `RTL-10` | Invariant: No silent fallback on auth error | User A's personal key is invalid (`AIzaINVALID...`). Gemini returns HTTP 400/401. System MUST throw `AI_AUTH_FAILED`. It MUST NOT fall back to admin or system key. |
| `RTL-11` | Non-admin assigns admin credential | Non-admin user attempts admin assignment API. Rejected with HTTP 403 `UNAUTHORIZED`. |
| `RTL-12` | Ciphertext tampering / AAD rejection | If ciphertext or AAD (`owner_user_id`) is tampered with in database, decryption fails auth tag verification and throws error. |

---

## 12. Structural Verification Requirements (Future Phase 11 Gate)

Future `scripts/verify-phase11-source.mjs` will verify:
1. `private.ai_credentials` table definition exists in migrations.
2. `REVOKE ALL` from `anon`, `authenticated`, and `PUBLIC` exists in migration.
3. No plaintext credential column exists in schema.
4. AES-256-GCM envelope validation with 12-byte nonce and 16-byte auth tag.
5. Server boundary: `src/lib/ai/credentials/` files import `'server-only'`.
6. Client metadata DTO contains zero ciphertext or secret fields.
7. Zero `process.env.GEMINI_API_KEY` lookups inside `GeminiProvider` or client components.
8. Zero references to `AI_CREDENTIALS_MASTER_KEY` in client components or shared bundles.
9. Settings UI never prefills existing password/key into input fields.
10. Router and provider architecture from Phase 10 remain intact.

---

## 13. Live Persistence Smoke Contract (Future Phase 11 Closure)

When Phase 11 implementation is executed, closure will require a human-authenticated production smoke test:
1. **Initial State Verification:** Verify `/settings` displays unconfigured AI status with no personal key.
2. **Personal Key Persistence:**
   - Enter a test personal API key in settings.
   - Verify masked hint (`AIza••••••••••92K`) appears with success indicator.
   - Inspect browser network payload to confirm zero plaintext or ciphertext leakage.
   - Refresh browser page; confirm masked hint persists.
   - Log out and log back in; confirm masked hint persists.
3. **Key Replacement:**
   - Enter a replacement API key.
   - Confirm masked hint updates to new key's hint.
4. **Key Revocation:**
   - Click "Xóa khóa cá nhân".
   - Confirm status reverts to system default (or unconfigured).
   - Refresh page; confirm personal key remains revoked.

---

## 14. Non-Goals & Strict Boundaries

The following items are **STRICTLY OUT OF SCOPE** for Phase 11:
- Natural-language transaction parsing UI or endpoint (`/api/ai/parse-transaction`).
- Smart transaction categorization UI or endpoint.
- Receipt scanning or OCR (`/api/ai/receipt-ocr`).
- Financial assistant chat interface or endpoint (`/api/ai/chat`).
- AI-driven automated transaction creation.
- Enterprise role-based access control (RBAC) system.
- Full Phase 13 Admin Panel implementation.

Phase 12 will implement user-facing AI features strictly after Phase 11 credentials are fully closed and audited.
