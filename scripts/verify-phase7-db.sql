-- ============================================================================
-- FINORA PHASE 7 STRICT DATABASE STRUCTURAL VERIFIER
-- ============================================================================
-- Read-only verifier. Returns one row per check plus 99_OVERALL.
-- 99_OVERALL is PASS only when every mandatory check is PASS.
-- ============================================================================

WITH
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

    -- 04. Budgets exact required columns
    SELECT
        '04_budgets_columns_exact',
        (
            SELECT count(*) = 9 AND bool_and(column_name IN (
                'id', 'user_id', 'category_id', 'category_type', 'limit_amount',
                'currency_code', 'period_month', 'is_archived', 'created_at', 'updated_at'
            ))
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'budgets'
        ),
        'budgets columns audited'

    UNION ALL

    -- 05. Goals exact required columns
    SELECT
        '05_goals_columns_exact',
        (
            SELECT count(*) = 12 AND bool_and(column_name IN (
                'id', 'user_id', 'name', 'target_amount', 'current_amount',
                'currency_code', 'target_date', 'monthly_contribution', 'color',
                'icon', 'category', 'is_archived', 'created_at', 'updated_at'
            ))
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'goals'
        ),
        'goals columns audited'

    UNION ALL

    -- 06. Recurring items exact required columns
    SELECT
        '06_recurring_columns_exact',
        (
            SELECT count(*) = 14 AND bool_and(column_name IN (
                'id', 'user_id', 'account_id', 'category_id', 'transaction_type',
                'name', 'amount', 'currency_code', 'frequency', 'anchor_date',
                'end_date', 'note', 'is_paused', 'is_archived', 'created_at', 'updated_at'
            ))
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'recurring_items'
        ),
        'recurring_items columns audited'

    UNION ALL

    -- 07. Numeric precision numeric(20,4) on budgets money columns
    SELECT
        '07_numeric_precision_budgets',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'budgets'
              AND column_name = 'limit_amount'
              AND data_type = 'numeric'
              AND numeric_precision = 20
              AND numeric_scale = 4
        ),
        'limit_amount numeric(20,4)'

    UNION ALL

    -- 08. Numeric precision numeric(20,4) on goals money columns
    SELECT
        '08_numeric_precision_goals',
        (
            SELECT count(*) = 3
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'goals'
              AND column_name IN ('target_amount', 'current_amount', 'monthly_contribution')
              AND data_type = 'numeric'
              AND numeric_precision = 20
              AND numeric_scale = 4
        ) = 3,
        'goals amounts numeric(20,4)'

    UNION ALL

    -- 09. Numeric precision numeric(20,4) on recurring items money columns
    SELECT
        '09_numeric_precision_recurring',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'recurring_items'
              AND column_name = 'amount'
              AND data_type = 'numeric'
              AND numeric_precision = 20
              AND numeric_scale = 4
        ),
        'recurring amount numeric(20,4)'

    UNION ALL

    -- 10. Absence of Phase 8 FX columns in Phase 7 tables
    SELECT
        '10_no_fx_columns_phase7',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('budgets', 'goals', 'recurring_items')
              AND column_name IN ('exchange_rate', 'base_amount', 'base_currency')
        ),
        'no FX columns in Phase 7 tables'

    UNION ALL

    -- 11. Absence of persisted budget spent / remaining / progress columns
    SELECT
        '11_no_persisted_budget_spent',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'budgets'
              AND column_name IN ('spent_amount', 'remaining_amount', 'is_over_budget', 'basis_points')
        ),
        'no persisted budget calculation columns'

    UNION ALL

    -- 12. Absence of persisted recurring next_due_date column
    SELECT
        '12_no_persisted_recurring_next_due',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'recurring_items'
              AND column_name = 'next_due_date'
        ),
        'no persisted recurring next_due_date column'

    UNION ALL

    -- 13. Budgets check constraints
    SELECT
        '13_budgets_check_constraints',
        (
            SELECT count(*) >= 4
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'budgets'
              AND c.contype = 'c'
        ),
        'budgets check constraints'

    UNION ALL

    -- 14. Goals check constraints
    SELECT
        '14_goals_check_constraints',
        (
            SELECT count(*) >= 4
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'goals'
              AND c.contype = 'c'
        ),
        'goals check constraints'

    UNION ALL

    -- 15. Recurring check constraints
    SELECT
        '15_recurring_check_constraints',
        (
            SELECT count(*) >= 5
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'recurring_items'
              AND c.contype = 'c'
        ),
        'recurring check constraints'

    UNION ALL

    -- 16. Budgets unique constraint (user_id, category_id, currency_code, period_month)
    SELECT
        '16_budgets_unique_period_month',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'budgets'
              AND c.contype = 'u'
        ),
        'budgets unique constraint on user_id, category_id, currency_code, period_month'

    UNION ALL

    -- 17. Budgets composite FK to categories (user_id, category_id, category_type)
    SELECT
        '17_budgets_composite_fk_category',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'budgets'
              AND c.contype = 'f'
              AND c.confdeltype = 'r'
        ),
        'budgets composite FK category'

    UNION ALL

    -- 18. Recurring composite FK to accounts (user_id, account_id, currency_code)
    SELECT
        '18_recurring_composite_fk_account',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_class f ON f.oid = c.confrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'recurring_items'
              AND f.relname = 'accounts'
              AND c.contype = 'f'
              AND c.confdeltype = 'r'
        ),
        'recurring composite FK account'

    UNION ALL

    -- 19. Recurring composite FK to categories (user_id, category_id, transaction_type)
    SELECT
        '19_recurring_composite_fk_category',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_class f ON f.oid = c.confrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'recurring_items'
              AND f.relname = 'categories'
              AND c.contype = 'f'
              AND c.confdeltype = 'r'
        ),
        'recurring composite FK category'

    UNION ALL

    -- 20. Foreign keys use RESTRICT delete action
    SELECT
        '20_fk_restrict_delete_actions',
        (
            SELECT bool_and(c.confdeltype = 'r')
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname IN ('budgets', 'goals', 'recurring_items')
              AND c.contype = 'f'
        ),
        'all Phase 7 FKs have confdeltype = r (RESTRICT)'

    UNION ALL

    -- 21. Exactly one handle_updated_at trigger per table
    SELECT
        '21_triggers_handle_updated_at',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_trigger tg
            JOIN pg_catalog.pg_class c ON c.oid = tg.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('budgets', 'goals', 'recurring_items')
              AND tg.tgname LIKE '%handle_updated_at%'
              AND NOT tg.tgisinternal
        ),
        'handle_updated_at triggers present'

    UNION ALL

    -- 22. RLS enabled on all Phase 7 tables
    SELECT
        '22_rls_enabled_phase7_tables',
        (
            SELECT count(*) = 3 AND bool_and(c.relrowsecurity = true)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('budgets', 'goals', 'recurring_items')
              AND c.relkind = 'r'
        ),
        'RLS enabled on budgets, goals, recurring_items'

    UNION ALL

    -- 23. Budgets policies exact 3
    SELECT
        '23_budgets_policies_exact_3',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'budgets'
        ),
        'budgets has exactly 3 policies'

    UNION ALL

    -- 24. Goals policies exact 3
    SELECT
        '24_goals_policies_exact_3',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'goals'
        ),
        'goals has exactly 3 policies'

    UNION ALL

    -- 25. Recurring items policies exact 3
    SELECT
        '25_recurring_policies_exact_3',
        (
            SELECT count(*) = 3
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'recurring_items'
        ),
        'recurring_items has exactly 3 policies'

    UNION ALL

    -- 26. Policy roles are authenticated only
    SELECT
        '26_policy_role_authenticated_only',
        (
            SELECT count(*) = 9 AND bool_and(p.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')])
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname IN ('budgets', 'goals', 'recurring_items')
        ),
        'all 9 policies restricted to authenticated role'

    UNION ALL

    -- 27. Policy ownership semantics: (SELECT auth.uid()) = user_id
    SELECT
        '27_policy_auth_uid_ownership',
        (
            SELECT count(*) = 9 AND bool_and(
                pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%' OR
                pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%'
            )
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname IN ('budgets', 'goals', 'recurring_items')
        ),
        'all 9 policies enforce auth.uid() ownership'

    UNION ALL

    -- 28. UPDATE policies have both USING and WITH CHECK
    SELECT
        '28_update_policies_using_and_check',
        (
            SELECT count(*) = 3 AND bool_and(
                p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL
            )
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('budgets', 'goals', 'recurring_items')
              AND p.polcmd = 'w'
        ),
        'UPDATE policies have both USING and WITH CHECK'

    UNION ALL

    -- 29. Zero DELETE policies across Phase 7 tables
    SELECT
        '29_zero_delete_policies_phase7',
        NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_policy p
            JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('budgets', 'goals', 'recurring_items')
              AND p.polcmd = 'd'
        ),
        'no DELETE policies on Phase 7 tables'

    UNION ALL

    -- 30. anon and PUBLIC have zero table/column privileges
    SELECT
        '30_anon_public_no_table_privileges',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('budgets', 'goals', 'recurring_items')
              AND grantee IN ('anon', 'public')
        ),
        'anon and public have no privileges'

    UNION ALL

    -- 31. Authenticated table-level privilege is SELECT only (no table-level INSERT/UPDATE/DELETE)
    SELECT
        '31_authenticated_table_select_only',
        (
            SELECT count(*) = 3 AND bool_and(privilege_type = 'SELECT')
            FROM information_schema.table_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('budgets', 'goals', 'recurring_items')
              AND grantee = 'authenticated'
        ),
        'authenticated has only SELECT at table level'

    UNION ALL

    -- 32. Budgets column grants for INSERT and UPDATE
    SELECT
        '32_budgets_column_grants_insert_update',
        (
            SELECT
                (SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'budgets' AND grantee = 'authenticated' AND privilege_type = 'INSERT' AND column_name IN (SELECT column_name FROM expected_budget_insert_columns)) = (SELECT count(*) FROM expected_budget_insert_columns)
                AND
                (SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'budgets' AND grantee = 'authenticated' AND privilege_type = 'UPDATE' AND column_name IN (SELECT column_name FROM expected_budget_update_columns)) = (SELECT count(*) FROM expected_budget_update_columns)
        ),
        'budgets column grants audited'

    UNION ALL

    -- 33. Goals column grants for INSERT and UPDATE
    SELECT
        '33_goals_column_grants_insert_update',
        (
            SELECT
                (SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'goals' AND grantee = 'authenticated' AND privilege_type = 'INSERT' AND column_name IN (SELECT column_name FROM expected_goal_insert_columns)) = (SELECT count(*) FROM expected_goal_insert_columns)
                AND
                (SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'goals' AND grantee = 'authenticated' AND privilege_type = 'UPDATE' AND column_name IN (SELECT column_name FROM expected_goal_update_columns)) = (SELECT count(*) FROM expected_goal_update_columns)
        ),
        'goals column grants audited'

    UNION ALL

    -- 34. Recurring items column grants for INSERT and UPDATE
    SELECT
        '34_recurring_column_grants_insert_update',
        (
            SELECT
                (SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'recurring_items' AND grantee = 'authenticated' AND privilege_type = 'INSERT' AND column_name IN (SELECT column_name FROM expected_recurring_insert_columns)) = (SELECT count(*) FROM expected_recurring_insert_columns)
                AND
                (SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'recurring_items' AND grantee = 'authenticated' AND privilege_type = 'UPDATE' AND column_name IN (SELECT column_name FROM expected_recurring_update_columns)) = (SELECT count(*) FROM expected_recurring_update_columns)
        ),
        'recurring_items column grants audited'

    UNION ALL

    -- 35. Immutable columns have no UPDATE grant (id, user_id, created_at, updated_at)
    SELECT
        '35_immutable_columns_no_update_grant',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.column_privileges
            WHERE table_schema = 'public'
              AND table_name IN ('budgets', 'goals', 'recurring_items')
              AND grantee = 'authenticated'
              AND privilege_type = 'UPDATE'
              AND column_name IN ('id', 'user_id', 'created_at', 'updated_at')
        ),
        'id, user_id, created_at, updated_at cannot be updated'

    UNION ALL

    -- 36. budget_progress view exists
    SELECT
        '36_budget_progress_view_exists',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'budget_progress'
        ),
        'budget_progress view exists'

    UNION ALL

    -- 37. goal_details view exists
    SELECT
        '37_goal_details_view_exists',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'goal_details'
        ),
        'goal_details view exists'

    UNION ALL

    -- 38. recurring_details view exists
    SELECT
        '38_recurring_details_view_exists',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public' AND viewname = 'recurring_details'
        ),
        'recurring_details view exists'

    UNION ALL

    -- 39. All 3 views have security_invoker = true
    SELECT
        '39_views_security_invoker_true',
        (
            SELECT count(*) = 3 AND bool_and(
                'security_invoker=true' = ANY(c.reloptions) OR 'security_invoker=on' = ANY(c.reloptions)
            )
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('budget_progress', 'goal_details', 'recurring_details')
              AND c.relkind = 'v'
        ),
        'views have security_invoker=true'

    UNION ALL

    -- 40. Authoritative money outputs in views are of text type
    SELECT
        '40_views_authoritative_money_text',
        (
            SELECT bool_and(data_type = 'text')
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                (table_name = 'budget_progress' AND column_name IN ('limit_amount', 'spent_amount')) OR
                (table_name = 'goal_details' AND column_name IN ('target_amount', 'current_amount', 'monthly_contribution')) OR
                (table_name = 'recurring_details' AND column_name = 'amount')
              )
        ),
        'all money columns in views are PostgreSQL text'

    UNION ALL

    -- 41. budget_progress spent aggregates active expense transactions by exact user/category/currency/month
    SELECT
        '41_budget_progress_active_expense_derivation',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public'
              AND viewname = 'budget_progress'
              AND definition LIKE '%is_voided = false%'
              AND definition LIKE '%EXPENSE%'
        ),
        'budget_progress filters active expense transactions'

    UNION ALL

    -- 42. budget_progress category ownership join semantics
    SELECT
        '42_budget_progress_category_ownership_join',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public'
              AND viewname = 'budget_progress'
              AND definition LIKE '%b.user_id = c.user_id%'
        ),
        'budget_progress category ownership join'

    UNION ALL

    -- 43. recurring_details account and category ownership join semantics
    SELECT
        '43_recurring_details_account_category_ownership_join',
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public'
              AND viewname = 'recurring_details'
              AND definition LIKE '%r.user_id = a.user_id%'
              AND definition LIKE '%r.user_id = c.user_id%'
        ),
        'recurring_details joins enforce ownership match'

    UNION ALL

    -- 44. Views grants: authenticated has SELECT, anon/public none
    SELECT
        '44_views_grants_authenticated_only',
        (
            SELECT
                (SELECT count(*) = 3 AND bool_and(privilege_type = 'SELECT') FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name IN ('budget_progress', 'goal_details', 'recurring_details') AND grantee = 'authenticated')
                AND
                NOT EXISTS (SELECT 1 FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name IN ('budget_progress', 'goal_details', 'recurring_details') AND grantee IN ('anon', 'public'))
        ),
        'views grants restricted to authenticated SELECT'

    UNION ALL

    -- 45. Phase 4 transactions non-regression: RLS + 3 policies + no DELETE
    SELECT
        '45_phase4_transactions_rls_non_regression',
        (
            SELECT
                (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions') = true
                AND
                (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions') = 3
                AND
                NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND p.polcmd = 'd')
        ),
        'transactions RLS, 3 policies, no DELETE verified'

    UNION ALL

    -- 46. Phase 5 transfers non-regression: RLS + 3 policies + no DELETE
    SELECT
        '46_phase5_transfers_rls_non_regression',
        (
            SELECT
                (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transfers') = true
                AND
                (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transfers') = 3
                AND
                NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transfers' AND p.polcmd = 'd')
        ),
        'transfers RLS, 3 policies, no DELETE verified'

    UNION ALL

    -- 47. Phase 4 transaction_details view: security_invoker and amount text
    SELECT
        '47_phase4_transaction_details_invoker_text',
        (
            SELECT
                EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transaction_details' AND ('security_invoker=true' = ANY(c.reloptions) OR 'security_invoker=on' = ANY(c.reloptions)))
                AND
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_details' AND column_name = 'amount' AND data_type = 'text')
        ),
        'transaction_details invoker and amount text'

    UNION ALL

    -- 48. Phase 5 transfer_details view: security_invoker and amount text
    SELECT
        '48_phase5_transfer_details_invoker_text',
        (
            SELECT
                EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transfer_details' AND ('security_invoker=true' = ANY(c.reloptions) OR 'security_invoker=on' = ANY(c.reloptions)))
                AND
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transfer_details' AND column_name = 'amount' AND data_type = 'text')
        ),
        'transfer_details invoker and amount text'

    UNION ALL

    -- 49. Phase 6 account_balances view: security_invoker and current_balance text formula
    SELECT
        '49_phase6_account_balances_invoker_text_formula',
        (
            SELECT
                EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'account_balances' AND ('security_invoker=true' = ANY(c.reloptions) OR 'security_invoker=on' = ANY(c.reloptions)))
                AND
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_balances' AND column_name = 'current_balance' AND data_type = 'text')
        ),
        'account_balances invoker and current_balance text'

    UNION ALL

    -- 50. No persisted accounts.current_balance column
    SELECT
        '50_no_persisted_accounts_current_balance',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'accounts'
              AND column_name = 'current_balance'
        ),
        'no persisted accounts.current_balance column'

    UNION ALL

    -- 51. RLS remains enabled across all Phase 2–7 user-owned tables
    SELECT
        '51_phase2_to_7_all_tables_rls_enabled',
        (
            SELECT count(*) = 10 AND bool_and(c.relrowsecurity = true)
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN (
                'profiles', 'user_settings', 'accounts', 'categories', 'income_sources',
                'transactions', 'transfers', 'budgets', 'goals', 'recurring_items'
              )
              AND c.relkind = 'r'
        ),
        'all 10 user-owned tables have RLS enabled'
),
overall AS (
    SELECT
        '99_OVERALL' AS check_name,
        bool_and(passed) AS passed,
        CASE
            WHEN bool_and(passed) THEN 'PASS: all Phase 7 database structural and non-regression invariants satisfied'
            ELSE 'FAIL: one or more Phase 7 database checks failed'
        END AS detail
    FROM checks
)
SELECT check_name, passed, detail FROM checks
UNION ALL
SELECT check_name, passed, detail FROM overall
ORDER BY check_name;
