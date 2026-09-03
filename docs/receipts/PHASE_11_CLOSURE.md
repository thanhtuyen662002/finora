# Finora — Phase 11 Closure Receipt

## 1. Scope & Execution Overview

- **Project:** Finora
- **Phase:** Phase 11 — AI Credentials
- **Repository:** `thanhtuyen662002/finora`
- **Branch:** `main`
- **Accepted Source SHA:** `50d9cd1ba40d48e34ffa1982d18c58e2a37c16a1`
- **Accepted Source Tree:** `e88a534e37780ac8903859f469e94b703fc73216`
- **Vercel Production Deployment:** `dpl_2jaji2hPoyCVriYZwVjTKVoTpQTD`
- **Target Supabase Project:** `qibfitbnlfgiqctntufr` (`https://qibfitbnlfgiqctntufr.supabase.co`)
- **Live Finora Origin:** `https://finora-orpin-nu.vercel.app`
- **Scope Identifier:** `AI_CREDENTIALS`

---

## 2. Accepted Architectural & Security Invariants

Phase 11 establishes the private, encrypted, server-only credential subsystem enabling secure personal and admin-assigned AI credentials with priority-based resolution, fail-closed access control, and zero client secret exposure.

### 2.1 Storage Architecture & Isolation
- **Storage Strategy:** `PRIVATE_SCHEMA_APPLICATION_AES_256_GCM_SERVICE_ROLE_RPC`
- **Migration:** `20260903110000_phase_11_ai_credentials.sql` (Status: **APPLIED**)
- **Private Schema Isolation:** Table `private.ai_credentials` resides in the `private` schema with all privileges revoked from `anon`, `authenticated`, and `public`. `service_role` is granted `USAGE`. RLS enabled fail-closed with 0 browser policies.
- **Service Role Least-Privilege Grants:** Service role granted `SELECT`, `INSERT`, `UPDATE` only on `private.ai_credentials` (no `DELETE`, no `TRUNCATE`).
- **Foreign Key Relationships:** `owner_user_id` references `auth.users(id) ON DELETE CASCADE`; `assigned_by_user_id` references `auth.users(id) ON DELETE SET NULL`.
- **Defensive Unique Constraints & Invariants:** Strict table-level uniqueness constraint `CONSTRAINT uq_ai_credentials_slot UNIQUE (owner_user_id, provider, source)` for `provider = 'GEMINI'` and `source IN ('PERSONAL', 'ADMIN_ASSIGNED')`. The database keeps the slot row upon revocation and zeroizes cryptographic material rather than deleting the row.
- **Cryptographic Material Invariants:**
  - *Active Record (`is_active = true`):* `revoked_at IS NULL`, non-empty `key_id`, 12-byte `nonce`, non-empty `ciphertext`, 16-byte `auth_tag`, 1..4 printable ASCII characters `key_hint`.
  - *Revoked/Inactive Record (`is_active = false`):* `revoked_at IS NOT NULL`, with `key_id`, `nonce`, `ciphertext`, `auth_tag`, and `key_hint` zeroized to `NULL`.
- **Public Service-Role RPC Facade:** Server-side database operations are mediated through explicit `public` schema SECURITY INVOKER functions:
  - `public.ai_credentials_read_for_service(uuid, text)`
  - `public.ai_credentials_write_for_service(uuid, uuid, text, text, uuid, smallint, text, bytea, bytea, bytea, text)`
  - `public.ai_credentials_revoke_for_service(uuid, text, text)`
  - All three functions specify `SECURITY INVOKER`, enforce empty `search_path = ''`, revoke execute privileges from `PUBLIC`, `anon`, and `authenticated`, and grant execute privileges strictly to `service_role`.

### 2.2 Cryptographic Envelope & Key Ring
- **Algorithm:** Node.js native `crypto` AES-256-GCM authenticated encryption.
- **Parameters:** 32-byte master key, 12-byte fresh random nonce per write (zero nonce reuse), 16-byte GCM authentication tag.
- **AAD Canonical Bindings:** Cryptographically binds `credential_id`, `owner_user_id`, `provider`, `source`, and `envelope_version`. Cross-slot and cross-row transplants fail closed with `AI_CREDENTIAL_CORRUPTED`.
- **Envelope Versioning:** Version 1 enforced at encryption, wire hydration, and decryption.
- **Zero Plaintext Storage:** Database stores only `bytea` ciphertext, nonce, and auth tag. No plaintext credential column exists.

