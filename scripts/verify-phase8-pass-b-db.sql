-- Phase 8 Pass B Structural DB Verifier
-- Verifies database constraints and triggers for cross-currency transfers

DO $$
DECLARE
    v_has_same_currency_chk BOOLEAN;
    v_has_cross_currency_chk BOOLEAN;
    v_has_currency_compat_chk BOOLEAN;
    v_has_archived_trigger BOOLEAN;
    v_has_archived_function BOOLEAN;
    v_col_count INT;
BEGIN
    SELECT count(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transfers';

    IF v_col_count < 15 THEN
        RAISE EXCEPTION 'transfers table column count is less than 15 (got %)', v_col_count;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_transfers_same_currency_invariant'
          AND conrelid = 'public.transfers'::regclass
    ) INTO v_has_same_currency_chk;

    IF NOT v_has_same_currency_chk THEN
        RAISE EXCEPTION 'Missing constraint chk_transfers_same_currency_invariant';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_transfers_cross_currency_conversion'
          AND conrelid = 'public.transfers'::regclass
    ) INTO v_has_cross_currency_chk;

    IF NOT v_has_cross_currency_chk THEN
        RAISE EXCEPTION 'Missing constraint chk_transfers_cross_currency_conversion';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_transfers_currency_compatibility'
          AND conrelid = 'public.transfers'::regclass
    ) INTO v_has_currency_compat_chk;

    IF NOT v_has_currency_compat_chk THEN
        RAISE EXCEPTION 'Missing constraint chk_transfers_currency_compatibility';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_check_transfer_accounts_active'
          AND tgrelid = 'public.transfers'::regclass
    ) INTO v_has_archived_trigger;

    IF NOT v_has_archived_trigger THEN
        RAISE EXCEPTION 'Missing trigger trg_check_transfer_accounts_active';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'check_transfer_accounts_active'
    ) INTO v_has_archived_function;

    IF NOT v_has_archived_function THEN
        RAISE EXCEPTION 'Missing trigger function check_transfer_accounts_active';
    END IF;

    RAISE NOTICE 'PHASE_8_PASS_B_STRUCTURAL_GATE=PASS';
END;
$$;
