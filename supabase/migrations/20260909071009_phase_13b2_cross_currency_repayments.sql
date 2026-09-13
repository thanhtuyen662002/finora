BEGIN;

-- Phase 13B-2: cross-currency debt repayments.
-- `amount`/`currency_code` remain the cash-outflow side of the repayment.
-- `debt_amount`/`debt_currency_code` remain the liability-reduction side.
-- The explicit rate always means: account currency -> debt currency.

ALTER TABLE public.debt_payments
    ADD COLUMN IF NOT EXISTS debt_amount NUMERIC(20,4),
    ADD COLUMN IF NOT EXISTS debt_currency_code TEXT,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(30,12),
    ADD COLUMN IF NOT EXISTS exchange_rate_source TEXT,
    ADD COLUMN IF NOT EXISTS exchange_rate_effective_date DATE;

-- Backfill the Phase 13B-1 same-currency rows before tightening nullability.
UPDATE public.debt_payments
SET debt_amount = principal_amount + interest_amount,
    debt_currency_code = currency_code,
    exchange_rate = 1.000000000000,
    exchange_rate_source = 'SAME_CURRENCY',
    exchange_rate_effective_date = paid_on
WHERE debt_amount IS NULL
   OR debt_currency_code IS NULL
   OR exchange_rate IS NULL
   OR exchange_rate_source IS NULL
   OR exchange_rate_effective_date IS NULL;

ALTER TABLE public.debt_payments
    ALTER COLUMN debt_amount SET NOT NULL,
    ALTER COLUMN debt_currency_code SET NOT NULL,
    ALTER COLUMN exchange_rate SET NOT NULL,
    ALTER COLUMN exchange_rate_source SET NOT NULL,
    ALTER COLUMN exchange_rate_effective_date SET NOT NULL;

-- The old amount-breakdown constraint incorrectly assumed that cash and
-- liability currencies were always identical. Keep the breakdown on the
-- liability side and leave `amount` as the account cash-outflow amount.
ALTER TABLE public.debt_payments
    DROP CONSTRAINT IF EXISTS check_debt_payment_amount_breakdown;

ALTER TABLE public.debt_payments
    ADD CONSTRAINT check_debt_payment_debt_amount_breakdown
        CHECK (debt_amount = principal_amount + interest_amount),
    ADD CONSTRAINT check_debt_payment_debt_amount_positive
        CHECK (debt_amount > 0),
    ADD CONSTRAINT check_debt_payment_debt_currency_code
        CHECK (debt_currency_code ~ '^[A-Z]{3,5}$'),
    ADD CONSTRAINT check_debt_payment_exchange_rate
        CHECK (exchange_rate > 0),
    ADD CONSTRAINT check_debt_payment_exchange_rate_source
        CHECK (char_length(trim(exchange_rate_source)) BETWEEN 1 AND 100),
    ADD CONSTRAINT check_debt_payment_exchange_rate_date
        CHECK (exchange_rate_effective_date <= paid_on);

COMMENT ON COLUMN public.debt_payments.amount IS
    'Cash amount debited from the selected account, in currency_code.';
COMMENT ON COLUMN public.debt_payments.principal_amount IS
    'Liability principal reduced, in debt_currency_code.';
COMMENT ON COLUMN public.debt_payments.interest_amount IS
    'Liability interest paid, in debt_currency_code.';
COMMENT ON COLUMN public.debt_payments.exchange_rate IS
    'Explicit account-currency to debt-currency rate; debt_amount = round(amount * exchange_rate, 4).';

CREATE INDEX IF NOT EXISTS idx_debt_payments_currency_pair
    ON public.debt_payments(user_id, currency_code, debt_currency_code, paid_on DESC);

