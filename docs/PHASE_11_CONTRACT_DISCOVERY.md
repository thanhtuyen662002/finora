# Finora — Phase 11 AI Credentials Architecture & Security Contract Discovery (Hardened Baseline)

## 1. Executive Summary & Purpose

Phase 11 establishes **AI Credentials** for Finora, delivering secure, multi-tier credential storage, server-side authenticated encryption at rest (AES-256-GCM), and strict priority resolution for Google Gemini API keys across three distinct sources:
1. **`PERSONAL`:** User-owned Gemini API key, stored encrypted in database, managed by the authenticated user.
2. **`ADMIN_ASSIGNED`:** Administrator-assigned Gemini API key for a designated user, stored encrypted in database, managed exclusively by an authorized administrator.
3. **`SYSTEM`:** Server environment default Gemini API key (`FINORA_SYSTEM_GEMINI_API_KEY`), stored strictly in server environment memory with zero database persistence.

Phase 11 is strictly focused on **cryptographic security, storage integrity, authorization, and resolution**. It does **NOT** implement Phase 12 end-user AI features (natural-language transaction parsing, receipt OCR, smart categorization, financial chat assistant, or AI transaction generation).

This document serves as the authoritative architectural discovery and contract baseline, correcting previous inconsistencies, resolving PostgREST private schema access limitations through a service-role RPC facade, hardening cryptographic bindings (AAD), establishing typed database storage, and enforcing immutable UUID-based administrative authorization.

---

## 2. Preflight & Invariant Baseline

### 2.1 Git & Codebase Baseline
- **Authoritative Base Main SHA:** `49fd089cc1e9a359e1ce04ddeb24b14b313efa07`
- **Base Tree:** `f8038bf3d4be55c138bc0db611811ea9daf5ac8a`
- **Base Parent:** `4fa006f911ce96dbcdef6e5e50f8b914680876a4`
- **Scope Identifier:** `AI_CREDENTIALS`
- **Contract Status:** `READY_FOR_FINAL_INDEPENDENT_AUDIT`
- **Implementation Status:** `PHASE_11_IMPLEMENTATION_AUTHORIZED=false`

### 2.2 Phase 10 Closure Preservation & Authorized Narrow Port Extension
Phase 10 remains closed and accepted (`PHASE_10_OVERALL=PASS`, `FINORA_PHASE_10=PASS`, accepted source SHA `b4e4b475f20900f52513702201ef8c0debb95f5d`). No Phase 10 source code is modified in this docs corrective.

To enable proper credential error taxonomy propagation, Phase 11 implementation is explicitly authorized for one narrow Phase 10 credential port integration extension:
```text
PHASE_10_CLOSED=true
PHASE_11_NARROW_PHASE10_CREDENTIAL_PORT_EXTENSION=AUTHORIZED
```
This authorizes future implementation changes strictly scoped to:
- `src/lib/ai/errors.ts` (adding normalized credential error codes)
- `src/lib/ai/router.ts` (propagating `AiError` instances from `resolveCredential` and wrapping unexpected resolver failures in `AI_CREDENTIAL_RESOLUTION_FAILED`)
- `tests/phase10-ai-foundation.test.ts` (regression coverage for credential error propagation)
- `scripts/verify-phase10-source.mjs` (verifying updated error taxonomy)

All other Phase 10 invariants (SDK boundary isolation, operation-driven model dispatch, structured result runtime validation, abort/timeout semantics, money string formatting, server-only execution) remain strictly immutable.

### 2.3 Corrected Phase 10 Port Interface
The authoritative Phase 10 dependency injection interface is strictly:
```typescript
export interface AiCredentialContext {
  readonly providerId: AiProviderId;
  readonly userId?: string;
  readonly operation?: AiOperation;
}

export interface AiCredentialProvider {
  resolveCredential(
    context: AiCredentialContext
  ): Promise<AiCredential | null>;
}
```
Furthermore, the provider execution contract accepts credentials as an explicit execute dependency/argument:
```typescript
provider.execute<TInput, TOutput>(
  request: AiProviderExecutionRequest<TInput, TOutput>,
  credential: AiCredential,
  context?: AiExecutionContext
): Promise<AiProviderResponse>;
```
Credential data is passed directly into `execute(...)`, NOT through `request.credential`.

---

## 3. Storage Architecture Options & Production Fact Analysis

### 3.1 Production Environment Facts
An independent audit of the live production environment revealed the following concrete database facts:
- `private` schema: Currently **absent** (to be created in Phase 11).
- `pgcrypto` extension: **Installed** in PostgreSQL.
- `supabase_vault` extension: **Installed** in PostgreSQL.
- `vault` schema: **Present**.
- `anon` vault schema usage: **false** (no public access).
- `authenticated` vault schema usage: **false** (no user access).

### 3.2 Evaluation of Storage Alternatives

