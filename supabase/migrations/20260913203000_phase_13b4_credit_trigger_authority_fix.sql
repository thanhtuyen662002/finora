BEGIN;

-- Phase 13B-4 corrective: linked credit/pay-later purchases are written by an
-- authenticated client, but the debt balance mutation itself must remain an
-- internal trigger authority. The original trigger function was SECURITY
-- INVOKER, so authenticated users hit the intentional column-level protection
-- on debts.principal_amount / debts.outstanding_amount and the transaction was
-- rolled back.
--
-- Keep direct client mutation blocked. Elevate only the trigger function, pin
-- search_path, bind the triggering row to auth.uid(), and keep EXECUTE revoked.

CREATE OR REPLACE FUNCTION public.sync_credit_account_debt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_user_id UUID := auth.uid();
    old_debt UUID;
    new_debt UUID;
    old_delta NUMERIC := 0;
    new_delta NUMERIC := 0;
    new_limit NUMERIC;
    old_limit NUMERIC;
BEGIN
    IF v_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.user_id IS DISTINCT FROM v_actor_user_id THEN
            RAISE EXCEPTION 'Credit account transaction owner mismatch' USING ERRCODE = '42501';
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.user_id IS DISTINCT FROM v_actor_user_id THEN
            RAISE EXCEPTION 'Credit account transaction owner mismatch' USING ERRCODE = '42501';
        END IF;
    ELSE
        IF OLD.user_id IS DISTINCT FROM v_actor_user_id
           OR NEW.user_id IS DISTINCT FROM v_actor_user_id THEN
            RAISE EXCEPTION 'Credit account transaction owner mismatch' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF TG_OP <> 'INSERT' THEN
        SELECT linked_debt_id, credit_limit
        INTO old_debt, old_limit
        FROM public.accounts
        WHERE id = OLD.account_id
          AND user_id = OLD.user_id;

        IF OLD.type = 'EXPENSE'
           AND OLD.is_voided = FALSE
           AND OLD.debt_id IS NULL THEN
            old_delta := OLD.amount;
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT linked_debt_id, credit_limit
        INTO new_debt, new_limit
        FROM public.accounts
        WHERE id = NEW.account_id
          AND user_id = NEW.user_id;

        IF NEW.type = 'EXPENSE'
           AND NEW.is_voided = FALSE
           AND NEW.debt_id IS NULL THEN
            new_delta := NEW.amount;
        END IF;
    END IF;

    IF old_debt IS NOT NULL AND old_debt = new_debt THEN
        PERFORM public.apply_credit_debt_delta(
            NEW.user_id,
            new_debt,
            new_delta - old_delta,
            new_limit
        );
    ELSE
        IF old_debt IS NOT NULL AND old_delta > 0 THEN
            PERFORM public.apply_credit_debt_delta(
                OLD.user_id,
                old_debt,
                -old_delta,
                old_limit
            );
        END IF;

        IF new_debt IS NOT NULL AND new_delta > 0 THEN
            PERFORM public.apply_credit_debt_delta(
                NEW.user_id,
                new_debt,
                new_delta,
                new_limit
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_credit_account_debt()
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_credit_account_debt() IS
'Internal trigger authority for linked credit/pay-later debt accrual. SECURITY DEFINER is constrained by auth.uid() ownership checks and is not directly executable by API roles.';

COMMIT;