-- Preserve the established view columns and append the cross-currency
-- provenance fields so existing clients remain source-compatible.
CREATE OR REPLACE VIEW public.debt_payment_details WITH (security_invoker = true) AS
SELECT
    p.id,
    p.user_id,
    p.debt_id,
    p.transaction_id,
    p.account_id,
    CAST(p.amount AS TEXT) AS amount,
    CAST(p.principal_amount AS TEXT) AS principal_amount,
    CAST(p.interest_amount AS TEXT) AS interest_amount,
    p.currency_code,
    p.paid_on,
    p.note,
    p.created_at,
    d.name AS debt_name,
    d.lender_name,
    a.name AS account_name,
    c.name AS category_name,
    CAST(p.debt_amount AS TEXT) AS debt_amount,
    p.debt_currency_code,
    CAST(p.exchange_rate AS TEXT) AS exchange_rate,
    p.exchange_rate_source,
    p.exchange_rate_effective_date
FROM public.debt_payments p
JOIN public.debts d
    ON d.id = p.debt_id AND d.user_id = p.user_id
JOIN public.accounts a
    ON a.id = p.account_id AND a.user_id = p.user_id
JOIN public.transactions t
    ON t.id = p.transaction_id AND t.user_id = p.user_id
JOIN public.categories c
    ON c.id = t.category_id AND c.user_id = p.user_id;