| Evaluation Dimension | Option A: Private Schema + Application-Level AES-256-GCM via Service-Role RPC Facade (RECOMMENDED) | Option B: Private Schema + Database-Side pgcrypto | Option C: Supabase Vault / Secret Storage Extension |
| :--- | :--- | :--- | :--- |
| **Status in Platform** | Standard Node.js `crypto` + standard PostgreSQL schema & tables. | Extension installed in Postgres (`pgcrypto`). | Real supported Supabase functionality; installed in production (`supabase_vault`); Public Alpha; supports self-hosted; survives backup/restore under supported configs. |
| **Secret Isolation** | **Highest.** Plaintext never reaches PostgreSQL. Database dumps, logs, and replication streams contain only ciphertext. | **Medium.** Plaintext passed in SQL parameters and decrypted in PostgreSQL memory; risk in query logs. | **Medium.** Plaintext decrypted inside PostgreSQL memory via internal KMS/pgodium keys. |
| **Key Management** | **Clean.** Master key ring (`FINORA_AI_CREDENTIAL_KEY_RING_JSON`) resides strictly in Node.js server memory. | **Complex.** Encryption key passed to SQL per query or stored in `app.settings`. | **Platform-bound.** Managed by Supabase Vault KMS/pgodium infrastructure. |
| **PostgREST Shield** | **Complete.** `private` schema is unexposed. Access strictly through service-role RPC facade. | **Complete.** Private schema unexposed; functions control access. | **Medium.** RPCs or views exposed to authenticated roles if misconfigured. |
| **Testability & Determinism** | **Deterministic & Offline.** Fast unit and integration tests with deterministic mock keys. Zero database dependency. | **Requires Postgres.** Tests require active Postgres instance with `pgcrypto`. | **Requires hosted Supabase.** Extremely difficult to mock in offline test suites. |
| **Key Rotation** | **Application-Managed.** Versioned envelope and key ring support online zero-downtime re-encryption. | **Difficult.** Requires custom batch migration scripts with old and new SQL keys. | **Platform-dependent.** Depends on vault re-encryption utilities. |

### 3.3 Selection Rationale: Option A
Option A remains the authoritative choice for Finora. This selection is based on architectural principles, not misinformation about Vault:
1. **Decoupled Decryption:** Decryption occurs strictly within trusted Finora Node.js server memory immediately before outbound dispatch to Google Gemini.
2. **Zero Plaintext in Database Layer:** Plaintext API keys never enter PostgreSQL temporary tables, memory buffers, write-ahead logs (WAL), query statistics (`pg_stat_statements`), or logical replication streams.
3. **Deterministic Offline Testability:** Cryptographic logic uses standard Node.js `crypto` (AEAD AES-256-GCM), permitting comprehensive offline automated testing with zero live infrastructure dependencies.
4. **Legitimate Future Alternative:** Supabase Vault remains a recognized, viable future alternative should Finora ever transition to database-managed secret decryption.

---

## 4. Server Database Access Architecture: Service-Role RPC Facade

### 4.1 Resolution of the PostgREST Private Schema Inconsistency
By design, the `private` schema is not included in PostgREST `db-schemas` and is completely unexposed to the Supabase Data API.
Because `supabase-js` database queries (`supabase.schema('private').from('ai_credentials')`) communicate via PostgREST, **direct queries against an unexposed schema fail even when authenticated with the `service_role` key**.

To resolve this without exposing `private` to PostgREST, Phase 11 implements a **Service-Role RPC Facade**:

```text
Browser Client
      │ (HTTPS POST with session cookie)
      ▼
Finora Authenticated Server Action / Route Handler
      │
      ├── 1. Server Session Authentication (supabase.auth.getUser())
      ├── 2. Server Authorization (Session check for PERSONAL, FINORA_ADMIN_USER_IDS for ADMIN_ASSIGNED)
      ├── 3. Application-Level AES-256-GCM Encryption / Decryption
      ▼
Server Credential Repository (src/lib/ai/credentials/repository.ts)
      │
      ▼
createAdminClient() [service_role key]
      │
      ▼ (PostgREST RPC call in public schema)
Service-Role-Only RPC Facade:
  - public.ai_credentials_read_for_service(...)
  - public.ai_credentials_write_for_service(...)
  - public.ai_credentials_revoke_for_service(...)
      │
      ▼ (Internal PostgreSQL SQL query)
private.ai_credentials [Table unexposed to PostgREST]
```

### 4.2 The Service-Role RPC Facade Contract
The RPC facade consists of a minimal set of functions residing in the exposed `public` schema.

#### Function 1: Read Active Credential Records (Scalar Return Boundary)
```sql
CREATE OR REPLACE FUNCTION public.ai_credentials_read_for_service(
  p_owner_user_id uuid,
  p_provider text DEFAULT 'GEMINI'
)
RETURNS TABLE (
  id uuid,
  owner_user_id uuid,
  source text,
  provider text,
  assigned_by_user_id uuid,
  envelope_version smallint,
  key_id text,
  nonce bytea,
  ciphertext bytea,
  auth_tag bytea,
  key_hint text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT 
    c.id, c.owner_user_id, c.source, c.provider, c.assigned_by_user_id,
    c.envelope_version, c.key_id, c.nonce, c.ciphertext, c.auth_tag,
    c.key_hint, c.is_active, c.created_at, c.updated_at, c.revoked_at
  FROM private.ai_credentials c
  WHERE c.owner_user_id = p_owner_user_id
    AND c.provider = p_provider
    AND c.is_active = true;
$$;
```
*Note on RPC Return Boundary:* `read_for_service` explicitly returns scalar fields / `RETURNS TABLE` columns. It **MUST NOT** return the private table's composite row type (`RETURNS SETOF private.ai_credentials` is strictly forbidden).

