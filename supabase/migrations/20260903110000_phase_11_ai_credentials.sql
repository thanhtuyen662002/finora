-- Finora Phase 11 — AI Credentials Storage Migration
-- Architecture: PRIVATE_SCHEMA_APPLICATION_AES_256_GCM_SERVICE_ROLE_RPC
-- Target schema: private
-- Target table: private.ai_credentials
-- Public facade: service_role-only RPCs with explicit scalar types and SECURITY INVOKER
-- Status: UNAPPLIED (Pass A - Source Only)

-- 1. Create unexposed private schema
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- 2. Safe default privileges for future objects in schema private
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  GRANT SELECT, INSERT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON ROUTINES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- 3. Create typed private.ai_credentials table
CREATE TABLE private.ai_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('PERSONAL', 'ADMIN_ASSIGNED')),
  provider text NOT NULL DEFAULT 'GEMINI' CHECK (provider = 'GEMINI'),
  assigned_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  envelope_version smallint NOT NULL CHECK (envelope_version = 1),
  key_id text NULL,
  nonce bytea NULL,
  ciphertext bytea NULL,
  auth_tag bytea NULL,
  key_hint text NULL,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz NULL,

  -- Unique slot per user, provider, and source
  CONSTRAINT uq_ai_credentials_slot UNIQUE (owner_user_id, provider, source),

  -- Assignment provenance CHECK constraint
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

  -- Cryptographic material integrity CHECK constraint
  CONSTRAINT chk_ai_credentials_crypto_material CHECK (
    (
      is_active = true
      AND revoked_at IS NULL
      AND key_id IS NOT NULL AND length(btrim(key_id)) > 0
      AND nonce IS NOT NULL AND octet_length(nonce) = 12
      AND ciphertext IS NOT NULL AND octet_length(ciphertext) > 0
      AND auth_tag IS NOT NULL AND octet_length(auth_tag) = 16
      AND key_hint IS NOT NULL AND length(key_hint) BETWEEN 1 AND 4
    )
    OR
    (
      is_active = false
      AND revoked_at IS NOT NULL
      AND key_id IS NULL
      AND nonce IS NULL
      AND ciphertext IS NULL
      AND auth_tag IS NULL
      AND key_hint IS NULL
    )
  )
);

-- 4. Enable RLS on private.ai_credentials with zero browser policies
ALTER TABLE private.ai_credentials ENABLE ROW LEVEL SECURITY;

-- 5. Revoke browser privileges and grant minimal privileges to service_role
REVOKE ALL ON TABLE private.ai_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.ai_credentials TO service_role;

-- 6. Service-Role RPC Facade in public schema

-- 6a. Read active credentials for service_role
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
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.owner_user_id,
    c.source,
    c.provider,
    c.assigned_by_user_id,
    c.envelope_version,
    c.key_id,
    c.nonce,
    c.ciphertext,
    c.auth_tag,
    c.key_hint,
    c.is_active,
    c.created_at,
    c.updated_at,
    c.revoked_at
  FROM private.ai_credentials AS c
  WHERE c.owner_user_id = p_owner_user_id
    AND c.provider = p_provider
    AND c.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_credentials_read_for_service(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credentials_read_for_service(uuid, text) TO service_role;

-- 6b. Write encrypted credential for service_role
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
    id,
    owner_user_id,
    source,
    provider,
    assigned_by_user_id,
    envelope_version,
    key_id,
    nonce,
    ciphertext,
    auth_tag,
    key_hint,
    is_active,
    created_at,
    updated_at,
    revoked_at
  )
  VALUES (
    p_id,
    p_owner_user_id,
    p_source,
    p_provider,
    p_assigned_by_user_id,
    p_envelope_version,
    p_key_id,
    p_nonce,
    p_ciphertext,
    p_auth_tag,
    p_key_hint,
    true,
    pg_catalog.now(),
    pg_catalog.now(),
    NULL
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

REVOKE ALL ON FUNCTION public.ai_credentials_write_for_service(uuid, uuid, text, text, uuid, smallint, text, bytea, bytea, bytea, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credentials_write_for_service(uuid, uuid, text, text, uuid, smallint, text, bytea, bytea, bytea, text) TO service_role;

-- 6c. Revoke credential for service_role
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
    key_id = NULL,
    nonce = NULL,
    ciphertext = NULL,
    auth_tag = NULL,
    key_hint = NULL
  WHERE owner_user_id = p_owner_user_id
    AND source = p_source
    AND provider = p_provider
    AND is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_credentials_revoke_for_service(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credentials_revoke_for_service(uuid, text, text) TO service_role;

-- 7. Existing SECURITY DEFINER ACL Hardening
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
