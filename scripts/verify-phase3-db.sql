WITH expected_tables AS (
    SELECT 'accounts' AS table_name UNION ALL
    SELECT 'categories'
),
expected_policies AS (
    SELECT 'accounts' AS table_name, 'Users can select own accounts' AS policy_name UNION ALL
    SELECT 'accounts', 'Users can insert own accounts' UNION ALL
    SELECT 'accounts', 'Users can update own accounts' UNION ALL
    SELECT 'categories', 'Users can select own categories' UNION ALL
    SELECT 'categories', 'Users can insert own categories' UNION ALL
    SELECT 'categories', 'Users can update own categories'
),
expected_insert_columns AS (
    SELECT 'accounts' AS table_name, 'user_id' AS column_name UNION ALL
    SELECT 'accounts', 'name' UNION ALL
    SELECT 'accounts', 'type' UNION ALL
    SELECT 'accounts', 'currency_code' UNION ALL
    SELECT 'accounts', 'opening_balance' UNION ALL
    SELECT 'accounts', 'institution' UNION ALL
    SELECT 'accounts', 'color' UNION ALL
    SELECT 'accounts', 'is_archived' UNION ALL
    SELECT 'categories', 'user_id' UNION ALL
    SELECT 'categories', 'name' UNION ALL
    SELECT 'categories', 'type' UNION ALL
    SELECT 'categories', 'icon' UNION ALL
    SELECT 'categories', 'color' UNION ALL
    SELECT 'categories', 'is_archived'
),
expected_update_columns AS (
    SELECT 'accounts' AS table_name, 'name' AS column_name UNION ALL
    SELECT 'accounts', 'type' UNION ALL
    SELECT 'accounts', 'currency_code' UNION ALL
    SELECT 'accounts', 'opening_balance' UNION ALL
    SELECT 'accounts', 'institution' UNION ALL
    SELECT 'accounts', 'color' UNION ALL
    SELECT 'accounts', 'is_archived' UNION ALL
    SELECT 'categories', 'name' UNION ALL
    SELECT 'categories', 'type' UNION ALL
    SELECT 'categories', 'icon' UNION ALL
    SELECT 'categories', 'color' UNION ALL
    SELECT 'categories', 'is_archived'
),
checks AS (
    SELECT
        '01_tables_exist' AS check_name,
        (
            SELECT count(*) = 2
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
        ) AS passed,
        COALESCE((
            SELECT string_agg(table_name, ', ' ORDER BY table_name)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
        ), 'none') AS detail

    UNION ALL

    SELECT
        '02_rls_enabled',
        (
            SELECT count(*) = 2
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('accounts', 'categories')
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT string_agg(c.relname || '=' || c.relrowsecurity::text, ', ' ORDER BY c.relname)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('accounts', 'categories')
        ), 'none')

    UNION ALL

    SELECT
        '03_rls_policies_exact',
        (
            SELECT count(*) = 6
            FROM pg_catalog.pg_policies p
            JOIN expected_policies e ON e.table_name = p.tablename AND e.policy_name = p.policyname
            WHERE p.schemaname = 'public'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename IN ('accounts', 'categories')
              AND NOT EXISTS (
                  SELECT 1
                  FROM expected_policies e
                  WHERE e.table_name = p.tablename AND e.policy_name = p.policyname
              )
        ),
        COALESCE((
            SELECT string_agg(tablename || ':' || policyname || ':' || cmd, ' | ' ORDER BY tablename, policyname)
            FROM pg_catalog.pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('accounts', 'categories')
        ), 'none')

    UNION ALL

    SELECT
        '04_updated_at_triggers',
        (
            SELECT count(*) = 2
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND (
                    (c.relname = 'accounts' AND t.tgname = 'set_accounts_updated_at')
                 OR (c.relname = 'categories' AND t.tgname = 'set_categories_updated_at')
              )
              AND NOT t.tgisinternal
        ),
        COALESCE((
            SELECT string_agg(c.relname || ':' || t.tgname, ', ' ORDER BY c.relname, t.tgname)
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('accounts', 'categories')
              AND NOT t.tgisinternal
        ), 'none')

    UNION ALL

    SELECT
        '05_function_security',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'seed_default_categories'
              AND p.prosecdef = true
              AND COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%'
        )
        AND EXISTS (
            SELECT 1
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'handle_new_user_categories'
              AND p.prosecdef = true
              AND COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%'
        ),
        COALESCE((
            SELECT string_agg(
                p.proname || ':security_definer=' || p.prosecdef::text || ':config=' || COALESCE(array_to_string(p.proconfig, ','), ''),
                ' | ' ORDER BY p.proname
            )
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('seed_default_categories', 'handle_new_user_categories')
        ), 'none')

    UNION ALL

    SELECT
        '06_anon_public_no_privileges',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
              AND grantee IN ('anon', 'PUBLIC')
        ),
        COALESCE((
            SELECT string_agg(grantee || ':' || table_name || ':' || privilege_type, ' | ' ORDER BY grantee, table_name, privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
              AND grantee IN ('anon', 'PUBLIC')
        ), 'no anon/public table privileges')

    UNION ALL

    SELECT
        '07_authenticated_table_privileges_exact',
        (
            SELECT count(*) = 2
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
              AND grantee = 'authenticated'
              AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
              AND grantee = 'authenticated'
              AND privilege_type <> 'SELECT'
        ),
        COALESCE((
            SELECT string_agg(table_name || ':' || privilege_type, ' | ' ORDER BY table_name, privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'categories')
              AND grantee = 'authenticated'
        ), 'none')

    UNION ALL

    SELECT
        '08_authenticated_insert_columns_exact',
        (
            SELECT count(DISTINCT cp.table_name || '.' || cp.column_name) = 14
            FROM information_schema.column_privileges cp
            JOIN expected_insert_columns e
              ON e.table_name = cp.table_name
             AND e.column_name = cp.column_name
            WHERE cp.table_schema = 'public'
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'INSERT'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public'
              AND cp.table_name IN ('accounts', 'categories')
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'INSERT'
              AND NOT EXISTS (
                  SELECT 1
                  FROM expected_insert_columns e
                  WHERE e.table_name = cp.table_name
                    AND e.column_name = cp.column_name
              )
        ),
        COALESCE((
            SELECT string_agg(cp.table_name || '.' || cp.column_name, ', ' ORDER BY cp.table_name, cp.column_name)
            FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public'
              AND cp.table_name IN ('accounts', 'categories')
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'INSERT'
        ), 'none')

    UNION ALL

    SELECT
        '09_authenticated_update_columns_exact',
        (
            SELECT count(DISTINCT cp.table_name || '.' || cp.column_name) = 12
            FROM information_schema.column_privileges cp
            JOIN expected_update_columns e
              ON e.table_name = cp.table_name
             AND e.column_name = cp.column_name
            WHERE cp.table_schema = 'public'
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'UPDATE'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public'
              AND cp.table_name IN ('accounts', 'categories')
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'UPDATE'
              AND NOT EXISTS (
                  SELECT 1
                  FROM expected_update_columns e
                  WHERE e.table_name = cp.table_name
                    AND e.column_name = cp.column_name
              )
        ),
        COALESCE((
            SELECT string_agg(cp.table_name || '.' || cp.column_name, ', ' ORDER BY cp.table_name, cp.column_name)
            FROM information_schema.column_privileges cp
            WHERE cp.table_schema = 'public'
              AND cp.table_name IN ('accounts', 'categories')
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'UPDATE'
        ), 'none')

    UNION ALL

    SELECT
        '10_opening_balance_type',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'accounts'
              AND column_name = 'opening_balance'
              AND data_type = 'numeric'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'accounts'
              AND column_name IN ('current_balance', 'converted_balance_vnd', 'monthly_inflow', 'monthly_outflow')
        ),
        COALESCE((
            SELECT string_agg(column_name || ':' || data_type, ', ' ORDER BY column_name)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'accounts'
        ), 'none')

    UNION ALL

    SELECT
        '11_categories_backfill_complete',
        NOT EXISTS (
            SELECT u.id, b.type, b.name
            FROM auth.users u
            CROSS JOIN (
                VALUES
                    ('INCOME', 'Lương'),
                    ('INCOME', 'YouTube & AdSense'),
                    ('INCOME', 'Freelance'),
                    ('INCOME', 'Đầu tư'),
                    ('INCOME', 'Khác'),
                    ('EXPENSE', 'Ăn uống'),
                    ('EXPENSE', 'Di chuyển'),
                    ('EXPENSE', 'Mua sắm'),
                    ('EXPENSE', 'Hóa đơn & Nhà cửa'),
                    ('EXPENSE', 'Giải trí'),
                    ('EXPENSE', 'Sức khỏe'),
                    ('EXPENSE', 'Khác')
            ) AS b(type, name)
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.categories c
                WHERE c.user_id = u.id AND c.type = b.type AND c.name = b.name
            )
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.categories WHERE name = 'Chuyển tiền'
        ),
        concat(
            'auth_users=', (SELECT count(*) FROM auth.users),
            ', categories=', (SELECT count(*) FROM public.categories)
        )

    UNION ALL

    SELECT
        '12_execute_privileges_revoked',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.routine_privileges
            WHERE routine_schema = 'public'
              AND routine_name = 'seed_default_categories'
              AND grantee IN ('anon', 'PUBLIC', 'authenticated')
              AND privilege_type = 'EXECUTE'
        ),
        COALESCE((
            SELECT string_agg(grantee || ':' || privilege_type, ' | ' ORDER BY grantee)
            FROM information_schema.routine_privileges
            WHERE routine_schema = 'public'
              AND routine_name = 'seed_default_categories'
              AND grantee IN ('anon', 'PUBLIC', 'authenticated')
        ), 'none')
)
SELECT
    check_name,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
    detail
FROM checks
UNION ALL
SELECT
    '99_OVERALL',
    CASE WHEN bool_and(passed) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN bool_and(passed)
        THEN 'Phase 3 database structural gate passed with least-privilege grants'
        ELSE 'One or more database structural/security checks failed'
    END
FROM checks
ORDER BY check_name;