#### Function 2: Upsert Active Credential Record
```sql
CREATE OR REPLACE FUNCTION public.ai_credentials_write_for_service(
  p_id uuid,
  p_owner_user_id uuid,
  p_source text,
  p_provider text,
  p_assigned_by_user_id uuid,
  p_envelope_version smallint,
  p_key_id text,
  p_nonce bytea,
  p_ciphertext bytea,
  p_auth_tag bytea,
  p_key_hint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.ai_credentials (
    id, owner_user_id, source, provider, assigned_by_user_id,
    envelope_version, key_id, nonce, ciphertext, auth_tag,
    key_hint, is_active, updated_at, revoked_at
  ) VALUES (
    p_id, p_owner_user_id, p_source, p_provider, p_assigned_by_user_id,
    p_envelope_version, p_key_id, p_nonce, p_ciphertext, p_auth_tag,
    p_key_hint, true, pg_catalog.now(), NULL
  )
  ON CONFLICT (owner_user_id, provider, source)
  DO UPDATE SET
    id = EXCLUDED.id,
    assigned_by_user_id = EXCLUDED.assigned_by_user_id,
    envelope_version = EXCLUDED.envelope_version,
    key_id = EXCLUDED.key_id,
    nonce = EXCLUDED.nonce,
    ciphertext = EXCLUDED.ciphertext,
    auth_tag = EXCLUDED.auth_tag,
    key_hint = EXCLUDED.key_hint,
    is_active = true,
    updated_at = pg_catalog.now(),
    revoked_at = NULL;
END;
$$;
```

#### Function 3: Revoke Credential & Erase Secret Material
```sql
CREATE OR REPLACE FUNCTION public.ai_credentials_revoke_for_service(
  p_owner_user_id uuid,
  p_source text,
  p_provider text DEFAULT 'GEMINI'
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.ai_credentials
  SET 
    is_active = false,
    revoked_at = pg_catalog.now(),
    updated_at = pg_catalog.now(),
    nonce = NULL,
    ciphertext = NULL,
    auth_tag = NULL,
    key_id = NULL,
    key_hint = NULL
  WHERE owner_user_id = p_owner_user_id
    AND source = p_source
    AND provider = p_provider
    AND is_active = true;
END;
$$;
```

### 4.3 Mandatory RPC Security & Privilege Invariants
1. **`SECURITY INVOKER`:** Functions execute with the caller's privileges (which is `service_role` when called from `createAdminClient()`). No `SECURITY DEFINER` is used.
2. **`SET search_path = ''`:** Mitigates schema-hijacking vulnerabilities. All table references and built-in functions are fully qualified (`private.ai_credentials`, `pg_catalog.now()`).
3. **Strict Privilege Lockout:**
   ```sql
   REVOKE EXECUTE ON FUNCTION public.ai_credentials_read_for_service(uuid, text) FROM PUBLIC, anon, authenticated;
   REVOKE EXECUTE ON FUNCTION public.ai_credentials_write_for_service(uuid, uuid, text, text, uuid, smallint, text, bytea, bytea, bytea, text) FROM PUBLIC, anon, authenticated;
   REVOKE EXECUTE ON FUNCTION public.ai_credentials_revoke_for_service(uuid, text, text) FROM PUBLIC, anon, authenticated;

   GRANT EXECUTE ON FUNCTION public.ai_credentials_read_for_service(uuid, text) TO service_role;
   GRANT EXECUTE ON FUNCTION public.ai_credentials_write_for_service(uuid, uuid, text, text, uuid, smallint, text, bytea, bytea, bytea, text) TO service_role;
   GRANT EXECUTE ON FUNCTION public.ai_credentials_revoke_for_service(uuid, text, text) TO service_role;
   ```
4. **Zero Plaintext in RPC:** Plaintext API keys **NEVER** enter RPC parameters or return values. The RPC layer processes only encrypted ciphertext blobs (`bytea`), cryptographic nonces, auth tags, and key hints.

---

## 5. Private Schema & Typed Database Storage Model

### 5.1 Schema Isolation & Privileges
```sql
CREATE SCHEMA IF NOT EXISTS private;

-- Complete lockdown of private schema
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Safe default privileges for future objects (least privilege)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private GRANT SELECT, INSERT, UPDATE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private REVOKE ALL ON ROUTINES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
```

### 5.2 Typed Table Definition: `private.ai_credentials`
JSONB is explicitly replaced with typed SQL columns to enforce structural cryptographic integrity at the database layer.

