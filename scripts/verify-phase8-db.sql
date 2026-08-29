WITH
c1_table AS (
  SELECT 'C1. Snapshot Table Schema' AS check_name,
    COUNT(*) = 12 AND
    bool_and(
      (column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default LIKE '%gen_random_uuid()%') OR
      (column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'transaction_id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'source_currency_code' AND data_type = 'text' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'target_currency_code' AND data_type = 'text' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'source_amount' AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4 AND is_nullable = 'NO') OR
      (column_name = 'rate' AND data_type = 'numeric' AND numeric_precision = 30 AND numeric_scale = 12 AND is_nullable = 'NO') OR
      (column_name = 'converted_amount' AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4 AND is_nullable = 'NO') OR
      (column_name = 'requested_date' AND data_type = 'date' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'effective_date' AND data_type = 'date' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'provider' AND data_type = 'text' AND is_nullable = 'NO' AND column_default IS NULL) OR
      (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND (column_default LIKE '%now()%' OR column_default LIKE '%CURRENT_TIMESTAMP%'))
    ) AS passed,
    'Columns matched' AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshots'
),
c2_constraints AS (
  SELECT 'C2. Domain Constraints' AS check_name,
    COUNT(*) = 8 AND
    bool_and(
      check_clause LIKE '%source_currency_code%~%^[A-Z]{3,5}$%' OR
      check_clause LIKE '%target_currency_code%~%^[A-Z]{3,5}$%' OR
      check_clause LIKE '%source_currency_code%<>%target_currency_code%' OR
      check_clause LIKE '%source_amount%>%0%' OR
      check_clause LIKE '%rate%>%0%' OR
      check_clause LIKE '%converted_amount%>%0%' OR
      check_clause LIKE '%effective_date%<=%requested_date%' OR
      check_clause LIKE '%length%trim%provider%>%BETWEEN 1 AND 100%' OR
      check_clause LIKE '%char_length%trim%provider%>%BETWEEN 1 AND 100%' OR
      check_clause LIKE '%length%trim%provider%>%>=%1%'
    ) AS passed,
    'Constraints matched' AS detail
  FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc ON cc.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public' AND tc.table_name = 'transaction_fx_snapshots'
),
c3_keys AS (
  SELECT 'C3. Keys and FKs' AS check_name,
    (
      SELECT count(*) = 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public' AND tc.table_name = 'transactions'
      AND constraint_type = 'UNIQUE' AND constraint_name = 'transactions_id_user_id_key'
    ) AND
    (
      SELECT count(*) = 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public' AND tc.table_name = 'transaction_fx_snapshots'
      AND constraint_type = 'UNIQUE' AND constraint_name = 'transaction_fx_snapshots_version_key'
    ) AND
    (
      SELECT count(*) = 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public' AND tc.table_name = 'transaction_fx_snapshots'
      AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'fk_snapshot_transaction'
    ) AS passed,
    'Keys matched' AS detail
),
c4_rls AS (
  SELECT 'C4. RLS Policy' AS check_name,
    (
      SELECT count(*) = 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transaction_fx_snapshots' AND rowsecurity = true
    ) AND
    (
      SELECT count(*) = 1 AND bool_and(cmd = 'SELECT' AND roles::text = '{authenticated}' AND qual LIKE '%auth.uid() = user_id%')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transaction_fx_snapshots'
    ) AS passed,
    'RLS matched' AS detail
),
c5_privs AS (
  SELECT 'C5. Privileges' AS check_name,
    -- anon and PUBLIC have zero privileges on table
    (SELECT count(*) = 0 FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshots' AND grantee IN ('anon', 'PUBLIC')) AND
    -- anon and PUBLIC have zero privileges on view
    (SELECT count(*) = 0 FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details' AND grantee IN ('anon', 'PUBLIC')) AND
    -- authenticated table: SELECT only
    (SELECT count(*) = 1 AND bool_and(privilege_type = 'SELECT') FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshots' AND grantee = 'authenticated') AND
    -- authenticated view: SELECT only
    (SELECT count(*) = 1 AND bool_and(privilege_type = 'SELECT') FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details' AND grantee = 'authenticated') AND
    -- user_settings auto_fx_enabled UPDATE privilege
    (SELECT count(*) >= 1 FROM information_schema.column_privileges WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'auto_fx_enabled' AND grantee = 'authenticated' AND privilege_type = 'UPDATE')
    AS passed,
    'Privs matched' AS detail
),
c6_view AS (
  SELECT 'C6. View' AS check_name,
    -- 12 columns
    (SELECT count(*) = 12 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details') AND
    -- source_amount is text
    (SELECT data_type = 'text' FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details' AND column_name = 'source_amount') AND
    -- rate is text
    (SELECT data_type = 'text' FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details' AND column_name = 'rate') AND
    -- converted_amount is text
    (SELECT data_type = 'text' FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details' AND column_name = 'converted_amount') AND
    -- security_invoker = true
    (SELECT count(*) = 1 FROM pg_class WHERE relname = 'transaction_fx_snapshot_details' AND relkind = 'v' AND reloptions @> ARRAY['security_invoker=true'])
    AS passed,
    'View matched' AS detail
),
c7_nonreg AS (
  SELECT 'C7. Phase 2-7 Non-regression' AS check_name,
    -- 9 tables have RLS
    (SELECT count(*) = 9 FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'user_settings', 'accounts', 'categories', 'transactions', 'transfers', 'budgets', 'goals', 'recurring_items') AND rowsecurity = true) AND
    -- Same currency only for transfers (no extra cols)
    (SELECT count(*) = 0 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name IN ('source_amount', 'rate', 'target_amount')) AND
    -- Views exist and security invoker
    (SELECT count(*) = 6 FROM pg_class WHERE relname IN ('transaction_details', 'transfer_details', 'account_balances', 'budget_progress', 'goal_details', 'recurring_details') AND relkind = 'v' AND reloptions @> ARRAY['security_invoker=true'])
    AS passed,
    'Non-reg matched' AS detail
)
SELECT * FROM c1_table
UNION ALL SELECT * FROM c2_constraints
UNION ALL SELECT * FROM c3_keys
UNION ALL SELECT * FROM c4_rls
UNION ALL SELECT * FROM c5_privs
UNION ALL SELECT * FROM c6_view
UNION ALL SELECT * FROM c7_nonreg
UNION ALL SELECT '99_OVERALL', bool_and(passed), 'All checks'
FROM (
  SELECT passed FROM c1_table
  UNION ALL SELECT passed FROM c2_constraints
  UNION ALL SELECT passed FROM c3_keys
  UNION ALL SELECT passed FROM c4_rls
  UNION ALL SELECT passed FROM c5_privs
  UNION ALL SELECT passed FROM c6_view
  UNION ALL SELECT passed FROM c7_nonreg
) t;
