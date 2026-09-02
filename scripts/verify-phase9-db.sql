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
BEGIN
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
    -- Authenticated: SELECT=true, all table mutations=false
    IF NOT has_table_privilege('authenticated', 'public.income_sources', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated must have table-level SELECT on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level INSERT on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level UPDATE on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'DELETE') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level DELETE on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'TRUNCATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level TRUNCATE on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'REFERENCES') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level REFERENCES on public.income_sources';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_sources', 'TRIGGER') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level TRIGGER on public.income_sources';
    END IF;

    -- income_source_streams table privileges
    IF NOT has_table_privilege('authenticated', 'public.income_source_streams', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated must have table-level SELECT on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level INSERT on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level UPDATE on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'DELETE') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level DELETE on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'TRUNCATE') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level TRUNCATE on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'REFERENCES') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level REFERENCES on public.income_source_streams';
    END IF;

    IF has_table_privilege('authenticated', 'public.income_source_streams', 'TRIGGER') THEN
        RAISE EXCEPTION 'authenticated must NOT have table-level TRIGGER on public.income_source_streams';
    END IF;

    -- Anon: no privileges on either table
    IF has_table_privilege('anon', 'public.income_sources', 'SELECT') OR
       has_table_privilege('anon', 'public.income_sources', 'INSERT') OR
       has_table_privilege('anon', 'public.income_sources', 'UPDATE') OR
       has_table_privilege('anon', 'public.income_sources', 'DELETE') THEN
        RAISE EXCEPTION 'anon must have NO privileges on public.income_sources';
    END IF;

    IF has_table_privilege('anon', 'public.income_source_streams', 'SELECT') OR
       has_table_privilege('anon', 'public.income_source_streams', 'INSERT') OR
       has_table_privilege('anon', 'public.income_source_streams', 'UPDATE') OR
       has_table_privilege('anon', 'public.income_source_streams', 'DELETE') THEN
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

    -- -------------------------------------------------------------------------
    -- 6. Row Level Security (RLS) & Policies
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

    -- Exactly 3 policies on income_sources (SELECT, INSERT, UPDATE) for authenticated
    SELECT count(*) INTO v_count
    FROM pg_policy
    WHERE polrelid = 'public.income_sources'::regclass;

    IF v_count != 3 THEN
        RAISE EXCEPTION 'income_sources must have exactly 3 policies, found %', v_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'd'
    ) THEN
        RAISE EXCEPTION 'income_sources must NOT have a DELETE policy';
    END IF;

    -- Exactly 3 policies on income_source_streams (SELECT, INSERT, UPDATE) for authenticated
    SELECT count(*) INTO v_count
    FROM pg_policy
    WHERE polrelid = 'public.income_source_streams'::regclass;

    IF v_count != 3 THEN
        RAISE EXCEPTION 'income_source_streams must have exactly 3 policies, found %', v_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'd'
    ) THEN
        RAISE EXCEPTION 'income_source_streams must NOT have a DELETE policy';
    END IF;

    -- Check policy expressions use canonical (auth.uid() = user_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid = 'public.income_sources'::regclass AND polcmd = 'r'
          AND pg_get_expr(polqual, polrelid) ILIKE '%auth.uid()%user_id%'
    ) THEN
        RAISE EXCEPTION 'income_sources SELECT policy must enforce auth.uid() = user_id';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid = 'public.income_source_streams'::regclass AND polcmd = 'r'
          AND pg_get_expr(polqual, polrelid) ILIKE '%auth.uid()%user_id%'
    ) THEN
        RAISE EXCEPTION 'income_source_streams SELECT policy must enforce auth.uid() = user_id';
    END IF;

    -- -------------------------------------------------------------------------
    -- 7. Composite Unique and Foreign Keys
    -- -------------------------------------------------------------------------
    -- Unique constraint on income_sources(id, user_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.income_sources'::regclass
          AND contype = 'u'
          AND conname = 'income_sources_id_user_id_key'
    ) THEN
        RAISE EXCEPTION 'income_sources must have composite UNIQUE constraint income_sources_id_user_id_key';
    END IF;

    -- Unique constraint on income_source_streams(id, income_source_id, user_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.income_source_streams'::regclass
          AND contype = 'u'
          AND conname = 'income_source_streams_id_income_source_id_user_id_key'
    ) THEN
        RAISE EXCEPTION 'income_source_streams must have composite UNIQUE constraint income_source_streams_id_income_source_id_user_id_key';
    END IF;

    -- Foreign Key: income_source_streams(income_source_id, user_id) -> income_sources(id, user_id) ON DELETE RESTRICT
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.income_source_streams'::regclass
          AND contype = 'f'
          AND conname = 'income_source_streams_parent_fkey'
          AND confrelid = 'public.income_sources'::regclass
          AND confdeltype = 'r'
    ) THEN
        RAISE EXCEPTION 'income_source_streams must have FK income_source_streams_parent_fkey ON DELETE RESTRICT';
    END IF;

    -- Foreign Key: transactions(income_source_id, user_id) -> income_sources(id, user_id) ON DELETE RESTRICT
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.transactions'::regclass
          AND contype = 'f'
          AND conname = 'transactions_income_source_fkey'
          AND confrelid = 'public.income_sources'::regclass
          AND confdeltype = 'r'
    ) THEN
        RAISE EXCEPTION 'transactions must have FK transactions_income_source_fkey ON DELETE RESTRICT';
    END IF;

    -- Foreign Key: transactions(income_source_stream_id, income_source_id, user_id) -> income_source_streams(id, income_source_id, user_id) ON DELETE RESTRICT
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.transactions'::regclass
          AND contype = 'f'
          AND conname = 'transactions_income_source_stream_fkey'
          AND confrelid = 'public.income_source_streams'::regclass
          AND confdeltype = 'r'
    ) THEN
        RAISE EXCEPTION 'transactions must have FK transactions_income_source_stream_fkey ON DELETE RESTRICT';
    END IF;

    -- -------------------------------------------------------------------------
    -- 8. CHECK Constraints
    -- -------------------------------------------------------------------------
    -- check_income_source_name_length
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.income_sources'::regclass AND conname = 'check_income_source_name_length';

    IF v_def IS NULL OR (v_def NOT ILIKE '%length%name%' AND v_def NOT ILIKE '%char_length%name%') THEN
        RAISE EXCEPTION 'check_income_source_name_length missing or malformed: %', v_def;
    END IF;

    -- check_income_source_type
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.income_sources'::regclass AND conname = 'check_income_source_type';

    IF v_def IS NULL OR v_def NOT ILIKE '%SALARY%' OR v_def NOT ILIKE '%YOUTUBE%' OR v_def NOT ILIKE '%FREELANCE%' OR v_def NOT ILIKE '%INVESTMENT%' OR v_def NOT ILIKE '%OTHER%' THEN
        RAISE EXCEPTION 'check_income_source_type missing or malformed: %', v_def;
    END IF;

    -- check_income_source_stream_name_length
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.income_source_streams'::regclass AND conname = 'check_income_source_stream_name_length';

    IF v_def IS NULL OR (v_def NOT ILIKE '%length%name%' AND v_def NOT ILIKE '%char_length%name%') THEN
        RAISE EXCEPTION 'check_income_source_stream_name_length missing or malformed: %', v_def;
    END IF;

    -- check_transaction_expense_no_attribution
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'check_transaction_expense_no_attribution';

    IF v_def IS NULL OR v_def NOT ILIKE '%EXPENSE%' OR v_def NOT ILIKE '%INCOME%' THEN
        RAISE EXCEPTION 'check_transaction_expense_no_attribution missing or malformed: %', v_def;
    END IF;

    -- check_transaction_stream_requires_source
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND conname = 'check_transaction_stream_requires_source';

    IF v_def IS NULL OR v_def NOT ILIKE '%income_source_stream_id%' OR v_def NOT ILIKE '%income_source_id%' THEN
        RAISE EXCEPTION 'check_transaction_stream_requires_source missing or malformed: %', v_def;
    END IF;

    -- -------------------------------------------------------------------------
    -- 9. Triggers: Updated-At & Active Attribution
    -- -------------------------------------------------------------------------
    -- set_income_sources_updated_at: BEFORE (2), UPDATE (16), ROW (1)
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.income_sources'::regclass
          AND tgname = 'set_income_sources_updated_at'
          AND (tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 16 = 16)
    ) THEN
        RAISE EXCEPTION 'set_income_sources_updated_at trigger missing or wrong bitmask';
    END IF;

    -- set_income_source_streams_updated_at: BEFORE (2), UPDATE (16), ROW (1)
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.income_source_streams'::regclass
          AND tgname = 'set_income_source_streams_updated_at'
          AND (tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 16 = 16)
    ) THEN
        RAISE EXCEPTION 'set_income_source_streams_updated_at trigger missing or wrong bitmask';
    END IF;

    -- check_transaction_attribution_active_trigger: BEFORE (2), INSERT (4), UPDATE (16), ROW (1)
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.transactions'::regclass
          AND tgname = 'check_transaction_attribution_active_trigger'
          AND (tgtype & 1 = 1) AND (tgtype & 2 = 2) AND (tgtype & 4 = 4) AND (tgtype & 16 = 16)
    ) THEN
        RAISE EXCEPTION 'check_transaction_attribution_active_trigger missing or wrong bitmask';
    END IF;

    -- check_transaction_attribution_active function properties
    SELECT proconfig INTO v_proconfig
    FROM pg_proc
    WHERE proname = 'check_transaction_attribution_active'
      AND prosecdef = FALSE; -- SECURITY INVOKER

    IF v_proconfig IS NULL OR NOT array_to_string(v_proconfig, ',') ILIKE '%search_path=%' THEN
        RAISE EXCEPTION 'check_transaction_attribution_active must have SECURITY INVOKER and empty search_path';
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
