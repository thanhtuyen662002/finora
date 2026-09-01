BEGIN;

-- Hardens public.check_transfer_accounts_active search_path to empty string
-- Resolves function_search_path_mutable advisor finding while preserving SECURITY INVOKER
ALTER FUNCTION public.check_transfer_accounts_active()
SET search_path TO '';

COMMIT;
