-- ============================================================================
-- FINORA PHASE 7 STRICT DATABASE STRUCTURAL VERIFIER
-- ============================================================================
-- Read-only verifier. Returns one row per check plus 99_OVERALL.
-- 99_OVERALL is PASS only when every mandatory check is PASS.
-- ============================================================================

WITH
expected_budget_policies AS (
    SELECT 'Users can select own budgets'::text AS policy_name, 'SELECT'::text AS cmd UNION ALL
    SELECT 'Users can insert own budgets', 'INSERT' UNION ALL
    SELECT 'Users can update own budgets', 'UPDATE'
),
expected_budget_insert_columns AS (
    SELECT unnest(ARRAY[
        'category_id','category_type','currency_code','limit_amount','period_month','user_id'
    ]::text[]) AS column_name
),
expected_budget_update_columns AS (
    SELECT unnest(ARRAY[
        'category_id','category_type','currency_code','is_archived','limit_amount','period_month'
    ]::text[]) AS column_name
),
expected_goal_policies AS (
    SELECT 'Users can select own goals'::text AS policy_name, 'SELECT'::text AS cmd UNION ALL
    SELECT 'Users can insert own goals', 'INSERT' UNION ALL
    SELECT 'Users can update own goals', 'UPDATE'
),
expected_goal_insert_columns AS (
    SELECT unnest(ARRAY[
        'category','color','currency_code','current_amount','icon','monthly_contribution','name','target_amount','target_date','user_id'
    ]::text[]) AS column_name
),
expected_goal_update_columns AS (
    SELECT unnest(ARRAY[
        'category','color','currency_code','current_amount','icon','is_archived','monthly_contribution','name','target_amount','target_date'
    ]::text[]) AS column_name
),
expected_recurring_policies AS (
    SELECT 'Users can select own recurring items'::text AS policy_name, 'SELECT'::text AS cmd UNION ALL
    SELECT 'Users can insert own recurring items', 'INSERT' UNION ALL
    SELECT 'Users can update own recurring items', 'UPDATE'
),
expected_recurring_insert_columns AS (
    SELECT unnest(ARRAY[
        'account_id','amount','anchor_date','category_id','currency_code','end_date','frequency','name','note','transaction_type','user_id'
    ]::text[]) AS column_name
),
expected_recurring_update_columns AS (
    SELECT unnest(ARRAY[
        'account_id','amount','anchor_date','category_id','currency_code','end_date','frequency','is_archived','is_paused','name','note','transaction_type'
    ]::text[]) AS column_name
),
checks AS (
    -- 01. Budgets table exists
    SELECT
        '01_budgets_table_exists' AS check_name,
        to_regclass('public.budgets') IS NOT NULL AS passed,
        COALESCE(to_regclass('public.budgets')::text, 'missing') AS detail

    UNION ALL

    -- 02. Goals table exists
    SELECT
        '02_goals_table_exists',
        to_regclass('public.goals') IS NOT NULL,
        COALESCE(to_regclass('public.goals')::text, 'missing')

    UNION ALL

    -- 03. Recurring items table exists
    SELECT
        '03_recurring_items_table_exists',
        to_regclass('public.recurring_items') IS NOT NULL,
        COALESCE(to_regclass('public.recurring_items')::text, 'missing')

    UNION ALL

    -- 04. Budgets RLS enabled
    SELECT
        '04_budgets_rls_enabled',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'budgets'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT 'rls=' || c.relrowsecurity::text
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'budgets'
        ), 'missing')

    UNION ALL

    -- 05. Goals RLS enabled
    SELECT
        '05_goals_rls_enabled',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'goals'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT 'rls=' || c.relrowsecurity::text
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'goals'
        ), 'missing')

    UNION ALL

    -- 06. Recurring items RLS enabled
    SELECT
        '06_recurring_items_rls_enabled',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'recurring_items'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        COALESCE((
            SELECT 'rls=' || c.relrowsecurity::text
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'recurring_items'
        ), 'missing')

    UNION ALL

    -- 07. budget_progress view exists with security_invoker
    SELECT
        '07_budget_progress_view_exists',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'budget_progress'
        ),
        'budget_progress'

    UNION ALL

    -- 08. goal_details view exists with security_invoker
    SELECT
        '08_goal_details_view_exists',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'goal_details'
        ),
        'goal_details'

    UNION ALL

    -- 09. recurring_details view exists with security_invoker
    SELECT
        '09_recurring_details_view_exists',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'recurring_details'
        ),
        'recurring_details'

    UNION ALL

    -- 10. Budgets policies exact
    SELECT
        '10_budget_policies_exact',
        (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'budgets') = 3
        AND NOT EXISTS (
            SELECT 1 FROM expected_budget_policies exp
            WHERE NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_policies pol
                WHERE pol.schemaname = 'public'
                  AND pol.tablename = 'budgets'
                  AND pol.policyname = exp.policy_name
                  AND pol.cmd = exp.cmd
            )
        ),
        (SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'budgets')

    UNION ALL

    -- 11. Goals policies exact
    SELECT
        '11_goal_policies_exact',
        (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'goals') = 3
        AND NOT EXISTS (
            SELECT 1 FROM expected_goal_policies exp
            WHERE NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_policies pol
                WHERE pol.schemaname = 'public'
                  AND pol.tablename = 'goals'
                  AND pol.policyname = exp.policy_name
                  AND pol.cmd = exp.cmd
            )
        ),
        (SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'goals')

    UNION ALL

    -- 12. Recurring items policies exact
    SELECT
        '12_recurring_policies_exact',
        (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'recurring_items') = 3
        AND NOT EXISTS (
            SELECT 1 FROM expected_recurring_policies exp
            WHERE NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_policies pol
                WHERE pol.schemaname = 'public'
                  AND pol.tablename = 'recurring_items'
                  AND pol.policyname = exp.policy_name
                  AND pol.cmd = exp.cmd
            )
        ),
        (SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'recurring_items')
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
    count(*) || ' checks evaluated'
FROM checks;
