-- Phase 8 Pass B Cross-Currency Transfers Integrity Corrective Migration
-- Canonical FX Contract:
-- exchange_rate = destination currency units received per 1 source currency unit
-- destination_amount = ROUND(amount * exchange_rate, 4)

BEGIN;

-- 1. Legacy/Source currency compatibility check constraint
ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS chk_transfers_currency_compatibility,
    ADD CONSTRAINT chk_transfers_currency_compatibility
    CHECK (currency_code = source_currency_code);

-- 2. Same-currency invariant check constraint
ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS chk_transfers_same_currency_invariant,
    ADD CONSTRAINT chk_transfers_same_currency_invariant
    CHECK (
        (source_currency_code <> destination_currency_code)
        OR (destination_amount = amount AND exchange_rate = 1.000000000000)
    );

-- 3. Cross-currency exact conversion consistency check constraint
-- destination_amount must equal ROUND(amount * exchange_rate, 4)
ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS chk_transfers_cross_currency_conversion,
    ADD CONSTRAINT chk_transfers_cross_currency_conversion
    CHECK (destination_amount = ROUND(amount * exchange_rate, 4));

-- 4. Trigger function to prevent creating/updating transfers using archived accounts
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_transfer_accounts_active ON public.transfers;
CREATE TRIGGER trg_check_transfer_accounts_active
    BEFORE INSERT OR UPDATE ON public.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.check_transfer_accounts_active();

COMMIT;
