BEGIN;

-- Phase 13B-4: credit / pay-later account linkage.
-- A linked account's active expense transactions increase the linked debt.
-- The account balance remains a cash-flow view; credit_limit and debt_details
-- are the authoritative availability and liability values.

ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(20,4) NULL,
    ADD COLUMN IF NOT EXISTS linked_debt_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accounts_linked_debt_fkey'
          AND conrelid = 'public.accounts'::regclass
    ) THEN
        ALTER TABLE public.accounts
            ADD CONSTRAINT accounts_linked_debt_fkey
            FOREIGN KEY (linked_debt_id, user_id)
            REFERENCES public.debts (id, user_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accounts_credit_limit_check'
          AND conrelid = 'public.accounts'::regclass
    ) THEN
        ALTER TABLE public.accounts
            ADD CONSTRAINT accounts_credit_limit_check
            CHECK (credit_limit IS NULL OR credit_limit > 0);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_one_credit_account_per_debt
    ON public.accounts(user_id, linked_debt_id)
    WHERE linked_debt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_linked_debt_id
    ON public.accounts(user_id, linked_debt_id)
    WHERE linked_debt_id IS NOT NULL;

-- Reject invalid links and over-limit purchases before they can be committed.
CREATE OR REPLACE FUNCTION public.validate_credit_account_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    debt_currency TEXT;
BEGIN
    IF NEW.linked_debt_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.credit_limit IS NULL OR NEW.credit_limit <= 0 THEN
        RAISE EXCEPTION 'Tài khoản tín dụng phải có hạn mức lớn hơn 0.' USING ERRCODE = '23514';
    END IF;

    SELECT currency_code INTO debt_currency
    FROM public.debts
    WHERE id = NEW.linked_debt_id AND user_id = NEW.user_id AND is_archived = FALSE;

    IF debt_currency IS NULL THEN
        RAISE EXCEPTION 'Khoản nợ liên kết không tồn tại hoặc đã lưu trữ.' USING ERRCODE = '23503';
    END IF;
    IF debt_currency <> NEW.currency_code THEN
        RAISE EXCEPTION 'Tiền tệ tài khoản và khoản nợ liên kết phải giống nhau.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_credit_account_link ON public.accounts;
CREATE TRIGGER trg_validate_credit_account_link
    BEFORE INSERT OR UPDATE OF linked_debt_id, credit_limit, currency_code, user_id
    ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.validate_credit_account_link();

CREATE OR REPLACE FUNCTION public.apply_credit_debt_delta(
    p_user_id UUID,
    p_debt_id UUID,
    p_delta NUMERIC,
    p_credit_limit NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_delta > 0 THEN
        IF EXISTS (
            SELECT 1 FROM public.debts
            WHERE id = p_debt_id AND user_id = p_user_id
              AND outstanding_amount + p_delta > p_credit_limit
        ) THEN
            RAISE EXCEPTION 'Giao dịch vượt quá hạn mức tín dụng.' USING ERRCODE = '22003';
        END IF;
        UPDATE public.debts
        SET principal_amount = principal_amount + p_delta,
            outstanding_amount = outstanding_amount + p_delta,
            updated_at = NOW()
        WHERE id = p_debt_id AND user_id = p_user_id;
    ELSIF p_delta < 0 THEN
        UPDATE public.debts
        SET outstanding_amount = GREATEST(0, outstanding_amount + p_delta),
            updated_at = NOW()
        WHERE id = p_debt_id AND user_id = p_user_id;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Khoản nợ liên kết không tồn tại.' USING ERRCODE = '23503';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_credit_account_debt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    old_debt UUID;
    new_debt UUID;
    old_delta NUMERIC := 0;
    new_delta NUMERIC := 0;
    new_limit NUMERIC;
    old_limit NUMERIC;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT linked_debt_id, credit_limit INTO old_debt, old_limit
        FROM public.accounts WHERE id = OLD.account_id AND user_id = OLD.user_id;
        IF OLD.type = 'EXPENSE' AND OLD.is_voided = FALSE AND OLD.debt_id IS NULL THEN old_delta := OLD.amount; END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT linked_debt_id, credit_limit INTO new_debt, new_limit
        FROM public.accounts WHERE id = NEW.account_id AND user_id = NEW.user_id;
        IF NEW.type = 'EXPENSE' AND NEW.is_voided = FALSE AND NEW.debt_id IS NULL THEN new_delta := NEW.amount; END IF;
    END IF;

    IF old_debt IS NOT NULL AND old_debt = new_debt THEN
        PERFORM public.apply_credit_debt_delta(NEW.user_id, new_debt, new_delta - old_delta, new_limit);
    ELSE
        IF old_debt IS NOT NULL AND old_delta > 0 THEN
            PERFORM public.apply_credit_debt_delta(OLD.user_id, old_debt, -old_delta, old_limit);
        END IF;
        IF new_debt IS NOT NULL AND new_delta > 0 THEN
            PERFORM public.apply_credit_debt_delta(NEW.user_id, new_debt, new_delta, new_limit);
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credit_account_debt ON public.transactions;
CREATE TRIGGER trg_sync_credit_account_debt
    AFTER INSERT OR UPDATE OF account_id, type, amount, is_voided OR DELETE
    ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.sync_credit_account_debt();

REVOKE ALL ON FUNCTION public.apply_credit_debt_delta(UUID, UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_credit_account_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_credit_account_debt() FROM PUBLIC, anon, authenticated;

GRANT INSERT (credit_limit, linked_debt_id) ON public.accounts TO authenticated;
GRANT UPDATE (credit_limit, linked_debt_id) ON public.accounts TO authenticated;

COMMIT;

