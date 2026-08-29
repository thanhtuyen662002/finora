-- ============================================================================
-- FINORA PHASE 5 STRICT DATABASE STRUCTURAL VERIFIER
-- ============================================================================
-- Read-only verifier. Returns one row per check plus 99_OVERALL.
-- 99_OVERALL is PASS only when every mandatory check is PASS.
-- ============================================================================

WITH
expected_transfer_policies AS (
    SELECT 'Users can select own transfers'::text AS policy_name, 'SELECT'::text AS cmd UNION ALL
    SELECT 'Users can insert own transfers', 'INSERT' UNION ALL
    SELECT 'Users can update own transfers', 'UPDATE'
),
expected_transfer_insert_columns AS (
    SELECT unnest(ARRAY[
        'amount','currency_code','from_account_id','note','occurred_on',
        'to_account_id','user_id'
    ]::text[]) AS column_name
),
expected_transfer_update_columns AS (
    SELECT unnest(ARRAY[
        'amount','currency_code','from_account_id','is_voided','note',
        'occurred_on','to_account_id'
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
        '01_transfers_table_exists' AS check_name,
        to_regclass('public.transfers') IS NOT NULL AS passed,
        COALESCE(to_regclass('public.transfers')::text, 'missing') AS detail

    UNION ALL

    SELECT
        '02_transfers_rls_enabled',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'transfers'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT 'rls=' || c.relrowsecurity::text
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transfers'
        ), 'missing')

    UNION ALL

    SELECT
        '03_transfer_policies_exact',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_policies p
            JOIN expected_transfer_policies e
              ON e.policy_name = p.policyname AND e.cmd = p.cmd
            WHERE p.schemaname = 'public'
              AND p.tablename = 'transfers'
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
              AND p.tablename = 'transfers'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_transfer_policies e
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
            WHERE schemaname = 'public' AND tablename = 'transfers'
        ), 'none')

    UNION ALL

    SELECT
        '04_no_delete_policy',
        NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies
            WHERE schemaname = 'public' AND tablename = 'transfers' AND cmd = 'DELETE'
        ),
        'DELETE policy must not exist'

    UNION ALL

    SELECT
        '05_amount_numeric_20_4',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name = 'amount'
              AND data_type = 'numeric' AND numeric_precision = 20 AND numeric_scale = 4
        ),
        COALESCE((
            SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name = 'amount'
        ), 'missing')

    UNION ALL

    SELECT
        '06_positive_amount_constraint_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND contype = 'c'
              AND conname = 'check_transfer_amount_positive'
              AND regexp_replace(definition, '[[:space:]]+', '', 'g') IN (
                  'CHECK((amount>(0)::numeric))',
                  'CHECK((amount>0::numeric))',
                  'CHECK(amount>(0)::numeric)',
                  'CHECK(amount>0::numeric)'
              )
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND conname = 'check_transfer_amount_positive'
        ), 'missing')

    UNION ALL

    SELECT
        '07_accounts_distinct_constraint_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND contype = 'c'
              AND conname = 'check_transfer_accounts_distinct'
              AND regexp_replace(definition, '[[:space:]]+', '', 'g') IN (
                  'CHECK((from_account_id<>to_account_id))',
                  'CHECK(from_account_id<>to_account_id)'
              )
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND conname = 'check_transfer_accounts_distinct'
        ), 'missing')

    UNION ALL

    SELECT
        '08_currency_code_format_constraint_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND contype = 'c'
              AND conname = 'check_transfer_currency_code_format'
              AND definition LIKE '%[A-Z]{3,5}%'
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND conname = 'check_transfer_currency_code_format'
        ), 'missing')

    UNION ALL

    SELECT
        '09_note_length_constraint_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND contype = 'c'
              AND conname = 'check_transfer_note_length'
              AND definition LIKE '%1000%'
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND conname = 'check_transfer_note_length'
        ), 'missing')

    UNION ALL

    SELECT
        '10_from_account_fk_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND contype = 'f'
              AND conname = 'transfers_from_account_fkey'
              AND confrelid = 'public.accounts'::regclass
              AND source_columns = ARRAY['from_account_id','user_id','currency_code']::text[]
              AND referenced_columns = ARRAY['id','user_id','currency_code']::text[]
              AND confdeltype = 'r'
        ),
        COALESCE((
            SELECT source_columns::text || ' -> ' || referenced_columns::text || ':del=' || confdeltype::text
            FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass AND conname = 'transfers_from_account_fkey'
        ), 'missing')

    UNION ALL

    SELECT
        '11_to_account_fk_exact',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass
              AND contype = 'f'
              AND conname = 'transfers_to_account_fkey'
              AND confrelid = 'public.accounts'::regclass
              AND source_columns = ARRAY['to_account_id','user_id','currency_code']::text[]
              AND referenced_columns = ARRAY['id','user_id','currency_code']::text[]
              AND confdeltype = 'r'
        ),
        COALESCE((
            SELECT source_columns::text || ' -> ' || referenced_columns::text || ':del=' || confdeltype::text
            FROM constraint_columns
            WHERE conrelid = 'public.transfers'::regclass AND conname = 'transfers_to_account_fkey'
        ), 'missing')

    UNION ALL

    SELECT
        '12_no_transfer_fx_columns',
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND column_name IN (
                  'exchange_rate','base_amount','base_amount_vnd','base_currency','to_currency_code','from_currency_code'
              )
        ),
        COALESCE((
            SELECT string_agg(column_name, ', ' ORDER BY column_name)
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND column_name IN (
                  'exchange_rate','base_amount','base_amount_vnd','base_currency','to_currency_code','from_currency_code'
              )
        ), 'none')

    UNION ALL

    SELECT
        '13_transfers_updated_at_trigger_exact',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid = 'public.transfers'::regclass
              AND t.tgname = 'set_transfers_updated_at'
              AND NOT t.tgisinternal
              AND t.tgenabled <> 'D'
              AND t.tgfoid = 'public.handle_updated_at()'::regprocedure
        ),
        COALESCE((
            SELECT t.tgname || ':' || t.tgfoid::regprocedure::text
            FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid = 'public.transfers'::regclass
              AND t.tgname = 'set_transfers_updated_at'
        ), 'missing')

    UNION ALL

    SELECT
        '14_anon_public_no_transfer_privileges',
        NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee IN ('anon','PUBLIC')
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee IN ('anon','PUBLIC')
        ),
        'no anon/PUBLIC table or column privileges'

    UNION ALL

    SELECT
        '15_authenticated_transfer_table_privileges_exact',
        (
            SELECT count(*) = 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated' AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated' AND privilege_type <> 'SELECT'
        ),
        COALESCE((
            SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated'
        ), 'none')

    UNION ALL

    SELECT
        '16_authenticated_transfer_insert_columns_exact',
        (
            SELECT count(DISTINCT cp.column_name) = 7
            FROM information_schema.column_privileges cp
            JOIN expected_transfer_insert_columns e ON e.column_name = cp.column_name
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transfers'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'INSERT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transfers'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'INSERT'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_transfer_insert_columns e WHERE e.column_name = cp.column_name
              )
        ),
        COALESCE((
            SELECT string_agg(column_name, ', ' ORDER BY column_name)
            FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated' AND privilege_type = 'INSERT'
        ), 'none')

    UNION ALL

    SELECT
        '17_authenticated_transfer_update_columns_exact',
        (
            SELECT count(DISTINCT cp.column_name) = 7
            FROM information_schema.column_privileges cp
            JOIN expected_transfer_update_columns e ON e.column_name = cp.column_name
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transfers'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'UPDATE'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transfers'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'UPDATE'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_transfer_update_columns e WHERE e.column_name = cp.column_name
              )
        ),
        COALESCE((
            SELECT string_agg(column_name, ', ' ORDER BY column_name)
            FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
        ), 'none')

    UNION ALL

    SELECT
        '18_transfer_identity_ownership_timestamp_update_blocked',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
              AND column_name IN ('id','user_id','created_at','updated_at')
        ),
        'id, user_id, created_at, updated_at excluded from UPDATE grants'

    UNION ALL

    SELECT
        '19_transfer_details_security_invoker',
        EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transfer_details' AND c.relkind = 'v'
              AND c.reloptions @> ARRAY['security_invoker=true']
        ),
        COALESCE((
            SELECT c.reloptions::text FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transfer_details' AND c.relkind = 'v'
        ), 'missing')

    UNION ALL

    SELECT
        '20_transfer_details_amount_is_text',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transfer_details'
              AND column_name = 'amount' AND data_type = 'text'
        ),
        'transfer_details.amount=text'

    UNION ALL

    SELECT
        '21_account_balances_security_invoker',
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
        '22_account_balances_current_balance_is_text',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'account_balances'
              AND column_name = 'current_balance' AND data_type = 'text'
        ),
        'account_balances.current_balance=text'

    UNION ALL

    SELECT
        '23_view_privileges_exact',
        (
            SELECT count(*) = 3
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('account_balances','transaction_details','transfer_details')
              AND grantee = 'authenticated'
              AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('account_balances','transaction_details','transfer_details')
              AND (
                    grantee IN ('anon','PUBLIC')
                 OR (grantee = 'authenticated' AND privilege_type <> 'SELECT')
              )
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('account_balances','transaction_details','transfer_details')
              AND (
                    grantee IN ('anon','PUBLIC')
                 OR (grantee = 'authenticated' AND privilege_type <> 'SELECT')
              )
        ),
        COALESCE((
            SELECT string_agg(table_name || ':' || grantee || ':' || privilege_type, ' | ' ORDER BY table_name, grantee, privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name IN ('account_balances','transaction_details','transfer_details')
        ), 'none')

    UNION ALL

    SELECT
        '24_accounts_no_persisted_current_balance',
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'current_balance'
        ),
        'current_balance must remain derived only'

    UNION ALL

    SELECT
        '25_transactions_type_constraint_still_income_expense',
        EXISTS (
            SELECT 1 FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND contype = 'c'
              AND conname = 'check_transaction_type'
              AND regexp_replace(definition, '[[:space:]]+', '', 'g') IN (
                  'CHECK((type=ANY(ARRAY[''INCOME''::text,''EXPENSE''::text])))',
                  'CHECK(type=ANY(ARRAY[''INCOME''::text,''EXPENSE''::text]))'
              )
        ),
        COALESCE((
            SELECT definition FROM constraint_columns
            WHERE conrelid = 'public.transactions'::regclass
              AND conname = 'check_transaction_type'
        ), 'missing')

    UNION ALL

    SELECT
        '26_phase2_3_4_rls_remains_enabled',
        (
            SELECT count(*) = 5
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles','user_settings','accounts','categories','transactions')
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT string_agg(c.relname || '=' || c.relrowsecurity::text, ', ' ORDER BY c.relname)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles','user_settings','accounts','categories','transactions')
        ), 'none')

    UNION ALL

    SELECT
        '27_transfer_updated_at_not_client_mutable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated'
              AND column_name = 'updated_at'
              AND privilege_type IN ('INSERT','UPDATE')
        ),
        'updated_at is trigger-managed only'

    UNION ALL

    SELECT
        '28_transfer_identity_columns_not_client_insertable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
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
        WHEN bool_and(passed) THEN 'All 28 Phase 5 structural/security checks passed'
        ELSE count(*) FILTER (WHERE NOT passed)::text || ' mandatory check(s) failed'
    END AS detail
FROM rendered

ORDER BY check_name;
