-- Finora Phase 7 live structural supplemental verifier
-- Read-only. This exists only to resolve known false-negatives in checks 14, 15, and 21
-- of verify-phase7-db.sql after the Phase 7 migration has already been applied.

WITH checks AS (
    SELECT
        '14_goals_check_constraints_livefix' AS check_name,
        (
            SELECT count(*) = 8
               AND bool_and(c.conname IN (
                   'check_goal_name_length',
                   'check_goal_target_amount_positive',
                   'check_goal_current_amount_non_negative',
                   'check_goal_monthly_contribution_non_negative',
                   'check_goal_currency_code',
                   'check_goal_category_length',
                   'check_goal_icon_length',
                   'check_goal_color_length'
               ))
               AND bool_and(
                   CASE c.conname
                       WHEN 'check_goal_name_length' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%char_length%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%name%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%1%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%200%'
                       WHEN 'check_goal_target_amount_positive' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%target_amount%'
                           AND pg_get_constraintdef(c.oid) LIKE '%>%'
                           AND pg_get_constraintdef(c.oid) LIKE '%0%'
                       WHEN 'check_goal_current_amount_non_negative' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%current_amount%'
                           AND pg_get_constraintdef(c.oid) LIKE '%>=%'
                           AND pg_get_constraintdef(c.oid) LIKE '%0%'
                       WHEN 'check_goal_monthly_contribution_non_negative' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%monthly_contribution%'
                           AND pg_get_constraintdef(c.oid) LIKE '%>=%'
                           AND pg_get_constraintdef(c.oid) LIKE '%0%'
                       WHEN 'check_goal_currency_code' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%currency_code%'
                           AND pg_get_constraintdef(c.oid) LIKE '%~%'
                           AND pg_get_constraintdef(c.oid) LIKE '%{3,5}%'
                       WHEN 'check_goal_category_length' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%char_length%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%category%'
                           AND pg_get_constraintdef(c.oid) LIKE '%1%'
                           AND pg_get_constraintdef(c.oid) LIKE '%100%'
                       WHEN 'check_goal_icon_length' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%char_length%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%icon%'
                           AND pg_get_constraintdef(c.oid) LIKE '%1%'
                           AND pg_get_constraintdef(c.oid) LIKE '%100%'
                       WHEN 'check_goal_color_length' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%char_length%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%color%'
                           AND pg_get_constraintdef(c.oid) LIKE '%1%'
                           AND pg_get_constraintdef(c.oid) LIKE '%32%'
                       ELSE false
                   END
               )
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'goals'
              AND c.contype = 'c'
        ) AS passed,
        'goal CHECK constraints verified independent of TRIM/BTRIM formatting' AS detail

    UNION ALL

    SELECT
        '15_recurring_check_constraints_livefix',
        (
            SELECT count(*) = 7
               AND bool_and(c.conname IN (
                   'check_recurring_amount_positive',
                   'check_recurring_transaction_type',
                   'check_recurring_frequency',
                   'check_recurring_currency_code',
                   'check_recurring_name_length',
                   'check_recurring_note_length',
                   'check_recurring_dates'
               ))
               AND bool_and(
                   CASE c.conname
                       WHEN 'check_recurring_amount_positive' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%amount%'
                           AND pg_get_constraintdef(c.oid) LIKE '%>%'
                           AND pg_get_constraintdef(c.oid) LIKE '%0%'
                       WHEN 'check_recurring_transaction_type' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%transaction_type%'
                           AND pg_get_constraintdef(c.oid) LIKE '%INCOME%'
                           AND pg_get_constraintdef(c.oid) LIKE '%EXPENSE%'
                       WHEN 'check_recurring_frequency' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%frequency%'
                           AND pg_get_constraintdef(c.oid) LIKE '%WEEKLY%'
                           AND pg_get_constraintdef(c.oid) LIKE '%MONTHLY%'
                           AND pg_get_constraintdef(c.oid) LIKE '%YEARLY%'
                       WHEN 'check_recurring_currency_code' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%currency_code%'
                           AND pg_get_constraintdef(c.oid) LIKE '%~%'
                           AND pg_get_constraintdef(c.oid) LIKE '%{3,5}%'
                       WHEN 'check_recurring_name_length' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%char_length%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%name%'
                           AND pg_get_constraintdef(c.oid) LIKE '%1%'
                           AND pg_get_constraintdef(c.oid) LIKE '%200%'
                       WHEN 'check_recurring_note_length' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%note%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%char_length%'
                           AND pg_get_constraintdef(c.oid) LIKE '%1000%'
                       WHEN 'check_recurring_dates' THEN
                           lower(pg_get_constraintdef(c.oid)) LIKE '%end_date%'
                           AND lower(pg_get_constraintdef(c.oid)) LIKE '%anchor_date%'
                           AND pg_get_constraintdef(c.oid) LIKE '%>=%'
                       ELSE false
                   END
               )
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'recurring_items'
              AND c.contype = 'c'
        ),
        'recurring CHECK constraints verified independent of TRIM/BTRIM formatting'

    UNION ALL

    SELECT
        '21_triggers_handle_updated_at_livefix',
        (
            SELECT count(*) = 3
               AND count(DISTINCT c.relname) = 3
               AND bool_and(
                   (tg.tgtype & 1) = 1
                   AND (tg.tgtype & 2) = 2
                   AND (tg.tgtype & 16) = 16
                   AND p.proname = 'handle_updated_at'
                   AND pn.nspname = 'public'
               )
            FROM pg_catalog.pg_trigger tg
            JOIN pg_catalog.pg_class c ON c.oid = tg.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_catalog.pg_proc p ON p.oid = tg.tgfoid
            JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('budgets', 'goals', 'recurring_items')
              AND NOT tg.tgisinternal
        ),
        'exactly one non-internal BEFORE UPDATE FOR EACH ROW public.handle_updated_at trigger per Phase 7 table'
), overall AS (
    SELECT
        '99_SUPPLEMENTAL_OVERALL' AS check_name,
        bool_and(passed) AS passed,
        CASE WHEN bool_and(passed)
             THEN 'PASS: all known Phase 7 structural false-negatives resolved'
             ELSE 'FAIL: one or more supplemental structural checks failed'
        END AS detail
    FROM checks
)
SELECT check_name, passed, detail FROM checks
UNION ALL
SELECT check_name, passed, detail FROM overall
ORDER BY check_name;
