-- Phase 8 Pass B Structural Remote DB Verifier
-- Verifies catalog definitions, constraints, composite FKs, RLS, grants, views, and trigger security modes for transfers.

DO $$
DECLARE
    v_cdef TEXT;
    v_fsrc TEXT;
    v_sec_invoker BOOLEAN;
    v_prosecdef BOOLEAN;
    v_proconfig TEXT[];
    v_relrowsecurity BOOLEAN;
    v_count INT;
BEGIN
    -- 1. Check transfers columns, data types, and nullability
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transfers';

    IF v_count < 15 THEN
        RAISE EXCEPTION 'transfers column count is less than 15 (got %)', v_count;
    END IF;

    -- amount: numeric(20,4) NOT NULL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers'
          AND column_name = 'amount' AND data_type = 'numeric'
          AND numeric_precision = 20 AND numeric_scale = 4 AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'transfers.amount column definition mismatch (expected numeric(20,4) NOT NULL)';
    END IF;

    -- destination_amount: numeric(20,4) NOT NULL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers'
          AND column_name = 'destination_amount' AND data_type = 'numeric'
          AND numeric_precision = 20 AND numeric_scale = 4 AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'transfers.destination_amount column definition mismatch (expected numeric(20,4) NOT NULL)';
    END IF;

    -- exchange_rate: numeric(30,12) NOT NULL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers'
          AND column_name = 'exchange_rate' AND data_type = 'numeric'
          AND numeric_precision = 30 AND numeric_scale = 12 AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'transfers.exchange_rate column definition mismatch (expected numeric(30,12) NOT NULL)';
    END IF;

    -- currency_code, source_currency_code, destination_currency_code: text NOT NULL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers'
          AND column_name = 'currency_code' AND data_type = 'text' AND is_nullable = 'NO'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers'
          AND column_name = 'source_currency_code' AND data_type = 'text' AND is_nullable = 'NO'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers'
          AND column_name = 'destination_currency_code' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'transfers currency columns definition mismatch (expected text NOT NULL)';
    END IF;

    -- 2. Constraints definitions inspection
    -- Check chk_transfers_currency_compatibility
    SELECT pg_get_constraintdef(oid) INTO v_cdef
    FROM pg_constraint
    WHERE conname = 'chk_transfers_currency_compatibility' AND conrelid = 'public.transfers'::regclass;

    IF v_cdef IS NULL OR v_cdef NOT ILIKE '%currency_code%source_currency_code%' THEN
        RAISE EXCEPTION 'chk_transfers_currency_compatibility definition mismatch: %', v_cdef;
    END IF;

    -- Check chk_transfers_same_currency_invariant
    SELECT pg_get_constraintdef(oid) INTO v_cdef
    FROM pg_constraint
    WHERE conname = 'chk_transfers_same_currency_invariant' AND conrelid = 'public.transfers'::regclass;

    IF v_cdef IS NULL OR v_cdef NOT ILIKE '%destination_amount%amount%' OR v_cdef NOT ILIKE '%exchange_rate%1%' THEN
        RAISE EXCEPTION 'chk_transfers_same_currency_invariant definition mismatch: %', v_cdef;
    END IF;

    -- Check chk_transfers_cross_currency_conversion
    SELECT pg_get_constraintdef(oid) INTO v_cdef
    FROM pg_constraint
    WHERE conname = 'chk_transfers_cross_currency_conversion' AND conrelid = 'public.transfers'::regclass;

    IF v_cdef IS NULL OR (v_cdef NOT ILIKE '%destination_amount = round(%amount * exchange_rate%, 4)%' AND v_cdef NOT ILIKE '%destination_amount = round(amount * exchange_rate, 4)%') THEN
        RAISE EXCEPTION 'chk_transfers_cross_currency_conversion definition mismatch: %', v_cdef;
    END IF;

    -- 3. Composite Foreign Keys inspection
    SELECT pg_get_constraintdef(oid) INTO v_cdef
    FROM pg_constraint
    WHERE conname = 'transfers_from_account_fkey' AND conrelid = 'public.transfers'::regclass;

    IF v_cdef IS NULL OR v_cdef NOT ILIKE '%from_account_id, user_id, source_currency_code%REFERENCES accounts(id, user_id, currency_code)%' OR v_cdef NOT ILIKE '%ON DELETE RESTRICT%' THEN
        RAISE EXCEPTION 'transfers_from_account_fkey composite FK definition mismatch: %', v_cdef;
    END IF;

    SELECT pg_get_constraintdef(oid) INTO v_cdef
    FROM pg_constraint
    WHERE conname = 'transfers_to_account_fkey' AND conrelid = 'public.transfers'::regclass;

    IF v_cdef IS NULL OR v_cdef NOT ILIKE '%to_account_id, user_id, destination_currency_code%REFERENCES accounts(id, user_id, currency_code)%' OR v_cdef NOT ILIKE '%ON DELETE RESTRICT%' THEN
        RAISE EXCEPTION 'transfers_to_account_fkey composite FK definition mismatch: %', v_cdef;
    END IF;

    -- 4. RLS & Policy inspection
    SELECT relrowsecurity INTO v_relrowsecurity
    FROM pg_class
    WHERE oid = 'public.transfers'::regclass;

    IF v_relrowsecurity IS NOT TRUE THEN
        RAISE EXCEPTION 'public.transfers row security (RLS) is NOT enabled';
    END IF;

    -- Prove SELECT policy for authenticated enforcing auth.uid() and user_id in USING
    SELECT count(*) INTO v_count
    FROM pg_policy p
    WHERE p.polrelid = 'public.transfers'::regclass
      AND p.polcmd IN ('r', '*')
      AND (
        (to_regrole('authenticated') IS NOT NULL AND to_regrole('authenticated')::oid = ANY(p.polroles))
        OR 0 = ANY(p.polroles)
      )
      AND p.polqual IS NOT NULL
      AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.uid()%'
      AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%user_id%';

    IF v_count < 1 THEN
        RAISE EXCEPTION 'public.transfers missing SELECT RLS policy for authenticated enforcing auth.uid() and user_id in USING';
    END IF;

    -- Prove INSERT policy for authenticated enforcing auth.uid() and user_id in WITH CHECK
    SELECT count(*) INTO v_count
    FROM pg_policy p
    WHERE p.polrelid = 'public.transfers'::regclass
      AND p.polcmd IN ('a', '*')
      AND (
        (to_regrole('authenticated') IS NOT NULL AND to_regrole('authenticated')::oid = ANY(p.polroles))
        OR 0 = ANY(p.polroles)
      )
      AND p.polwithcheck IS NOT NULL
      AND pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%auth.uid()%'
      AND pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%user_id%';

    IF v_count < 1 THEN
        RAISE EXCEPTION 'public.transfers missing INSERT RLS policy for authenticated enforcing auth.uid() and user_id in WITH CHECK';
    END IF;

    -- Prove UPDATE policy for authenticated enforcing auth.uid() and user_id in USING and WITH CHECK
    SELECT count(*) INTO v_count
    FROM pg_policy p
    WHERE p.polrelid = 'public.transfers'::regclass
      AND p.polcmd IN ('w', '*')
      AND (
        (to_regrole('authenticated') IS NOT NULL AND to_regrole('authenticated')::oid = ANY(p.polroles))
        OR 0 = ANY(p.polroles)
      )
      AND p.polqual IS NOT NULL
      AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.uid()%'
      AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%user_id%'
      AND p.polwithcheck IS NOT NULL
      AND pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%auth.uid()%'
      AND pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%user_id%';

    IF v_count < 1 THEN
        RAISE EXCEPTION 'public.transfers missing UPDATE RLS policy for authenticated enforcing auth.uid() and user_id in USING and WITH CHECK';
    END IF;

    -- Prove DELETE policy is absent for public.transfers
    SELECT count(*) INTO v_count
    FROM pg_policy p
    WHERE p.polrelid = 'public.transfers'::regclass
      AND p.polcmd = 'd';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'public.transfers must NOT have a DELETE policy (expected 0, found %)', v_count;
    END IF;

    -- 5. Grants inspection
    SELECT count(*) INTO v_count
    FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND table_name = 'transfers' AND grantee = 'anon';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'anon role has unintended privileges on public.transfers (found %)', v_count;
    END IF;

    -- 6. Views security_invoker inspection
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'transfer_details'
          AND c.relkind = 'v'
          AND EXISTS (
            SELECT 1 FROM unnest(c.reloptions) opt WHERE opt = 'security_invoker=true' OR opt = 'security_invoker=1'
          )
    ) INTO v_sec_invoker;

    IF NOT v_sec_invoker THEN
        RAISE EXCEPTION 'public.transfer_details does not have security_invoker = true';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'account_balances'
          AND c.relkind = 'v'
          AND EXISTS (
            SELECT 1 FROM unnest(c.reloptions) opt WHERE opt = 'security_invoker=true' OR opt = 'security_invoker=1'
          )
    ) INTO v_sec_invoker;

    IF NOT v_sec_invoker THEN
        RAISE EXCEPTION 'public.account_balances does not have security_invoker = true';
    END IF;

    -- 7. Archive Guard Trigger & Function Security Mode & search_path inspection
    SELECT count(*) INTO v_count
    FROM pg_trigger
    WHERE tgname = 'trg_check_transfer_accounts_active'
      AND tgrelid = 'public.transfers'::regclass
      AND (tgtype & 1) = 1    -- FOR EACH ROW
      AND (tgtype & 2) = 0    -- BEFORE
      AND (tgtype & 4) = 4    -- INSERT
      AND (tgtype & 16) = 16; -- UPDATE

    IF v_count < 1 THEN
        RAISE EXCEPTION 'Missing or invalid trigger trg_check_transfer_accounts_active on public.transfers (must be BEFORE INSERT OR UPDATE FOR EACH ROW)';
    END IF;

    SELECT prosecdef, prosrc, proconfig INTO v_prosecdef, v_fsrc, v_proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_transfer_accounts_active';

    IF v_prosecdef IS NULL THEN
        RAISE EXCEPTION 'Missing function public.check_transfer_accounts_active';
    END IF;

    IF v_prosecdef IS TRUE THEN
        RAISE EXCEPTION 'SECURITY DEFINER LEAK: public.check_transfer_accounts_active has prosecdef = true (must be SECURITY INVOKER / false)';
    END IF;

    -- Verify search_path is explicitly set to empty string ('')
    IF v_proconfig IS NULL OR NOT (
        'search_path=' = ANY(v_proconfig) OR
        'search_path=""' = ANY(v_proconfig) OR
        'search_path=''' = ANY(v_proconfig)
    ) THEN
        RAISE EXCEPTION 'public.check_transfer_accounts_active does not have search_path explicitly set to empty string (proconfig: %)', v_proconfig;
    END IF;

    IF v_fsrc NOT ILIKE '%v_from_archived%' OR v_fsrc NOT ILIKE '%v_to_archived%' THEN
        RAISE EXCEPTION 'public.check_transfer_accounts_active function body missing from/to archive checks';
    END IF;

    RAISE NOTICE 'PHASE_8_PASS_B_STRUCTURAL_GATE=PASS';
END;
$$;
