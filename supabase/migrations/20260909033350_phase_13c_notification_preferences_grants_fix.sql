BEGIN;

-- Phase 13C corrective: restore the Data API grants required by the
-- authenticated Settings client. RLS policies continue to restrict every row
-- to the signed-in owner (auth.uid() = user_id).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE
    ON TABLE public.notification_preferences
    TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
