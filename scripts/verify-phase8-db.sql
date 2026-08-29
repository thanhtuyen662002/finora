WITH
  test_tx_key AS (
    SELECT count(*) = 1 as pass
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE t.relname = 'transactions'
      AND c.contype = 'u'
      AND c.conname = 'transactions_id_user_id_key'
      AND array_length(c.conkey, 1) = 2
      AND a1.attname = 'id'
      AND a2.attname = 'user_id'
  ),
  test_snap_key AS (
    SELECT count(*) = 1 as pass
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    JOIN pg_attribute a3 ON a3.attrelid = t.oid AND a3.attnum = c.conkey[3]
    JOIN pg_attribute a4 ON a4.attrelid = t.oid AND a4.attnum = c.conkey[4]
    JOIN pg_attribute a5 ON a5.attrelid = t.oid AND a5.attnum = c.conkey[5]
    JOIN pg_attribute a6 ON a6.attrelid = t.oid AND a6.attnum = c.conkey[6]
    WHERE t.relname = 'transaction_fx_snapshots'
      AND c.contype = 'u'
      AND c.conname = 'transaction_fx_snapshots_version_key'
      AND array_length(c.conkey, 1) = 6
      AND a1.attname = 'user_id'
      AND a2.attname = 'transaction_id'
      AND a3.attname = 'target_currency_code'
      AND a4.attname = 'source_currency_code'
      AND a5.attname = 'source_amount'
      AND a6.attname = 'requested_date'
  ),
  test_snap_fk AS (
    SELECT count(*) = 1 as pass
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_class f ON c.confrelid = f.oid
    JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    JOIN pg_attribute fa1 ON fa1.attrelid = f.oid AND fa1.attnum = c.confkey[1]
    JOIN pg_attribute fa2 ON fa2.attrelid = f.oid AND fa2.attnum = c.confkey[2]
    WHERE t.relname = 'transaction_fx_snapshots'
      AND f.relname = 'transactions'
      AND c.contype = 'f'
      AND c.conname = 'fk_snapshot_transaction'
      AND array_length(c.conkey, 1) = 2
      AND array_length(c.confkey, 1) = 2
      AND a1.attname = 'transaction_id'
      AND a2.attname = 'user_id'
      AND fa1.attname = 'id'
      AND fa2.attname = 'user_id'
      AND c.confdeltype = 'r'
  ),
  test_check_source_curr AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source_currency_code%~%^[A-Z]{3,5}$%'
  ),
  test_check_target_curr AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%target_currency_code%~%^[A-Z]{3,5}$%'
  ),
  test_check_distinct_curr AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source_currency_code%!=%target_currency_code%'
  ),
  test_check_source_amt AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source_amount%>%0%'
  ),
  test_check_rate AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%rate%>%0%'
  ),
  test_check_converted_amt AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%converted_amount%>%0%'
  ),
  test_check_dates AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%effective_date%<=%requested_date%'
  ),
  test_check_provider AS (
    SELECT count(*) = 1 as pass FROM pg_constraint
    WHERE conrelid = 'transaction_fx_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%length%trim%provider%>%0%'
  ),
  test_snap_cols AS (
    SELECT count(*) = 12 as pass FROM information_schema.columns
    WHERE table_name = 'transaction_fx_snapshots'
  ),
  test_rls_enabled AS (
    SELECT count(*) = 1 as pass FROM pg_class
    WHERE relname = 'transaction_fx_snapshots' AND relrowsecurity = true
  ),
  test_rls_policies AS (
    SELECT count(*) = 1 as pass FROM pg_policies
    WHERE tablename = 'transaction_fx_snapshots'
      AND cmd = 'SELECT'
      AND roles = '{authenticated}'
      AND qual ILIKE '%auth.uid() = user_id%'
  ),
  test_no_other_policies AS (
    SELECT count(*) = 0 as pass FROM pg_policies
    WHERE tablename = 'transaction_fx_snapshots' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  test_table_grants AS (
    SELECT count(*) = 1 as pass
    FROM information_schema.role_table_grants
    WHERE table_name = 'transaction_fx_snapshots'
      AND grantee = 'authenticated'
      AND privilege_type = 'SELECT'
  ),
  test_no_insert_grants AS (
    SELECT count(*) = 0 as pass
    FROM information_schema.role_table_grants
    WHERE table_name = 'transaction_fx_snapshots'
      AND grantee = 'authenticated'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  test_view_grants AS (
    SELECT count(*) = 1 as pass
    FROM information_schema.role_table_grants
    WHERE table_name = 'transaction_fx_snapshot_details'
      AND grantee = 'authenticated'
      AND privilege_type = 'SELECT'
  ),
  test_user_settings_grant AS (
    SELECT count(*) = 1 as pass
    FROM information_schema.role_column_grants
    WHERE table_name = 'user_settings'
      AND column_name = 'auto_fx_enabled'
      AND grantee = 'authenticated'
      AND privilege_type = 'UPDATE'
  ),
  test_view_invoker AS (
    SELECT count(*) = 1 as pass
    FROM pg_class
    WHERE relname = 'transaction_fx_snapshot_details'
      AND relkind = 'v'
      AND pg_relation_is_updatable('transaction_fx_snapshot_details'::regclass, false) & 8 = 8 -- security_invoker=true check
  ),
  test_view_columns AS (
    SELECT count(*) = 3 as pass
    FROM information_schema.columns
    WHERE table_name = 'transaction_fx_snapshot_details'
      AND column_name IN ('source_amount', 'rate', 'converted_amount')
      AND data_type = 'text'
  )
SELECT
  (SELECT pass FROM test_tx_key) AND
  (SELECT pass FROM test_snap_key) AND
  (SELECT pass FROM test_snap_fk) AND
  (SELECT pass FROM test_check_source_curr) AND
  (SELECT pass FROM test_check_target_curr) AND
  (SELECT pass FROM test_check_distinct_curr) AND
  (SELECT pass FROM test_check_source_amt) AND
  (SELECT pass FROM test_check_rate) AND
  (SELECT pass FROM test_check_converted_amt) AND
  (SELECT pass FROM test_check_dates) AND
  (SELECT pass FROM test_check_provider) AND
  (SELECT pass FROM test_snap_cols) AND
  (SELECT pass FROM test_rls_enabled) AND
  (SELECT pass FROM test_rls_policies) AND
  (SELECT pass FROM test_no_other_policies) AND
  (SELECT pass FROM test_table_grants) AND
  (SELECT pass FROM test_no_insert_grants) AND
  (SELECT pass FROM test_view_grants) AND
  (SELECT pass FROM test_user_settings_grant) AND
  (SELECT pass FROM test_view_columns) as "99_OVERALL";
