WITH col_check AS (
  SELECT 'Snapshot table exact schema' AS check_name,
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
           (column_name = 'requested_date' AND data_type = 'date' AND is_nullable = 'NO') OR
           (column_name = 'effective_date' AND data_type = 'date' AND is_nullable = 'NO') OR
           (column_name = 'provider' AND data_type = 'text' AND is_nullable = 'NO') OR
           (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND column_default LIKE '%now()%')
         ) AS passed,
         COUNT(*)::text || ' cols' AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshots'
),
constraint_check AS (
  SELECT 'Exact domain constraints' AS check_name,
         COUNT(*) = 8 AND
         bool_and(
           check_clause ILIKE '%source_currency_code%~%^[A-Z]{3}$%' OR
           check_clause ILIKE '%target_currency_code%~%^[A-Z]{3}$%' OR
           check_clause ILIKE '%source_currency_code%!=%target_currency_code%' OR
           check_clause ILIKE '%source_amount%>%0%' OR
           check_clause ILIKE '%rate%>%0%' OR
           check_clause ILIKE '%converted_amount%>%0%' OR
           check_clause ILIKE '%effective_date%<=%requested_date%' OR
           check_clause ILIKE '%length%trim%provider%>%0%<=%100%'
         ) AS passed,
         COUNT(*)::text || ' constraints' AS detail
  FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc ON cc.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public' AND tc.table_name = 'transaction_fx_snapshots'
),
fk_unique_check AS (
  SELECT 'Exact unique keys and FK' AS check_name,
         COUNT(*) = 3 AS passed,
         COUNT(*)::text || ' keys' AS detail
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name IN ('transactions', 'transaction_fx_snapshots')
    AND constraint_name IN ('transactions_id_user_id_key', 'transaction_fx_snapshots_version_key', 'fk_snapshot_transaction')
),
rls_check AS (
  SELECT 'Exact RLS policy' AS check_name,
         COUNT(*) = 1 AND bool_and(cmd = 'SELECT' AND roles = '{authenticated}' AND qual ILIKE '%auth.uid() = user_id%') AS passed,
         COUNT(*)::text || ' policies' AS detail
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'transaction_fx_snapshots'
),
priv_check AS (
  SELECT 'Exact privileges' AS check_name,
         COUNT(*) = 0 AS passed,
         'Anon/Public have no access' AS detail
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshots' AND grantee IN ('anon', 'PUBLIC')
),
view_check AS (
  SELECT 'Snapshot view exactness' AS check_name,
         COUNT(*) = 12 AS passed,
         'View cols' AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'transaction_fx_snapshot_details'
),
user_set_check AS (
  SELECT 'user_settings auto_fx' AS check_name,
         COUNT(*) = 1 AND bool_and(data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'true') AS passed,
         'auto_fx_enabled' AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'auto_fx_enabled'
),
nonreg_check AS (
  SELECT 'Phase 2-7 non-regression' AS check_name,
         COUNT(*) = 9 AS passed,
         'RLS enabled' AS detail
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename IN ('profiles', 'user_settings', 'accounts', 'categories', 'transactions', 'transfers', 'budgets', 'goals', 'recurring_items')
    AND rowsecurity = true
),
transfer_check AS (
  SELECT 'Phase 5 same-currency transfer invariant' AS check_name,
         COUNT(*) = 0 AS passed,
         'No cross currency columns' AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name IN ('source_amount', 'rate')
),
phase7_check AS (
  SELECT 'Phase 7 object non-regression' AS check_name,
         COUNT(*) = 6 AS passed,
         'Phase 7' AS detail
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname IN ('budgets', 'goals', 'recurring_items', 'budget_progress', 'goal_details', 'recurring_details')
)
SELECT * FROM col_check
UNION ALL SELECT * FROM constraint_check
UNION ALL SELECT * FROM fk_unique_check
UNION ALL SELECT * FROM rls_check
UNION ALL SELECT * FROM priv_check
UNION ALL SELECT * FROM view_check
UNION ALL SELECT * FROM user_set_check
UNION ALL SELECT * FROM nonreg_check
UNION ALL SELECT * FROM transfer_check
UNION ALL SELECT * FROM phase7_check
UNION ALL SELECT '99_OVERALL', bool_and(passed), 'All checks'
FROM (
  SELECT passed FROM col_check
  UNION ALL SELECT passed FROM constraint_check
  UNION ALL SELECT passed FROM fk_unique_check
  UNION ALL SELECT passed FROM rls_check
  UNION ALL SELECT passed FROM priv_check
  UNION ALL SELECT passed FROM view_check
  UNION ALL SELECT passed FROM user_set_check
  UNION ALL SELECT passed FROM nonreg_check
  UNION ALL SELECT passed FROM transfer_check
  UNION ALL SELECT passed FROM phase7_check
) t;
