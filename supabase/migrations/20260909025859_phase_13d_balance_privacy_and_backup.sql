-- Phase 13D: balance privacy preference and data portability
-- Adds a per-user UI-only balance masking preference. Backup export remains
-- client-side and never reads private.ai_credentials.

BEGIN;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mask_balance BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.user_settings.mask_balance IS
  'Hide account balances and financial summary amounts in the authenticated user interface.';

GRANT UPDATE (mask_balance)
  ON TABLE public.user_settings
  TO authenticated;

COMMIT;
