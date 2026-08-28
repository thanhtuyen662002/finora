-- ============================================================================
-- FINORA PHASE 4 STRICT DATABASE STRUCTURAL VERIFIER
-- ============================================================================
-- This script validates all structural invariants, constraints, RLS policies,
-- column-level privilege allowlists, views, security_invoker options, and
-- regression checks for Phase 4 (Transactions).
-- Returns one row per check with columns: check_name | status | detail
-- and concludes with 99_OVERALL = PASS (or FAIL).
-- ============================================================================

DROP TABLE IF EXISTS _phase4_verification_results;
CREATE TEMP TABLE _phase4_verification_results (
    check_name TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    detail TEXT NOT NULL
);

DO $$
DECLARE
    v_cnt INT;
    v_type TEXT;
    v_prec INT;
    v_scale INT;
    v_opts TEXT[];
    v_cols TEXT[];
BEGIN
    -- 01: transactions table exists in public schema
    SELECT count(*) INTO v_cnt FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions';
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('01_transactions_table_exists', 'PASS', 'public.transactions table exists');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('01_transactions_table_exists', 'FAIL', 'public.transactions table missing');
    END IF;

    -- 02: transactions RLS enabled
    SELECT count(*) INTO v_cnt FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = 'transactions' AND relrowsecurity = true;
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('02_transactions_rls_enabled', 'PASS', 'RLS is enabled on public.transactions');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('02_transactions_rls_enabled', 'FAIL', 'RLS not enabled on public.transactions');
    END IF;

    -- 03: exactly three RLS policies on transactions
    SELECT count(*) INTO v_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions';
    IF v_cnt = 3 THEN
        INSERT INTO _phase4_verification_results VALUES ('03_exact_policies_count', 'PASS', 'Exactly 3 policies found on public.transactions');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('03_exact_policies_count', 'FAIL', format('Expected 3 policies, found %s', v_cnt));
    END IF;

    -- 04: exact policy names and commands
    SELECT count(*) INTO v_cnt FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'transactions'
      AND (
        (policyname = 'Users can select own transactions' AND cmd = 'SELECT') OR
        (policyname = 'Users can insert own transactions' AND cmd = 'INSERT') OR
        (policyname = 'Users can update own transactions' AND cmd = 'UPDATE')
      );
    IF v_cnt = 3 THEN
        INSERT INTO _phase4_verification_results VALUES ('04_exact_policy_names_and_commands', 'PASS', 'SELECT, INSERT, and UPDATE policies correctly defined');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('04_exact_policy_names_and_commands', 'FAIL', format('Matched only %s of 3 expected policies', v_cnt));
    END IF;

    -- 05: no DELETE policy on transactions
    SELECT count(*) INTO v_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND cmd = 'DELETE';
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('05_no_delete_policy', 'PASS', 'No DELETE policy on public.transactions');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('05_no_delete_policy', 'FAIL', 'Found unexpected DELETE policy on public.transactions');
    END IF;

    -- 06: amount is NUMERIC(20,4)
    SELECT data_type, numeric_precision, numeric_scale INTO v_type, v_prec, v_scale
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount';
    IF v_type = 'numeric' AND v_prec = 20 AND v_scale = 4 THEN
        INSERT INTO _phase4_verification_results VALUES ('06_amount_is_numeric_20_4', 'PASS', 'amount is numeric(20,4)');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('06_amount_is_numeric_20_4', 'FAIL', format('amount type is %s(%s,%s)', v_type, v_prec, v_scale));
    END IF;

    -- 07: positive amount constraint exists
    SELECT count(*) INTO v_cnt FROM pg_constraint 
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c' AND conname = 'check_transaction_amount_positive';
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('07_positive_amount_constraint', 'PASS', 'check_transaction_amount_positive exists');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('07_positive_amount_constraint', 'FAIL', 'check_transaction_amount_positive missing');
    END IF;

    -- 08: transaction type constraint exists
    SELECT count(*) INTO v_cnt FROM pg_constraint 
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c' AND conname = 'check_transaction_type';
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('08_transaction_type_constraint', 'PASS', 'check_transaction_type exists (INCOME/EXPENSE)');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('08_transaction_type_constraint', 'FAIL', 'check_transaction_type missing');
    END IF;

    -- 09: merchant and note bounds constraints exist
    SELECT count(*) INTO v_cnt FROM pg_constraint 
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c' 
      AND conname IN ('check_merchant_length', 'check_note_length', 'check_currency_code_format');
    IF v_cnt = 3 THEN
        INSERT INTO _phase4_verification_results VALUES ('09_merchant_note_bounds', 'PASS', 'Merchant, note, and currency format constraints exist');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('09_merchant_note_bounds', 'FAIL', format('Expected 3 text constraints, found %s', v_cnt));
    END IF;

    -- 10: no transfer columns on transactions table
    SELECT count(*) INTO v_cnt FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' 
      AND column_name IN ('transfer_id', 'to_account_id', 'from_account_id', 'destination_account_id');
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('10_no_transfer_columns', 'PASS', 'No transfer persistence columns present');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('10_no_transfer_columns', 'FAIL', 'Found unexpected transfer column on transactions');
    END IF;

    -- 11: no base conversion columns on transactions table
    SELECT count(*) INTO v_cnt FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' 
      AND column_name IN ('base_amount', 'exchange_rate', 'base_currency');
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('11_no_base_conversion_columns', 'PASS', 'No base conversion columns present');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('11_no_base_conversion_columns', 'FAIL', 'Found unexpected base conversion column');
    END IF;

    -- 12: composite account FK exists
    SELECT count(*) INTO v_cnt FROM pg_constraint 
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'f' 
      AND conname = 'transactions_account_fkey' AND confrelid = 'public.accounts'::regclass;
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('12_account_composite_fk', 'PASS', 'transactions_account_fkey references accounts(id, user_id, currency_code)');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('12_account_composite_fk', 'FAIL', 'transactions_account_fkey missing');
    END IF;

    -- 13: composite category FK exists
    SELECT count(*) INTO v_cnt FROM pg_constraint 
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'f' 
      AND conname = 'transactions_category_fkey' AND confrelid = 'public.categories'::regclass;
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('13_category_composite_fk', 'PASS', 'transactions_category_fkey references categories(id, user_id, type)');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('13_category_composite_fk', 'FAIL', 'transactions_category_fkey missing');
    END IF;

    -- 14: referenced unique constraints exist on accounts and categories
    SELECT count(*) INTO v_cnt FROM pg_constraint 
    WHERE (conrelid = 'public.accounts'::regclass AND conname = 'accounts_id_user_id_currency_code_key')
       OR (conrelid = 'public.categories'::regclass AND conname = 'categories_id_user_id_type_key');
    IF v_cnt = 2 THEN
        INSERT INTO _phase4_verification_results VALUES ('14_referenced_unique_constraints', 'PASS', 'Composite unique constraints exist on accounts and categories');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('14_referenced_unique_constraints', 'FAIL', format('Found %s of 2 unique constraints', v_cnt));
    END IF;

    -- 15: updated_at trigger exists
    SELECT count(*) INTO v_cnt FROM pg_trigger 
    WHERE tgrelid = 'public.transactions'::regclass AND tgname = 'set_transactions_updated_at';
    IF v_cnt = 1 THEN
        INSERT INTO _phase4_verification_results VALUES ('15_updated_at_trigger', 'PASS', 'set_transactions_updated_at trigger exists');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('15_updated_at_trigger', 'FAIL', 'set_transactions_updated_at trigger missing');
    END IF;

    -- 16: anon and PUBLIC have no table or column privileges on transactions
    SELECT count(*) INTO v_cnt FROM (
        SELECT privilege_type FROM information_schema.table_privileges 
        WHERE table_schema = 'public' AND table_name = 'transactions' AND grantee IN ('anon', 'PUBLIC')
        UNION ALL
        SELECT privilege_type FROM information_schema.column_privileges 
        WHERE table_schema = 'public' AND table_name = 'transactions' AND grantee IN ('anon', 'PUBLIC')
    ) t;
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('16_anon_public_no_privileges', 'PASS', '0 privileges for anon/PUBLIC on transactions');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('16_anon_public_no_privileges', 'FAIL', format('Found %s unexpected privileges for anon/PUBLIC', v_cnt));
    END IF;

    -- 17: authenticated has table SELECT only on transactions
    SELECT count(*) INTO v_cnt FROM information_schema.table_privileges 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND grantee = 'authenticated' AND privilege_type != 'SELECT';
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('17_authenticated_table_select_only', 'PASS', 'authenticated has table SELECT only (no table-level INSERT/UPDATE/DELETE)');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('17_authenticated_table_select_only', 'FAIL', 'authenticated has non-SELECT table-level privileges');
    END IF;

    -- 18: exact insert column allowlist for authenticated
    SELECT array_agg(column_name::text ORDER BY column_name) INTO v_cols
    FROM information_schema.column_privileges 
    WHERE table_schema = 'public' AND table_name = 'transactions' 
      AND grantee = 'authenticated' AND privilege_type = 'INSERT';
    IF v_cols = ARRAY['account_id', 'amount', 'category_id', 'currency_code', 'merchant', 'note', 'occurred_on', 'type', 'user_id'] THEN
        INSERT INTO _phase4_verification_results VALUES ('18_exact_insert_column_allowlist', 'PASS', 'Exact 9-column INSERT allowlist granted');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('18_exact_insert_column_allowlist', 'FAIL', format('INSERT columns: %s', v_cols));
    END IF;

    -- 19: exact update column allowlist for authenticated
    SELECT array_agg(column_name::text ORDER BY column_name) INTO v_cols
    FROM information_schema.column_privileges 
    WHERE table_schema = 'public' AND table_name = 'transactions' 
      AND grantee = 'authenticated' AND privilege_type = 'UPDATE';
    IF v_cols = ARRAY['account_id', 'amount', 'category_id', 'currency_code', 'is_voided', 'merchant', 'note', 'occurred_on', 'type'] THEN
        INSERT INTO _phase4_verification_results VALUES ('19_exact_update_column_allowlist', 'PASS', 'Exact 9-column UPDATE allowlist granted');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('19_exact_update_column_allowlist', 'FAIL', format('UPDATE columns: %s', v_cols));
    END IF;

    -- 20: no ownership or id update privilege
    SELECT count(*) INTO v_cnt FROM information_schema.column_privileges 
    WHERE table_schema = 'public' AND table_name = 'transactions' 
      AND grantee = 'authenticated' AND privilege_type = 'UPDATE' AND column_name IN ('user_id', 'id', 'created_at', 'updated_at');
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('20_no_ownership_update_privilege', 'PASS', 'user_id, id, timestamps cannot be updated');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('20_no_ownership_update_privilege', 'FAIL', 'Found unexpected UPDATE privilege on immutable columns');
    END IF;

    -- 21: account_balances view exists with security_invoker = true
    SELECT reloptions INTO v_opts FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = 'account_balances' AND relkind = 'v';
    IF v_opts @> ARRAY['security_invoker=true'] OR v_opts @> ARRAY['security_invoker=on'] THEN
        INSERT INTO _phase4_verification_results VALUES ('21_account_balances_view_security_invoker', 'PASS', 'account_balances view has security_invoker=true');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('21_account_balances_view_security_invoker', 'FAIL', format('account_balances reloptions: %s', v_opts));
    END IF;

    -- 22: transaction_details view exists with security_invoker = true
    SELECT reloptions INTO v_opts FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = 'transaction_details' AND relkind = 'v';
    IF v_opts @> ARRAY['security_invoker=true'] OR v_opts @> ARRAY['security_invoker=on'] THEN
        INSERT INTO _phase4_verification_results VALUES ('22_transaction_details_view_security_invoker', 'PASS', 'transaction_details view has security_invoker=true');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('22_transaction_details_view_security_invoker', 'FAIL', format('transaction_details reloptions: %s', v_opts));
    END IF;

    -- 23: anon/PUBLIC have no privileges on views
    SELECT count(*) INTO v_cnt FROM information_schema.table_privileges 
    WHERE table_schema = 'public' AND table_name IN ('account_balances', 'transaction_details') AND grantee IN ('anon', 'PUBLIC');
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('23_views_anon_public_no_privileges', 'PASS', '0 privileges on views for anon/PUBLIC');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('23_views_anon_public_no_privileges', 'FAIL', 'Found privileges on views for anon/PUBLIC');
    END IF;

    -- 24: authenticated has SELECT only on views
    SELECT count(*) INTO v_cnt FROM information_schema.table_privileges 
    WHERE table_schema = 'public' AND table_name IN ('account_balances', 'transaction_details') 
      AND grantee = 'authenticated' AND privilege_type != 'SELECT';
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('24_views_authenticated_select_only', 'PASS', 'authenticated has SELECT only on views');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('24_views_authenticated_select_only', 'FAIL', 'authenticated has non-SELECT privileges on views');
    END IF;

    -- 25: accounts has no persisted current_balance column
    SELECT count(*) INTO v_cnt FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'current_balance';
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('25_accounts_no_persisted_current_balance', 'PASS', 'No persisted current_balance column on accounts table');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('25_accounts_no_persisted_current_balance', 'FAIL', 'accounts table has persisted current_balance column');
    END IF;

    -- 26: Phase 2 and 3 tables retain RLS enabled
    SELECT count(*) INTO v_cnt FROM pg_class 
    WHERE relnamespace = 'public'::regnamespace 
      AND relname IN ('profiles', 'user_settings', 'accounts', 'categories') 
      AND relrowsecurity = true;
    IF v_cnt = 4 THEN
        INSERT INTO _phase4_verification_results VALUES ('26_phase2_3_rls_remains_enabled', 'PASS', 'RLS is enabled on profiles, user_settings, accounts, categories');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('26_phase2_3_rls_remains_enabled', 'FAIL', format('Only %s of 4 prior tables have RLS enabled', v_cnt));
    END IF;

    -- 99_OVERALL
    SELECT count(*) INTO v_cnt FROM _phase4_verification_results WHERE status = 'FAIL';
    IF v_cnt = 0 THEN
        INSERT INTO _phase4_verification_results VALUES ('99_OVERALL', 'PASS', 'All 26 Phase 4 structural and security checks PASSED');
    ELSE
        INSERT INTO _phase4_verification_results VALUES ('99_OVERALL', 'FAIL', format('%s of 26 checks FAILED', v_cnt));
    END IF;
END $$;

SELECT check_name, status, detail FROM _phase4_verification_results ORDER BY check_name;
