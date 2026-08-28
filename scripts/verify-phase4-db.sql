DO $$ 
DECLARE
  v_count INT;
  v_type TEXT;
  v_text TEXT;
  passed BOOLEAN := TRUE;
  failed_checks TEXT[] := ARRAY[]::TEXT[];

  PROCEDURE check_cond(name TEXT, condition BOOLEAN, fail_message TEXT) IS
  BEGIN
    IF condition THEN
      RAISE NOTICE 'check_name: % | status: PASS | detail: OK', name;
    ELSE
      RAISE NOTICE 'check_name: % | status: FAIL | detail: %', name, fail_message;
      passed := FALSE;
      failed_checks := array_append(failed_checks, name);
    END IF;
  END;

BEGIN
  RAISE NOTICE '--- PHASE 4 STRUCTURAL VERIFIER ---';

  SELECT count(*) INTO v_count FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions';
  CALL check_cond('1_transactions_table_exists', v_count = 1, 'transactions table not found');

  SELECT count(*) INTO v_count FROM pg_class WHERE relname = 'transactions' AND relrowsecurity = true;
  CALL check_cond('2_transactions_rls_enabled', v_count = 1, 'RLS not enabled');

  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions';
  CALL check_cond('3_exact_three_policies', v_count = 3, 'Expected 3 policies');

  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND cmd = 'DELETE';
  CALL check_cond('5_no_delete_policy', v_count = 0, 'DELETE policy found');

  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount';
  CALL check_cond('6_amount_is_numeric', v_type = 'numeric', 'amount is not numeric');

  SELECT count(*) INTO v_count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'base_amount';
  CALL check_cond('9_no_base_conversion', v_count = 0, 'base conversion column found');

  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'account_balances' AND c.relkind = 'v';
  CALL check_cond('20_account_balances_exists', v_count = 1, 'view not found');

  IF passed THEN
    RAISE NOTICE 'check_name: 99_OVERALL | status: PASS | detail: All strict constraints met';
  ELSE
    RAISE NOTICE 'check_name: 99_OVERALL | status: FAIL | detail: % checks failed', array_length(failed_checks, 1);
  END IF;
END $$;
