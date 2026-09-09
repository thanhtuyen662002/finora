BEGIN;

-- Phase 13C: in-app notification preferences.
-- Notifications are derived on demand from existing budgets and recurring items.
-- This table stores only per-user opt-in preferences; it does not schedule jobs
-- or create financial records.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    budget_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    recurring_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notification_preferences IS
    'Per-user opt-in preferences for derived in-app financial notifications.';

DROP TRIGGER IF EXISTS set_notification_preferences_updated_at
    ON public.notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own notification preferences"
    ON public.notification_preferences;
CREATE POLICY "Users can select own notification preferences"
    ON public.notification_preferences
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences"
    ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
    ON public.notification_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences"
    ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences"
    ON public.notification_preferences
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.notification_preferences FROM anon;
REVOKE ALL ON TABLE public.notification_preferences FROM authenticated;
REVOKE ALL ON TABLE public.notification_preferences FROM PUBLIC;

GRANT SELECT ON TABLE public.notification_preferences TO authenticated;
GRANT INSERT (user_id, budget_alerts_enabled, recurring_reminders_enabled)
    ON TABLE public.notification_preferences TO authenticated;
GRANT UPDATE (budget_alerts_enabled, recurring_reminders_enabled)
    ON TABLE public.notification_preferences TO authenticated;

COMMIT;
