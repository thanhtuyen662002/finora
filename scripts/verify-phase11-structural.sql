-- ============================================================================
-- Finora Phase 11 — Structural Database Gate Verifier
-- Read-only SQL assertion script for Phase 11 schema, security, and RPCs
-- Designed to execute in Supabase SQL Editor or psql post-migration.
-- ============================================================================

DO $$
DECLARE
    v_count INT;
    v_schema_exists BOOLEAN;
    v_table_exists BOOLEAN;
    v_proconfig TEXT[];
    v_secdef BOOLEAN;
    v_fn_oid OID;
    v_sig TEXT;
BEGIN
    RAISE NOTICE '--- Starting Finora Phase 11 Structural Database Verification ---';

    -- -------------------------------------------------------------------------
    -- 0. Migration History Check: supabase_migrations.schema_migrations
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
    ) THEN
        RAISE EXCEPTION '[FAIL] Table supabase_migrations.schema_migrations does not exist';
    END IF;

    SELECT count(*) INTO v_count
    FROM supabase_migrations.schema_migrations
    WHERE version::text = '20260903110000';

    IF v_count = 0 THEN
        RAISE EXCEPTION '[FAIL] Migration 20260903110000 not found in supabase_migrations.schema_migrations';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
          AND column_name = 'name'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM supabase_migrations.schema_migrations
            WHERE version::text = '20260903110000'
              AND (name ILIKE '%phase_11%' OR name ILIKE '%ai_credentials%')
        ) THEN
            RAISE EXCEPTION '[FAIL] Migration name for 20260903110000 does not match phase_11 / ai_credentials';
        END IF;
    END IF;
    RAISE NOTICE '[PASS] Migration 20260903110000 recorded in supabase_migrations.schema_migrations';

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
    -- 6. Foreign Keys Verification
    -- -------------------------------------------------------------------------
    -- Owner FK: owner_user_id -> auth.users(id) ON DELETE CASCADE
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'f'
          AND c.confdeltype = 'c'
          AND pg_get_constraintdef(c.oid) ~* 'FOREIGN KEY.*owner_user_id.*REFERENCES auth\.users\s*\(id\).*ON DELETE CASCADE'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing foreign key owner_user_id -> auth.users(id) ON DELETE CASCADE';
    END IF;
    RAISE NOTICE '[PASS] Foreign key owner_user_id -> auth.users(id) ON DELETE CASCADE verified';

    -- Assigned By FK: assigned_by_user_id -> auth.users(id) ON DELETE SET NULL
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'f'
          AND c.confdeltype = 'n'
          AND pg_get_constraintdef(c.oid) ~* 'FOREIGN KEY.*assigned_by_user_id.*REFERENCES auth\.users\s*\(id\).*ON DELETE SET NULL'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing foreign key assigned_by_user_id -> auth.users(id) ON DELETE SET NULL';
    END IF;
    RAISE NOTICE '[PASS] Foreign key assigned_by_user_id -> auth.users(id) ON DELETE SET NULL verified';

    -- -------------------------------------------------------------------------
    -- 7. Exact Unique Slot Constraint
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*owner_user_id\s*,\s*provider\s*,\s*source\s*\)'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing exact UNIQUE (owner_user_id, provider, source) constraint';
    END IF;
    RAISE NOTICE '[PASS] Exact UNIQUE (owner_user_id, provider, source) slot constraint verified';

    -- -------------------------------------------------------------------------
    -- 8. CHECK Constraints: Source, Provider, Envelope Version
    -- -------------------------------------------------------------------------
    -- Source restriction: PERSONAL, ADMIN_ASSIGNED
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* 'source\s*(?:=\s*ANY\s*\(\s*ARRAY\s*\[\s*''PERSONAL''::text\s*,\s*''ADMIN_ASSIGNED''::text\s*\]\s*\)|IN\s*\(\s*''PERSONAL''\s*,\s*''ADMIN_ASSIGNED''\s*\))'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing CHECK constraint restricting source IN (''PERSONAL'', ''ADMIN_ASSIGNED'')';
    END IF;
    RAISE NOTICE '[PASS] Source constraint verified';

    -- Provider restriction: GEMINI
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* 'provider\s*=\s*''GEMINI'''
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing CHECK constraint restricting provider = ''GEMINI''';
    END IF;
    RAISE NOTICE '[PASS] Provider constraint verified';

    -- Envelope Version restriction: = 1
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* 'envelope_version\s*=\s*1'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing CHECK constraint restricting envelope_version = 1';
    END IF;
    RAISE NOTICE '[PASS] Envelope version constraint verified';

    -- -------------------------------------------------------------------------
    -- 9. CHECK Constraints: Provenance and Crypto-Material Integrity
    -- -------------------------------------------------------------------------
    -- Provenance CHECK
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* 'source\s*=\s*''PERSONAL''.*assigned_by_user_id\s+IS\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'source\s*=\s*''ADMIN_ASSIGNED''.*is_active\s*=\s*false.*assigned_by_user_id\s+IS\s+NOT\s+NULL'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing or invalid assignment provenance CHECK constraint';
    END IF;
    RAISE NOTICE '[PASS] Assignment provenance CHECK constraint verified';

    -- Crypto-Material Integrity CHECK (active rows have bounded key_hint BETWEEN 1 AND 4)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'private' AND t.relname = 'ai_credentials'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* 'is_active\s*=\s*true'
          AND pg_get_constraintdef(c.oid) ~* 'revoked_at\s+IS\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'octet_length\(nonce\)\s*=\s*12'
          AND pg_get_constraintdef(c.oid) ~* 'octet_length\(auth_tag\)\s*=\s*16'
          AND pg_get_constraintdef(c.oid) ~* 'key_hint.*length\(key_hint\)\s+BETWEEN\s+1\s+AND\s+4'
          AND pg_get_constraintdef(c.oid) ~* 'is_active\s*=\s*false'
          AND pg_get_constraintdef(c.oid) ~* 'revoked_at\s+IS\s+NOT\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'key_id\s+IS\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'nonce\s+IS\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'ciphertext\s+IS\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'auth_tag\s+IS\s+NULL'
          AND pg_get_constraintdef(c.oid) ~* 'key_hint\s+IS\s+NULL'
    ) THEN
        RAISE EXCEPTION '[FAIL] Missing or invalid crypto material integrity CHECK constraint';
    END IF;
    RAISE NOTICE '[PASS] Crypto material integrity CHECK constraint verified (active key_hint bounded 1-4)';

    -- -------------------------------------------------------------------------
    -- 10. RLS enabled on private.ai_credentials with zero browser policies
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
    -- 11. Privileges on private schema and table
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

    -- Verify service_role privileges on table: exactly SELECT, INSERT, UPDATE
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

    -- Explicit absence of DELETE, TRUNCATE, REFERENCES, TRIGGER for service_role
    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'private' AND table_name = 'ai_credentials'
          AND grantee = 'service_role'
          AND privilege_type IN ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    ) THEN
        RAISE EXCEPTION '[FAIL] service_role must NOT have DELETE, TRUNCATE, REFERENCES, or TRIGGER on private.ai_credentials';
    END IF;
    RAISE NOTICE '[PASS] service_role table privileges strictly limited to SELECT, INSERT, UPDATE (no DELETE/TRUNCATE/REFERENCES/TRIGGER)';

    -- -------------------------------------------------------------------------
    -- 12. RPC Facade functions in public schema (Exact Signatures and Security)
    -- -------------------------------------------------------------------------
    -- Function 1: public.ai_credentials_read_for_service(uuid, text)
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_read_for_service';

    IF v_count != 1 THEN
        RAISE EXCEPTION '[FAIL] Exactly 1 public.ai_credentials_read_for_service function must exist, found %', v_count;
    END IF;

    SELECT p.oid, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid)
    INTO v_fn_oid, v_secdef, v_proconfig, v_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_read_for_service';

    IF v_sig !~* '^p_owner_user_id uuid,\s*p_provider text.*$' AND v_sig !~* '^uuid,\s*text.*$' THEN
        RAISE EXCEPTION '[FAIL] Unexpected identity arguments for ai_credentials_read_for_service: %', v_sig;
    END IF;
    IF v_secdef THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_read_for_service must be SECURITY INVOKER';
    END IF;
    IF NOT ('search_path=' = ANY(v_proconfig) OR 'search_path=""' = ANY(v_proconfig) OR 'search_path=\'\'' = ANY(v_proconfig)) THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_read_for_service must set search_path to empty string';
    END IF;

    -- Function 2: public.ai_credentials_write_for_service(uuid, uuid, text, text, uuid, smallint, text, bytea, bytea, bytea, text)
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_write_for_service';

    IF v_count != 1 THEN
        RAISE EXCEPTION '[FAIL] Exactly 1 public.ai_credentials_write_for_service function must exist, found %', v_count;
    END IF;

    SELECT p.oid, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid)
    INTO v_fn_oid, v_secdef, v_proconfig, v_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_write_for_service';

    IF v_sig !~* 'uuid,\s*uuid,\s*text,\s*text,\s*uuid,\s*smallint,\s*text,\s*bytea,\s*bytea,\s*bytea,\s*text' THEN
        RAISE EXCEPTION '[FAIL] Unexpected identity arguments for ai_credentials_write_for_service: %', v_sig;
    END IF;
    IF v_secdef THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_write_for_service must be SECURITY INVOKER';
    END IF;
    IF NOT ('search_path=' = ANY(v_proconfig) OR 'search_path=""' = ANY(v_proconfig) OR 'search_path=\'\'' = ANY(v_proconfig)) THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_write_for_service must set search_path to empty string';
    END IF;

    -- Function 3: public.ai_credentials_revoke_for_service(uuid, text, text)
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_revoke_for_service';

    IF v_count != 1 THEN
        RAISE EXCEPTION '[FAIL] Exactly 1 public.ai_credentials_revoke_for_service function must exist, found %', v_count;
    END IF;

    SELECT p.oid, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid)
    INTO v_fn_oid, v_secdef, v_proconfig, v_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ai_credentials_revoke_for_service';

    IF v_sig !~* 'uuid,\s*text,\s*text' THEN
        RAISE EXCEPTION '[FAIL] Unexpected identity arguments for ai_credentials_revoke_for_service: %', v_sig;
    END IF;
    IF v_secdef THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_revoke_for_service must be SECURITY INVOKER';
    END IF;
    IF NOT ('search_path=' = ANY(v_proconfig) OR 'search_path=""' = ANY(v_proconfig) OR 'search_path=\'\'' = ANY(v_proconfig)) THEN
        RAISE EXCEPTION '[FAIL] public.ai_credentials_revoke_for_service must set search_path to empty string';
    END IF;
    RAISE NOTICE '[PASS] All 3 RPC facade functions exist with exact identity arguments, SECURITY INVOKER, and empty search_path';

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
    -- 13. Baseline Security Definer Hardening
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

    -- -------------------------------------------------------------------------
    -- 14. Final Deterministic Pass Marker
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'PHASE_11_STRUCTURAL_GATE=PASS';
    RAISE NOTICE '--- Finora Phase 11 Structural Database Verification: ALL CHECKS PASSED ---';
END $$;