```sql
CREATE TABLE private.ai_credentials (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('PERSONAL', 'ADMIN_ASSIGNED')),
  provider text NOT NULL DEFAULT 'GEMINI' CHECK (provider IN ('GEMINI')),
  assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Cryptographic envelope fields (Typed)
  envelope_version smallint NOT NULL CHECK (envelope_version = 1),
  key_id text,
  nonce bytea,
  ciphertext bytea,
  auth_tag bytea,
  key_hint text,
  
  -- Lifecycle & Audit
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,

  -- Constraint 1: One active credential per user per provider per source
  CONSTRAINT uq_ai_credentials_slot UNIQUE (owner_user_id, provider, source),

  -- Constraint 2: Source and assignment integrity with conditional provenance
  CONSTRAINT chk_ai_credentials_source_assignment CHECK (
    (
      source = 'PERSONAL'
      AND assigned_by_user_id IS NULL
    )
    OR
    (
      source = 'ADMIN_ASSIGNED'
      AND (
        is_active = false
        OR assigned_by_user_id IS NOT NULL
      )
    )
  ),

  -- Constraint 3: Cryptographic material integrity when ACTIVE
  CONSTRAINT chk_ai_credentials_active_material CHECK (
    (is_active = true AND 
     revoked_at IS NULL AND
     key_id IS NOT NULL AND length(key_id) > 0 AND
     nonce IS NOT NULL AND octet_length(nonce) = 12 AND
     auth_tag IS NOT NULL AND octet_length(auth_tag) = 16 AND
     ciphertext IS NOT NULL AND octet_length(ciphertext) > 0 AND
     key_hint IS NOT NULL AND length(key_hint) > 0)
    OR
    (is_active = false AND 
     revoked_at IS NOT NULL AND
     nonce IS NULL AND 
     ciphertext IS NULL AND 
     auth_tag IS NULL AND 
     key_id IS NULL AND 
     key_hint IS NULL)
  )
);

-- Revoke all direct privileges on the table
REVOKE ALL ON TABLE private.ai_credentials FROM PUBLIC, anon, authenticated;

-- Service role least privilege: grant SELECT, INSERT, UPDATE only
GRANT SELECT, INSERT, UPDATE ON TABLE private.ai_credentials TO service_role;
```

#### Foreign Key Delete Semantics & Conditional Provenance:
- **`owner_user_id REFERENCES auth.users(id) ON DELETE CASCADE`:** If the user identity is deleted from the system, all associated credential records and encrypted payloads are automatically deleted. This aligns with Finora's privacy posture.
- **`assigned_by_user_id REFERENCES auth.users(id) ON DELETE SET NULL` with Conditional Provenance Check:**
  - **Active Admin-Assigned Credential:** An active `ADMIN_ASSIGNED` credential row requires `assigned_by_user_id IS NOT NULL` per `chk_ai_credentials_source_assignment`. If an authorized administrator attempts to delete their user account while active `ADMIN_ASSIGNED` credentials reference them, the database foreign key action triggers `SET NULL`, but the check constraint rejects the update, causing the admin deletion to **fail closed (`FAIL`)**.
  - **Revoked Admin-Assigned Credential:** When an admin-assigned credential is revoked (`is_active = false`), cryptographic material is erased (`nonce = NULL`, `ciphertext = NULL`, `auth_tag = NULL`, `key_id = NULL`, `key_hint = NULL`). If the referenced administrator identity is subsequently deleted, `ON DELETE SET NULL` is permitted by the check constraint. The historical inactive record is retained with `assigned_by_user_id = NULL`, leaving no broken foreign key references.
  - **Explicit Assignment Invariants:**
    ```text
    PERSONAL:
    assigned_by_user_id = NULL (always)

    ACTIVE ADMIN_ASSIGNED:
    assigned_by_user_id IS NOT NULL (always enforced)

    INACTIVE ADMIN_ASSIGNED:
    assigned_by_user_id MAY be non-null
    assigned_by_user_id MAY become NULL only because referenced admin identity was deleted
    ```
    Application code is strictly forbidden from arbitrarily clearing `assigned_by_user_id` on an active assignment.

#### Service-Role Least Privilege Invariants:
- `service_role` is granted strictly `SELECT, INSERT, UPDATE`.
- `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` are strictly **NOT** granted to `service_role`.
- Credential revocation is performed via `UPDATE` setting `is_active = false` and erasing sensitive ciphertext/nonce/auth_tag fields.
- Credential replacement is performed via `INSERT ... ON CONFLICT DO UPDATE`.
- Credential read is performed via `SELECT`.
- Historical inactive metadata does not require `DELETE`.

### 5.3 RLS Defense in Depth
Even though `private.ai_credentials` is completely unexposed to PostgREST, RLS is enabled as a defense-in-depth measure:
```sql
ALTER TABLE private.ai_credentials ENABLE ROW LEVEL SECURITY;
```
- **Browser Policies:** Exactly **0** (no policies exist; browser client access is completely barred).
- **Service-Role Execution:** In Supabase production, `service_role` possesses `BYPASSRLS=true`. Service-role RPC calls execute safely under the granted table privileges.
- Authenticated ownership RLS policies must **NOT** be added to the private table.

### 5.4 Secret Material Erased on Revocation
In accordance with Finora's privacy-first posture, secret credentials are **not** financial audit records and must not be retained after user revocation. When a credential is revoked:
- `is_active` becomes `false`.
- `revoked_at` is set to `now()`.
- `nonce`, `ciphertext`, `auth_tag`, `key_id`, and `key_hint` are **erased (`NULL`)**.
Database constraints guarantee that inactive rows cannot retain encrypted payloads.

---

## 6. Cryptographic Encryption Standard (AES-256-GCM)

