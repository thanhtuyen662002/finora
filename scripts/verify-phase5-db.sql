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
expected_tx_policies AS (
    SELECT 'Users can select own transactions'::text AS policy_name, 'SELECT'::text AS cmd UNION ALL
    SELECT 'Users can insert own transactions', 'INSERT' UNION ALL
    SELECT 'Users can update own transactions', 'UPDATE'
),
expected_tx_insert_columns AS (
    SELECT unnest(ARRAY[
        'account_id','amount','category_id','currency_code','merchant',
        'note','occurred_on','type','user_id'
    ]::text[]) AS column_name
),
expected_tx_update_columns AS (
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
    -- 01. Transfers table exists
    SELECT
        '01_transfers_table_exists' AS check_name,
        to_regclass('public.transfers') IS NOT NULL AS passed,
        COALESCE(to_regclass('public.transfers')::text, 'missing') AS detail

    UNION ALL

    -- 02. Transfers RLS enabled
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

    -- 03. Transfer policies exact
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

    -- 04. No DELETE policy on transfers
    SELECT
        '04_no_delete_policy_transfers',
        NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies
            WHERE schemaname = 'public' AND tablename = 'transfers' AND cmd = 'DELETE'
        ),
        'DELETE policy must not exist on transfers'

    UNION ALL

    -- 05. Transfers amount is numeric(20,4)
    SELECT
        '05_transfer_amount_numeric_20_4',
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

    -- 06. Transfer positive amount check constraint
    SELECT
        '06_transfer_positive_amount_constraint_exact',
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

    -- 07. Transfer accounts distinct check constraint
    SELECT
        '07_transfer_accounts_distinct_constraint_exact',
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

    -- 08. Transfer currency code format check constraint
    SELECT
        '08_transfer_currency_code_format_constraint_exact',
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

    -- 09. Transfer note length check constraint
    SELECT
        '09_transfer_note_length_constraint_exact',
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

    -- 10. Transfers from_account composite FK exact
    SELECT
        '10_transfers_from_account_fk_exact',
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

    -- 11. Transfers to_account composite FK exact
    SELECT
        '11_transfers_to_account_fk_exact',
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

    -- 12. No transfer FX columns
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

    -- 13. Transfers updated_at trigger exact
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

    -- 14. Anon/PUBLIC have zero privileges on transfers
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
        'no anon/PUBLIC table or column privileges on transfers'

    UNION ALL

    -- 15. Authenticated transfer table privilege is SELECT only
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

    -- 16. Authenticated transfer INSERT columns exact allowlist
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

    -- 17. Authenticated transfer UPDATE columns exact allowlist
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

    -- 18. Transfer identity/ownership/timestamps update blocked
    SELECT
        '18_transfer_identity_ownership_timestamp_update_blocked',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
              AND column_name IN ('id','user_id','created_at','updated_at')
        ),
        'id, user_id, created_at, updated_at excluded from UPDATE grants on transfers'

    UNION ALL

    -- 19. Transfer identity columns not client insertable
    SELECT
        '19_transfer_identity_columns_not_client_insertable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated'
              AND privilege_type = 'INSERT'
              AND column_name IN ('id','created_at','updated_at','is_voided')
        ),
        'id/timestamps/is_voided excluded from INSERT grants on transfers'

    UNION ALL

    -- 20. Transfer updated_at not client mutable
    SELECT
        '20_transfer_updated_at_not_client_mutable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transfers'
              AND grantee = 'authenticated'
              AND column_name = 'updated_at'
              AND privilege_type IN ('INSERT','UPDATE')
        ),
        'updated_at is trigger-managed only on transfers'

    UNION ALL

    -- 21. Transfer_details view has security_invoker = true
    SELECT
        '21_transfer_details_security_invoker',
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

    -- 22. Transfer_details amount is text
    SELECT
        '22_transfer_details_amount_is_text',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transfer_details'
              AND column_name = 'amount' AND data_type = 'text'
        ),
        'transfer_details.amount=text'

    UNION ALL

    -- 23. Phase 4 transactions table and RLS intact
    SELECT
        '23_phase4_transactions_table_and_rls_intact',
        to_regclass('public.transactions') IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'transactions'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        'transactions table exists with RLS enabled'

    UNION ALL

    -- 24. Phase 4 transaction policies exact
    SELECT
        '24_phase4_transaction_policies_exact',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_policies p
            JOIN expected_tx_policies e
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
                  SELECT 1 FROM expected_tx_policies e
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

    -- 25. Phase 4 no DELETE policy on transactions
    SELECT
        '25_phase4_no_delete_policy_transactions',
        NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies
            WHERE schemaname = 'public' AND tablename = 'transactions' AND cmd = 'DELETE'
        ),
        'DELETE policy must not exist on transactions'

    UNION ALL

    -- 26. Phase 4 transaction table privilege is SELECT only for authenticated
    SELECT
        '26_phase4_transaction_table_privileges_exact',
        (
            SELECT count(*) = 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND (
                    grantee IN ('anon','PUBLIC')
                 OR (grantee = 'authenticated' AND privilege_type <> 'SELECT')
              )
        ),
        'transactions table privilege: authenticated SELECT only'

    UNION ALL

    -- 27. Phase 4 transaction INSERT column allowlist exact
    SELECT
        '27_phase4_transaction_insert_columns_exact',
        (
            SELECT count(DISTINCT cp.column_name) = 9
            FROM information_schema.column_privileges cp
            JOIN expected_tx_insert_columns e ON e.column_name = cp.column_name
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'INSERT'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'INSERT'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_tx_insert_columns e WHERE e.column_name = cp.column_name
              )
        ),
        'transactions INSERT columns exact allowlist of 9 columns'

    UNION ALL

    -- 28. Phase 4 transaction UPDATE column allowlist exact
    SELECT
        '28_phase4_transaction_update_columns_exact',
        (
            SELECT count(DISTINCT cp.column_name) = 9
            FROM information_schema.column_privileges cp
            JOIN expected_tx_update_columns e ON e.column_name = cp.column_name
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'UPDATE'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public' AND cp.table_name = 'transactions'
              AND cp.grantee = 'authenticated' AND cp.privilege_type = 'UPDATE'
              AND NOT EXISTS (
                  SELECT 1 FROM expected_tx_update_columns e WHERE e.column_name = cp.column_name
              )
        ),
        'transactions UPDATE columns exact allowlist of 9 columns'

    UNION ALL

    -- 29. Phase 4 transaction identity/ownership/timestamp update blocked
    SELECT
        '29_phase4_transaction_identity_ownership_timestamp_update_blocked',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
              AND column_name IN ('id','user_id','created_at','updated_at')
        ),
        'id, user_id, created_at, updated_at excluded from UPDATE grants on transactions'

    UNION ALL

    -- 30. Phase 4 transaction identity columns not client insertable
    SELECT
        '30_phase4_transaction_identity_columns_not_client_insertable',
        NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = 'public' AND table_name = 'transactions'
              AND grantee = 'authenticated'
              AND privilege_type = 'INSERT'
              AND column_name IN ('id','created_at','updated_at','is_voided')
        ),
        'id/timestamps/is_voided excluded from INSERT grants on transactions'

    UNION ALL

    -- 31. Phase 4 transaction_details security_invoker and text amount
    SELECT
        '31_phase4_transaction_details_security_invoker_and_text',
        EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'transaction_details' AND c.relkind = 'v'
              AND c.reloptions @> ARRAY['security_invoker=true']
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transaction_details'
              AND column_name = 'amount' AND data_type = 'text'
        ),
        'transaction_details security_invoker=true and amount=text'

    UNION ALL

    -- 32. Account_balances view has security_invoker = true
    SELECT
        '32_account_balances_security_invoker',
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

    -- 33. Account_balances current_balance is text
    SELECT
        '33_account_balances_current_balance_is_text',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'account_balances'
              AND column_name = 'current_balance' AND data_type = 'text'
        ),
        'account_balances.current_balance=text'

    UNION ALL

    -- 34. Account_balances pre-aggregated derivation incorporates all 3 components
    SELECT
        '34_account_balances_pre_aggregated_derivation_exact',
        EXISTS (
            WITH v AS (
                SELECT regexp_replace(lower(definition), '\s+', ' ', 'g') AS norm_def
                FROM pg_catalog.pg_views
                WHERE schemaname = 'public' AND viewname = 'account_balances'
            )
            SELECT 1
            FROM v
            WHERE
              -- 1. tx_totals CTE: grouped by account_id, signed sum with income/expense, is_voided = false
              norm_def ~ 'tx_totals\s+as\s*\(\s*select\s+.*account_id.*sum\s*\(\s*case.*income.*expense.*end\)\s+as\s+net_transactions\s+from\s+(public\.)?transactions\s+where\s+.*is_voided\s*=\s*false.*group\s+by\s+.*account_id'
              -- 2. incoming_transfers CTE: grouped by to_account_id, sum(amount), is_voided = false
              AND norm_def ~ 'incoming_transfers\s+as\s*\(\s*select\s+.*to_account_id.*sum\s*\(\s*.*amount\s*\)\s+as\s+in_transfers\s+from\s+(public\.)?transfers\s+where\s+.*is_voided\s*=\s*false.*group\s+by\s+.*to_account_id'
              -- 3. outgoing_transfers CTE: grouped by from_account_id, sum(amount), is_voided = false
              AND norm_def ~ 'outgoing_transfers\s+as\s*\(\s*select\s+.*from_account_id.*sum\s*\(\s*.*amount\s*\)\s+as\s+out_transfers\s+from\s+(public\.)?transfers\s+where\s+.*is_voided\s*=\s*false.*group\s+by\s+.*from_account_id'
              -- 4. Arithmetic formula: opening_balance + net_transactions + in_transfers - out_transfers
              AND norm_def ~ 'opening_balance.*\+\s*coalesce\s*\(\s*.*net_transactions.*\+\s*coalesce\s*\(\s*.*in_transfers.*-\s*coalesce\s*\(\s*.*out_transfers'
              -- 5. Result cast to text
              AND (norm_def ~ '::text\s+as\s+current_balance' OR norm_def ~ 'cast\(.*as\s+text\)\s+as\s+current_balance')
        ),
        COALESCE((
            SELECT 'definition_length=' || length(definition)::text
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'account_balances'
        ), 'missing')

    UNION ALL

    -- 35. Account_balances active-only semantics for transactions and transfers
    SELECT
        '35_account_balances_active_only_semantics',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'account_balances'
              -- Proves active-only filter is applied in all 3 CTEs (at least 3 distinct occurrences of is_voided = false)
              AND (length(lower(definition)) - length(replace(lower(definition), 'is_voided', ''))) / length('is_voided') >= 3
              AND (
                  (length(lower(definition)) - length(replace(lower(definition), 'false', ''))) / length('false') >= 3
                  OR (length(lower(definition)) - length(replace(lower(definition), 'not is_voided', ''))) / length('not is_voided') >= 3
              )
              AND definition ~* 'transactions.*WHERE.*is_voided[[:space:]]*=[[:space:]]*false'
              AND definition ~* 'transfers.*WHERE.*is_voided[[:space:]]*=[[:space:]]*false'
        ),
        'account_balances filters is_voided = false on transactions and transfers'

    UNION ALL

    -- 36. Exact view privileges across all 3 views
    SELECT
        '36_view_privileges_exact',
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

    -- 37. Accounts has no persisted current_balance column
    SELECT
        '37_accounts_no_persisted_current_balance',
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'current_balance'
        ),
        'current_balance must remain derived only'

    UNION ALL

    -- 38. Phase 2, 3, 4, 5 tables RLS enabled
    SELECT
        '38_phase2_3_4_5_rls_remains_enabled',
        (
            SELECT count(*) = 6
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles','user_settings','accounts','categories','transactions','transfers')
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT string_agg(c.relname || '=' || c.relrowsecurity::text, ', ' ORDER BY c.relname)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles','user_settings','accounts','categories','transactions','transfers')
        ), 'none')
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
        WHEN bool_and(passed) THEN 'All 38 Phase 5 structural, derivation, non-regression, and security checks passed'
        ELSE count(*) FILTER (WHERE NOT passed)::text || ' mandatory check(s) failed'
    END AS detail
FROM rendered

ORDER BY check_name;