-- New explicit contract. The old same-currency RPC remains available below as
-- a compatibility wrapper, while all new clients use this unambiguous name.
CREATE OR REPLACE FUNCTION public.record_debt_payment_v2(
    p_debt_id UUID,
    p_account_id UUID,
    p_category_id UUID,
    p_account_amount NUMERIC,
    p_debt_amount NUMERIC,
    p_principal_amount NUMERIC,
    p_interest_amount NUMERIC,
    p_exchange_rate NUMERIC,
    p_exchange_rate_source TEXT,
    p_exchange_rate_effective_date DATE,
    p_paid_on DATE,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_debt public.debts%ROWTYPE;
    v_account_currency TEXT;
    v_transaction_id UUID;
    v_payment_id UUID;
    v_paid_on DATE := COALESCE(p_paid_on, CURRENT_DATE);
    v_rate_source TEXT := NULLIF(trim(p_exchange_rate_source), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_debt
    FROM public.debts
    WHERE id = p_debt_id
      AND user_id = v_user_id
      AND is_archived = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt not found or archived' USING ERRCODE = 'P0002';
    END IF;

    IF p_account_amount IS NULL OR p_account_amount <= 0
       OR p_debt_amount IS NULL OR p_debt_amount <= 0
       OR p_principal_amount IS NULL OR p_principal_amount < 0
       OR p_interest_amount IS NULL OR p_interest_amount < 0 THEN
        RAISE EXCEPTION 'Payment amounts must be non-negative and both totals must be positive'
            USING ERRCODE = '22023';
    END IF;

    IF p_debt_amount <> p_principal_amount + p_interest_amount THEN
        RAISE EXCEPTION 'Debt amount must equal principal plus interest'
            USING ERRCODE = '22023';
    END IF;

    IF p_account_amount <> round(p_account_amount, 4)
       OR p_debt_amount <> round(p_debt_amount, 4)
       OR p_principal_amount <> round(p_principal_amount, 4)
       OR p_interest_amount <> round(p_interest_amount, 4)
       OR p_exchange_rate <> round(p_exchange_rate, 12) THEN
        RAISE EXCEPTION 'Payment amounts and exchange rate exceed the supported exact precision'
            USING ERRCODE = '22023';
    END IF;

    IF p_principal_amount > v_debt.outstanding_amount THEN
        RAISE EXCEPTION 'Principal payment exceeds outstanding balance'
            USING ERRCODE = '22003';
    END IF;

    IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
        RAISE EXCEPTION 'Exchange rate must be greater than zero'
            USING ERRCODE = '22023';
    END IF;

    IF v_rate_source IS NULL OR char_length(v_rate_source) > 100 THEN
        RAISE EXCEPTION 'Exchange rate source is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_exchange_rate_effective_date IS NULL
       OR p_exchange_rate_effective_date > v_paid_on THEN
        RAISE EXCEPTION 'Exchange rate effective date cannot be after payment date'
            USING ERRCODE = '22023';
    END IF;

    SELECT currency_code
    INTO v_account_currency
    FROM public.accounts
    WHERE id = p_account_id
      AND user_id = v_user_id
      AND is_archived = FALSE;

    IF v_account_currency IS NULL THEN
        RAISE EXCEPTION 'Payment account not found or archived' USING ERRCODE = 'P0002';
    END IF;

    IF v_account_currency = v_debt.currency_code THEN
        IF p_exchange_rate <> 1
           OR p_account_amount <> p_debt_amount THEN
            RAISE EXCEPTION 'Same-currency repayment must use a 1:1 rate and equal amounts'
                USING ERRCODE = '22023';
        END IF;
    ELSIF round(p_account_amount * p_exchange_rate, 4) <> p_debt_amount THEN
        RAISE EXCEPTION 'Account amount, debt amount, and exchange rate do not reconcile'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.categories
        WHERE id = p_category_id
          AND user_id = v_user_id
          AND type = 'EXPENSE'
          AND is_archived = FALSE
    ) THEN
        RAISE EXCEPTION 'An active expense category is required' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.transactions (
        user_id, account_id, category_id, type, amount, currency_code,
        merchant, note, occurred_on, debt_id
    )
    VALUES (
        v_user_id,
        p_account_id,
        p_category_id,
        'EXPENSE',
        p_account_amount,
        v_account_currency,
        LEFT('Trả nợ: ' || v_debt.name, 200),
        NULLIF(trim(p_note), ''),
        v_paid_on,
        p_debt_id
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.debt_payments (
        user_id, debt_id, transaction_id, account_id,
        amount, principal_amount, interest_amount, currency_code,
        debt_amount, debt_currency_code, exchange_rate, exchange_rate_source,
        exchange_rate_effective_date, paid_on, note
    )
    VALUES (
        v_user_id, p_debt_id, v_transaction_id, p_account_id,
        p_account_amount, p_principal_amount, p_interest_amount, v_account_currency,
        p_debt_amount, v_debt.currency_code, p_exchange_rate, v_rate_source,
        p_exchange_rate_effective_date, v_paid_on, NULLIF(trim(p_note), '')
    )
    RETURNING id INTO v_payment_id;

    -- Reuse the existing historical FX provenance boundary for cross-currency
    -- cash-flow reporting. Same-currency payments need no FX snapshot.
    IF v_account_currency <> v_debt.currency_code THEN
        INSERT INTO public.transaction_fx_snapshots (
            user_id, transaction_id, source_currency_code, target_currency_code,
            source_amount, rate, converted_amount, requested_date,
            effective_date, provider
        )
        VALUES (
            v_user_id, v_transaction_id, v_account_currency, v_debt.currency_code,
            p_account_amount, p_exchange_rate, p_debt_amount, v_paid_on,
            p_exchange_rate_effective_date, v_rate_source
        );
    END IF;

    UPDATE public.debts
    SET outstanding_amount = outstanding_amount - p_principal_amount,
        updated_at = NOW()
    WHERE id = p_debt_id AND user_id = v_user_id;

    RETURN v_payment_id;
END;
$$;

-- Keep the original public contract working for same-currency callers, but
-- route it through the new exact dual-currency implementation.
CREATE OR REPLACE FUNCTION public.record_debt_payment(
    p_debt_id UUID,
    p_account_id UUID,
    p_category_id UUID,
    p_amount NUMERIC,
    p_principal_amount NUMERIC,
    p_interest_amount NUMERIC,
    p_paid_on DATE,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN public.record_debt_payment_v2(
        p_debt_id,
        p_account_id,
        p_category_id,
        p_amount,
        p_amount,
        p_principal_amount,
        p_interest_amount,
        1.000000000000,
        'SAME_CURRENCY',
        COALESCE(p_paid_on, CURRENT_DATE),
        p_paid_on,
        p_note
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_debt_payment_v2(
    UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, DATE, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment_v2(
    UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, DATE, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION public.record_debt_payment(
    UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(
    UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) TO authenticated;

COMMIT;