### 2.3 Server Boundary & Credential Security
- **Build-Time Server Isolation:** All credential modules enforce `import 'server-only'`. Zero leaks to browser bundles.
- **Client Purity:** Zero credentials or master keys stored in `localStorage`, `sessionStorage`, or cookies. Zero ciphertext returned to client components.
- **Safe Metadata DTO (`AiCredentialSafeMetadata`):** Exposes only safe boolean flags, key hints (1..4 printable ASCII characters, never equals plaintext), and timestamps.
- **Password Masking:** UI input fields use `type="password"` with `autoComplete="off"`. Plaintext keys are never read back or displayed once saved.

### 2.4 Credential Resolution Priority
- **Order of Precedence:**
  1. `PERSONAL` (User's active personal key)
  2. `ADMIN_ASSIGNED` (Admin-assigned key for the user)
  3. `SYSTEM` (`FINORA_SYSTEM_GEMINI_API_KEY` server environment variable)
- **Fallback Behavior:** Revocation or absence of higher-priority sources safely falls back to lower-priority sources. Corrupted active credentials or unavailable decryption keys fail closed with specific error taxonomy (`AI_CREDENTIAL_CORRUPTED`, `AI_CREDENTIAL_KEY_UNAVAILABLE`) with NO unsafe fallback.

### 2.5 Admin Authority & Governance
- **Authorization Authority:** Strictly evaluated server-side via `FINORA_ADMIN_USER_IDS` environment variable. Zero reliance on user-editable profile metadata or client-supplied actor claims.
- **Exact User Email Resolution:** Case-insensitive, trimmed email match using paginated Supabase Admin API with fail-closed duplicate/ambiguity handling.
- **Deferred Factory Pattern:** Supabase admin client and repository instantiation is strictly deferred until AFTER actor authentication and admin authorization checks pass.

---

## 3. Independently Accepted Verification Evidence

All production gates, runtime tests, and UI governance checks have been independently verified and accepted:

```text
PHASE_11_MIGRATION_SOURCE_GATE=PASS
PHASE_11_REMOTE_DATABASE=PASS
PHASE_11_STRUCTURAL_GATE=PASS
PHASE_11_SOURCE_GATE=PASS
PHASE_11_CRYPTO_GATE=PASS
PHASE_11_SECURITY_BOUNDARY_GATE=PASS

PHASE_11_PERSONAL_LIVE_PERSISTENCE=PASS
PHASE_11_PERSONAL_REVOKE_ZEROIZATION=PASS

PHASE_11_NON_ADMIN_DENY_RUNTIME=PASS
PHASE_11_ADMIN_AUTHORITY_RUNTIME=PASS
PHASE_11_ADMIN_LOOKUP_RUNTIME=PASS

PHASE_11_ADMIN_ASSIGNED_STORAGE=PASS
PHASE_11_ADMIN_ASSIGNED_USER_RESOLUTION=PASS
PHASE_11_ADMIN_ASSIGNED_REVOKE_ZEROIZATION=PASS

PHASE_11_TWO_USER_RUNTIME=PASS
PHASE_11_ADMIN_ASSIGNED_RUNTIME=PASS

PHASE_11_UI_GOVERNANCE_CORRECTIVE=PASS
PHASE_11_FINAL_UI_SMOKE=PASS

PHASE_11_OVERALL=PASS
FINORA_PHASE_11=PASS
```

### 3.1 Operational Statements
- **No Plaintext Credential Readback:** Plaintext credentials are encrypted immediately upon receipt and cannot be retrieved or read back via UI or API.
- **No Manual Database Mutation:** All runtime smoke tests and persistence validations operated through authoritative application server actions and RPCs.
- **No Real Gemini Network Calls:** Verification validated credential storage, cryptographic envelopes, resolution ordering, and administrative governance without consuming external AI quota.

---

## 4. Phase 12 Authorization

With formal closure of Phase 11, discovery and planning for Phase 12 is authorized.

```text
PHASE_11_CLOSED=true
PHASE_12_AUTHORIZED=true
```

*Note: Authorization permits Phase 12 contract discovery and architecture planning. Implementation remains blocked until the Phase 12 contract is defined and approved.*
