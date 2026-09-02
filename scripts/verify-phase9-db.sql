WITH
  -- 1. Exact 7 columns for income_sources
  test_src_cols AS (
    SELECT (
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_sources') = 7
      AND
      (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_sources' AND column_name IN (
        'id', 'user_id', 'name', 'type', 'is_archived', 'created_at', 'updated_at'
      )) = 7
    ) AS pass
  ),
  test_src_col_types AS (
    SELECT count(*) = 7 AS pass FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'income_sources' AND (
      (column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default ILIKE '%gen_random_uuid()%') OR
      (column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default ILIKE '%auth.uid()%') OR
      (column_name IN ('name', 'type') AND data_type = 'text' AND is_nullable = 'NO') OR
      (column_name = 'is_archived' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default ILIKE '%false%') OR
      (column_name IN ('created_at', 'updated_at') AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND (column_default ILIKE '%now()%' OR column_default ILIKE '%CURRENT_TIMESTAMP%'))
    )
  ),

  -- 2. Exact 7 columns for income_source_streams
  test_stm_cols AS (
    SELECT (
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_source_streams') = 7
      AND
      (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_source_streams' AND column_name IN (
        'id', 'user_id', 'income_source_id', 'name', 'is_archived', 'created_at', 'updated_at'
      )) = 7
    ) AS pass
  ),
  test_stm_col_types AS (
    SELECT count(*) = 7 AS pass FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'income_source_streams' AND (
      (column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default ILIKE '%gen_random_uuid()%') OR
      (column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default ILIKE '%auth.uid()%') OR
      (column_name = 'income_source_id' AND data_type = 'uuid' AND is_nullable = 'NO') OR
      (column_name = 'name' AND data_type = 'text' AND is_nullable = 'NO') OR
      (column_name = 'is_archived' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default ILIKE '%false%') OR
      (column_name IN ('created_at', 'updated_at') AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND (column_default ILIKE '%now()%' OR column_default ILIKE '%CURRENT_TIMESTAMP%'))
    )
  ),

  -- 3. Transactions columns extended with attribution
  test_tx_attribution_cols AS (
    SELECT count(*) = 2 AS pass FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND (
      (column_name = 'income_source_id' AND data_type = 'uuid' AND is_nullable = 'YES') OR
      (column_name = 'income_source_stream_id' AND data_type = 'uuid' AND is_nullable = 'YES')
    )
  ),

  -- 4. CHECK constraints
  test_chk_src_name AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.income_sources'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%char_length(btrim(name)) >= 1%' OR pg_get_constraintdef(oid) ILIKE '%length(btrim(name)) >= 1%')
  ),
  test_chk_src_type AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.income_sources'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%SALARY%'
      AND pg_get_constraintdef(oid) ILIKE '%YOUTUBE%'
      AND pg_get_constraintdef(oid) ILIKE '%FREELANCE%'
      AND pg_get_constraintdef(oid) ILIKE '%INVESTMENT%'
      AND pg_get_constraintdef(oid) ILIKE '%OTHER%'
  ),
  test_chk_stm_name AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.income_source_streams'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%char_length(btrim(name)) >= 1%' OR pg_get_constraintdef(oid) ILIKE '%length(btrim(name)) >= 1%')
  ),
  test_chk_tx_expense_no_attr AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
      AND conname = 'check_transaction_expense_no_attribution'
  ),
  test_chk_tx_stream_req_src AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
      AND conname = 'check_transaction_stream_requires_source'
  ),

  -- 5. Foreign keys
  test_stm_parent_fk AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.income_source_streams'::regclass AND contype = 'f'
      AND conname = 'income_source_streams_parent_fkey'
      AND confdeltype = 'r' -- RESTRICT
  ),
  test_tx_src_fk AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'f'
      AND conname = 'transactions_income_source_fkey'
      AND confdeltype = 'r' -- RESTRICT
  ),
  test_tx_stm_fk AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'f'
      AND conname = 'transactions_income_source_stream_fkey'
      AND confdeltype = 'r' -- RESTRICT
  ),

  -- 6. Trigger & Function
  test_active_attr_trigger AS (
    SELECT count(*) = 1 AS pass FROM pg_trigger
    WHERE tgrelid = 'public.transactions'::regclass
      AND tgname = 'trigger_check_transaction_attribution_active'
  ),
  test_active_attr_func AS (
    SELECT count(*) = 1 AS pass FROM pg_proc
    WHERE proname = 'check_transaction_attribution_active'
      AND prosecdef = false -- SECURITY INVOKER
  ),

  -- 7. View security_invoker and 22 columns
  test_view_invoker AS (
    SELECT (
      (SELECT count(*) FROM pg_views WHERE schemaname = 'public' AND viewname = 'transaction_details') = 1
      AND
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_details') = 22
    ) AS pass
  ),

  -- 8. RLS enabled
  test_rls_src AS (
    SELECT relrowsecurity = true AND relforcerowsecurity = false AS pass
    FROM pg_class WHERE relname = 'income_sources' AND relnamespace = 'public'::regnamespace
  ),
  test_rls_stm AS (
    SELECT relrowsecurity = true AND relforcerowsecurity = false AS pass
    FROM pg_class WHERE relname = 'income_source_streams' AND relnamespace = 'public'::regnamespace
  )

SELECT
  test_src_cols.pass AS src_cols_pass,
  test_src_col_types.pass AS src_col_types_pass,
  test_stm_cols.pass AS stm_cols_pass,
  test_stm_col_types.pass AS stm_col_types_pass,
  test_tx_attribution_cols.pass AS tx_attribution_cols_pass,
  test_chk_src_name.pass AS chk_src_name_pass,
  test_chk_src_type.pass AS chk_src_type_pass,
  test_chk_stm_name.pass AS chk_stm_name_pass,
  test_chk_tx_expense_no_attr.pass AS chk_tx_expense_no_attr_pass,
  test_chk_tx_stream_req_src.pass AS chk_tx_stream_req_src_pass,
  test_stm_parent_fk.pass AS stm_parent_fk_pass,
  test_tx_src_fk.pass AS tx_src_fk_pass,
  test_tx_stm_fk.pass AS tx_stm_fk_pass,
  test_active_attr_trigger.pass AS active_attr_trigger_pass,
  test_active_attr_func.pass AS active_attr_func_pass,
  test_view_invoker.pass AS view_invoker_pass,
  test_rls_src.pass AS rls_src_pass,
  test_rls_stm.pass AS rls_stm_pass
FROM
  test_src_cols, test_src_col_types,
  test_stm_cols, test_stm_col_types,
  test_tx_attribution_cols,
  test_chk_src_name, test_chk_src_type,
  test_chk_stm_name, test_chk_tx_expense_no_attr, test_chk_tx_stream_req_src,
  test_stm_parent_fk, test_tx_src_fk, test_tx_stm_fk,
  test_active_attr_trigger, test_active_attr_func,
  test_view_invoker,
  test_rls_src, test_rls_stm;