### 6.1 Cryptographic Parameters
- **Cipher:** `aes-256-gcm` (Authenticated Encryption with Associated Data - AEAD).
- **Key Length:** 256 bits (32 bytes).
- **Nonce (IV):** 96 bits (12 bytes) cryptographically random, generated via `crypto.randomBytes(12)` per encryption. **Nonces must never be repeated.**
- **Auth Tag:** 128 bits (16 bytes), generated via `cipher.getAuthTag()`.
- **Row ID Pre-generation:** The credential row UUID (`id`) is generated before encryption via `crypto.randomUUID()` so it can be bound into the AAD.

### 6.2 Strengthened Associated Authenticated Data (AAD)
To mathematically prevent ciphertext transplantation attacks across users, providers, sources, or distinct credential records, the AAD is bound to the immutable identity of the record:

```text
AAD String = "v1|" + credential_id + "|" + owner_user_id + "|" + provider + "|" + source
```

**Transplantation Protections:**
1. **User-to-User:** User B cannot transplant User A's ciphertext into their own row (AAD mismatch on `owner_user_id`).
2. **Class Swap:** A compromised `PERSONAL` key cannot be transplanted into an `ADMIN_ASSIGNED` row (AAD mismatch on `source`).
3. **Row Replay:** Ciphertext cannot be replayed into a different credential row (AAD mismatch on `credential_id`).

### 6.3 Master Key Management Contract
- **Encoding Standard:** Exactly **base64 encoded 32-byte AES key**. Ambiguous hex-or-base64 parsing is strictly rejected.
- **Server Environment Variables:**
  - `FINORA_AI_CREDENTIAL_ACTIVE_KEY_ID`: Identifier for the currently active master key (e.g. `k1`).
  - `FINORA_AI_CREDENTIAL_KEY_RING_JSON`: JSON dictionary mapping key IDs to base64-encoded 32-byte keys.
    ```json
    {
      "k1": "<32-byte-base64-encoded-key>"
    }
    ```
- **Rules:**
  - Server-only (`import 'server-only'`). Never accessible to client components or public bundles.
  - Base64 decoding must produce exactly 32 bytes (`Buffer.length === 32`).
  - Missing active key or malformed key ring fails closed for credential operations.
  - **Zero Database / Log Storage:** Master keys are never logged, persisted in Supabase, or returned in errors.
  - Supports zero-downtime key rotation: decrypt with legacy `key_id`, encrypt with active `key_id`, write back in single transaction.

---

## 7. AI Credential Resolution & Fail-Closed Invariants

### 7.1 Multi-Tier Resolution Priority
When an AI operation is requested, the resolver evaluates credentials in the following strict order:
```text
1. Check for active PERSONAL credential for user
   └── If present, active, and decrypts successfully → RESOLVED = PERSONAL

2. Else, check for active ADMIN_ASSIGNED credential for user
   └── If present, active, and decrypts successfully → RESOLVED = ADMIN_ASSIGNED

3. Else, check for configured FINORA_SYSTEM_GEMINI_API_KEY in server environment
   └── If present and non-empty → RESOLVED = SYSTEM

4. Else:
   └── No credential available → Throws AI_NOT_CONFIGURED
```

### 7.2 Authenticated User Context Required (Blocker B)
`AiCredentialContext.userId` is optional at the generic Phase 10 type layer. However, for Finora end-user AI resolution:
- **`context.userId` missing:** MUST NOT be interpreted as permission to use the `SYSTEM` credential.
- **Fail-Closed Resolution:**
  ```text
  context.userId missing
  → no credential resolution
  → no PERSONAL lookup
  → no ADMIN_ASSIGNED lookup
  → no SYSTEM fallback
  → Throws AI_NOT_CONFIGURED (or null credential)
  ```
- The resolver **MUST** verify authenticated user context before querying or evaluating any credential source.

### 7.3 SYSTEM Is a User Fallback, Not Anonymous Quota
The server environment variable `FINORA_SYSTEM_GEMINI_API_KEY` is defined strictly as:
> **Default Gemini quota for an authenticated Finora user who has no active personal or admin-assigned credential.**

It explicitly **DOES NOT** mean:
- Anonymous user fallback
- Unauthenticated server route fallback
- Missing-user-context fallback
- Generic public system quota

All Phase 12 server routes will be strictly required to authenticate the user session via Supabase Auth before invoking AI operations.

### 7.4 Provider Validation
Phase 11 implements credentials for the Google Gemini provider only:
- `context.providerId === 'gemini'` → Eligible for Phase 11 multi-tier resolution.
- `context.providerId !== 'gemini'` (unknown or unsupported provider) → Returns `null` / throws `AI_NOT_CONFIGURED`.
- The resolver **MUST NEVER** return the Gemini system key for an arbitrary or unsupported future provider ID.

### 7.5 Extended Normalized Error Taxonomy (Blocker A)
Phase 11 implementation extends `AiErrorCode` in `src/lib/ai/errors.ts` to distinguish storage/decryption failures from provider authentication rejections:

```typescript
export type AiErrorCode =
  // Authoritative Phase 10 error codes:
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_AUTH_FAILED'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_ABORTED'
  | 'AI_INVALID_REQUEST'
  | 'AI_INVALID_RESPONSE'
  | 'AI_STRUCTURED_OUTPUT_INVALID'
  | 'AI_PROVIDER_ERROR'
  // Phase 11 credential error extensions (Authorized):
  | 'AI_CREDENTIAL_CORRUPTED'
  | 'AI_CREDENTIAL_KEY_UNAVAILABLE'
  | 'AI_CREDENTIAL_RESOLUTION_FAILED';
```

