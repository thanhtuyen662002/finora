-- ============================================================================
-- Finora Phase 9 — Structural Database Gate Verifier
-- Fail-closed assertion script for Phase 9 schema, security, and triggers
-- ============================================================================

DO $$
DECLARE
    v_count INT;
    v_def TEXT;
    v_col_order TEXT[];
    v_expected_order TEXT[];
    v_reloptions TEXT[];
    v_proconfig TEXT[];
    v_auth_role_oid OID;
    v_keys TEXT[];
    v_local_keys TEXT[];
    v_ref_keys TEXT[];
    v_pol_qual TEXT;
    v_pol_check TEXT;
    v_pol_roles OID[];
    v_norm TEXT;
    v_rec RECORD;
BEGIN
    -- -------------------------------------------------------------------------
    -- 0. Resolve Role OID
    -- -------------------------------------------------------------------------
    SELECT oid INTO v_auth_role_oid FROM pg_roles WHERE rolname = 'authenticated';
    IF v_auth_role_oid IS NULL THEN
        RAISE EXCEPTION 'authenticated role not found in pg_roles';
    END IF;

    -- -------------------------------------------------------------------------
    -- 1. Table & Column Structure: income_sources (exact 7 columns)
    -- -------------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'income_sources';

    IF v_count != 7 THEN
        RAISE EXCEPTION 'income_sources must have exactly 7 columns, found %', v_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO'
          AND column_default ILIKE '%gen_random_uuid%'
    ) THEN
        RAISE EXCEPTION 'income_sources.id must be uuid NOT NULL DEFAULT gen_random_uuid()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO'
          AND column_default ILIKE '%auth.uid%'
    ) THEN
        RAISE EXCEPTION 'income_sources.user_id must be uuid NOT NULL DEFAULT auth.uid()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'name' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'income_sources.name must be text NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'type' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'income_sources.type must be text NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'is_archived' AND data_type = 'boolean' AND is_nullable = 'NO'
          AND column_default ILIKE '%false%'
    ) THEN
        RAISE EXCEPTION 'income_sources.is_archived must be boolean NOT NULL DEFAULT false';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
          AND (column_default ILIKE '%now%' OR column_default ILIKE '%current_timestamp%')
    ) THEN
        RAISE EXCEPTION 'income_sources.created_at must be timestamptz NOT NULL DEFAULT now()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_sources'
          AND column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
          AND (column_default ILIKE '%now%' OR column_default ILIKE '%current_timestamp%')
    ) THEN
        RAISE EXCEPTION 'income_sources.updated_at must be timestamptz NOT NULL DEFAULT now()';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Table & Column Structure: income_source_streams (exact 7 columns)
    -- -------------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'income_source_streams';

    IF v_count != 7 THEN
        RAISE EXCEPTION 'income_source_streams must have exactly 7 columns, found %', v_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO'
          AND column_default ILIKE '%gen_random_uuid%'
    ) THEN
        RAISE EXCEPTION 'income_source_streams.id must be uuid NOT NULL DEFAULT gen_random_uuid()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO'
          AND column_default ILIKE '%auth.uid%'
    ) THEN
        RAISE EXCEPTION 'income_source_streams.user_id must be uuid NOT NULL DEFAULT auth.uid()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'income_source_id' AND data_type = 'uuid' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'income_source_streams.income_source_id must be uuid NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'name' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'income_source_streams.name must be text NOT NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'is_archived' AND data_type = 'boolean' AND is_nullable = 'NO'
          AND column_default ILIKE '%false%'
    ) THEN
        RAISE EXCEPTION 'income_source_streams.is_archived must be boolean NOT NULL DEFAULT false';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
          AND (column_default ILIKE '%now%' OR column_default ILIKE '%current_timestamp%')
    ) THEN
        RAISE EXCEPTION 'income_source_streams.created_at must be timestamptz NOT NULL DEFAULT now()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'income_source_streams'
          AND column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
          AND (column_default ILIKE '%now%' OR column_default ILIKE '%current_timestamp%')
    ) THEN
        RAISE EXCEPTION 'income_source_streams.updated_at must be timestamptz NOT NULL DEFAULT now()';
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. Transactions Extension
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions'
          AND column_name = 'income_source_id' AND data_type = 'uuid' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION 'transactions.income_source_id must be uuid nullable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions'
          AND column_name = 'income_source_stream_id' AND data_type = 'uuid' AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION 'transactions.income_source_stream_id must be uuid nullable';
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. Effective Table Privileges
    -- -------------------------------------------------------------------------
    -- Authenticated: SELECT=true, all other table privileges=false
    IF NOT has_table_privilege('authenticated', 'public.income_sources', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated must have table-level SELECT on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'INSERT') OR
       has_table_privilege('authenticated', 'public.income_sources', 'UPDATE') OR
       has_table_privilege('authenticated', 'public.income_sources', 'DELETE') OR
       has_table_privilege('authenticated', 'public.income_sources', 'TRUNCATE') OR
       has_table_privilege('authenticated', 'public.income_sources', 'REFERENCES') OR
       has_table_privilege('authenticated', 'public.income_sources', 'TRIGGER') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER on public.income_sources';
    END IF;

    -- income_source_streams table privileges
    IF NOT has_table_privilege('authenticated', 'public.income_source_streams', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated must have table-level SELECT on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'INSERT') OR
       has_table_privilege('authenticated', 'public.income_source_streams', 'UPDATE') OR
       has_table_privilege('authenticated', 'public.income_source_streams', 'DELETE') OR
       has_table_privilege('authenticated', 'public.income_source_streams', 'TRUNCATE') OR
       has_table_privilege('authenticated', 'public.income_source_streams', 'REFERENCES') OR
       has_table_privilege('authenticated', 'public.income_source_streams', 'TRIGGER') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER on public.income_source_streams';
    END IF;

    -- public.transactions table privileges (Fail-closed table mutation authority)
    IF NOT has_table_privilege('authenticated', 'public.transactions', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated must have table-level SELECT on public.transactions';
    END IF;

    IF has_table_privilege('authenticated', 'public.transactions', 'INSERT') OR
       has_table_privilege('authenticated', 'public.transactions', 'UPDATE') OR
       has_table_privilege('authenticated', 'public.transactions', 'DELETE') OR
       has_table_privilege('authenticated', 'public.transactions', 'TRUNCATE') OR
       has_table_privilege('authenticated', 'public.transactions', 'REFERENCES') OR
       has_table_privilege('authenticated', 'public.transactions', 'TRIGGER') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER on public.transactions';
    END IF;

    -- Anon: all table privileges must be FALSE on both tables
    IF has_table_privilege('anon', 'public.income_sources', 'SELECT') OR
       has_table_privilege('anon', 'public.income_sources', 'INSERT') OR
       has_table_privilege('anon', 'public.income_sources', 'UPDATE') OR
       has_table_privilege('anon', 'public.income_sources', 'DELETE') OR
       has_table_privilege('anon', 'public.income_sources', 'TRUNCATE') OR
       has_table_privilege('anon', 'public.income_sources', 'REFERENCES') OR
       has_table_privilege('anon', 'public.income_sources', 'TRIGGER') THEN
        RAISE EXCEPTION 'anon must have NO privileges on public.income_sources';
    END IF;

    IF has_table_privilege('anon', 'public.income_source_streams', 'SELECT') OR
       has_table_privilege('anon', 'public.income_source_streams', 'INSERT') OR
       has_table_privilege('anon', 'public.income_source_streams', 'UPDATE') OR
       has_table_privilege('anon', 'public.income_source_streams', 'DELETE') OR
       has_table_privilege('anon', 'public.income_source_streams', 'TRUNCATE') OR
       has_table_privilege('anon', 'public.income_source_streams', 'REFERENCES') OR
       has_table_privilege('anon', 'public.income_source_streams', 'TRIGGER') THEN
        RAISE EXCEPTION 'anon must have NO privileges on public.income_source_streams';
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Effective Column Privileges
    -- -------------------------------------------------------------------------
    -- income_sources column INSERT allowlist: name, type ONLY
    IF NOT has_column_privilege('authenticated', 'public.income_sources', 'name', 'INSERT') OR
       NOT has_column_privilege('authenticated', 'public.income_sources', 'type', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must have column INSERT on income_sources(name, type)';
    END IF;

    IF has_column_privilege('authenticated', 'public.income_sources', 'user_id', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_sources', 'id', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_sources', 'is_archived', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_sources', 'created_at', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_sources', 'updated_at', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must NOT have column INSERT on income_sources non-allowlisted columns';
    END IF;

    -- income_sources column UPDATE allowlist: name, type, is_archived ONLY
    IF NOT has_column_privilege('authenticated', 'public.income_sources', 'name', 'UPDATE') OR
       NOT has_column_privilege('authenticated', 'public.income_sources', 'type', 'UPDATE') OR
       NOT has_column_privilege('authenticated', 'public.income_sources', 'is_archived', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must have column UPDATE on income_sources(name, type, is_archived)';
    END IF;

    IF has_column_privilege('authenticated', 'public.income_sources', 'user_id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_sources', 'id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_sources', 'created_at', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_sources', 'updated_at', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have column UPDATE on income_sources non-allowlisted columns';
    END IF;

    -- income_source_streams column INSERT allowlist: income_source_id, name ONLY
    IF NOT has_column_privilege('authenticated', 'public.income_source_streams', 'income_source_id', 'INSERT') OR
       NOT has_column_privilege('authenticated', 'public.income_source_streams', 'name', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must have column INSERT on income_source_streams(income_source_id, name)';
    END IF;

    IF has_column_privilege('authenticated', 'public.income_source_streams', 'user_id', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'id', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'is_archived', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'created_at', 'INSERT') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'updated_at', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must NOT have column INSERT on income_source_streams non-allowlisted columns';
    END IF;

    -- income_source_streams column UPDATE allowlist: name, is_archived ONLY
    IF NOT has_column_privilege('authenticated', 'public.income_source_streams', 'name', 'UPDATE') OR
       NOT has_column_privilege('authenticated', 'public.income_source_streams', 'is_archived', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must have column UPDATE on income_source_streams(name, is_archived)';
    END IF;

    IF has_column_privilege('authenticated', 'public.income_source_streams', 'income_source_id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'user_id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'created_at', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.income_source_streams', 'updated_at', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have column UPDATE on income_source_streams non-allowlisted columns';
    END IF;

    -- public.transactions column INSERT & UPDATE on new attribution columns
    IF NOT has_column_privilege('authenticated', 'public.transactions', 'income_source_id', 'INSERT') OR
       NOT has_column_privilege('authenticated', 'public.transactions', 'income_source_stream_id', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must have column INSERT on transactions(income_source_id, income_source_stream_id)';
    END IF;

    IF NOT has_column_privilege('authenticated', 'public.transactions', 'income_source_id', 'UPDATE') OR
       NOT has_column_privilege('authenticated', 'public.transactions', 'income_source_stream_id', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must have column UPDATE on transactions(income_source_id, income_source_stream_id)';
    END IF;

    -- Negative checks on transactions system / non-allowlisted columns
    IF has_column_privilege('authenticated', 'public.transactions', 'id', 'INSERT') OR
       has_column_privilege('authenticated', 'public.transactions', 'created_at', 'INSERT') OR
       has_column_privilege('authenticated', 'public.transactions', 'updated_at', 'INSERT') OR
       has_column_privilege('authenticated', 'public.transactions', 'id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.transactions', 'user_id', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.transactions', 'created_at', 'UPDATE') OR
       has_column_privilege('authenticated', 'public.transactions', 'updated_at', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have column INSERT/UPDATE on transactions non-allowlisted/system columns';
    END IF;

    -- -------------------------------------------------------------------------
    -- 6. Row Level Security (RLS) & Policies Exact Matrix
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'income_sources' AND relnamespace = 'public'::regnamespace
          AND relrowsecurity = TRUE AND relforcerowsecurity = FALSE
    ) THEN
        RAISE EXCEPTION 'public.income_sources must have relrowsecurity = TRUE and relforcerowsecurity = FALSE';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'income_source_streams' AND relnamespace = 'public'::regnamespace
          AND relrowsecurity = TRUE AND relforcerowsecurity = FALSE
    ) THEN
        RAISE EXCEPTION 'public.income_source_streams must have relrowsecurity = TRUE and relforcerowsecurity = FALSE';
    END IF;

    -- income_sources policy count & command matrix
    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_sources'::regclass;
    IF v_count != 3 THEN
        RAISE EXCEPTION 'income_sources must have exactly 3 policies, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'r';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'income_sources must have exactly 1 SELECT (polcmd=r) policy, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'a';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'income_sources must have exactly 1 INSERT (polcmd=a) policy, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'w';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'income_sources must have exactly 1 UPDATE (polcmd=w) policy, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_sources'::regclass AND polcmd IN ('d', '*');
    IF v_count != 0 THEN
        RAISE EXCEPTION 'income_sources must have 0 DELETE or ALL policies, found %', v_count;
    END IF;

    -- income_sources exact policy roles & expressions
    -- SELECT
    SELECT polroles, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_pol_roles, v_pol_qual, v_pol_check
    FROM pg_policy
    WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'r';

    IF v_pol_roles != ARRAY[v_auth_role_oid] THEN
        RAISE EXCEPTION 'income_sources SELECT policy roles must be exactly [authenticated], got: %', v_pol_roles;
    END IF;
    IF v_pol_qual IS NULL OR v_pol_check IS NOT NULL THEN
        RAISE EXCEPTION 'income_sources SELECT policy must have ownership polqual and NULL polwithcheck, got qual=%, check=%', v_pol_qual, v_pol_check;
    END IF;
    v_norm := lower(regexp_replace(v_pol_qual, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_qual ILIKE '% or %' OR v_pol_qual ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_sources SELECT policy must strictly be canonical ownership expression only, got: %', v_pol_qual;
    END IF;

    -- INSERT
    SELECT polroles, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_pol_roles, v_pol_qual, v_pol_check
    FROM pg_policy
    WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'a';

    IF v_pol_roles != ARRAY[v_auth_role_oid] THEN
        RAISE EXCEPTION 'income_sources INSERT policy roles must be exactly [authenticated], got: %', v_pol_roles;
    END IF;
    IF v_pol_qual IS NOT NULL OR v_pol_check IS NULL THEN
        RAISE EXCEPTION 'income_sources INSERT policy must have NULL polqual and ownership polwithcheck, got qual=%, check=%', v_pol_qual, v_pol_check;
    END IF;
    v_norm := lower(regexp_replace(v_pol_check, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_check ILIKE '% or %' OR v_pol_check ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_sources INSERT policy must strictly be canonical ownership expression only, got: %', v_pol_check;
    END IF;

    -- UPDATE
    SELECT polroles, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_pol_roles, v_pol_qual, v_pol_check
    FROM pg_policy
    WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'w';

    IF v_pol_roles != ARRAY[v_auth_role_oid] THEN
        RAISE EXCEPTION 'income_sources UPDATE policy roles must be exactly [authenticated], got: %', v_pol_roles;
    END IF;
    IF v_pol_qual IS NULL OR v_pol_check IS NULL THEN
        RAISE EXCEPTION 'income_sources UPDATE policy must have ownership polqual and ownership polwithcheck, got qual=%, check=%', v_pol_qual, v_pol_check;
    END IF;
    v_norm := lower(regexp_replace(v_pol_qual, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_qual ILIKE '% or %' OR v_pol_qual ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_sources UPDATE USING policy must strictly be canonical ownership expression only, got: %', v_pol_qual;
    END IF;
    v_norm := lower(regexp_replace(v_pol_check, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_check ILIKE '% or %' OR v_pol_check ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_sources UPDATE WITH CHECK policy must strictly be canonical ownership expression only, got: %', v_pol_check;
    END IF;

    -- income_source_streams policy count & command matrix
    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_source_streams'::regclass;
    IF v_count != 3 THEN
        RAISE EXCEPTION 'income_source_streams must have exactly 3 policies, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'r';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'income_source_streams must have exactly 1 SELECT (polcmd=r) policy, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'a';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'income_source_streams must have exactly 1 INSERT (polcmd=a) policy, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'w';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'income_source_streams must have exactly 1 UPDATE (polcmd=w) policy, found %', v_count;
    END IF;

    SELECT count(*) INTO v_count FROM pg_policy WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd IN ('d', '*');
    IF v_count != 0 THEN
        RAISE EXCEPTION 'income_source_streams must have 0 DELETE or ALL policies, found %', v_count;
    END IF;

    -- income_source_streams exact policy roles & expressions
    -- SELECT
    SELECT polroles, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_pol_roles, v_pol_qual, v_pol_check
    FROM pg_policy
    WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'r';

    IF v_pol_roles != ARRAY[v_auth_role_oid] THEN
        RAISE EXCEPTION 'income_source_streams SELECT policy roles must be exactly [authenticated], got: %', v_pol_roles;
    END IF;
    IF v_pol_qual IS NULL OR v_pol_check IS NOT NULL THEN
        RAISE EXCEPTION 'income_source_streams SELECT policy must have ownership polqual and NULL polwithcheck, got qual=%, check=%', v_pol_qual, v_pol_check;
    END IF;
    v_norm := lower(regexp_replace(v_pol_qual, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_qual ILIKE '% or %' OR v_pol_qual ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_source_streams SELECT policy must strictly be canonical ownership expression only, got: %', v_pol_qual;
    END IF;

    -- INSERT
    SELECT polroles, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_pol_roles, v_pol_qual, v_pol_check
    FROM pg_policy
    WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'a';

    IF v_pol_roles != ARRAY[v_auth_role_oid] THEN
        RAISE EXCEPTION 'income_source_streams INSERT policy roles must be exactly [authenticated], got: %', v_pol_roles;
    END IF;
    IF v_pol_qual IS NOT NULL OR v_pol_check IS NULL THEN
        RAISE EXCEPTION 'income_source_streams INSERT policy must have NULL polqual and ownership polwithcheck, got qual=%, check=%', v_pol_qual, v_pol_check;
    END IF;
    v_norm := lower(regexp_replace(v_pol_check, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_check ILIKE '% or %' OR v_pol_check ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_source_streams INSERT policy must strictly be canonical ownership expression only, got: %', v_pol_check;
    END IF;

    -- UPDATE
    SELECT polroles, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_pol_roles, v_pol_qual, v_pol_check
    FROM pg_policy
    WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'w';

    IF v_pol_roles != ARRAY[v_auth_role_oid] THEN
        RAISE EXCEPTION 'income_source_streams UPDATE policy roles must be exactly [authenticated], got: %', v_pol_roles;
    END IF;
    IF v_pol_qual IS NULL OR v_pol_check IS NULL THEN
        RAISE EXCEPTION 'income_source_streams UPDATE policy must have ownership polqual and ownership polwithcheck, got qual=%, check=%', v_pol_qual, v_pol_check;
    END IF;
    v_norm := lower(regexp_replace(v_pol_qual, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_qual ILIKE '% or %' OR v_pol_qual ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_source_streams UPDATE USING policy must strictly be canonical ownership expression only, got: %', v_pol_qual;
    END IF;
    v_norm := lower(regexp_replace(v_pol_check, '\s+', '', 'g'));
    v_norm := regexp_replace(v_norm, '[\(\)]', '', 'g');
    IF v_norm NOT IN (
        'selectauth.uid()asuid=user_id',
        'selectauth.uid()=user_id',
        'auth.uid()=user_id',
        'user_id=selectauth.uid()asuid',
        'user_id=selectauth.uid()',
        'user_id=auth.uid()'
    ) OR v_pol_check ILIKE '% or %' OR v_pol_check ILIKE '% and %' THEN
        RAISE EXCEPTION 'income_source_streams UPDATE WITH CHECK policy must strictly be canonical ownership expression only, got: %', v_pol_check;
    END IF;

    -- -------------------------------------------------------------------------
    -- 7. Exact Composite UNIQUE and Foreign Keys
    -- -------------------------------------------------------------------------
    -- Unique constraint on income_sources(id, user_id) in exact order
    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.income_sources'::regclass
      AND c.contype = 'u'
      AND c.conname = 'income_sources_id_user_id_key';

    IF v_keys != ARRAY['id', 'user_id'] THEN
        RAISE EXCEPTION 'income_sources_id_user_id_key must have exact column order (id, user_id), found: %', v_keys;
    END IF;

    -- Unique constraint on income_source_streams(id, income_source_id, user_id) in exact order
    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.income_source_streams'::regclass
      AND c.contype = 'u'
      AND c.conname = 'income_source_streams_id_income_source_id_user_id_key';

    IF v_keys != ARRAY['id', 'income_source_id', 'user_id'] THEN
        RAISE EXCEPTION 'income_source_streams_id_income_source_id_user_id_key must have exact column order (id, income_source_id, user_id), found: %', v_keys;
    END IF;

    -- Foreign Key 1: income_source_streams_parent_fkey
    -- Local: (income_source_id, user_id), Ref: (id, user_id), Ref table: public.income_sources, ON DELETE RESTRICT
    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_local_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.income_source_streams'::regclass
      AND c.conname = 'income_source_streams_parent_fkey'
      AND c.contype = 'f'
      AND c.confrelid = 'public.income_sources'::regclass
      AND c.confdeltype = 'r';

    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_ref_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.income_source_streams'::regclass
      AND c.conname = 'income_source_streams_parent_fkey';

    IF v_local_keys != ARRAY['income_source_id', 'user_id'] OR v_ref_keys != ARRAY['id', 'user_id'] THEN
        RAISE EXCEPTION 'income_source_streams_parent_fkey key mismatch. Local: %, Ref: %', v_local_keys, v_ref_keys;
    END IF;

    -- Foreign Key 2: transactions_income_source_fkey
    -- Local: (income_source_id, user_id), Ref: (id, user_id), Ref table: public.income_sources, ON DELETE RESTRICT
    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_local_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.transactions'::regclass
      AND c.conname = 'transactions_income_source_fkey'
      AND c.contype = 'f'
      AND c.confrelid = 'public.income_sources'::regclass
      AND c.confdeltype = 'r';

    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_ref_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.transactions'::regclass
      AND c.conname = 'transactions_income_source_fkey';

    IF v_local_keys != ARRAY['income_source_id', 'user_id'] OR v_ref_keys != ARRAY['id', 'user_id'] THEN
        RAISE EXCEPTION 'transactions_income_source_fkey key mismatch. Local: %, Ref: %', v_local_keys, v_ref_keys;
    END IF;

    -- Foreign Key 3: transactions_income_source_stream_fkey
    -- Local: (income_source_stream_id, income_source_id, user_id), Ref: (id, income_source_id, user_id), Ref table: public.income_source_streams, ON DELETE RESTRICT
    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_local_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.transactions'::regclass
      AND c.conname = 'transactions_income_source_stream_fkey'
      AND c.contype = 'f'
      AND c.confrelid = 'public.income_source_streams'::regclass
      AND c.confdeltype = 'r';

    SELECT array_agg(a.attname ORDER BY k.ord) INTO v_ref_keys
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.transactions'::regclass
      AND c.conname = 'transactions_income_source_stream_fkey';

    IF v_local_keys != ARRAY['income_source_stream_id', 'income_source_id', 'user_id'] OR
       v_ref_keys != ARRAY['id', 'income_source_id', 'user_id'] THEN
        RAISE EXCEPTION 'transactions_income_source_stream_fkey key mismatch. Local: %, Ref: %', v_local_keys, v_ref_keys;
    END IF;

    -- -------------------------------------------------------------------------
    -- 8. CHECK Constraints Proof
    -- -------------------------------------------------------------------------
    -- check_income_source_name_length: length/char_length of trim(name) between 1 and 200
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.income_sources'::regclass AND conname = 'check_income_source_name_length';

    IF v_def IS NULL OR v_def NOT ILIKE '%name%' OR
       NOT (
           (v_def ILIKE '%BETWEEN 1 AND 200%') OR
           (v_def ILIKE '%>= 1%' AND v_def ILIKE '%<= 200%')
       ) THEN
        RAISE EXCEPTION 'check_income_source_name_length missing or malformed: %', v_def;
    END IF;

    -- check_income_source_type: exactly the 5 allowed types (FREELANCE, INVESTMENT, OTHER, SALARY, YOUTUBE)
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.income_sources'::regclass AND conname = 'check_income_source_type';

    IF v_def IS NULL OR v_def NOT ILIKE '%type%' THEN
        RAISE EXCEPTION 'check_income_source_type missing or does not reference type: %', v_def;
    END IF;

    SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_keys
    FROM (
        SELECT regexp_matches(v_def, '''([A-Z0-9_]+)''', 'g') AS m
    ) sub;

    IF v_keys != ARRAY['FREELANCE', 'INVESTMENT', 'OTHER', 'SALARY', 'YOUTUBE'] THEN
        RAISE EXCEPTION 'check_income_source_type must match exact set (FREELANCE, INVESTMENT, OTHER, SALARY, YOUTUBE) with no extra values, found: %', v_keys;
    END IF;

    -- check_income_source_stream_name_length: length/char_length of trim(name) between 1 and 200
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.income_source_streams'::regclass AND conname = 'check_income_source_stream_name_length';

    IF v_def IS NULL OR v_def NOT ILIKE '%name%' OR
       NOT (
           (v_def ILIKE '%BETWEEN 1 AND 200%') OR
           (v_def ILIKE '%>= 1%' AND v_def ILIKE '%<= 200%')
       ) THEN
        RAISE EXCEPTION 'check_income_source_stream_name_length missing or malformed: %', v_def;
    END IF;

    -- check_transaction_expense_no_attribution: EXPENSE requires NULL attribution, INCOME allowed
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'check_transaction_expense_no_attribution';

    IF v_def IS NULL OR
       v_def NOT ILIKE '%EXPENSE%' OR
       v_def NOT ILIKE '%income_source_id IS NULL%' OR
       v_def NOT ILIKE '%income_source_stream_id IS NULL%' OR
       v_def NOT ILIKE '%INCOME%' THEN
        RAISE EXCEPTION 'check_transaction_expense_no_attribution missing or malformed: %', v_def;
    END IF;

    -- check_transaction_stream_requires_source: stream requires source
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'check_transaction_stream_requires_source';

    IF v_def IS NULL OR
       v_def NOT ILIKE '%income_source_stream_id IS NULL%' OR
       v_def NOT ILIKE '%income_source_id IS NOT NULL%' THEN
        RAISE EXCEPTION 'check_transaction_stream_requires_source missing or malformed: %', v_def;
    END IF;

    -- -------------------------------------------------------------------------
    -- 9. Triggers: Updated-At & Active Attribution Function Binding & Properties
    -- -------------------------------------------------------------------------
    -- set_income_sources_updated_at: BEFORE (2), UPDATE (16), ROW (1), handle_updated_at()
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.income_sources'::regclass
          AND tgname = 'set_income_sources_updated_at'
          AND (tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 16 = 16)
          AND tgfoid = 'public.handle_updated_at()'::regprocedure
    ) THEN
        RAISE EXCEPTION 'set_income_sources_updated_at trigger missing, wrong bitmask, or wrong function binding';
    END IF;

    -- set_income_source_streams_updated_at: BEFORE (2), UPDATE (16), ROW (1), handle_updated_at()
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.income_source_streams'::regclass
          AND tgname = 'set_income_source_streams_updated_at'
          AND (tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 16 = 16)
          AND tgfoid = 'public.handle_updated_at()'::regprocedure
    ) THEN
        RAISE EXCEPTION 'set_income_source_streams_updated_at trigger missing, wrong bitmask, or wrong function binding';
    END IF;

    -- check_transaction_attribution_active_trigger: BEFORE (2), INSERT (4), UPDATE (16), ROW (1), check_transaction_attribution_active()
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.transactions'::regclass
          AND tgname = 'check_transaction_attribution_active_trigger'
          AND (tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 4 = 4) AND (tgtype & 16 = 16)
          AND tgfoid = 'public.check_transaction_attribution_active()'::regprocedure
    ) THEN
        RAISE EXCEPTION 'check_transaction_attribution_active_trigger missing, wrong bitmask, or wrong function binding';
    END IF;

    -- check_transaction_attribution_active function security & empty search_path
    SELECT proconfig INTO v_proconfig
    FROM pg_proc
    WHERE oid = 'public.check_transaction_attribution_active()'::regprocedure
      AND pronamespace = 'public'::regnamespace
      AND pronargs = 0
      AND prosecdef = FALSE; -- SECURITY INVOKER

    IF NOT FOUND THEN
        RAISE EXCEPTION 'check_transaction_attribution_active function must exist with 0 args in public schema and have SECURITY INVOKER (prosecdef=FALSE)';
    END IF;

    IF v_proconfig IS NULL OR NOT (
        'search_path=""' = ANY(v_proconfig) OR
        'search_path=''' = ANY(v_proconfig) OR
        'search_path=' = ANY(v_proconfig)
    ) OR EXISTS (
        SELECT 1 FROM unnest(v_proconfig) cfg
        WHERE cfg ILIKE 'search_path=%'
          AND cfg NOT IN ('search_path=""', 'search_path=''''', 'search_path=')
    ) THEN
        RAISE EXCEPTION 'check_transaction_attribution_active must have exact empty search_path in proconfig, found: %', v_proconfig;
    END IF;

    -- -------------------------------------------------------------------------
    -- 10. transaction_details View (security_invoker + exact 22 columns)
    -- -------------------------------------------------------------------------
    SELECT reloptions INTO v_reloptions
    FROM pg_class
    WHERE relname = 'transaction_details' AND relnamespace = 'public'::regnamespace;

    IF v_reloptions IS NULL OR NOT array_to_string(v_reloptions, ',') ILIKE '%security_invoker=true%' THEN
        RAISE EXCEPTION 'transaction_details view must have security_invoker = true';
    END IF;

    -- Check exact 22 ordered columns
    SELECT array_agg(column_name ORDER BY ordinal_position) INTO v_col_order
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transaction_details';

    v_expected_order := ARRAY[
        'id', 'user_id', 'account_id', 'category_id', 'type',
        'amount', 'currency_code', 'merchant', 'note', 'occurred_on',
        'is_voided', 'created_at', 'updated_at', 'account_name',
        'category_name', 'category_icon', 'category_color',
        'income_source_id', 'income_source_stream_id', 'income_source_name',
        'income_source_type', 'income_source_stream_name'
    ];

    IF v_col_order != v_expected_order THEN
        RAISE EXCEPTION 'transaction_details view column order mismatch. Got: %, Expected: %', v_col_order, v_expected_order;
    END IF;

    -- Column 6 'amount' must be text in the view
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaction_details'
          AND column_name = 'amount' AND data_type = 'text'
    ) THEN
        RAISE EXCEPTION 'transaction_details.amount must be text';
    END IF;

    RAISE NOTICE 'PHASE 9 STRUCTURAL VERIFIER PASS: all assertions satisfied';
END $$;

SELECT 'PASS' AS phase_9_structural_gate;
