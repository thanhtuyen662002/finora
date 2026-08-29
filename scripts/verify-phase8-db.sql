WITH checks AS (
  SELECT '01_columns' AS check_name,
         (SELECT count(*) = 12 FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshots') AS passed,
         'snapshot has 12 columns' AS detail
  UNION ALL
  SELECT '02_types',
         (SELECT data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4 FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshots' AND column_name = 'source_amount') AND
         (SELECT data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4 FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshots' AND column_name = 'converted_amount') AND
         (SELECT data_type = 'numeric' AND numeric_precision = 30 AND numeric_scale = 12 FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshots' AND column_name = 'rate'),
         'types are exact'
  UNION ALL
  SELECT '03_constraints',
         (SELECT count(*) >= 7 FROM information_schema.check_constraints WHERE constraint_name LIKE '%check_snapshot_%'),
         'check constraints exist'
  UNION ALL
  SELECT '04_unique',
         (SELECT count(*) > 0 FROM pg_constraint WHERE conname = 'transaction_fx_snapshots_version_key'),
         'version unique key exists'
  UNION ALL
  SELECT '05_fk',
         (SELECT count(*) > 0 FROM pg_constraint WHERE conname = 'fk_snapshot_transaction' AND confupdtype = 'a' AND confdeltype = 'r'),
         'composite FK exists with RESTRICT'
  UNION ALL
  SELECT '06_tx_unique',
         (SELECT count(*) > 0 FROM pg_constraint WHERE conname = 'transactions_id_user_id_key'),
         'transaction (id,user_id) unique exists'
  UNION ALL
  SELECT '07_rls_enabled',
         (SELECT relrowsecurity FROM pg_class WHERE relname = 'transaction_fx_snapshots'),
         'RLS enabled'
  UNION ALL
  SELECT '08_policies',
         (SELECT count(*) = 1 FROM pg_policies WHERE tablename = 'transaction_fx_snapshots' AND cmd = 'SELECT') AND
         (SELECT count(*) = 0 FROM pg_policies WHERE tablename = 'transaction_fx_snapshots' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')),
         'exactly one SELECT policy and no write policies'
  UNION ALL
  SELECT '09_ownership',
         (SELECT count(*) = 1 FROM pg_policies WHERE tablename = 'transaction_fx_snapshots' AND qual LIKE '%auth.uid() = user_id%'),
         'ownership expression matches'
  UNION ALL
  SELECT '10_privileges',
         (SELECT count(*) = 0 FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshots' AND grantee IN ('anon', 'public')) AND
         (SELECT count(*) = 1 FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshots' AND grantee = 'authenticated' AND privilege_type = 'SELECT'),
         'privileges are correct'
  UNION ALL
  SELECT '11_view',
         (SELECT count(*) = 1 FROM information_schema.views WHERE table_name = 'transaction_fx_snapshot_details'),
         'view exists'
  UNION ALL
  SELECT '12_view_types',
         (SELECT data_type = 'text' FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshot_details' AND column_name = 'source_amount') AND
         (SELECT data_type = 'text' FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshot_details' AND column_name = 'rate') AND
         (SELECT data_type = 'text' FROM information_schema.columns WHERE table_name = 'transaction_fx_snapshot_details' AND column_name = 'converted_amount'),
         'view casts to text'
  UNION ALL
  SELECT '13_view_privileges',
         (SELECT count(*) = 0 FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshot_details' AND grantee IN ('anon', 'public')) AND
         (SELECT count(*) = 1 FROM information_schema.role_table_grants WHERE table_name = 'transaction_fx_snapshot_details' AND grantee = 'authenticated' AND privilege_type = 'SELECT'),
         'view privileges correct'
  UNION ALL
  SELECT '14_auto_fx',
         (SELECT is_nullable = 'NO' AND column_default = 'true' FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'auto_fx_enabled'),
         'auto_fx_enabled exists and default true'
  UNION ALL
  SELECT '15_legacy_rls',
         (SELECT count(*) >= 5 FROM pg_class WHERE relname IN ('transactions', 'transfers', 'accounts', 'budgets', 'goals') AND relrowsecurity = true),
         'legacy RLS intact'
  UNION ALL
  SELECT '16_legacy_transfers',
         (SELECT count(*) = 0 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name IN ('to_currency', 'exchange_rate')),
         'transfers remain same-currency'
),
overall AS (
  SELECT '99_OVERALL' AS check_name,
         bool_and(passed) AS passed,
         'All mandatory checks passed' AS detail
  FROM checks
)
SELECT * FROM checks
UNION ALL
SELECT * FROM overall
ORDER BY check_name;
