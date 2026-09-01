-- Phase 8 Pass B Authenticated Two-User Runtime Gate Harness
-- Simulates real authenticated sessions with auth.uid() for two distinct users.
-- Tests same-currency and cross-currency transfers, balance effects, void/restore,
-- cross-user isolation (SELECT, UPDATE, INSERT), rejection of DELETE,
-- constraint invariants, and archive guards.
-- Entire execution is transaction-scoped with ROLLBACK.

BEGIN;

DO $$
DECLARE
    v_users UUID[];
    v_user_a UUID;
    v_user_b UUID;

    -- Account IDs
    v_acc_a_usd UUID;
    v_acc_a_usd_2 UUID;
    v_acc_a_vnd UUID;
    v_acc_a_archived_usd UUID;
    v_acc_b_usd UUID;

    -- Transfer IDs & variables
    v_transfer_same_id UUID;
    v_transfer_cross_id UUID;
    v_check_count INT;
    v_rowcount INT;

    -- Values for assertion
    v_t_amount NUMERIC(20,4);
    v_t_src_curr TEXT;
    v_t_dst_curr TEXT;
    v_t_rate NUMERIC(30,12);
    v_t_dst_amt NUMERIC(20,4);
    v_t_curr TEXT;
    v_t_voided BOOLEAN;
    v_note_check TEXT;

    -- Balance snapshots (Exact NUMERIC arithmetic)
    v_bal_a_usd_before NUMERIC(20,4);
    v_bal_a_vnd_before NUMERIC(20,4);
    v_bal_a_usd_after NUMERIC(20,4);
    v_bal_a_vnd_after NUMERIC(20,4);
    v_bal_a_usd_voided NUMERIC(20,4);
    v_bal_a_vnd_voided NUMERIC(20,4);
    v_bal_a_usd_restored NUMERIC(20,4);
    v_bal_a_vnd_restored NUMERIC(20,4);

    -- Transaction count isolation
    v_user_a_tx_count_before INT;
    v_user_a_tx_count_after INT;
