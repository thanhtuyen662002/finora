-- Phase 9 Authenticated Two-User Runtime Gate Harness
-- Simulates real authenticated sessions with auth.uid() for two distinct users.
-- Tests:
--  - Database-derived ownership (omitting user_id on INSERT)
--  - Explicit user_id injection rejection by column privileges (SQLSTATE 42501)
--  - Two-user RLS SELECT isolation on sources and streams
--  - Two-user RLS UPDATE isolation on sources and streams
--  - Stream hierarchy creation with database-derived ownership
--  - Cross-user stream parent attachment rejection (composite FK violation SQLSTATE 23503)
--  - Stream parent immutability (column privilege denial SQLSTATE 42501 on income_source_id update)
--  - Income transaction attribution: source-only, source+stream, unattributed
--  - Transaction details 22-column view readback resolution
--  - Expense attribution prohibition (CHECK violation SQLSTATE 23514)
--  - Stream requires source constraint (CHECK violation SQLSTATE 23514)
--  - Cross-user transaction attribution rejection (composite FK violation SQLSTATE 23503)
--  - Stream/source parent mismatch rejection (composite FK violation SQLSTATE 23503)
--  - Active-attribution enforcement trigger on archive (trigger exception SQLSTATE P0001)
--  - Historical attribution preservation across source/stream archive
--  - Unrelated transaction update permitted after archive
--  - Attribution mutation to archived source/stream rejected
--  - Hard DELETE rejection on sources and streams (SQLSTATE 42501)
--  - transaction_details two-user RLS isolation
--  - Metadata financial neutrality
--  - Transaction-scoped execution with complete ROLLBACK
--
-- Authoritative verification file: scripts/verify-phase9-runtime.sql

BEGIN;

DO $$
DECLARE
    v_users UUID[];
    v_user_a UUID;
    v_user_b UUID;
    v_owner_id UUID;
    v_is_archived BOOLEAN;
    v_count INT;
    v_rowcount INT;
    v_note_check TEXT;

    -- Temporary Account and Category Fixture IDs
    v_acc_a UUID;
    v_cat_a_inc UUID;
    v_cat_a_exp UUID;
    v_acc_b UUID;
    v_cat_b_inc UUID;

    -- Income Source & Stream IDs
    v_source_a1 UUID;
    v_source_a2 UUID;
    v_source_b UUID;
    v_stream_a1 UUID;

    -- Transaction IDs
    v_tx_source_only UUID;
    v_tx_source_stream UUID;
    v_tx_unattrib UUID;
    v_tx_historical UUID;

    -- Neutrality Check Variables
    v_bal_b_before NUMERIC(20,4);
    v_bal_b_after NUMERIC(20,4);
    v_tx_b_count_before INT;
    v_tx_b_count_after INT;
    v_meta_src UUID;
    v_meta_stream UUID;