**Semantics & Mapping:**
- `AI_CREDENTIAL_CORRUPTED`: AES-GCM authentication tag mismatch, tampered ciphertext, corrupted nonce, or malformed cryptographic envelope.
- `AI_CREDENTIAL_KEY_UNAVAILABLE`: The envelope references a `key_id` that is not present in `FINORA_AI_CREDENTIAL_KEY_RING_JSON`, or the server encryption key ring is unavailable.
- `AI_CREDENTIAL_RESOLUTION_FAILED`: Unexpected internal credential repository failure, database communication error during resolution, or unhandled resolver exception.
- `AI_AUTH_FAILED`: Reserved strictly for upstream provider authentication failures (e.g., Google Gemini returns HTTP 400/401/403 rejecting the decrypted plaintext API key).

**Sanitization Invariant:** No secret-bearing details (raw keys, key hints, nonces, or auth tags) may appear in error messages, logs, or error metadata.

### 7.6 Router Credential Catch Contract (Blocker A)
Phase 10's generic credential catch block in `src/lib/ai/router.ts` caught all resolver errors and converted them indiscriminately to `AI_AUTH_FAILED`.
Under the Phase 11 authorized port extension, the router must preserve normalized `AiError` instances:

```typescript
try {
  credential = await context.credentialProvider.resolveCredential(credentialContext);
} catch (error) {
  // Preserve intentional normalized credential errors
  if (error instanceof AiError) {
    return {
      ok: false,
      error,
    };
  }

  // Wrap unexpected resolver exceptions in AI_CREDENTIAL_RESOLUTION_FAILED
  return {
    ok: false,
    error: new AiError({
      code: 'AI_CREDENTIAL_RESOLUTION_FAILED',
      message: 'Failed to resolve AI credential.',
      providerId,
    }),
  };
}
```
The router **MUST NOT** map arbitrary credential storage or decryption failures to `AI_AUTH_FAILED`.

### 7.7 Credential Error Fallback Rule (Strict Fail-Closed)
Fallback to a lower-priority credential source occurs **ONLY** when a higher-priority credential is **absent, unconfigured, or explicitly revoked (`is_active = false`)**.
Once a higher-priority credential source is selected for resolution, any subsequent error **FAILS CLOSED** and **MUST NEVER** fall back to lower-priority credentials:

```text
selected PERSONAL corrupted
→ AI_CREDENTIAL_CORRUPTED
→ NO ADMIN fallback
→ NO SYSTEM fallback

selected PERSONAL key_id unavailable
→ AI_CREDENTIAL_KEY_UNAVAILABLE
→ NO fallback

selected ADMIN_ASSIGNED corrupted
→ AI_CREDENTIAL_CORRUPTED
→ NO SYSTEM fallback

selected Gemini credential rejected (HTTP 401/403)
→ AI_AUTH_FAILED
→ NO fallback
```

**Security & Financial Justification:** Silently falling back when a user's personal key fails would mask configuration errors, violate user intent, and surreptitiously consume instance administrator or system quota.

### 7.8 Decoupling: Deterministic Finance Unaffected
Finora's core personal finance OS (balances, transactions, transfers, budgets, goals, reports) is completely decoupled from AI. Missing master keys, unconfigured AI credentials, or AI provider outages **MUST NOT** impact core financial tracking. Credential encryption is evaluated lazily only when AI features are invoked.

---

## 8. Administrative Authorization & Security Baseline

### 8.1 Admin Authorization via Immutable UUID Only
To eliminate security risks associated with mutable user identifiers, Phase 11 authorizes administrators **strictly by immutable user UUID**:
- **Environment Variable:** `FINORA_ADMIN_USER_IDS` (comma-separated list of trusted `auth.users.id` UUIDs).
- **Prohibited Authorities:**
  - `FINORA_ADMIN_EMAILS` is **FORBIDDEN** as an authorization authority.
  - User profile metadata, `user_metadata`, display names, or client-supplied `is_admin` flags are **FORBIDDEN**.
- **Verification Helper (`src/lib/auth/admin.ts`):**
  ```typescript
  export async function isServerAuthorizedAdmin(supabase: SupabaseClient): Promise<boolean> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return false;
    
    const adminIds = (process.env.FINORA_ADMIN_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
      
    return adminIds.includes(user.id);
  }
  ```

### 8.2 Email as Target Locator Only
For administrative UX, an administrator may locate a target user by email. That email serves solely as a lookup parameter to resolve the target `auth.users.id`. The resulting credential assignment authorizes and stores strictly by the target's immutable UUID.

### 8.3 Security Advisor Prerequisite (Existing Function ACLs)
An independent audit revealed that existing functions `public.handle_new_user()` and `public.rls_auto_enable()` are defined as `SECURITY DEFINER` and are currently executable by `PUBLIC`, `anon`, and `authenticated`.
**Prerequisite for Phase 11 Production Deployment:**
The Phase 11 database migration must include:
```sql
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
```
This hardens existing triggers against unintended direct execution.

---

## 9. Client Transport & Safe Metadata Surface

