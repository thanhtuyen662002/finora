BEGIN;

-- Phase 13B-3: on-demand, in-app reminders for active debts.
-- No scheduler, email, push channel, or financial mutation is introduced.
ALTER TABLE public.notification_preferences
    ADD COLUMN IF NOT EXISTS debt_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE
    ON TABLE public.notification_preferences
    TO authenticated;

GRANT INSERT (
    user_id,
    budget_alerts_enabled,
    recurring_reminders_enabled,
    debt_reminders_enabled
)
ON public.notification_preferences TO authenticated;

GRANT UPDATE (
    budget_alerts_enabled,
    recurring_reminders_enabled,
    debt_reminders_enabled
)
ON public.notification_preferences TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