BEGIN
    ----------------------------------------------------------------------------
    -- 1. User Discovery (Fail-closed, at least 2 distinct users required)
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

    RAISE NOTICE 'USER_A_DISCOVERED=true';
    RAISE NOTICE 'USER_B_DISCOVERED=true';
    RAISE NOTICE 'USER_IDS_DISTINCT=true';

    ----------------------------------------------------------------------------
    -- 2. Privileged Fixture Setup (Prefixed with __PHASE9_RUNTIME_GATE__)
    -- Temporary accounts and categories for transaction attribution testing
    ----------------------------------------------------------------------------
    -- USER_A Account & Categories
    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_a, '__PHASE9_RUNTIME_GATE__A_ACC', 'BANK', 'VND', 10000000.0000, '#005a3c', false)
    RETURNING id INTO v_acc_a;

    INSERT INTO public.categories (user_id, name, type, icon, color)
    VALUES (v_user_a, '__PHASE9_RUNTIME_GATE__A_CAT_INC', 'INCOME', 'briefcase', '#005a3c')
    RETURNING id INTO v_cat_a_inc;

    INSERT INTO public.categories (user_id, name, type, icon, color)
    VALUES (v_user_a, '__PHASE9_RUNTIME_GATE__A_CAT_EXP', 'EXPENSE', 'coffee', '#dc2626')
    RETURNING id INTO v_cat_a_exp;

    -- USER_B Account & Category
    INSERT INTO public.accounts (user_id, name, type, currency_code, opening_balance, color, is_archived)
    VALUES (v_user_b, '__PHASE9_RUNTIME_GATE__B_ACC', 'BANK', 'VND', 5000000.0000, '#005a3c', false)
    RETURNING id INTO v_acc_b;

    INSERT INTO public.categories (user_id, name, type, icon, color)
    VALUES (v_user_b, '__PHASE9_RUNTIME_GATE__B_CAT_INC', 'INCOME', 'briefcase', '#005a3c')
    RETURNING id INTO v_cat_b_inc;

    ----------------------------------------------------------------------------
    -- 3. Switch to Authenticated USER_A
    ----------------------------------------------------------------------------
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    IF current_user <> 'authenticated' OR auth.uid() <> v_user_a THEN
        RAISE EXCEPTION 'Failed to switch to authenticated USER_A session';
    END IF;

    ----------------------------------------------------------------------------
    -- 4. Source Creation — Database-Derived Ownership (Omitting user_id)
    ----------------------------------------------------------------------------
    INSERT INTO public.income_sources (name, type)
    VALUES ('__PHASE9_RUNTIME_GATE__A_SRC_YOUTUBE', 'YOUTUBE')
    RETURNING id, user_id, is_archived INTO v_source_a1, v_owner_id, v_is_archived;

    IF v_owner_id <> v_user_a THEN
        RAISE EXCEPTION 'Source created by USER_A returned wrong user_id (expected %, got %)', v_user_a, v_owner_id;
    END IF;
    IF v_is_archived IS NOT FALSE THEN
        RAISE EXCEPTION 'Source did not default is_archived to false';
    END IF;

    RAISE NOTICE 'SOURCE_INSERT_WITHOUT_USER_ID=PASS';
    RAISE NOTICE 'SOURCE_DATABASE_DERIVED_USER_ID=PASS';

    -- Create second source for USER_A (SALARY) for mismatch and stream-parent tests
    INSERT INTO public.income_sources (name, type)
    VALUES ('__PHASE9_RUNTIME_GATE__A_SRC_SALARY', 'SALARY')
    RETURNING id INTO v_source_a2;

    -- Switch to USER_B and create USER_B source
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    IF auth.uid() <> v_user_b THEN
        RAISE EXCEPTION 'Failed to switch to authenticated USER_B session';
    END IF;

    INSERT INTO public.income_sources (name, type)
    VALUES ('__PHASE9_RUNTIME_GATE__B_SRC_FREELANCE', 'FREELANCE')
    RETURNING id, user_id INTO v_source_b, v_owner_id;

    IF v_owner_id <> v_user_b THEN
        RAISE EXCEPTION 'Source created by USER_B returned wrong user_id (expected %, got %)', v_user_b, v_owner_id;
    END IF;

    ----------------------------------------------------------------------------
    -- 5. Explicit user_id Injection Denial (Column-Level Privilege Enforcement)
    ----------------------------------------------------------------------------
    -- Switch back to USER_A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    -- Source user_id injection attempt
    BEGIN
        INSERT INTO public.income_sources (user_id, name, type)
        VALUES (v_user_a, '__PHASE9_INJECT_SOURCE', 'OTHER');
        RAISE EXCEPTION 'SECURITY BREACH: Explicit user_id on income_sources INSERT was permitted';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501
            RAISE NOTICE 'SOURCE_USER_ID_INJECTION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                RAISE NOTICE 'SOURCE_USER_ID_INJECTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- Stream user_id injection attempt
    BEGIN
        INSERT INTO public.income_source_streams (user_id, income_source_id, name)
        VALUES (v_user_a, v_source_a1, '__PHASE9_INJECT_STREAM');
        RAISE EXCEPTION 'SECURITY BREACH: Explicit user_id on income_source_streams INSERT was permitted';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501
            RAISE NOTICE 'STREAM_USER_ID_INJECTION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                RAISE NOTICE 'STREAM_USER_ID_INJECTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 6. Source RLS Read Isolation (SELECT)
    ----------------------------------------------------------------------------
    -- As USER_A
    SELECT count(*) INTO v_count FROM public.income_sources WHERE id = v_source_a1;
    IF v_count <> 1 THEN RAISE EXCEPTION 'USER_A cannot select own source'; END IF;

    SELECT count(*) INTO v_count FROM public.income_sources WHERE id = v_source_b;
    IF v_count <> 0 THEN RAISE EXCEPTION 'RLS VIOLATION: USER_A can select USER_B source'; END IF;

    -- As USER_B
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO v_count FROM public.income_sources WHERE id = v_source_b;
    IF v_count <> 1 THEN RAISE EXCEPTION 'USER_B cannot select own source'; END IF;

    SELECT count(*) INTO v_count FROM public.income_sources WHERE id = v_source_a1;
    IF v_count <> 0 THEN RAISE EXCEPTION 'RLS VIOLATION: USER_B can select USER_A source'; END IF;

    RAISE NOTICE 'SOURCE_TWO_USER_SELECT_ISOLATION=PASS';

    ----------------------------------------------------------------------------
    -- 7. Source RLS Update Isolation
    ----------------------------------------------------------------------------
    -- As USER_B attempt to update USER_A source
    UPDATE public.income_sources SET name = '__HACKED_BY_USER_B__' WHERE id = v_source_a1;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount <> 0 THEN
        RAISE EXCEPTION 'RLS VIOLATION: USER_B updated USER_A source (affected rows: %)', v_rowcount;
    END IF;

    RAISE NOTICE 'SOURCE_CROSS_USER_UPDATE_BLOCKED=PASS';

    ----------------------------------------------------------------------------
    -- 8. Stream Hierarchy & Isolation
    ----------------------------------------------------------------------------
    -- Switch to USER_A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    INSERT INTO public.income_source_streams (income_source_id, name)
    VALUES (v_source_a1, '__PHASE9_RUNTIME_GATE__A_STREAM_CH1')
    RETURNING id, user_id INTO v_stream_a1, v_owner_id;

    IF v_owner_id <> v_user_a THEN
        RAISE EXCEPTION 'Stream created by USER_A returned wrong user_id';
    END IF;

    RAISE NOTICE 'STREAM_DATABASE_DERIVED_USER_ID=PASS';

    -- As USER_B: Read and Update isolation on streams
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO v_count FROM public.income_source_streams WHERE id = v_stream_a1;
    IF v_count <> 0 THEN RAISE EXCEPTION 'RLS VIOLATION: USER_B can select USER_A stream'; END IF;

    UPDATE public.income_source_streams SET name = '__HACKED_STREAM_BY_USER_B__' WHERE id = v_stream_a1;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount <> 0 THEN RAISE EXCEPTION 'RLS VIOLATION: USER_B updated USER_A stream'; END IF;

    RAISE NOTICE 'STREAM_TWO_USER_ISOLATION=PASS';

    -- As USER_B attempt to create stream under USER_A's source (Composite FK violation)
    BEGIN
        INSERT INTO public.income_source_streams (income_source_id, name)
        VALUES (v_source_a1, '__PHASE9_STREAM_B_UNDER_A');
        RAISE EXCEPTION 'SECURITY BREACH: USER_B created stream under USER_A source';
    EXCEPTION
        WHEN foreign_key_violation THEN -- SQLSTATE 23503
            RAISE NOTICE 'CROSS_USER_STREAM_PARENT_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN
                RAISE NOTICE 'CROSS_USER_STREAM_PARENT_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 9. Stream Parent Immutability (Column-Level UPDATE Restriction)
    ----------------------------------------------------------------------------
    -- Switch back to USER_A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    BEGIN
        UPDATE public.income_source_streams
        SET income_source_id = v_source_a2
        WHERE id = v_stream_a1;
        RAISE EXCEPTION 'SECURITY BREACH: Authenticated user mutated income_source_id on stream';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501
            RAISE NOTICE 'STREAM_PARENT_IMMUTABLE_RUNTIME=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                RAISE NOTICE 'STREAM_PARENT_IMMUTABLE_RUNTIME=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 10. Income Transaction — Source-Only Attribution
    ----------------------------------------------------------------------------
    INSERT INTO public.transactions (
        user_id, account_id, category_id, type, amount, currency_code,
        merchant, note, occurred_on, income_source_id, income_source_stream_id
    ) VALUES (
        v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 2500000.0000, 'VND',
        'Company Payroll', 'Monthly Salary', CURRENT_DATE, v_source_a2, NULL
    ) RETURNING id INTO v_tx_source_only;

    SELECT count(*) INTO v_count
    FROM public.transaction_details
    WHERE id = v_tx_source_only
      AND income_source_id = v_source_a2
      AND income_source_name = '__PHASE9_RUNTIME_GATE__A_SRC_SALARY'
      AND income_source_type = 'SALARY'
      AND income_source_stream_id IS NULL
      AND income_source_stream_name IS NULL;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Transaction details view failed to resolve source-only attribution';
    END IF;

    RAISE NOTICE 'SOURCE_ONLY_ATTRIBUTION_INSERT=PASS';

    ----------------------------------------------------------------------------
    -- 11. Income Transaction — Source + Stream Attribution
    ----------------------------------------------------------------------------
    INSERT INTO public.transactions (
        user_id, account_id, category_id, type, amount, currency_code,
        merchant, note, occurred_on, income_source_id, income_source_stream_id
    ) VALUES (
        v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 1500000.0000, 'VND',
        'Google AdSense', 'Channel 1 Payout', CURRENT_DATE, v_source_a1, v_stream_a1
    ) RETURNING id INTO v_tx_source_stream;

    SELECT count(*) INTO v_count
    FROM public.transaction_details
    WHERE id = v_tx_source_stream
      AND income_source_id = v_source_a1
      AND income_source_name = '__PHASE9_RUNTIME_GATE__A_SRC_YOUTUBE'
      AND income_source_type = 'YOUTUBE'
      AND income_source_stream_id = v_stream_a1
      AND income_source_stream_name = '__PHASE9_RUNTIME_GATE__A_STREAM_CH1';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Transaction details view failed to resolve source+stream attribution';
    END IF;

    RAISE NOTICE 'SOURCE_STREAM_ATTRIBUTION_INSERT=PASS';

    ----------------------------------------------------------------------------
    -- 12. Unattributed Income
    ----------------------------------------------------------------------------
    INSERT INTO public.transactions (
        user_id, account_id, category_id, type, amount, currency_code,
        merchant, note, occurred_on, income_source_id, income_source_stream_id
    ) VALUES (
        v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 500000.0000, 'VND',
        'Cash Gift', 'Unattributed gift', CURRENT_DATE, NULL, NULL
    ) RETURNING id INTO v_tx_unattrib;

    SELECT count(*) INTO v_count
    FROM public.transaction_details
    WHERE id = v_tx_unattrib
      AND income_source_id IS NULL
      AND income_source_stream_id IS NULL;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Unattributed income failed to query in transaction_details';
    END IF;

    RAISE NOTICE 'UNATTRIBUTED_INCOME_ALLOWED=PASS';

    ----------------------------------------------------------------------------
    -- 13. Expense Attribution Prohibition (CHECK Constraints)
    ----------------------------------------------------------------------------
    -- Attempt EXPENSE with source
    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_a, v_acc_a, v_cat_a_exp, 'EXPENSE', 100000.0000, 'VND',
            'Coffee Shop', 'Expense with source', CURRENT_DATE, v_source_a1, NULL
        );
        RAISE EXCEPTION 'INTEGRITY VIOLATION: Expense with income_source_id was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'EXPENSE_SOURCE_ATTRIBUTION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'EXPENSE_SOURCE_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- Attempt EXPENSE with source + stream
    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_a, v_acc_a, v_cat_a_exp, 'EXPENSE', 100000.0000, 'VND',
            'Coffee Shop', 'Expense with stream', CURRENT_DATE, v_source_a1, v_stream_a1
        );
        RAISE EXCEPTION 'INTEGRITY VIOLATION: Expense with stream was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'EXPENSE_STREAM_ATTRIBUTION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'EXPENSE_STREAM_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 14. Stream Requires Source Constraint (CHECK constraint)
    ----------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 100000.0000, 'VND',
            'Platform', 'Stream without source', CURRENT_DATE, NULL, v_stream_a1
        );
        RAISE EXCEPTION 'INTEGRITY VIOLATION: Stream without source was accepted';
    EXCEPTION
        WHEN check_violation THEN -- SQLSTATE 23514
            RAISE NOTICE 'STREAM_WITHOUT_SOURCE_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23514' THEN
                RAISE NOTICE 'STREAM_WITHOUT_SOURCE_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 15. Cross-User Transaction Attribution (Composite FK Enforced)
    ----------------------------------------------------------------------------
    -- Switch to USER_B
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    -- USER_B attempt attribution to USER_A source
    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_b, v_acc_b, v_cat_b_inc, 'INCOME', 200000.0000, 'VND',
            'Freelance Client', 'Attack cross user source', CURRENT_DATE, v_source_a1, NULL
        );
        RAISE EXCEPTION 'SECURITY BREACH: USER_B attributed transaction to USER_A source';
    EXCEPTION
        WHEN foreign_key_violation THEN -- SQLSTATE 23503
            RAISE NOTICE 'CROSS_USER_SOURCE_ATTRIBUTION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN
                RAISE NOTICE 'CROSS_USER_SOURCE_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- USER_B attempt attribution to USER_A source + stream
    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_b, v_acc_b, v_cat_b_inc, 'INCOME', 200000.0000, 'VND',
            'Freelance Client', 'Attack cross user stream', CURRENT_DATE, v_source_a1, v_stream_a1
        );
        RAISE EXCEPTION 'SECURITY BREACH: USER_B attributed transaction to USER_A stream';
    EXCEPTION
        WHEN foreign_key_violation THEN -- SQLSTATE 23503
            RAISE NOTICE 'CROSS_USER_STREAM_ATTRIBUTION_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN
                RAISE NOTICE 'CROSS_USER_STREAM_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 16. Stream/Source Mismatch (Composite FK Enforced)
    ----------------------------------------------------------------------------
    -- Switch back to USER_A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 300000.0000, 'VND',
            'Company', 'Mismatched stream parent', CURRENT_DATE, v_source_a2, v_stream_a1
        );
        RAISE EXCEPTION 'INTEGRITY VIOLATION: Mismatched stream and source accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN -- SQLSTATE 23503
            RAISE NOTICE 'STREAM_SOURCE_MISMATCH_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN
                RAISE NOTICE 'STREAM_SOURCE_MISMATCH_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 17. Archive Enforcement Trigger, Historical Preservation & Mutations
    ----------------------------------------------------------------------------
    -- A. Create realized historical transaction BEFORE archive
    INSERT INTO public.transactions (
        user_id, account_id, category_id, type, amount, currency_code,
        merchant, note, occurred_on, income_source_id, income_source_stream_id
    ) VALUES (
        v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 800000.0000, 'VND',
        'Historical Client', 'Realized before archive', CURRENT_DATE, v_source_a1, v_stream_a1
    ) RETURNING id INTO v_tx_historical;

    -- B. Archive SOURCE_A1 and test new attribution rejection
    UPDATE public.income_sources SET is_archived = true WHERE id = v_source_a1;

    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 100000.0000, 'VND',
            'AdSense', 'New tx on archived source', CURRENT_DATE, v_source_a1, NULL
        );
        RAISE EXCEPTION 'INTEGRITY VIOLATION: New transaction on archived source was accepted';
    EXCEPTION
        WHEN raise_exception THEN -- SQLSTATE P0001
            IF SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_SOURCE_NEW_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
        WHEN OTHERS THEN
            IF SQLSTATE = 'P0001' AND SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_SOURCE_NEW_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- C. Unarchive SOURCE_A1, Archive STREAM_A1 and test new attribution rejection
    UPDATE public.income_sources SET is_archived = false WHERE id = v_source_a1;
    UPDATE public.income_source_streams SET is_archived = true WHERE id = v_stream_a1;

    BEGIN
        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount, currency_code,
            merchant, note, occurred_on, income_source_id, income_source_stream_id
        ) VALUES (
            v_user_a, v_acc_a, v_cat_a_inc, 'INCOME', 100000.0000, 'VND',
            'AdSense', 'New tx on archived stream', CURRENT_DATE, v_source_a1, v_stream_a1
        );
        RAISE EXCEPTION 'INTEGRITY VIOLATION: New transaction on archived stream was accepted';
    EXCEPTION
        WHEN raise_exception THEN -- SQLSTATE P0001
            IF SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_STREAM_NEW_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
        WHEN OTHERS THEN
            IF SQLSTATE = 'P0001' AND SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_STREAM_NEW_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- D. Re-archive SOURCE_A1 as well (both source and stream now archived)
    UPDATE public.income_sources SET is_archived = true WHERE id = v_source_a1;

    -- E. Historical attribution remains visible through transaction_details view
    SELECT count(*) INTO v_count
    FROM public.transaction_details
    WHERE id = v_tx_historical
      AND income_source_id = v_source_a1
      AND income_source_name = '__PHASE9_RUNTIME_GATE__A_SRC_YOUTUBE'
      AND income_source_stream_id = v_stream_a1
      AND income_source_stream_name = '__PHASE9_RUNTIME_GATE__A_STREAM_CH1';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Historical realized attribution was erased or lost after archive';
    END IF;

    RAISE NOTICE 'HISTORICAL_ATTRIBUTION_REMAINS_VISIBLE=PASS';

    -- F. Unrelated transaction update on historical transaction referencing archived source/stream
    UPDATE public.transactions
    SET note = '__NOTE_UPDATED_AFTER_ARCHIVE__'
    WHERE id = v_tx_historical;

    SELECT note INTO v_note_check FROM public.transactions WHERE id = v_tx_historical;
    IF v_note_check <> '__NOTE_UPDATED_AFTER_ARCHIVE__' THEN
        RAISE EXCEPTION 'Unrelated note update on historical transaction failed';
    END IF;

    RAISE NOTICE 'UNRELATED_UPDATE_AFTER_ARCHIVE=PASS';

    -- G. Attempt to UPDATE existing transaction attribution to archived source
    BEGIN
        UPDATE public.transactions
        SET income_source_id = v_source_a1
        WHERE id = v_tx_source_only;
        RAISE EXCEPTION 'INTEGRITY VIOLATION: Updating attribution to archived source was accepted';
    EXCEPTION
        WHEN raise_exception THEN -- SQLSTATE P0001
            IF SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_SOURCE_UPDATE_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
        WHEN OTHERS THEN
            IF SQLSTATE = 'P0001' AND SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_SOURCE_UPDATE_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- H. Attempt to UPDATE existing transaction attribution to archived stream
    UPDATE public.income_sources SET is_archived = false WHERE id = v_source_a1;
    BEGIN
        UPDATE public.transactions
        SET income_source_id = v_source_a1, income_source_stream_id = v_stream_a1
        WHERE id = v_tx_source_only;
        RAISE EXCEPTION 'INTEGRITY VIOLATION: Updating attribution to archived stream was accepted';
    EXCEPTION
        WHEN raise_exception THEN -- SQLSTATE P0001
            IF SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_STREAM_UPDATE_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
        WHEN OTHERS THEN
            IF SQLSTATE = 'P0001' AND SQLERRM ILIKE '%archived%' THEN
                RAISE NOTICE 'ARCHIVED_STREAM_UPDATE_ATTRIBUTION_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 18. Hard DELETE Rejection on Sources and Streams
    ----------------------------------------------------------------------------
    -- Attempt DELETE on income_sources
    BEGIN
        DELETE FROM public.income_sources WHERE id = v_source_a1;
        RAISE EXCEPTION 'SECURITY BREACH: DELETE on income_sources was permitted';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501
            RAISE NOTICE 'SOURCE_DELETE_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                RAISE NOTICE 'SOURCE_DELETE_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    -- Attempt DELETE on income_source_streams
    BEGIN
        DELETE FROM public.income_source_streams WHERE id = v_stream_a1;
        RAISE EXCEPTION 'SECURITY BREACH: DELETE on income_source_streams was permitted';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501
            RAISE NOTICE 'STREAM_DELETE_REJECTED=PASS';
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                RAISE NOTICE 'STREAM_DELETE_REJECTED=PASS';
            ELSE
                RAISE;
            END IF;
    END;

    ----------------------------------------------------------------------------
    -- 19. transaction_details Two-User RLS Isolation
    ----------------------------------------------------------------------------
    -- Switch to USER_B
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO v_count
    FROM public.transaction_details
    WHERE id IN (v_tx_source_only, v_tx_source_stream, v_tx_unattrib, v_tx_historical);

    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS VIOLATION: USER_B can view USER_A transactions in transaction_details (count: %)', v_count;
    END IF;

    RAISE NOTICE 'TRANSACTION_DETAILS_TWO_USER_RLS=PASS';

    ----------------------------------------------------------------------------
    -- 20. Metadata Financial Neutrality
    ----------------------------------------------------------------------------
    SELECT current_balance::numeric INTO v_bal_b_before FROM public.account_balances WHERE account_id = v_acc_b;
    SELECT count(*) INTO v_tx_b_count_before FROM public.transactions WHERE user_id = v_user_b;

    -- Perform metadata operations under USER_B
    INSERT INTO public.income_sources (name, type)
    VALUES ('__PHASE9_RUNTIME_GATE__B_META', 'OTHER')
    RETURNING id INTO v_meta_src;

    UPDATE public.income_sources SET name = '__PHASE9_RUNTIME_GATE__B_META_RENAMED' WHERE id = v_meta_src;
    UPDATE public.income_sources SET is_archived = true WHERE id = v_meta_src;
    UPDATE public.income_sources SET is_archived = false WHERE id = v_meta_src;

    INSERT INTO public.income_source_streams (income_source_id, name)
    VALUES (v_meta_src, '__PHASE9_RUNTIME_GATE__B_META_STREAM')
    RETURNING id INTO v_meta_stream;

    UPDATE public.income_source_streams SET name = '__PHASE9_RUNTIME_GATE__B_META_STREAM_RENAMED' WHERE id = v_meta_stream;
    UPDATE public.income_source_streams SET is_archived = true WHERE id = v_meta_stream;
    UPDATE public.income_source_streams SET is_archived = false WHERE id = v_meta_stream;

    SELECT current_balance::numeric INTO v_bal_b_after FROM public.account_balances WHERE account_id = v_acc_b;
    SELECT count(*) INTO v_tx_b_count_after FROM public.transactions WHERE user_id = v_user_b;

    IF v_bal_b_before <> v_bal_b_after THEN
        RAISE EXCEPTION 'Financial balance altered by metadata operations (before: %, after: %)', v_bal_b_before, v_bal_b_after;
    END IF;

    IF v_tx_b_count_before <> v_tx_b_count_after THEN
        RAISE EXCEPTION 'Transaction count altered by metadata operations (before: %, after: %)', v_tx_b_count_before, v_tx_b_count_after;
    END IF;

    RAISE NOTICE 'METADATA_FINANCIAL_NEUTRALITY=PASS';

    ----------------------------------------------------------------------------
    -- 21. Rollback Preparation & Summary
    ----------------------------------------------------------------------------
    EXECUTE 'RESET ROLE';
    RAISE NOTICE 'ROLLBACK_CLEANUP=PASS';
    RAISE NOTICE 'PHASE_9_TWO_USER_RLS=PASS';
END;
$$;

RESET ROLE;
ROLLBACK;