### 9.1 Browser Transport Reality
When a user submits a personal API key in `/settings`:
- The plaintext API key is transmitted in the HTTPS request body (`POST`) to the Finora server action. This is the expected transport mechanism.
- The Finora server immediately validates format, encrypts via AES-256-GCM, and dispatches the ciphertext envelope to the RPC facade.
- Client React state is cleared immediately upon response.

### 9.2 Zero Secret Leakage Perimeter
Plaintext API keys, master keys, and ciphertext envelopes **MUST NEVER** appear in:
- URL paths or query strings
- HTTP response bodies
- Client-side metadata queries
- `localStorage`, `sessionStorage`, or cookies
- Client-side JavaScript bundles
- Database RPC arguments
- Application log streams or error serialization payloads

### 9.3 Safe Metadata DTO
Browser components access credential status exclusively through a safe, unprivileged DTO:
```typescript
export interface UserAiCredentialMetadataDTO {
  hasPersonalCredential: boolean;
  personalKeyHint: string | null; // Suffix only (e.g. "••••••••••92K")
  personalKeyUpdatedAt: string | null;
  hasAdminAssignedCredential: boolean;
  adminAssignedKeyHint: string | null;
  hasSystemKeyConfigured: boolean;
  activeResolvedSource: 'PERSONAL' | 'ADMIN_ASSIGNED' | 'SYSTEM' | 'NONE';
}
```
**No Plaintext Readback:** Once stored, plaintext API keys cannot be read back by users, administrators, or client APIs.

---

## 10. Phase 11 Verification Gates & Contracts

### 10.1 Structural Database & Source Gate (`scripts/verify-phase11-source.mjs`)
The structural verification gate must prove:
1. `private` schema exists and is not exposed to PostgREST.
2. `private.ai_credentials` exists with typed columns (`bytea` for nonce, ciphertext, auth_tag; `smallint` for envelope_version).
3. Check constraints enforce nonce (12 bytes), auth_tag (16 bytes), ciphertext non-empty, and source/assignment rules.
4. Active records hold complete cryptographic material; revoked records hold `NULL` secret material.
5. `UNIQUE(owner_user_id, provider, source)` enforces single slot per credential type.
6. RLS is enabled on `private.ai_credentials` with zero browser policies.
7. Service-role RPC facade exists (`public.ai_credentials_*_for_service`) with `SECURITY INVOKER` and empty `search_path`.
8. `EXECUTE` on RPC functions revoked from `PUBLIC`, `anon`, `authenticated`, and granted strictly to `service_role`.
9. `src/lib/ai/credentials/` modules enforce `import 'server-only'`.
10. Zero direct `supabase.schema('private')` calls in application repository code.
11. Zero `process.env.GEMINI_API_KEY` lookups in provider adapters.

### 10.2 Phase 11 Security & Error Runtime Test Matrix

| Test ID | Category | Scenario | Verification Criteria |
| :--- | :--- | :--- | :--- |
| `SEC-01` | Encryption | User A saves personal key | Key encrypted with AES-256-GCM. Typed envelope stored in `private.ai_credentials`. No plaintext in database. |
| `SEC-02` | Metadata DTO | User A reads metadata | Receives masked hint (`••••••••••92K`) and `activeResolvedSource = PERSONAL`. No ciphertext or plaintext in response. |
| `SEC-03` | Isolation | User B queries metadata | User B sees `hasPersonalCredential = false`. Cannot view User A's metadata or status. |
| `SEC-04` | PostgREST API | Direct Data API attack on `private` | Unprivileged HTTP request targeting `/rest/v1/private/ai_credentials` fails closed (404/403). |
| `SEC-05` | PostgREST API | Direct Data API attack on RPC | Authenticated client invoking `rpc/ai_credentials_read_for_service` rejected with 403 Forbidden. |
| `SEC-06` | Priority | Priority: Personal > Admin | User with both active personal and admin-assigned keys resolves `PERSONAL`. |
| `SEC-07` | Priority | Priority: Admin > System | User with admin-assigned key and system key configured resolves `ADMIN_ASSIGNED`. |
| `SEC-08` | Priority | Fallback: Revoked Personal | Revoking personal key allows resolver to select `ADMIN_ASSIGNED` or `SYSTEM`. |
| `SEC-09` | Error Fail-Closed | Invariant: Auth Tag Mismatch | Tampered ciphertext or AAD throws `AI_CREDENTIAL_CORRUPTED`. **No fallback** to lower priority. |
| `SEC-10` | Error Fail-Closed | Invariant: Missing Key ID | Envelope with unknown master key ID throws `AI_CREDENTIAL_KEY_UNAVAILABLE`. **No fallback** to lower priority. |
| `SEC-11` | Error Fail-Closed | Invariant: Gemini 401/403 | Invalid Gemini key throws `AI_AUTH_FAILED`. **No fallback** to lower priority. |
| `SEC-12` | Authorization | Non-admin assigns key | Request rejected with HTTP 403 Forbidden. |
| `SEC-13` | Cryptography | AAD Transplantation Attack | Swapping `owner_user_id` or `source` across records causes AES-GCM decryption failure. |
| `SEC-USER-01` | Context Invariant | Missing `context.userId` with System Key | When `context.userId` is absent, resolver does **NOT** return `SYSTEM` key; fails closed with `AI_NOT_CONFIGURED`. |
| `SEC-USER-02` | Context Invariant | Authenticated User A with System Key | Authenticated user with no personal or admin-assigned key resolves `SYSTEM`. |
| `SEC-PROVIDER-01`| Provider Invariant| Unsupported provider request | Resolver rejects non-Gemini provider IDs even if Gemini system key is configured (`AI_NOT_CONFIGURED`). |
| `SEC-ERROR-01` | Error Propagation | Resolver throws `AI_CREDENTIAL_CORRUPTED` | Router catch preserves `AI_CREDENTIAL_CORRUPTED` without remapping to `AI_AUTH_FAILED`. |
| `SEC-ERROR-02` | Error Propagation | Resolver throws `AI_CREDENTIAL_KEY_UNAVAILABLE` | Router catch preserves `AI_CREDENTIAL_KEY_UNAVAILABLE` without remapping to `AI_AUTH_FAILED`. |
| `SEC-ERROR-03` | Error Propagation | Unexpected resolver runtime exception | Router wraps generic runtime errors in `AI_CREDENTIAL_RESOLUTION_FAILED`. |
| `SEC-FK-01` | Provenance FK | Active ADMIN_ASSIGNED references Admin A; attempt to delete Admin A | Foreign key attempts SET NULL, but `chk_ai_credentials_source_assignment` rejects active row without assigner; admin deletion fails closed (FAIL). |
| `SEC-FK-02` | Provenance FK | Revoke ADMIN_ASSIGNED (`is_active=false`, crypto erased), then delete Admin A | Admin A deletion succeeds; `assigned_by_user_id` becomes NULL; inactive credential metadata remains. |
| `SEC-FK-03` | Provenance FK | Attempt to create or reactivate ADMIN_ASSIGNED with `assigned_by_user_id=NULL` | Database constraint `chk_ai_credentials_source_assignment` rejects; fails closed. |

