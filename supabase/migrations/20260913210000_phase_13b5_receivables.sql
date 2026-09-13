BEGIN;

-- Phase 13B-5: Receivables / money lent to other people.
-- This ledger is intentionally separate from public.debts, which represents
-- the owner's liabilities. Receivable payments are ledger-only in this phase;
-- they do not silently create income/expense transactions.

CREATE TABLE IF NOT EXISTS public.receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    borrower_name TEXT NOT NULL,
    principal_amount NUMERIC(20,4) NOT NULL,
    outstanding_amount NUMERIC(20,4) NOT NULL,
    currency_code TEXT NOT NULL,
    interest_rate NUMERIC(12,4) NOT NULL DEFAULT 0,
    expected_payment NUMERIC(20,4) NULL,
    payment_frequency TEXT NOT NULL DEFAULT 'ONE_TIME',
    first_due_date DATE NULL,
    due_day SMALLINT NULL,
    note TEXT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT receivables_id_user_id_key UNIQUE (id, user_id),
    CONSTRAINT check_receivable_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT check_receivable_borrower_length CHECK (char_length(trim(borrower_name)) BETWEEN 1 AND 200),
    CONSTRAINT check_receivable_principal_positive CHECK (principal_amount > 0),
    CONSTRAINT check_receivable_outstanding_range CHECK (outstanding_amount >= 0 AND outstanding_amount <= principal_amount),
    CONSTRAINT check_receivable_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_receivable_interest_rate CHECK (interest_rate >= 0 AND interest_rate <= 1000),
    CONSTRAINT check_receivable_expected_payment CHECK (expected_payment IS NULL OR expected_payment >= 0),
    CONSTRAINT check_receivable_frequency CHECK (
        payment_frequency IN ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')
    ),
    CONSTRAINT check_receivable_due_day CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
    CONSTRAINT check_receivable_note_length CHECK (note IS NULL OR char_length(note) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_receivables_user_id ON public.receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_user_active ON public.receivables(user_id)
    WHERE is_archived = FALSE AND outstanding_amount > 0;
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(user_id, first_due_date)
    WHERE is_archived = FALSE;

DROP TRIGGER IF EXISTS set_receivables_updated_at ON public.receivables;
CREATE TRIGGER set_receivables_updated_at
    BEFORE UPDATE ON public.receivables
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.receivable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    receivable_id UUID NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    principal_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    interest_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT receivable_payments_id_user_id_key UNIQUE (id, user_id),
    CONSTRAINT receivable_payments_receivable_fkey FOREIGN KEY (receivable_id, user_id)
        REFERENCES public.receivables (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT check_receivable_payment_amount_positive CHECK (amount > 0),
    CONSTRAINT check_receivable_payment_principal_non_negative CHECK (principal_amount >= 0),
    CONSTRAINT check_receivable_payment_interest_non_negative CHECK (interest_amount >= 0),
    CONSTRAINT check_receivable_payment_breakdown CHECK (amount = principal_amount + interest_amount),
    CONSTRAINT check_receivable_payment_note_length CHECK (note IS NULL OR char_length(note) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_receivable_payments_user_receivable
    ON public.receivable_payments(user_id, receivable_id, paid_on DESC);

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
    CAST(COALESCE(SUM(p.principal_amount), 0) AS TEXT) AS received_principal_amount,
    CAST(COALESCE(SUM(p.interest_amount), 0) AS TEXT) AS received_interest_amount,
    COUNT(p.id)::INTEGER AS payment_count
FROM public.receivables r
LEFT JOIN public.receivable_payments p
    ON p.receivable_id = r.id
   AND p.user_id = r.user_id
GROUP BY
    r.id, r.user_id, r.name, r.borrower_name,
    r.principal_amount, r.outstanding_amount, r.currency_code,
    r.interest_rate, r.expected_payment, r.payment_frequency,
    r.first_due_date, r.due_day, r.note, r.is_archived,
    r.created_at, r.updated_at;

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
    r.name AS receivable_name,
    r.borrower_name,
    r.currency_code
FROM public.receivable_payments p
JOIN public.receivables r
    ON r.id = p.receivable_id
   AND r.user_id = p.user_id;

CREATE OR REPLACE FUNCTION public.record_receivable_payment(
    p_receivable_id UUID,
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
    v_payment_id UUID;
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

    IF p_amount IS NULL OR p_amount <= 0
       OR p_principal_amount IS NULL OR p_principal_amount < 0
       OR p_interest_amount IS NULL OR p_interest_amount < 0 THEN
        RAISE EXCEPTION 'Payment amounts must be non-negative and total amount must be positive'
            USING ERRCODE = '22023';
    END IF;

    IF p_amount <> p_principal_amount + p_interest_amount THEN
        RAISE EXCEPTION 'Payment amount must equal principal plus interest'
            USING ERRCODE = '22023';
    END IF;

    IF p_principal_amount > v_receivable.outstanding_amount THEN
        RAISE EXCEPTION 'Principal received exceeds outstanding receivable'
            USING ERRCODE = '22003';
    END IF;

    INSERT INTO public.receivable_payments (
        user_id, receivable_id, amount, principal_amount,
        interest_amount, paid_on, note
    ) VALUES (
        v_user_id,
        p_receivable_id,
        p_amount,
        p_principal_amount,
        p_interest_amount,
        COALESCE(p_paid_on, CURRENT_DATE),
        NULLIF(trim(p_note), '')
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.receivables
    SET outstanding_amount = outstanding_amount - p_principal_amount,
        updated_at = NOW()
    WHERE id = p_receivable_id
      AND user_id = v_user_id;

    RETURN v_payment_id;
END;
$$;

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own receivables" ON public.receivables;
CREATE POLICY "Users can select own receivables"
    ON public.receivables FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own receivables" ON public.receivables;
CREATE POLICY "Users can insert own receivables"
    ON public.receivables FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own receivables" ON public.receivables;
CREATE POLICY "Users can update own receivables"
    ON public.receivables FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own receivable payments" ON public.receivable_payments;
CREATE POLICY "Users can select own receivable payments"
    ON public.receivable_payments FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.receivables FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.receivables TO authenticated;
GRANT INSERT (
    user_id, name, borrower_name, principal_amount, outstanding_amount,
    currency_code, interest_rate, expected_payment, payment_frequency,
    first_due_date, due_day, note
) ON public.receivables TO authenticated;
GRANT UPDATE (
    name, borrower_name, interest_rate, expected_payment,
    payment_frequency, first_due_date, due_day, note, is_archived
) ON public.receivables TO authenticated;

REVOKE ALL ON TABLE public.receivable_payments FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.receivable_payments TO authenticated;

REVOKE ALL ON public.receivable_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.receivable_details TO authenticated;

REVOKE ALL ON public.receivable_payment_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.receivable_payment_details TO authenticated;

REVOKE ALL ON FUNCTION public.record_receivable_payment(
    UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_receivable_payment(
    UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) TO authenticated;

COMMENT ON TABLE public.receivables IS 'Money owed to the authenticated owner by another person or counterparty.';
COMMENT ON TABLE public.receivable_payments IS 'Append-only receivable collection ledger. No cash transaction is created in Phase 13B-5.';

COMMIT;
