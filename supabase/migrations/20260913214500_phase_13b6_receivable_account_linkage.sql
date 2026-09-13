BEGIN;

-- Phase 13B-6: connect receivables to real cash accounts without misclassifying
-- principal as expense/income. Funding principal reduces the chosen account;
-- collected principal restores the chosen receiving account; collected interest
-- is recorded as a real INCOME transaction so reports stay economically correct.

ALTER TABLE public.receivables
    ADD COLUMN IF NOT EXISTS funding_account_id UUID NULL;

ALTER TABLE public.receivable_payments
    ADD COLUMN IF NOT EXISTS receiving_account_id UUID NULL,
    ADD COLUMN IF NOT EXISTS currency_code TEXT NULL,
    ADD COLUMN IF NOT EXISTS interest_transaction_id UUID NULL;

UPDATE public.receivable_payments p
SET currency_code = r.currency_code
FROM public.receivables r
WHERE r.id = p.receivable_id
  AND r.user_id = p.user_id
  AND p.currency_code IS NULL;

ALTER TABLE public.receivable_payments
    ALTER COLUMN currency_code SET NOT NULL;

ALTER TABLE public.receivables
    DROP CONSTRAINT IF EXISTS receivables_funding_account_fkey,
    ADD CONSTRAINT receivables_funding_account_fkey
        FOREIGN KEY (funding_account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code)
        ON DELETE RESTRICT;