### 10.3 Phase 10 Non-Regression Verification Contract
When Phase 11 implementation is authorized and executed, the following Phase 10 test suites must be executed and confirmed passing without regressions:
1. `npx tsx tests/phase10-ai-foundation.test.ts`
2. `node scripts/verify-phase10-source.mjs`

**Required Non-Regression Assertions:**
- **Provider Registration:** Provider registration and lookup remain authoritative in `AiRouter` (`src/lib/ai/router.ts`) implementing `AiProvider` contract (`src/lib/ai/provider.ts`), remaining decoupled from business logic and concrete SDK details.
- **Operation Fail-Closed:** Unknown or unconfigured AI operations throw `AI_INVALID_REQUEST` without attempting execution.
- **Structured Runtime Validation:** Structured responses parse unknown JSON via `parseAndValidateJson` and validate through `AiOutputValidator<T>`; malformed JSON or schema-invalid structured output throws `AI_STRUCTURED_OUTPUT_INVALID`.
- **Empty Response Detection:** Empty text or provider response fails closed throwing `AI_INVALID_RESPONSE`.
- **Unexpected Provider Error:** Unhandled provider failure throws `AI_PROVIDER_ERROR`.
- **Abort vs Timeout Semantics:** `AbortSignal` cancellation throws `AI_ABORTED`; runtime timeout throws `AI_TIMEOUT`.
- **Gemini SDK Boundary Isolation:** `@google/genai` is imported strictly within `src/lib/ai/providers/gemini.ts` and marked `server-only`.
- **Credential Error Propagation:** Authorized port extension correctly preserves normalized `AiError` instances (`AI_CREDENTIAL_CORRUPTED`, `AI_CREDENTIAL_KEY_UNAVAILABLE`) and wraps unexpected resolver exceptions in `AI_CREDENTIAL_RESOLUTION_FAILED`.
- **Exception Sanitization:** Exception messages sanitize API keys and Bearer tokens without exposing secret material or call stacks.
- **No Unvalidated Output Casts:** All output processing preserves validated domain contracts without unvalidated generic typecasts.

### 10.4 Live Persistence Smoke Contract (Future Phase 11 Closure)
When Phase 11 implementation is executed, production closure will require human verification:
1. **Initial Unconfigured State:** `/settings` displays default status with no personal key.
2. **Personal Key Save:** Save personal API key. Outbound request body contains plaintext (expected transport). Response contains masked suffix only (`••••••••••92K`).
3. **Session & Browser Persistence:** Hard refresh and re-login verify masked hint persists from database.
4. **Database Verification:** Direct inspection confirms `private.ai_credentials` contains binary ciphertext, 12-byte nonce, 16-byte tag, and zero plaintext.
5. **Key Replacement:** Replacing key updates slot with fresh nonce, tag, and hint. Old secret is purged.
6. **Key Revocation:** Removing key sets `is_active = false` and zeroes out nonce, tag, ciphertext, and hint in database. Resolver falls back to system key.

---

## 11. Non-Goals & Strict Boundaries

The following items are **STRICTLY FORBIDDEN** in Phase 11:
- Natural-language transaction parsing UI or endpoints (`/api/ai/parse-transaction`)
- AI categorization UI or endpoints
- Receipt OCR scanning (`/api/ai/receipt-ocr`)
- Financial chat assistant interface (`/api/ai/chat`)
- AI automated transaction creation
- Enterprise RBAC systems or full Phase 13 Admin Panel

Phase 12 will implement user-facing AI features strictly after Phase 11 credentials are fully audited and closed.
