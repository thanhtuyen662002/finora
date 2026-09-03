-- ============================================================================
-- Finora Phase 11 — Structural Database Gate Verifier
-- Read-only SQL assertion script for Phase 11 schema, security, and RPCs
-- Designed to execute in Supabase SQL Editor or psql.
-- ============================================================================

DO $$
DECLARE
    v_count INT;
    v_schema_exists BOOLEAN;
    v_table_exists BOOLEAN;
    v_reloptions TEXT[];
    v_proconfig TEXT[];
    v_secdef BOOLEAN;
    v_fn_oid OID;
BEGIN
    RAISE NOTICE '--- Starting Finora Phase 11 Structural Database Verification ---';

    -- -------------------------------------------------------------------------
    -- 1. Schema private exists
    -- -------------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'private'
    ) INTO v_schema_exists;

    IF NOT v_schema_exists THEN
        RAISE EXCEPTION '[FAIL] Schema "private" does not exist';
    END IF;
    RAISE NOTICE '[PASS] Schema "private" exists';

    -- -------------------------------------------------------------------------
    -- 2. Schema private is NOT in public search path
    -- -------------------------------------------------------------------------
    IF current_setting('search_path') ILIKE '%private%' THEN
        RAISE EXCEPTION '[FAIL] Schema "private" must NOT be in the active search_path';
    END IF;
    RAISE NOTICE '[PASS] Schema "private" is NOT in search_path';

    -- -------------------------------------------------------------------------
    -- 3. Zero public tables for ai_credentials
    -- -------------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_credentials';

    IF v_count != 0 THEN
        RAISE EXCEPTION '[FAIL] Table public.ai_credentials must NOT exist (found %)', v_count;
    END IF;
    RAISE NOTICE '[PASS] Zero tables named public.ai_credentials';

    -- -------------------------------------------------------------------------
    -- 4. Table private.ai_credentials exists with exact 15 columns
    -- -------------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION '[FAIL] Table private.ai_credentials does not exist';
    END IF;

    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'ai_credentials';

    IF v_count != 15 THEN
        RAISE EXCEPTION '[FAIL] private.ai_credentials must have exactly 15 columns, found %', v_count;
    END IF;
    RAISE NOTICE '[PASS] private.ai_credentials exists with exactly 15 columns';

    -- Check required typed columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column id must be uuid NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'owner_user_id' AND data_type = 'uuid' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column owner_user_id must be uuid NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'source' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column source must be text NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'provider' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column provider must be text NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'assigned_by_user_id' AND data_type = 'uuid' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column assigned_by_user_id must be uuid NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'envelope_version' AND data_type = 'smallint' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column envelope_version must be smallint NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'key_id' AND data_type = 'text' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column key_id must be text NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'nonce' AND data_type = 'bytea' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column nonce must be bytea NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'ciphertext' AND data_type = 'bytea' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column ciphertext must be bytea NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'auth_tag' AND data_type = 'bytea' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column auth_tag must be bytea NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'key_hint' AND data_type = 'text' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column key_hint must be text NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'is_active' AND data_type = 'boolean' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column is_active must be boolean NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column created_at must be timestamptz NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column updated_at must be timestamptz NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name = 'revoked_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '[FAIL] Column revoked_at must be timestamptz NULL';
    END IF;
    RAISE NOTICE '[PASS] All 15 column definitions and data types verified';

    -- -------------------------------------------------------------------------
    -- 5. Zero plaintext key column names
    -- -------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND column_name ~* 'api_key|plaintext|secret_val|raw_key'
    ) THEN
        RAISE EXCEPTION '[FAIL] Prohibited plaintext column name found in private.ai_credentials';
    END IF;
    RAISE NOTICE '[PASS] Zero plaintext key columns in private.ai_credentials';

    -- -------------------------------------------------------------------------
    -- 6. RLS enabled on private.ai_credentials with zero browser policies
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'private' AND c.relname = 'ai_credentials'
          AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION '[FAIL] RLS must be enabled on private.ai_credentials';
    END IF;
    RAISE NOTICE '[PASS] RLS is enabled on private.ai_credentials';

    SELECT count(*) INTO v_count
    FROM pg_policy
    WHERE polrelid = 'private.ai_credentials'::regclass;

    IF v_count != 0 THEN
        RAISE EXCEPTION '[FAIL] private.ai_credentials must have exactly 0 policies, found %', v_count;
    END IF;
    RAISE NOTICE '[PASS] Zero policies on private.ai_credentials';

    -- -------------------------------------------------------------------------
    -- 7. Privileges on private schema and table
    -- -------------------------------------------------------------------------
    -- Verify no permissions to PUBLIC, anon, authenticated on schema private
    IF EXISTS (
        SELECT 1 FROM information_schema.usage_privileges
        WHERE object_schema = 'private'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ) THEN
        RAISE EXCEPTION '[FAIL] Schema "private" permissions must be revoked from PUBLIC, anon, authenticated';
    END IF;
    RAISE NOTICE '[PASS] Schema "private" permissions revoked from PUBLIC, anon, authenticated';

    -- Verify no table permissions to PUBLIC, anon, authenticated on private.ai_credentials
    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ) THEN
        RAISE EXCEPTION '[FAIL] Table private.ai_credentials permissions must be revoked from PUBLIC, anon, authenticated';
    END IF;
    RAISE NOTICE '[PASS] Table private.ai_credentials permissions revoked from PUBLIC, anon, authenticated';

    -- Verify service_role privileges on table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND grantee = 'service_role' AND privilege_type = 'SELECT'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND grantee = 'service_role' AND privilege_type = 'INSERT'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND grantee = 'service_role' AND privilege_type = 'UPDATE'
    ) THEN
        RAISE EXCEPTION '[FAIL] service_role must have SELECT, INSERT, UPDATE on private.ai_credentials';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND grantee = 'service_role' AND privilege_type IN ('DELETE', 'TRUNCATE')
    ) THEN
        RAISE EXCEPTION '[FAIL] service_role must NOT have DELETE or TRUNCATE on private.ai_credentials';
    END IF;
    RAISE NOTICE '[PASS] service_role table privileges strictly limited to SELECT, INSERT, UPDATE';

    -- -------------------------------------------------------------------------
    -- 8. RPC Facade functions in public schema
    -- -------------------------------------------------------------------------
    -- Function 1: public.ai_credentials_read_for_service
    SELECT p.oid, p.prosecdef, p.proconfig
    INTO v_fn_oid, v_secdef, v_proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_read_for_service';

    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_read_for_service does not exist';
    END IF;
    IF v_secdef THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_read_for_service must be SECURITY INVOKER';
    END IF;
    IF NOT ('search_path=' = ANY(v_proconfig) OR 'search_path=""' = ANY(v_proconfig) OR 'search_path=\'\'' = ANY(v_proconfig)) THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_read_for_service must set search_path to empty string';
    END IF;

    -- Function 2: public.ai_credentials_write_for_service
    SELECT p.oid, p.prosecdef, p.proconfig
    INTO v_fn_oid, v_secdef, v_proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_write_for_service';

    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_write_for_service does not exist';
    END IF;
    IF v_secdef THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_write_for_service must be SECURITY INVOKER';
    END IF;
    IF NOT ('search_path=' = ANY(v_proconfig) OR 'search_path=""' = ANY(v_proconfig) OR 'search_path=\'\'' = ANY(v_proconfig)) THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_write_for_service must set search_path to empty string';
    END IF;

    -- Function 3: public.ai_credentials_revoke_for_service
    SELECT p.oid, p.prosecdef, p.proconfig
    INTO v_fn_oid, v_secdef, v_proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_revoke_for_service';

    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_revoke_for_service does not exist';
    END IF;
    IF v_secdef THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_revoke_for_service must be SECURITY INVOKER';
    END IF;
    IF NOT ('search_path=' = ANY(v_proconfig) OR 'search_path=""' = ANY(v_proconfig) OR 'search_path=\'\'' = ANY(v_proconfig)) THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_revoke_for_service must set search_path to empty string';
    END IF;
    RAISE NOTICE '[PASS] All 3 RPC facade functions exist with SECURITY INVOKER and empty search_path';

    -- Verify RPC EXECUTE permissions: revoked from PUBLIC, anon, authenticated; granted to service_role
    IF EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name IN (
              'ai_credentials_read_for_service',
              'ai_credentials_write_for_service',
              'ai_credentials_revoke_for_service'
          )
          AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ) THEN
        RAISE EXCEPTION '[FAIL] RPC execution permissions must be revoked from PUBLIC, anon, authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name = 'ai_credentials_read_for_service'
          AND grantee = 'service_role' AND privilege_type = 'EXECUTE'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name = 'ai_credentials_write_for_service'
          AND grantee = 'service_role' AND privilege_type = 'EXECUTE'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name = 'ai_credentials_revoke_for_service'
          AND grantee = 'service_role' AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION '[FAIL] RPC execution must be granted to service_role';
    END IF;
    RAISE NOTICE '[PASS] RPC execute privileges strictly granted to service_role only';

    -- -------------------------------------------------------------------------
    -- 9. Baseline Security Definer Hardening
    -- -------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name IN ('handle_new_user', 'rls_auto_enable')
          AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ) THEN
        RAISE EXCEPTION '[FAIL] Baseline security definer functions must have EXECUTE revoked from browser roles';
    END IF;
    RAISE NOTICE '[PASS] Baseline security definer functions revoked from browser roles';

    RAISE NOTICE '--- Finora Phase 11 Structural Database Verification: ALL CHECKS PASSED ---';
END $$;
