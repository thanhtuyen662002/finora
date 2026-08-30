
WITH
  -- 1. Exact 12 columns for transaction_fx_snapshots
  test_snap_cols AS (
    SELECT count(*) = 12 AS pass FROM (
      SELECT column_name FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshots'
      INTERSECT
      VALUES
        ('id'), ('user_id'), ('transaction_id'), ('target_currency_code'),
        ('source_currency_code'), ('source_amount'), ('rate'), ('converted_amount'),
        ('requested_date'), ('effective_date'), ('provider'), ('created_at')
    ) t
  ),
  test_snap_col_types AS (
    SELECT count(*) = 12 AS pass FROM information_schema.columns
    WHERE table_name = 'transaction_fx_snapshots' AND (
      (column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default IS NOT NULL) OR
      (column_name IN ('user_id', 'transaction_id') AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name IN ('target_currency_code', 'source_currency_code', 'provider') AND data_type = 'text' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name IN ('source_amount', 'converted_amount') AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4 AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'rate' AND data_type = 'numeric' AND numeric_precision = 30 AND numeric_scale = 12 AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name IN ('requested_date', 'effective_date') AND data_type = 'date' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND column_default IS NOT NULL)
    )
  ),
  -- 2. CHECK constraints
  test_check_source_curr AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source_currency_code%~%^[A-Z]{3,5}$%'
  ),
  test_check_target_curr AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%target_currency_code%~%^[A-Z]{3,5}$%'
  ),
  test_check_distinct_curr AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND (pg_get_constraintdef(oid) ILIKE '%source_currency_code%!=%target_currency_code%' OR pg_get_constraintdef(oid) ILIKE '%source_currency_code%<>%target_currency_code%')
  ),
  test_check_source_amt AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source_amount%0%'
  ),
  test_check_rate AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%rate%0%'
  ),
  test_check_converted_amt AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%converted_amount%0%'
  ),
  test_check_dates AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%effective_date%requested_date%'
  ),
  test_check_provider AS (
    SELECT count(*) = 1 AS pass FROM pg_constraint WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%length%trim%provider%'
  ),
  -- 3. Ordered Keys/FK
  test_tx_key AS (
    SELECT count(*) = 1 as pass FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE t.relname = 'transactions' AND c.contype = 'u' AND c.conname = 'transactions_id_user_id_key' AND array_length(c.conkey, 1) = 2 AND a1.attname = 'id' AND a2.attname = 'user_id'
  ),
  test_snap_key AS (
    SELECT count(*) = 1 as pass FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute a3 ON a3.attrelid = t.oid AND a3.attnum = c.conkey[3] JOIN pg_attribute a4 ON a4.attrelid = t.oid AND a4.attnum = c.conkey[4] JOIN pg_attribute a5 ON a5.attrelid = t.oid AND a5.attnum = c.conkey[5] JOIN pg_attribute a6 ON a6.attrelid = t.oid AND a6.attnum = c.conkey[6]
    WHERE t.relname = 'transaction_fx_snapshots' AND c.contype = 'u' AND c.conname = 'transaction_fx_snapshots_version_key' AND array_length(c.conkey, 1) = 6 AND a1.attname = 'user_id' AND a2.attname = 'transaction_id' AND a3.attname = 'target_currency_code' AND a4.attname = 'source_currency_code' AND a5.attname = 'source_amount' AND a6.attname = 'requested_date'
  ),
  test_snap_fk AS (
    SELECT count(*) = 1 as pass FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_class f ON c.confrelid = f.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute fa1 ON fa1.attrelid = f.oid AND fa1.attnum = c.confkey[1] JOIN pg_attribute fa2 ON fa2.attrelid = f.oid AND fa2.attnum = c.confkey[2]
    WHERE t.relname = 'transaction_fx_snapshots' AND f.relname = 'transactions' AND c.contype = 'f' AND c.conname = 'fk_snapshot_transaction' AND array_length(c.conkey, 1) = 2 AND array_length(c.confkey, 1) = 2 AND a1.attname = 'transaction_id' AND a2.attname = 'user_id' AND fa1.attname = 'id' AND fa2.attname = 'user_id' AND c.confdeltype = 'r'
  ),
  -- 4. RLS and policy
  test_rls_enabled AS (
    SELECT count(*) = 1 as pass FROM pg_class WHERE relname = 'transaction_fx_snapshots' AND relrowsecurity = true
  ),
  test_rls_policies_count AS (
    SELECT count(*) = 1 as pass FROM pg_policies WHERE tablename = 'transaction_fx_snapshots'
  ),
  test_rls_policies AS (
    SELECT count(*) = 1 as pass FROM pg_policies WHERE tablename = 'transaction_fx_snapshots' AND cmd = 'SELECT' AND roles = '{authenticated}' AND qual ILIKE '%auth.uid() = user_id%'
  ),
  -- 5. Grants
  test_no_anon_public_table_grants AS (
    SELECT count(*) = 0 as pass FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshots' AND grantee IN ('anon', 'PUBLIC')
  ),
  test_no_anon_public_view_grants AS (
    SELECT count(*) = 0 as pass FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshot_details' AND grantee IN ('anon', 'PUBLIC')
  ),
  test_authenticated_table_select_only AS (
    SELECT (count(*) = 1 AND min(privilege_type) = 'SELECT') as pass FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshots' AND grantee = 'authenticated'
  ),
  test_authenticated_view_select_only AS (
    SELECT (count(*) = 1 AND min(privilege_type) = 'SELECT') as pass FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshot_details' AND grantee = 'authenticated'
  ),
  test_user_settings_grant AS (
    SELECT count(*) = 1 as pass FROM information_schema.role_column_grants WHERE table_name = 'user_settings' AND column_name = 'auto_fx_enabled' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
  ),
  -- 6. View
  test_view_exists AS (
    SELECT count(*) = 1 as pass FROM pg_class WHERE relname = 'transaction_fx_snapshot_details' AND relkind = 'v'
  ),
  test_view_columns_count AS (
    SELECT count(*) = 12 as pass FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshot_details'
  ),
  test_view_columns_text AS (
    SELECT count(*) = 3 as pass FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshot_details' AND column_name IN ('source_amount', 'rate', 'converted_amount') AND data_type = 'text'
  ),
  test_view_invoker AS (
    SELECT count(*) = 1 as pass FROM pg_class WHERE relname = 'transaction_fx_snapshot_details' AND relkind = 'v' AND array_to_string(reloptions, ',') ILIKE '%security_invoker=true%'
  ),
  -- 7. user_settings
  test_auto_fx_enabled_struct AS (
    SELECT count(*) = 1 as pass FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_fx_enabled' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'true'
  ),
  -- 8. Non-regression
  test_phase2_7_rls AS (
    SELECT count(*) = 9 as pass FROM pg_class WHERE relname IN ('profiles', 'user_settings', 'accounts', 'categories', 'transactions', 'transfers', 'budgets', 'goals', 'recurring_items') AND relrowsecurity = true
  ),
  test_phase5_transfers AS (
    SELECT count(*) = 0 as pass FROM information_schema.columns WHERE table_name = 'transfers' AND column_name IN ('to_currency', 'exchange_rate', 'base_amount')
  ),
  test_views_exist_invoker AS (
    SELECT count(*) = 6 as pass FROM pg_class WHERE relname IN ('transaction_details', 'transfer_details', 'account_balances', 'budget_progress', 'goal_details', 'recurring_details') AND relkind = 'v' AND array_to_string(reloptions, ',') ILIKE '%security_invoker=true%'
  )