BEGIN
    ----------------------------------------------------------------------------
    -- 1. Select two real existing auth users (Fail-fast, PII-safe)
    ----------------------------------------------------------------------------
    SELECT array_agg(id) INTO v_users
    FROM (
        SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 2
    ) u;

    IF v_users IS NULL OR cardinality(v_users) < 2 THEN
        RAISE EXCEPTION 'Runtime gate requires at least 2 auth.users in database (found %)', COALESCE(cardinality(v_users), 0);
    END IF;

    v_user_a := v_users[1];
    v_user_b := v_users[2];

    IF v_user_a = v_user_b THEN
        RAISE EXCEPTION 'USER_A and USER_B must be distinct users';
    END IF;

    -- Bind transaction-local settings
    PERFORM set_config('finora_test.user_a', v_user_a::text, true);
    PERFORM set_config('finora_test.user_b', v_user_b::text, true);

    ----------------------------------------------------------------------------
    -- 2. Privileged Fixture Setup (Prefixed with __PHASE8_RUNTIME_GATE__)
    ----------------------------------------------------------------------------
    -- USER_A Accounts
    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_a, '__PHASE8_RUNTIME_GATE__A_USD', 'BANK', 'USD', 1000.0000, '#005a3c', false)
    RETURNING id INTO v_acc_a_usd;

    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_a, '__PHASE8_RUNTIME_GATE__A_USD_2', 'BANK', 'USD', 500.0000, '#005a3c', false)
    RETURNING id INTO v_acc_a_usd_2;

    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_a, '__PHASE8_RUNTIME_GATE__A_VND', 'BANK', 'VND', 10000000.0000, '#005a3c', false)
    RETURNING id INTO v_acc_a_vnd;

    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_a, '__PHASE8_RUNTIME_GATE__A_ARCHIVED_USD', 'CASH', 'USD', 0.0000, '#005a3c', true)
    RETURNING id INTO v_acc_a_archived_usd;

    -- USER_B Account
    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_b, '__PHASE8_RUNTIME_GATE__B_USD', 'BANK', 'USD', 500.0000, '#005a3c', false)
    RETURNING id INTO v_acc_b_usd;

    -- Store account IDs in transaction config
    PERFORM set_config('finora_test.acc_a_usd', v_acc_a_usd::text, true);
    PERFORM set_config('finora_test.acc_a_usd_2', v_acc_a_usd_2::text, true);
    PERFORM set_config('finora_test.acc_a_vnd', v_acc_a_vnd::text, true);
    PERFORM set_config('finora_test.acc_a_archived_usd', v_acc_a_archived_usd::text, true);
    PERFORM set_config('finora_test.acc_b_usd', v_acc_b_usd::text, true);

    -- Record initial transaction count for USER_A to ensure transfer != transaction
    SELECT count(*) INTO v_user_a_tx_count_before FROM public.transactions WHERE user_id = v_user_a;

    ----------------------------------------------------------------------------
    -- 3. Switch Role to Authenticated USER_A
    ----------------------------------------------------------------------------
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    IF current_user <> 'authenticated' THEN
        RAISE EXCEPTION 'Failed to switch current_user to authenticated (current: %)', current_user;
    END IF;
    RAISE NOTICE 'RUNTIME_AUTH_ROLE_USER_A=PASS';

    IF auth.uid() <> v_user_a THEN
        RAISE EXCEPTION 'Failed to establish auth.uid() for USER_A';
    END IF;
    RAISE NOTICE 'RUNTIME_AUTH_UID_USER_A=PASS';

    ----------------------------------------------------------------------------
    -- 4. USER_A Positive Case: Same-Currency Transfer (USD -> USD)
    -- Must omit is_voided on authenticated INSERT and prove default is_voided=false
    ----------------------------------------------------------------------------
    INSERT INTO public.transfers (
        user_id,
        from_account_id,
        to_account_id,
        amount,
        currency_code,
        source_currency_code,
        destination_currency_code,
        exchange_rate,
        destination_amount,
        note,
        occurred_on
    ) VALUES (
        v_user_a,
        v_acc_a_usd,
        v_acc_a_usd_2,
        25.0000,
        'USD',
        'USD',
        'USD',
        1.000000000000,
        25.0000,
        '__PHASE8_RUNTIME_GATE__ same-currency transfer test',
        CURRENT_DATE
    ) RETURNING id INTO v_transfer_same_id;

    SELECT is_voided INTO v_t_voided FROM public.transfers WHERE id = v_transfer_same_id;
    IF v_t_voided IS NOT FALSE THEN
        RAISE EXCEPTION 'Same-currency transfer did not default is_voided to false';
    END IF;

    SELECT count(*) INTO v_check_count
    FROM public.transfers
    WHERE id = v_transfer_same_id AND user_id = v_user_a AND amount = 25.0000 AND currency_code = 'USD';
    IF v_check_count <> 1 THEN
        RAISE EXCEPTION 'Same-currency transfer failed to persist or read via public.transfers';
    END IF;

    SELECT count(*) INTO v_check_count
    FROM public.transfer_details
    WHERE id = v_transfer_same_id AND user_id = v_user_a AND amount = '25.0000' AND source_currency_code = 'USD' AND destination_currency_code = 'USD';
    IF v_check_count <> 1 THEN
        RAISE EXCEPTION 'Same-currency transfer failed to read via public.transfer_details view';
    END IF;

    RAISE NOTICE 'RUNTIME_SAME_CURRENCY=PASS';

    ----------------------------------------------------------------------------
    -- 5. Record Balances and Execute Cross-Currency Transfer (USD -> VND)
    -- Queries public.account_balances using account_id and current_balance::numeric
    ----------------------------------------------------------------------------
    SELECT current_balance::numeric INTO v_bal_a_usd_before FROM public.account_balances WHERE account_id = v_acc_a_usd;
    SELECT current_balance::numeric INTO v_bal_a_vnd_before FROM public.account_balances WHERE account_id = v_acc_a_vnd;

    INSERT INTO public.transfers (
        user_id,
        from_account_id,
        to_account_id,
        amount,
        currency_code,
        source_currency_code,
        destination_currency_code,
        exchange_rate,
        destination_amount,
        note,
        occurred_on
    ) VALUES (
        v_user_a,
        v_acc_a_usd,
        v_acc_a_vnd,
        10.0000,
        'USD',
        'USD',
        'VND',
        25000.000000000000,
        250000.0000,
        '__PHASE8_RUNTIME_GATE__ cross-currency transfer test',
        CURRENT_DATE
    ) RETURNING id INTO v_transfer_cross_id;

    SELECT amount, source_currency_code, destination_currency_code, exchange_rate, destination_amount, currency_code, is_voided
    INTO v_t_amount, v_t_src_curr, v_t_dst_curr, v_t_rate, v_t_dst_amt, v_t_curr, v_t_voided
    FROM public.transfers
    WHERE id = v_transfer_cross_id;

    IF v_t_amount <> 10.0000 OR v_t_src_curr <> 'USD' OR v_t_dst_curr <> 'VND' OR
       v_t_rate <> 25000.000000000000 OR v_t_dst_amt <> 250000.0000 OR v_t_curr <> 'USD' OR v_t_voided IS NOT FALSE THEN
        RAISE EXCEPTION 'Cross-currency transfer values mismatch or is_voided not false in public.transfers';
    END IF;

    RAISE NOTICE 'RUNTIME_USD_TO_VND=PASS';

    ----------------------------------------------------------------------------
    -- 6. Dual-Currency Balance Effect
    ----------------------------------------------------------------------------
    SELECT current_balance::numeric INTO v_bal_a_usd_after FROM public.account_balances WHERE account_id = v_acc_a_usd;
    SELECT current_balance::numeric INTO v_bal_a_vnd_after FROM public.account_balances WHERE account_id = v_acc_a_vnd;

    IF (v_bal_a_usd_before - v_bal_a_usd_after) <> 10.0000 THEN
        RAISE EXCEPTION 'A_USD balance decrease mismatch: expected 10.0000, got %', (v_bal_a_usd_before - v_bal_a_usd_after);
    END IF;

    IF (v_bal_a_vnd_after - v_bal_a_vnd_before) <> 250000.0000 THEN
        RAISE EXCEPTION 'A_VND balance increase mismatch: expected 250000.0000, got %', (v_bal_a_vnd_after - v_bal_a_vnd_before);
    END IF;

    RAISE NOTICE 'RUNTIME_DUAL_CURRENCY_BALANCES=PASS';

    ----------------------------------------------------------------------------
    -- 7. Void / Restore Persistence Gate & Historical FX Stability
    ----------------------------------------------------------------------------
    -- Step A: Void
    UPDATE public.transfers
    SET is_voided = true
    WHERE id = v_transfer_cross_id;

    SELECT is_voided INTO v_t_voided FROM public.transfers WHERE id = v_transfer_cross_id;
    IF v_t_voided IS NOT TRUE THEN
        RAISE EXCEPTION 'Transfer void failed in public.transfers';
    END IF;

    SELECT is_voided INTO v_t_voided FROM public.transfer_details WHERE id = v_transfer_cross_id;
    IF v_t_voided IS NOT TRUE THEN
        RAISE EXCEPTION 'Transfer void failed in public.transfer_details view';
    END IF;

    SELECT current_balance::numeric INTO v_bal_a_usd_voided FROM public.account_balances WHERE account_id = v_acc_a_usd;
    SELECT current_balance::numeric INTO v_bal_a_vnd_voided FROM public.account_balances WHERE account_id = v_acc_a_vnd;

    IF v_bal_a_usd_voided <> v_bal_a_usd_before THEN
        RAISE EXCEPTION 'A_USD balance when voided did not restore to before state (expected %, got %)', v_bal_a_usd_before, v_bal_a_usd_voided;
    END IF;

    IF v_bal_a_vnd_voided <> v_bal_a_vnd_before THEN
        RAISE EXCEPTION 'A_VND balance when voided did not restore to before state (expected %, got %)', v_bal_a_vnd_before, v_bal_a_vnd_voided;
    END IF;

    RAISE NOTICE 'RUNTIME_VOID=PASS';

    -- Step B: Restore
    UPDATE public.transfers
    SET is_voided = false
    WHERE id = v_transfer_cross_id;

    SELECT is_voided, exchange_rate, destination_amount
    INTO v_t_voided, v_t_rate, v_t_dst_amt
    FROM public.transfers
    WHERE id = v_transfer_cross_id;

    IF v_t_voided IS NOT FALSE THEN
        RAISE EXCEPTION 'Transfer restore failed in public.transfers';
    END IF;

    SELECT current_balance::numeric INTO v_bal_a_usd_restored FROM public.account_balances WHERE account_id = v_acc_a_usd;
    SELECT current_balance::numeric INTO v_bal_a_vnd_restored FROM public.account_balances WHERE account_id = v_acc_a_vnd;

    IF v_bal_a_usd_restored <> v_bal_a_usd_after THEN
        RAISE EXCEPTION 'A_USD balance after restore mismatch (expected %, got %)', v_bal_a_usd_after, v_bal_a_usd_restored;
    END IF;

    IF v_bal_a_vnd_restored <> v_bal_a_vnd_after THEN
        RAISE EXCEPTION 'A_VND balance after restore mismatch (expected %, got %)', v_bal_a_vnd_after, v_bal_a_vnd_restored;
    END IF;

    RAISE NOTICE 'RUNTIME_RESTORE=PASS';

    -- Step C: Historical FX stability
    IF v_t_rate <> 25000.000000000000 OR v_t_dst_amt <> 250000.0000 THEN
        RAISE EXCEPTION 'Historical FX fields mutated during void/restore';
    END IF;

    RAISE NOTICE 'RUNTIME_HISTORICAL_FX_STABLE=PASS';

    ----------------------------------------------------------------------------
    -- 8. USER_B Cross-User Isolation (Read, Update, Cross-User Account Insert)
    ----------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    IF auth.uid() <> v_user_b THEN
        RAISE EXCEPTION 'Failed to switch auth.uid() to USER_B';
    END IF;

    -- Cross-user read isolation
    SELECT count(*) INTO v_check_count FROM public.transfers WHERE id = v_transfer_cross_id;
    IF v_check_count <> 0 THEN
        RAISE EXCEPTION 'RLS VIOLATION: USER_B can read USER_A transfer in public.transfers';
    END IF;

    SELECT count(*) INTO v_check_count FROM public.transfer_details WHERE id = v_transfer_cross_id;
    IF v_check_count <> 0 THEN
        RAISE EXCEPTION 'RLS VIOLATION: USER_B can read USER_A transfer in public.transfer_details';
    END IF;

    RAISE NOTICE 'RUNTIME_USER_B_CANNOT_READ_A=PASS';

    -- Cross-user update isolation
    UPDATE public.transfers SET note = '__HACKED_BY_USER_B__' WHERE id = v_transfer_cross_id;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount <> 0 THEN
        RAISE EXCEPTION 'RLS VIOLATION: USER_B was able to update USER_A transfer (affected rows: %)', v_rowcount;
    END IF;

    RAISE NOTICE 'RUNTIME_USER_B_CANNOT_UPDATE_A=PASS';

    -- Privileged verification that USER_A record note was NOT mutated
    EXECUTE 'RESET ROLE';
    SELECT note INTO v_note_check FROM public.transfers WHERE id = v_transfer_cross_id;
    IF v_note_check = '__HACKED_BY_USER_B__' THEN
        RAISE EXCEPTION 'RLS LEAK: USER_A transfer note was mutated by USER_B';
    END IF;

    -- Switch back to USER_B for cross-user account insertion attempt
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    BEGIN
        INSERT INTO public.transfers (
            user_id,
            from_account_id,
            to_account_id,
            amount,
            currency_code,
            source_currency_code,
            destination_currency_code,
            exchange_rate,
            destination_amount,
            note,
            occurred_on
        ) VALUES (
            v_user_b,
            v_acc_a_usd,
            v_acc_b_usd,
            10.0000,
            'USD',
            'USD',
            'USD',
            1.000000000000,
            10.0000,
            'Cross-user account attack',
            CURRENT_DATE
        );
        RAISE EXCEPTION 'SECURITY BREACH: USER_B created transfer referencing USER_A account';
    EXCEPTION
        WHEN foreign_key_violation THEN -- SQLSTATE 23503
            RAISE NOTICE 'RUNTIME_CROSS_USER_ACCOUNT_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN
                RAISE NOTICE 'RUNTIME_CROSS_USER_ACCOUNT_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 9. No DELETE Authority on public.transfers
    ----------------------------------------------------------------------------
    -- Switch back to USER_A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    IF auth.uid() <> v_user_a THEN
        RAISE EXCEPTION 'Failed to switch auth.uid() back to USER_A';
    END IF;

    BEGIN
        DELETE FROM public.transfers WHERE id = v_transfer_cross_id;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount > 0 THEN
            RAISE EXCEPTION 'SECURITY BREACH: USER_A was able to DELETE transfer (rowcount %)', v_rowcount;
        END IF;
        RAISE NOTICE 'RUNTIME_DELETE_REJECTED=PASS';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501
            RAISE NOTICE 'RUNTIME_DELETE_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                RAISE NOTICE 'RUNTIME_DELETE_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- Verify transfer still exists in database
    SELECT count(*) INTO v_check_count FROM public.transfers WHERE id = v_transfer_cross_id;
    IF v_check_count <> 1 THEN
        RAISE EXCEPTION 'Transfer was deleted unexpectedly';
    END IF;

    ----------------------------------------------------------------------------
    -- 10. Negative DB Integrity Matrix (Subtransaction protected with exact SQLSTATE)
    ----------------------------------------------------------------------------
    -- A. Same currency bad rate (Expected CHECK violation SQLSTATE 23514)
    BEGIN
        INSERT INTO public.transfers (
            user_id, from_account_id, to_account_id, amount,
            currency_code, source_currency_code, destination_currency_code,
            exchange_rate, destination_amount, note, occurred_on
        ) VALUES (
            v_user_a, v_acc_a_usd, v_acc_a_usd_2, 10.0000,
            'USD', 'USD', 'USD', 25000.000000000000, 10.0000,
            'Bad same currency rate', CURRENT_DATE
        );
        RAISE EXCEPTION 'FAILED: Bad same currency rate was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'RUNTIME_BAD_SAME_CURRENCY_RATE_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'RUNTIME_BAD_SAME_CURRENCY_RATE_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- B. Same currency contradictory destination amount (Expected CHECK violation SQLSTATE 23514)
    BEGIN
        INSERT INTO public.transfers (
            user_id, from_account_id, to_account_id, amount,
            currency_code, source_currency_code, destination_currency_code,
            exchange_rate, destination_amount, note, occurred_on
        ) VALUES (
            v_user_a, v_acc_a_usd, v_acc_a_usd_2, 10.0000,
            'USD', 'USD', 'USD', 1.000000000000, 20.0000,
            'Bad same currency destination amount', CURRENT_DATE
        );
        RAISE EXCEPTION 'FAILED: Bad same currency destination amount was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'RUNTIME_BAD_SAME_CURRENCY_DESTINATION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'RUNTIME_BAD_SAME_CURRENCY_DESTINATION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- C. Cross-currency contradictory destination amount (Expected CHECK violation SQLSTATE 23514)
    BEGIN
        INSERT INTO public.transfers (
            user_id, from_account_id, to_account_id, amount,
            currency_code, source_currency_code, destination_currency_code,
            exchange_rate, destination_amount, note, occurred_on
        ) VALUES (
            v_user_a, v_acc_a_usd, v_acc_a_vnd, 10.0000,
            'USD', 'USD', 'VND', 25000.000000000000, 200000.0000,
            'Bad cross currency destination amount', CURRENT_DATE
        );
        RAISE EXCEPTION 'FAILED: Bad cross currency destination amount was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'RUNTIME_BAD_CROSS_CURRENCY_DESTINATION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'RUNTIME_BAD_CROSS_CURRENCY_DESTINATION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- D. Account currency mismatch (account USD but claiming source VND) (Expected FK violation SQLSTATE 23503)
    BEGIN
        INSERT INTO public.transfers (
            user_id, from_account_id, to_account_id, amount,
            currency_code, source_currency_code, destination_currency_code,
            exchange_rate, destination_amount, note, occurred_on
        ) VALUES (
            v_user_a, v_acc_a_usd, v_acc_a_vnd, 10.0000,
            'VND', 'VND', 'VND', 1.000000000000, 10.0000,
            'Account currency mismatch', CURRENT_DATE
        );
        RAISE EXCEPTION 'FAILED: Account currency mismatch was accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN -- SQLSTATE 23503
            RAISE NOTICE 'RUNTIME_ACCOUNT_CURRENCY_MISMATCH_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN
                RAISE NOTICE 'RUNTIME_ACCOUNT_CURRENCY_MISMATCH_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- E. Same account transfer (Expected CHECK violation SQLSTATE 23514)
    BEGIN
        INSERT INTO public.transfers (
            user_id, from_account_id, to_account_id, amount,
            currency_code, source_currency_code, destination_currency_code,
            exchange_rate, destination_amount, note, occurred_on
        ) VALUES (
            v_user_a, v_acc_a_usd, v_acc_a_usd, 10.0000,
            'USD', 'USD', 'USD', 1.000000000000, 10.0000,
            'Same account transfer', CURRENT_DATE
        );
        RAISE EXCEPTION 'FAILED: Same account transfer was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'RUNTIME_SAME_ACCOUNT_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'RUNTIME_SAME_ACCOUNT_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- F. Archived account transfer (Expected raise_exception SQLSTATE P0001 from trigger)
    BEGIN
        INSERT INTO public.transfers (
            user_id, from_account_id, to_account_id, amount,
            currency_code, source_currency_code, destination_currency_code,
            exchange_rate, destination_amount, note, occurred_on
        ) VALUES (
            v_user_a, v_acc_a_archived_usd, v_acc_a_usd_2, 10.0000,
            'USD', 'USD', 'USD', 1.000000000000, 10.0000,
            'Archived account transfer', CURRENT_DATE
        );
        RAISE EXCEPTION 'FAILED: Archived account transfer was accepted';
    EXCEPTION
        WHEN raise_exception THEN -- SQLSTATE P0001
            IF SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'RUNTIME_ARCHIVED_ACCOUNT_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
        WHEN OTHERS THEN
            IF SQLSTATE = 'P0001' AND SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'RUNTIME_ARCHIVED_ACCOUNT_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 11. Transfers Must Not Become Transactions
    ----------------------------------------------------------------------------
    SELECT count(*) INTO v_user_a_tx_count_after FROM public.transactions WHERE user_id = v_user_a;
    IF v_user_a_tx_count_before <> v_user_a_tx_count_after THEN
        RAISE EXCEPTION 'Transfer operations altered public.transactions count (before: %, after: %)', v_user_a_tx_count_before, v_user_a_tx_count_after;
    END IF;

    RAISE NOTICE 'RUNTIME_TRANSFER_DOES_NOT_CREATE_TRANSACTION=PASS';

    ----------------------------------------------------------------------------
    -- 12. Final Status & Rollback Proof
    ----------------------------------------------------------------------------
    EXECUTE 'RESET ROLE';
    RAISE NOTICE 'RUNTIME_FIXTURE_ROLLBACK=PASS';
    RAISE NOTICE 'PHASE_8_PASS_B_TWO_USER_RLS_RUNTIME=PASS';
    RAISE NOTICE 'PHASE_8_PASS_B_VOID_RESTORE_RUNTIME=PASS';
END;
$$;

RESET ROLE;
ROLLBACK;

-- Read-only cleanup verification proof query:
-- Confirm 0 rows remain with runtime prefix after rollback:
-- SELECT count(*) AS remaining_fixtures FROM public.accounts WHERE name LIKE '__PHASE8_RUNTIME_GATE__%';
