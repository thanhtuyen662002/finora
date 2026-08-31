-- Phase 8 Pass B Security Hardening Migration
-- Replaces check_transfer_accounts_active function with SECURITY INVOKER (removing legacy mode)

BEGIN;

CREATE OR REPLACE FUNCTION public.check_transfer_accounts_active()
RETURNS trigger AS $$
DECLARE
    v_from_archived BOOLEAN;
    v_to_archived BOOLEAN;
BEGIN
    IF (TG_OP = 'INSERT') OR 
       (TG_OP = 'UPDATE' AND (NEW.from_account_id IS DISTINCT FROM OLD.from_account_id OR NEW.to_account_id IS DISTINCT FROM OLD.to_account_id)) THEN
        
        SELECT is_archived INTO v_from_archived FROM public.accounts WHERE id = NEW.from_account_id AND user_id = NEW.user_id;
        IF v_from_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create or update transfer using archived source account (account_id: %)', NEW.from_account_id;
        END IF;

        SELECT is_archived INTO v_to_archived FROM public.accounts WHERE id = NEW.to_account_id AND user_id = NEW.user_id;
        IF v_to_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create or update transfer using archived destination account (account_id: %)', NEW.to_account_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMIT;
