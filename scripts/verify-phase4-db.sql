-- ============================================================================
-- FINORA PHASE 4 STRICT DATABASE STRUCTURAL VERIFIER
-- ============================================================================
-- Read-only verifier. Returns one row per check plus 99_OVERALL.
-- 99_OVERALL is PASS only when every mandatory check is PASS.
-- ============================================================================

WITH
expected_policies AS (
    SELECT 'Users can select own transactions'::text AS policy_name, 'SELECT'::text AS cmd UNION ALL
    SELECT 'Users can insert own transactions', 'INSERT' UNION ALL
    SELECT 'Users can update own transactions', 'UPDATE'
),
expected_insert_columns AS (
    SELECT unnest(ARRAY[
        'account_id','amount','category_id','currency_code','merchant',
        'note','occurred_on','type','user_id'
    ]::text[]) AS column_name
),
expected_update_columns AS (
    SELECT unnest(ARRAY[
        'account_id','amount','category_id','currency_code','is_voided',
        'merchant','note','occurred_on','type'
    ]::text[]) AS column_name
),
constraint_columns AS (
    SELECT
        c.oid,
        c.conname,
        c.contype,
        c.conrelid,
        c.confrelid,
        c.confdeltype,
        ARRAY(
            SELECT a.attname::text
            FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_catalog.pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            ORDER BY k.ord
        ) AS source_columns,
        CASE WHEN c.confrelid <> 0 THEN ARRAY(
            SELECT a.attname::text
            FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_catalog.pg_attribute a
              ON a.attrelid = c.confrelid AND a.attnum = k.attnum
            ORDER BY k.ord
        ) ELSE ARRAY[]::text[] END AS referenced_columns,
        pg_catalog.pg_get_constraintdef(c.oid, true) AS definition
    FROM pg_catalog.pg_constraint c
),
checks AS (
    SELECT
        '01_transactions_table_exists' AS check_name,
        to_regclass('public.transactions') IS NOT NULL AS passed,
        COALESCE(to_regclass('public.transactions')::text, 'missing') AS detail

    UNION ALL

    SELECT
        '02_transactions_rls_enabled',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'transactions'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT 'rls=' || c.relrowsecurity::text
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transactions'
        ), 'missing')

    UNION ALL

    SELECT
        '03_transaction_policies_exact',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_policies p
            JOIN expected_policies e
              ON e.policy_name = p.policyname AND e.cmd = p.cmd
            WHERE p.schemaname = 'public'
              AND p.tablename = 'transactions'
              AND array_to_string(p.roles, ',') = 'authenticated'
              AND (
                    (p.cmd = 'SELECT'
                     AND p.qual = '(( SELECT auth.uid() AS uid) = user_id)'
                     AND p.with_check IS NULL)
                 OR (p.cmd = 'INSERT'
                     AND p.qual IS NULL
                     AND p.with_check = '(( SELECT auth.uid() AS uid) = user_id)')
                 OR (p.cmd = 'UPDATE'
                     AND p.qual = '(( SELECT auth.uid() AS uid) = user_id)'
                     AND p.with_check = '(( SELECT auth.uid() AS uid) = user_id)')
              )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename = 'transactions'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_policies e
                  WHERE e.policy_name = p.policyname AND e.cmd = p.cmd
              )
        ),
        COALESCE((
            SELECT string_agg(
                policyname || ':' || cmd || ':' || array_to_string(roles, ',') ||
                ':qual=' || COALESCE(qual, 'NULL') ||
                ':check=' || COALESCE(with_check, 'NULL'),
                ' | ' ORDER BY policyname
            )
            FROM pg_catalog.pg_policies
            WHERE schemaname = 'public' AND tablename = 'transactions'
        ), 'none')

    UNION ALL

    SELECT
        '04_no_delete_policy',
        NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies
            WHERE schemaname = 'public' AND tablename = 'transactions' AND cmd = 'DELETE'
        ),
        'DELETE policy must not exist'

    UNION ALL

    SELECT
        '05_amount_numeric_20_4',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount'
              AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4
        ),
        COALESCE((
            SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount'
        ), 'missing')

    UNION ALL

    SELECT
        '06_positive_amount_constraint_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND contype = 'c'
              AND conname = 'check_transaction_amount_positive'
              AND regexp_replace(definition, '\\s+', '', 'g') = 'CHECK((amount>(0)::numeric))'
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND conname = 'check_transaction_amount_positive'
        ), 'missing')

    UNION ALL

    SELECT
        '07_transaction_type_constraint_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND contype = 'c'
              AND conname = 'check_transaction_type'
              AND regexp_replace(definition, '\\s+', '', 'g') =
                  'CHECK((type=ANY(ARRAY[''INCOME''::text,''EXPENSE''::text])))'
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND conname = 'check_transaction_type'
        ), 'missing')

    UNION ALL

    SELECT
        '08_text_and_currency_constraints_present',
        (
            SELECT count(*) = 3
            FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND contype = 'c'
              AND conname IN ('check_merchant_length','check_note_length','check_currency_code_format')
              AND (
                    (conname = 'check_merchant_length' AND definition LIKE '%200%')
                 OR (conname = 'check_note_length' AND definition LIKE '%1000%')
                 OR (conname = 'check_currency_code_format' AND definition LIKE '%[A-Z]{3,5}%')
              )
        ),
        COALESCE((
            SELECT string_agg(conname || ':' || definition, ' | ' ORDER BY conname)
            FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND conname IN ('check_merchant_length','check_note_length','check_currency_code_format')
        ), 'none')

    UNION ALL

    SELECT
        '09_no_transfer_or_fx_columns',
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND column_name IN (
                  'transfer_id','to_account_id','from_account_id','destination_account_id',
                  'exchange_rate','base_amount','base_amount_vnd','base_currency','converted_balance_vnd'
              )
        ),
        COALESCE((
            SELECT string_agg(column_name, ', ' ORDER BY column_name)
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND column_name IN (
                  'transfer_id','to_account_id','from_account_id','destination_account_id',
                  'exchange_rate','base_amount','base_amount_vnd','base_currency','converted_balance_vnd'
              )
        ), 'none')

    UNION ALL

    SELECT
        '10_account_fk_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND contype = 'f'
              AND conname = 'transactions_account_fkey'
              AND confrelid = 'public.accounts'::regclass
              AND source_columns = ARRAY['account_id','user_id','currency_code']::text[]
              AND referenced_columns = ARRAY['id','user_id','currency_code']::text[]
              AND confdeltype = 'r'
        ),
        COALESCE((
            SELECT source_columns::text || ' -> ' || referenced_columns::text || ':del=' || confdeltype
            FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_account_fkey'
        ), 'missing')

    UNION ALL

    SELECT
        '11_category_fk_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND contype = 'f'
              AND conname = 'transactions_category_fkey'
              AND confrelid = 'public.categories'::regclass
              AND source_columns = ARRAY['category_id','user_id','type']::text[]
              AND referenced_columns = ARRAY['id','user_id','type']::text[]
              AND confdeltype = 'r'
        ),
        COALESCE((
            SELECT source_columns::text || ' -> ' || referenced_columns::text || ':del=' || confdeltype
            FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_category_fkey'
        ), 'missing')

    UNION ALL

    SELECT
        '12_referenced_unique_keys_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.accounts'::regclass
              AND contype = 'u'
              AND conname = 'accounts_id_user_id_currency_code_key'
              AND source_columns = ARRAY['id','user_id','currency_code']::text[]
        )
        AND EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.categories'::regclass
              AND contype = 'u'
              AND conname = 'categories_id_user_id_type_key'
              AND source_columns = ARRAY['id','user_id','type']::text[]
        ),
        'accounts(id,user_id,currency_code) and categories(id,user_id,type)'

    UNION ALL

    SELECT
        '13_updated_at_trigger_exact',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid = 'public.transactions'::regclass
              AND t.tgname = 'set_transactions_updated_at'
              AND NOT t.tgisinternal
              AND t.tgenabled <> 'D'
              AND t.tgfoid = 'public.handle_updated_at()'::regprocedure
        ),
        COALESCE((
            SELECT t.tgname || ':' || t.tgfoid::regprocedure::text
            FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid = 'public.transactions'::regclass
              AND t.tgname = 'set_transactions_updated_at'
        ), 'missing')

    UNION ALL

    SELECT
        '14_anon_public_no_transaction_privileges',
        NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee IN ('anon','PUBLIC')
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee IN ('anon','PUBLIC')
        ),
        'no anon/PUBLIC table or column privileges'

    UNION ALL

    SELECT
        '15_authenticated_table_privileges_exact',
        (
            SELECT count(*) = 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type <> 'SELECT'
        ),
        COALESCE((
            SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated'
        ), 'none')

    UNION ALL

    SELECT
        '16_authenticated_insert_columns_exact',
        (
            SELECT count(*) = 9
            FROM information_schema.column_privileges cp
            JOIN expected_insert_columns e ON e.column_name = cp.column_name
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'INSERT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'INSERT'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_insert_columns e WHERE e.column_name = cp.column_name
              )
        ),
        COALESCE((
            SELECT string_agg(column_name, ', ' ORDER BY column_name)
            FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type = 'INSERT'
        ), 'none')

    UNION ALL

    SELECT
        '17_authenticated_update_columns_exact',
        (
            SELECT count(*) = 9
            FROM information_schema.column_privileges cp
            JOIN expected_update_columns e ON e.column_name = cp.column_name
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'UPDATE'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'UPDATE'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_update_columns e WHERE e.column_name = cp.column_name
              )
        ),
        COALESCE((
            SELECT string_agg(column_name, ', ' ORDER BY column_name)
            FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
        ), 'none')

    UNION ALL

    SELECT
        '18_identity_ownership_timestamp_update_blocked',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
              AND column_name IN ('id','user_id','created_at','updated_at')
        ),
        'id, user_id, created_at, updated_at excluded from UPDATE grants'

    UNION ALL

    SELECT
        '19_account_balances_security_invoker',
        EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'account_balances' AND c.relkind = 'v'
              AND c.reloptions @> ARRAY['security_invoker=true']
        ),
        COALESCE((
            SELECT c.reloptions::text FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'account_balances' AND c.relkind = 'v'
        ), 'missing')

    UNION ALL

    SELECT
        '20_transaction_details_security_invoker',
        EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transaction_details' AND c.relkind = 'v'
              AND c.reloptions @> ARRAY['security_invoker=true']
        ),
        COALESCE((
            SELECT c.reloptions::text FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transaction_details' AND c.relkind = 'v'
        ), 'missing')

    UNION ALL

    SELECT
        '21_exact_money_read_columns_are_text',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'account_balances'
              AND column_name = 'current_balance' AND data_type = 'text'
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transaction_details'
              AND column_name = 'amount' AND data_type = 'text'
        ),
        'account_balances.current_balance=text; transaction_details.amount=text'

    UNION ALL

    SELECT
        '22_view_privileges_exact',
        (
            SELECT count(*) = 2
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('account_balances','transaction_details')
              AND grantee = 'authenticated'
              AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('account_balances','transaction_details')
              AND (
                    grantee IN ('anon','PUBLIC')
                 OR (grantee = 'authenticated' AND privilege_type <> 'SELECT')
              )
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('account_balances','transaction_details')
              AND grantee IN ('anon','PUBLIC','authenticated')
        ),
        COALESCE((
            SELECT string_agg(table_name || ':' || grantee || ':' || privilege_type, ' | ' ORDER BY table_name, grantee, privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name IN ('account_balances','transaction_details')
        ), 'none')

    UNION ALL

    SELECT
        '23_accounts_no_persisted_current_balance',
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'current_balance'
        ),
        'current_balance must remain derived only'

    UNION ALL

    SELECT
        '24_phase2_3_rls_remains_enabled',
        (
            SELECT count(*) = 4
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles','user_settings','accounts','categories')
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT string_agg(c.relname || '=' || c.relrowsecurity::text, ', ' ORDER BY c.relname)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles','user_settings','accounts','categories')
        ), 'none')

    UNION ALL

    SELECT
        '25_transaction_updated_at_not_client_mutable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated'
              AND column_name = 'updated_at'
              AND privilege_type IN ('INSERT','UPDATE')
        ),
        'updated_at is trigger-managed only'

    UNION ALL

    SELECT
        '26_transaction_identity_columns_not_client_insertable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated'
              AND privilege_type = 'INSERT'
              AND column_name IN ('id','created_at','updated_at','is_voided')
        ),
        'id/timestamps/is_voided excluded from INSERT grants'
),
rendered AS (
    SELECT check_name, passed, detail FROM checks
)
SELECT
    check_name,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
    detail
FROM rendered

UNION ALL

SELECT
    '99_OVERALL' AS check_name,
    CASE WHEN bool_and(passed) THEN 'PASS' ELSE 'FAIL' END AS status,
    CASE
        WHEN bool_and(passed) THEN 'All 26 Phase 4 structural/security checks passed'
        ELSE count(*) FILTER (WHERE NOT passed)::text || ' mandatory check(s) failed'
    END AS detail
FROM rendered

ORDER BY check_name;