ALTER TABLE public.receivable_payments
    DROP CONSTRAINT IF EXISTS receivable_payments_receiving_account_fkey,
    ADD CONSTRAINT receivable_payments_receiving_account_fkey
        FOREIGN KEY (receiving_account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code)
        ON DELETE RESTRICT,
    DROP CONSTRAINT IF EXISTS receivable_payments_interest_transaction_fkey,
    ADD CONSTRAINT receivable_payments_interest_transaction_fkey
        FOREIGN KEY (interest_transaction_id)
        REFERENCES public.transactions (id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT IF EXISTS check_receivable_payment_currency_code,
    ADD CONSTRAINT check_receivable_payment_currency_code
        CHECK (currency_code ~ '^[A-Z]{3,5}$');

CREATE INDEX IF NOT EXISTS idx_receivables_funding_account
    ON public.receivables(user_id, funding_account_id)
    WHERE funding_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receivable_payments_receiving_account
    ON public.receivable_payments(user_id, receiving_account_id)
    WHERE receiving_account_id IS NOT NULL;

CREATE OR REPLACE VIEW public.receivable_details WITH (security_invoker = true) AS
SELECT
    r.id,
    r.user_id,
    r.name,
    r.borrower_name,
    CAST(r.principal_amount AS TEXT) AS principal_amount,
    CAST(r.outstanding_amount AS TEXT) AS outstanding_amount,
    r.currency_code,
    CAST(r.interest_rate AS TEXT) AS interest_rate,
    CASE WHEN r.expected_payment IS NULL THEN NULL ELSE CAST(r.expected_payment AS TEXT) END AS expected_payment,
    r.payment_frequency,
    r.first_due_date,
    r.due_day,
    r.note,
    r.is_archived,
    r.created_at,
    r.updated_at,
    r.funding_account_id,
    fa.name AS funding_account_name,
    fa.type AS funding_account_type,
    CAST(COALESCE(SUM(p.principal_amount), 0) AS TEXT) AS received_principal_amount,
    CAST(COALESCE(SUM(p.interest_amount), 0) AS TEXT) AS received_interest_amount,
    COUNT(p.id)::INTEGER AS payment_count
FROM public.receivables r
LEFT JOIN public.accounts fa
    ON fa.id = r.funding_account_id
   AND fa.user_id = r.user_id
LEFT JOIN public.receivable_payments p
    ON p.receivable_id = r.id
   AND p.user_id = r.user_id
GROUP BY
    r.id, r.user_id, r.name, r.borrower_name,
    r.principal_amount, r.outstanding_amount, r.currency_code,
    r.interest_rate, r.expected_payment, r.payment_frequency,
    r.first_due_date, r.due_day, r.note, r.is_archived,
    r.created_at, r.updated_at, r.funding_account_id,
    fa.name, fa.type;

CREATE OR REPLACE VIEW public.receivable_payment_details WITH (security_invoker = true) AS
SELECT
    p.id,
    p.user_id,
    p.receivable_id,
    CAST(p.amount AS TEXT) AS amount,
    CAST(p.principal_amount AS TEXT) AS principal_amount,
    CAST(p.interest_amount AS TEXT) AS interest_amount,
    p.paid_on,
    p.note,
    p.created_at,
    p.receiving_account_id,
    ra.name AS receiving_account_name,
    p.interest_transaction_id,
    r.name AS receivable_name,
    r.borrower_name,
    p.currency_code
FROM public.receivable_payments p
JOIN public.receivables r
    ON r.id = p.receivable_id
   AND r.user_id = p.user_id
LEFT JOIN public.accounts ra
    ON ra.id = p.receiving_account_id
   AND ra.user_id = p.user_id;

CREATE OR REPLACE FUNCTION public.create_receivable_v2(
    p_name TEXT,
    p_borrower_name TEXT,
    p_principal_amount NUMERIC,
    p_currency_code TEXT,
    p_funding_account_id UUID,
    p_interest_rate NUMERIC DEFAULT 0,
    p_expected_payment NUMERIC DEFAULT NULL,
    p_payment_frequency TEXT DEFAULT 'ONE_TIME',
    p_first_due_date DATE DEFAULT NULL,
    p_due_day SMALLINT DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_account public.accounts%ROWTYPE;
    v_receivable_id UUID;
    v_currency TEXT := upper(trim(p_currency_code));
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_funding_account_id IS NULL THEN
        RAISE EXCEPTION 'Funding account is required' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_account
    FROM public.accounts
    WHERE id = p_funding_account_id
      AND user_id = v_user_id
    FOR SHARE;

    IF NOT FOUND OR v_account.is_archived THEN
        RAISE EXCEPTION 'Funding account not found or archived' USING ERRCODE = 'P0002';
    END IF;

    IF v_account.type = 'CREDIT_CARD' THEN
        RAISE EXCEPTION 'Credit-card accounts cannot fund a receivable' USING ERRCODE = '22023';
    END IF;

    IF v_account.currency_code <> v_currency THEN
        RAISE EXCEPTION 'Funding account currency must match receivable currency' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.receivables (
        user_id, name, borrower_name, principal_amount, outstanding_amount,
        currency_code, funding_account_id, interest_rate, expected_payment,
        payment_frequency, first_due_date, due_day, note
    ) VALUES (
        v_user_id,
        trim(p_name),
        trim(p_borrower_name),
        p_principal_amount,
        p_principal_amount,
        v_currency,
        p_funding_account_id,
        COALESCE(p_interest_rate, 0),
        p_expected_payment,
        p_payment_frequency,
        p_first_due_date,
        p_due_day,
        NULLIF(trim(p_note), '')
    )
    RETURNING id INTO v_receivable_id;

    RETURN v_receivable_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_receivable_funding_account(
    p_receivable_id UUID,
    p_funding_account_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_receivable public.receivables%ROWTYPE;
    v_account public.accounts%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_receivable
    FROM public.receivables
    WHERE id = p_receivable_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receivable not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_receivable.funding_account_id IS NOT NULL THEN
        RAISE EXCEPTION 'Funding account is already linked' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_account
    FROM public.accounts
    WHERE id = p_funding_account_id
      AND user_id = v_user_id
    FOR SHARE;

    IF NOT FOUND OR v_account.is_archived THEN
        RAISE EXCEPTION 'Funding account not found or archived' USING ERRCODE = 'P0002';
    END IF;

    IF v_account.type = 'CREDIT_CARD' THEN
        RAISE EXCEPTION 'Credit-card accounts cannot fund a receivable' USING ERRCODE = '22023';
    END IF;

    IF v_account.currency_code <> v_receivable.currency_code THEN
        RAISE EXCEPTION 'Funding account currency must match receivable currency' USING ERRCODE = '22023';
    END IF;

    UPDATE public.receivables
    SET funding_account_id = p_funding_account_id,
        updated_at = NOW()
    WHERE id = p_receivable_id
      AND user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_receivable_payment_v2(
    p_receivable_id UUID,
    p_receiving_account_id UUID,
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
DECLARE
    v_user_id UUID := auth.uid();
    v_receivable public.receivables%ROWTYPE;
    v_account public.accounts%ROWTYPE;
    v_payment_id UUID;
    v_interest_tx_id UUID;
    v_income_category_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_receivable
    FROM public.receivables
    WHERE id = p_receivable_id
      AND user_id = v_user_id
      AND is_archived = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receivable not found or archived' USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_account
    FROM public.accounts
    WHERE id = p_receiving_account_id
      AND user_id = v_user_id
    FOR SHARE;

    IF NOT FOUND OR v_account.is_archived THEN
        RAISE EXCEPTION 'Receiving account not found or archived' USING ERRCODE = 'P0002';
    END IF;

    IF v_account.type = 'CREDIT_CARD' THEN
        RAISE EXCEPTION 'Credit-card accounts cannot receive a receivable collection' USING ERRCODE = '22023';
    END IF;

    IF v_account.currency_code <> v_receivable.currency_code THEN
        RAISE EXCEPTION 'Receiving account currency must match receivable currency' USING ERRCODE = '22023';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0
       OR p_principal_amount IS NULL OR p_principal_amount < 0
       OR p_interest_amount IS NULL OR p_interest_amount < 0 THEN
        RAISE EXCEPTION 'Payment amounts are invalid' USING ERRCODE = '22023';
    END IF;

    IF p_amount <> p_principal_amount + p_interest_amount THEN
        RAISE EXCEPTION 'Payment amount must equal principal plus interest' USING ERRCODE = '22023';
    END IF;

    IF p_principal_amount > v_receivable.outstanding_amount THEN
        RAISE EXCEPTION 'Principal received exceeds outstanding receivable' USING ERRCODE = '22003';
    END IF;

    INSERT INTO public.receivable_payments (
        user_id, receivable_id, receiving_account_id, currency_code,
        amount, principal_amount, interest_amount, paid_on, note
    ) VALUES (
        v_user_id,
        p_receivable_id,
        p_receiving_account_id,
        v_receivable.currency_code,
        p_amount,
        p_principal_amount,
        p_interest_amount,
        COALESCE(p_paid_on, CURRENT_DATE),
        NULLIF(trim(p_note), '')
    )
    RETURNING id INTO v_payment_id;

    IF p_interest_amount > 0 THEN
        SELECT id INTO v_income_category_id
        FROM public.categories
        WHERE user_id = v_user_id
          AND type = 'INCOME'
          AND name = 'Khác'
        ORDER BY is_archived ASC, created_at ASC
        LIMIT 1;

        IF v_income_category_id IS NULL THEN
            RAISE EXCEPTION 'Income category is unavailable' USING ERRCODE = 'P0002';
        END IF;

        INSERT INTO public.transactions (
            user_id, account_id, category_id, type, amount,
            currency_code, merchant, note, occurred_on
        ) VALUES (
            v_user_id,
            p_receiving_account_id,
            v_income_category_id,
            'INCOME',
            p_interest_amount,
            v_receivable.currency_code,
            left('Lãi khoản phải thu: ' || v_receivable.borrower_name, 200),
            'Tự động tạo từ khoản phải thu ' || v_receivable.name,
            COALESCE(p_paid_on, CURRENT_DATE)
        )
        RETURNING id INTO v_interest_tx_id;

        UPDATE public.receivable_payments
        SET interest_transaction_id = v_interest_tx_id
        WHERE id = v_payment_id
          AND user_id = v_user_id;
    END IF;

    UPDATE public.receivables
    SET outstanding_amount = outstanding_amount - p_principal_amount,
        updated_at = NOW()
    WHERE id = p_receivable_id
      AND user_id = v_user_id;

    RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_receivable_interest_transaction_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.receivable_payments rp
        WHERE rp.interest_transaction_id = OLD.id
          AND rp.user_id = OLD.user_id
    ) THEN
        RAISE EXCEPTION 'Receivable interest transactions are managed by the receivable ledger'
            USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_receivable_interest_transaction_mutation
    ON public.transactions;
CREATE TRIGGER guard_receivable_interest_transaction_mutation
    BEFORE UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_receivable_interest_transaction_mutation();

CREATE OR REPLACE VIEW public.account_balances WITH (security_invoker = true) AS
WITH tx_totals AS (
    SELECT
        account_id,
        SUM(
            CASE
                WHEN type = 'INCOME' THEN amount
                WHEN type = 'EXPENSE' THEN -amount
                ELSE 0
            END
        ) AS net_transactions
    FROM public.transactions
    WHERE is_voided = FALSE
    GROUP BY account_id
),
incoming_transfers AS (
    SELECT
        to_account_id AS account_id,
        SUM(COALESCE(destination_amount, amount)) AS in_transfers
    FROM public.transfers
    WHERE is_voided = FALSE
    GROUP BY to_account_id
),
outgoing_transfers AS (
    SELECT
        from_account_id AS account_id,
        SUM(amount) AS out_transfers
    FROM public.transfers
    WHERE is_voided = FALSE
    GROUP BY from_account_id
),
receivable_disbursements AS (
    SELECT
        funding_account_id AS account_id,
        SUM(principal_amount) AS lent_principal
    FROM public.receivables
    WHERE funding_account_id IS NOT NULL
    GROUP BY funding_account_id
),
receivable_principal_collections AS (
    SELECT
        receiving_account_id AS account_id,
        SUM(principal_amount) AS returned_principal
    FROM public.receivable_payments
    WHERE receiving_account_id IS NOT NULL
    GROUP BY receiving_account_id
)
SELECT
    a.id AS account_id,
    a.user_id,
    a.currency_code,
    CAST(
        a.opening_balance
        + COALESCE(tx.net_transactions, 0)
        + COALESCE(it.in_transfers, 0)
        - COALESCE(ot.out_transfers, 0)
        - COALESCE(rd.lent_principal, 0)
        + COALESCE(rc.returned_principal, 0)
    AS TEXT) AS current_balance
FROM public.accounts a
LEFT JOIN tx_totals tx ON a.id = tx.account_id
LEFT JOIN incoming_transfers it ON a.id = it.account_id
LEFT JOIN outgoing_transfers ot ON a.id = ot.account_id
LEFT JOIN receivable_disbursements rd ON a.id = rd.account_id
LEFT JOIN receivable_principal_collections rc ON a.id = rc.account_id;

REVOKE EXECUTE ON FUNCTION public.record_receivable_payment(
    UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) FROM authenticated;

REVOKE INSERT (
    user_id, name, borrower_name, principal_amount, outstanding_amount,
    currency_code, interest_rate, expected_payment, payment_frequency,
    first_due_date, due_day, note
) ON public.receivables FROM authenticated;

REVOKE ALL ON FUNCTION public.create_receivable_v2(
    TEXT, TEXT, NUMERIC, TEXT, UUID, NUMERIC, NUMERIC, TEXT, DATE, SMALLINT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_receivable_v2(
    TEXT, TEXT, NUMERIC, TEXT, UUID, NUMERIC, NUMERIC, TEXT, DATE, SMALLINT, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION public.link_receivable_funding_account(UUID, UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_receivable_funding_account(UUID, UUID)
TO authenticated;

REVOKE ALL ON FUNCTION public.record_receivable_payment_v2(
    UUID, UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_receivable_payment_v2(
    UUID, UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION public.guard_receivable_interest_transaction_mutation()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.receivable_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.receivable_details TO authenticated;

REVOKE ALL ON public.receivable_payment_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.receivable_payment_details TO authenticated;

REVOKE ALL ON public.account_balances FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.account_balances TO authenticated;

COMMENT ON COLUMN public.receivables.funding_account_id IS
'Account whose cash balance funded the receivable principal. Principal is an asset transfer, not an expense.';
COMMENT ON COLUMN public.receivable_payments.receiving_account_id IS
'Account receiving the collection. Principal restores cash; interest is separately recorded as income.';
COMMENT ON COLUMN public.receivable_payments.interest_transaction_id IS
'Immutable generated INCOME transaction for the interest portion only.';

COMMIT;