SELECT
  (SELECT pass FROM test_snap_cols) AS pass_snap_cols,
  (SELECT pass FROM test_snap_col_types) AS pass_snap_col_types,
  (SELECT pass FROM test_check_source_curr) AS pass_check_source_curr,
  (SELECT pass FROM test_check_target_curr) AS pass_check_target_curr,
  (SELECT pass FROM test_check_distinct_curr) AS pass_check_distinct_curr,
  (SELECT pass FROM test_check_source_amt) AS pass_check_source_amt,
  (SELECT pass FROM test_check_rate) AS pass_check_rate,
  (SELECT pass FROM test_check_converted_amt) AS pass_check_converted_amt,
  (SELECT pass FROM test_check_dates) AS pass_check_dates,
  (SELECT pass FROM test_check_provider) AS pass_check_provider,
  (SELECT pass FROM test_tx_key) AS pass_tx_key,
  (SELECT pass FROM test_snap_key) AS pass_snap_key,
  (SELECT pass FROM test_snap_fk) AS pass_snap_fk,
  (SELECT pass FROM test_rls_enabled) AS pass_rls_enabled,
  (SELECT pass FROM test_rls_policies_count) AS pass_rls_policies_count,
  (SELECT pass FROM test_rls_policies) AS pass_rls_policies,
  (SELECT pass FROM test_no_anon_public_table_grants) AS pass_no_anon_public_table_grants,
  (SELECT pass FROM test_no_anon_public_view_grants) AS pass_no_anon_public_view_grants,
  (SELECT pass FROM test_authenticated_table_select_only) AS pass_authenticated_table_select_only,
  (SELECT pass FROM test_authenticated_view_select_only) AS pass_authenticated_view_select_only,
  (SELECT pass FROM test_user_settings_grant) AS pass_user_settings_grant,
  (SELECT pass FROM test_view_exists) AS pass_view_exists,
  (SELECT pass FROM test_view_columns_count) AS pass_view_columns_count,
  (SELECT pass FROM test_view_columns_text) AS pass_view_columns_text,
  (SELECT pass FROM test_view_invoker) AS pass_view_invoker,
  (SELECT pass FROM test_auto_fx_enabled_struct) AS pass_auto_fx_enabled_struct,
  (SELECT pass FROM test_phase2_7_rls) AS pass_phase2_7_rls,
  (SELECT pass FROM test_phase5_transfers) AS pass_phase5_transfers,
  (SELECT pass FROM test_views_exist_invoker) AS pass_views_exist_invoker,
  (
    (SELECT pass FROM test_snap_cols) AND
    (SELECT pass FROM test_snap_col_types) AND
    (SELECT pass FROM test_check_source_curr) AND
    (SELECT pass FROM test_check_target_curr) AND
    (SELECT pass FROM test_check_distinct_curr) AND
    (SELECT pass FROM test_check_source_amt) AND
    (SELECT pass FROM test_check_rate) AND
    (SELECT pass FROM test_check_converted_amt) AND
    (SELECT pass FROM test_check_dates) AND
    (SELECT pass FROM test_check_provider) AND
    (SELECT pass FROM test_tx_key) AND
    (SELECT pass FROM test_snap_key) AND
    (SELECT pass FROM test_snap_fk) AND
    (SELECT pass FROM test_rls_enabled) AND
    (SELECT pass FROM test_rls_policies_count) AND
    (SELECT pass FROM test_rls_policies) AND
    (SELECT pass FROM test_no_anon_public_table_grants) AND
    (SELECT pass FROM test_no_anon_public_view_grants) AND
    (SELECT pass FROM test_authenticated_table_select_only) AND
    (SELECT pass FROM test_authenticated_view_select_only) AND
    (SELECT pass FROM test_user_settings_grant) AND
    (SELECT pass FROM test_view_exists) AND
    (SELECT pass FROM test_view_columns_count) AND
    (SELECT pass FROM test_view_columns_text) AND
    (SELECT pass FROM test_view_invoker) AND
    (SELECT pass FROM test_auto_fx_enabled_struct) AND
    (SELECT pass FROM test_phase2_7_rls) AND
    (SELECT pass FROM test_phase5_transfers) AND
    (SELECT pass FROM test_views_exist_invoker)
  ) AS "99_OVERALL";
