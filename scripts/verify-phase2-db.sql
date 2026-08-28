WITH expected_update_columns(table_name, column_name) AS (
    VALUES
        ('profiles', 'display_name'),
        ('profiles', 'avatar_url'),
        ('profiles', 'onboarding_completed'),
        ('user_settings', 'base_currency'),
        ('user_settings', 'locale'),
        ('user_settings', 'timezone'),
        ('user_settings', 'theme')
),
checks AS (
    SELECT
        '01_tables_exist' AS check_name,
        (
            to_regclass('public.profiles') IS NOT NULL
            AND to_regclass('public.user_settings') IS NOT NULL
        ) AS passed,
        concat(
            'profiles=', to_regclass('public.profiles'),
            ', user_settings=', to_regclass('public.user_settings')
        ) AS detail

    UNION ALL

    SELECT
        '02_rls_enabled',
        (
            SELECT count(*) = 2
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles', 'user_settings')
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT string_agg(c.relname || '=' || c.relrowsecurity::text, ', ' ORDER BY c.relname)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles', 'user_settings')
        ), 'none')

    UNION ALL

    SELECT
        '03_rls_policies_exact',
        (
            SELECT count(*) = 4
            FROM pg_catalog.pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('profiles', 'user_settings')
              AND policyname IN (
                  'Users can select own profile',
                  'Users can update own profile',
                  'Users can select own settings',
                  'Users can update own settings'
              )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('profiles', 'user_settings')
              AND policyname NOT IN (
                  'Users can select own profile',
                  'Users can update own profile',
                  'Users can select own settings',
                  'Users can update own settings'
              )
        ),
        COALESCE((
            SELECT string_agg(tablename || ':' || policyname || ':' || cmd, ' | ' ORDER BY tablename, policyname)
            FROM pg_catalog.pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('profiles', 'user_settings')
        ), 'none')

    UNION ALL

    SELECT
        '04_auth_user_trigger',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'auth'
              AND c.relname = 'users'
              AND t.tgname = 'on_auth_user_created'
              AND NOT t.tgisinternal
        ),
        COALESCE((
            SELECT string_agg(t.tgname, ', ' ORDER BY t.tgname)
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'auth'
              AND c.relname = 'users'
              AND NOT t.tgisinternal
        ), 'none')

    UNION ALL

    SELECT
        '05_updated_at_triggers',
        (
            SELECT count(*) = 2
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND (
                    (c.relname = 'profiles' AND t.tgname = 'set_profiles_updated_at')
                 OR (c.relname = 'user_settings' AND t.tgname = 'set_user_settings_updated_at')
              )
              AND NOT t.tgisinternal
        ),
        COALESCE((
            SELECT string_agg(c.relname || ':' || t.tgname, ', ' ORDER BY c.relname, t.tgname)
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('profiles', 'user_settings')
              AND NOT t.tgisinternal
        ), 'none')

    UNION ALL

    SELECT
        '06_function_security',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'handle_new_user'
              AND p.prosecdef = true
              AND COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%'
        )
        AND EXISTS (
            SELECT 1
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'handle_updated_at'
              AND p.prosecdef = false
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
              AND p.proname IN ('handle_new_user', 'handle_updated_at')
        ), 'none')

    UNION ALL

    SELECT
        '07_anon_public_no_privileges',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('profiles', 'user_settings')
              AND grantee IN ('anon', 'PUBLIC')
        ),
        COALESCE((
            SELECT string_agg(grantee || ':' || table_name || ':' || privilege_type, ' | ' ORDER BY grantee, table_name, privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('profiles', 'user_settings')
              AND grantee IN ('anon', 'PUBLIC')
        ), 'no anon/public table privileges')

    UNION ALL

    SELECT
        '08_authenticated_table_privileges_exact',
        (
            SELECT count(*) = 2
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('profiles', 'user_settings')
              AND grantee = 'authenticated'
              AND privilege_type = 'SELECT'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('profiles', 'user_settings')
              AND grantee = 'authenticated'
              AND privilege_type <> 'SELECT'
        ),
        COALESCE((
            SELECT string_agg(table_name || ':' || privilege_type, ' | ' ORDER BY table_name, privilege_type)
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('profiles', 'user_settings')
              AND grantee = 'authenticated'
        ), 'none')

    UNION ALL

    SELECT
        '09_authenticated_update_columns_exact',
        (
            SELECT count(DISTINCT cp.table_name || '.' || cp.column_name) = 7
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
              AND cp.table_name IN ('profiles', 'user_settings')
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
              AND cp.table_name IN ('profiles', 'user_settings')
              AND cp.grantee = 'authenticated'
              AND cp.privilege_type = 'UPDATE'
        ), 'none')

    UNION ALL

    SELECT
        '10_auth_backfill_complete',
        NOT EXISTS (
            SELECT 1
            FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
            LEFT JOIN public.user_settings s ON s.user_id = u.id
            WHERE p.id IS NULL OR s.user_id IS NULL
        ),
        concat(
            'auth_users=', (SELECT count(*) FROM auth.users),
            ', profiles=', (SELECT count(*) FROM public.profiles),
            ', user_settings=', (SELECT count(*) FROM public.user_settings)
        )
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
        THEN 'Phase 2 database structural gate passed with least-privilege grants'
        ELSE 'One or more database structural/security checks failed'
    END
FROM checks
ORDER BY check_name;
