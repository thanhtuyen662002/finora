BEGIN;

-- Phase 13B: Debt & liability management
-- Debt balances are liabilities. Payments are append-only financial events that
-- atomically create an expense transaction and reduce principal outstanding.

CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lender_name TEXT NULL,
    debt_type TEXT NOT NULL DEFAULT 'OTHER',
    principal_amount NUMERIC(20,4) NOT NULL,
    outstanding_amount NUMERIC(20,4) NOT NULL,
    currency_code TEXT NOT NULL,
    interest_rate NUMERIC(12,4) NOT NULL DEFAULT 0,
    minimum_payment NUMERIC(20,4) NULL,
    payment_frequency TEXT NOT NULL DEFAULT 'MONTHLY',
    first_due_date DATE NULL,
    due_day SMALLINT NULL,
    note TEXT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT debts_id_user_id_key UNIQUE (id, user_id),
    CONSTRAINT check_debt_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT check_debt_lender_length CHECK (lender_name IS NULL OR char_length(trim(lender_name)) <= 200),
    CONSTRAINT check_debt_type CHECK (
        debt_type IN ('PERSONAL_LOAN', 'CREDIT_CARD', 'MORTGAGE', 'INSTALLMENT', 'BORROWED_FROM_PERSON', 'OTHER')
    ),
    CONSTRAINT check_debt_principal_positive CHECK (principal_amount > 0),
    CONSTRAINT check_debt_outstanding_range CHECK (outstanding_amount >= 0 AND outstanding_amount <= principal_amount),
    CONSTRAINT check_debt_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_debt_interest_rate CHECK (interest_rate >= 0 AND interest_rate <= 1000),
    CONSTRAINT check_debt_minimum_payment CHECK (minimum_payment IS NULL OR minimum_payment >= 0),
    CONSTRAINT check_debt_frequency CHECK (
        payment_frequency IN ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')
    ),
    CONSTRAINT check_debt_due_day CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
    CONSTRAINT check_debt_note_length CHECK (note IS NULL OR char_length(note) <= 1000)
);

COMMENT ON TABLE public.debts IS 'User-owned liabilities and outstanding debt balances.';

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_active ON public.debts(user_id)
    WHERE is_archived = FALSE AND outstanding_amount > 0;
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts(user_id, first_due_date)
    WHERE is_archived = FALSE;

-- Prepare the transaction-side debt marker and owner-safe composite key
-- before debt_payments creates its transaction foreign key.
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS debt_id UUID NULL;

DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transactions_id_user_id_key'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_id_user_id_key UNIQUE (id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transactions_debt_fkey'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_debt_fkey
            FOREIGN KEY (debt_id, user_id)
            REFERENCES public.debts (id, user_id) ON DELETE RESTRICT;
    END IF;
END $;

CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    debt_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    account_id UUID NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    principal_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    interest_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL,
    paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT debt_payments_id_user_id_key UNIQUE (id, user_id),
    CONSTRAINT debt_payments_debt_fkey FOREIGN KEY (debt_id, user_id)
        REFERENCES public.debts (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT debt_payments_transaction_fkey FOREIGN KEY (transaction_id, user_id)
        REFERENCES public.transactions (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT debt_payments_account_fkey FOREIGN KEY (account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT,
    CONSTRAINT check_debt_payment_amount_positive CHECK (amount > 0),
    CONSTRAINT check_debt_payment_principal_non_negative CHECK (principal_amount >= 0),
    CONSTRAINT check_debt_payment_interest_non_negative CHECK (interest_amount >= 0),
    CONSTRAINT check_debt_payment_amount_breakdown CHECK (amount = principal_amount + interest_amount),
    CONSTRAINT check_debt_payment_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_debt_payment_note_length CHECK (note IS NULL OR char_length(note) <= 1000)
);

COMMENT ON TABLE public.debt_payments IS 'Append-only debt repayment events linked to cash-flow transactions.';

CREATE INDEX IF NOT EXISTS idx_debt_payments_user_debt ON public.debt_payments(user_id, debt_id, paid_on DESC);
CREATE INDEX IF NOT EXISTS idx_debt_payments_transaction_id ON public.debt_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_account_id ON public.debt_payments(account_id);

-- Transactions keep the cash-flow side of a repayment. The debt_id marker lets
-- the reports layer distinguish liability payments from ordinary consumption.
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS debt_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_id_user_id_key'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_id_user_id_key UNIQUE (id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_debt_fkey'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_debt_fkey
            FOREIGN KEY (debt_id, user_id)
            REFERENCES public.debts (id, user_id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_debt_id
    ON public.transactions(user_id, debt_id)
    WHERE debt_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_debts_updated_at ON public.debts;
CREATE TRIGGER set_debts_updated_at
    BEFORE UPDATE ON public.debts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Exact-read debt summary view. outstanding_amount is the authoritative
-- balance; paid amounts are derived from the immutable payment ledger.
CREATE OR REPLACE VIEW public.debt_details WITH (security_invoker = true) AS
SELECT
    d.id,
    d.user_id,
    d.name,
    d.lender_name,
    d.debt_type,
    CAST(d.principal_amount AS TEXT) AS principal_amount,
    CAST(d.outstanding_amount AS TEXT) AS outstanding_amount,
    d.currency_code,
    CAST(d.interest_rate AS TEXT) AS interest_rate,
    CASE WHEN d.minimum_payment IS NULL THEN NULL ELSE CAST(d.minimum_payment AS TEXT) END AS minimum_payment,
    d.payment_frequency,
    d.first_due_date,
    d.due_day,
    d.note,
    d.is_archived,
    d.created_at,
    d.updated_at,
    CAST(COALESCE(SUM(p.principal_amount), 0) AS TEXT) AS paid_principal_amount,
    CAST(COALESCE(SUM(p.interest_amount), 0) AS TEXT) AS paid_interest_amount,
    COUNT(p.id)::INTEGER AS payment_count
FROM public.debts d
LEFT JOIN public.debt_payments p
    ON p.debt_id = d.id
   AND p.user_id = d.user_id
GROUP BY
    d.id, d.user_id, d.name, d.lender_name, d.debt_type,
    d.principal_amount, d.outstanding_amount, d.currency_code,
    d.interest_rate, d.minimum_payment, d.payment_frequency,
    d.first_due_date, d.due_day, d.note, d.is_archived,
    d.created_at, d.updated_at;

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
    c.name AS category_name
FROM public.debt_payments p
JOIN public.debts d
    ON d.id = p.debt_id AND d.user_id = p.user_id
JOIN public.accounts a
    ON a.id = p.account_id AND a.user_id = p.user_id
JOIN public.transactions t
    ON t.id = p.transaction_id AND t.user_id = p.user_id
JOIN public.categories c
    ON c.id = t.category_id AND c.user_id = p.user_id;

-- Preserve the established transaction_details prefix and append debt_id.
CREATE OR REPLACE VIEW public.transaction_details WITH (security_invoker = true) AS
SELECT
    t.id,
    t.user_id,
    t.account_id,
    t.category_id,
    t.type,
    CAST(t.amount AS TEXT) AS amount,
    t.currency_code,
    t.merchant,
    t.note,
    t.occurred_on,
    t.is_voided,
    t.created_at,
    t.updated_at,
    a.name AS account_name,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    t.income_source_id,
    t.income_source_stream_id,
    src.name AS income_source_name,
    src.type AS income_source_type,
    strm.name AS income_source_stream_name,
    t.debt_id
FROM public.transactions t
JOIN public.accounts a
    ON t.account_id = a.id AND t.user_id = a.user_id
JOIN public.categories c
    ON t.category_id = c.id AND t.user_id = c.user_id
LEFT JOIN public.income_sources src
    ON t.income_source_id = src.id AND t.user_id = src.user_id
LEFT JOIN public.income_source_streams strm
    ON t.income_source_stream_id = strm.id
   AND t.income_source_id = strm.income_source_id
   AND t.user_id = strm.user_id;

-- Atomic repayment operation:
-- 1) lock the debt;
-- 2) validate same-user debt/account/category and exact breakdown;
-- 3) create the cash-flow expense;
-- 4) append the payment ledger row;
-- 5) reduce principal outstanding.
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
DECLARE
    v_user_id UUID := auth.uid();
    v_debt public.debts%ROWTYPE;
    v_account_currency TEXT;
    v_transaction_id UUID;
    v_payment_id UUID;
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

    IF p_principal_amount > v_debt.outstanding_amount THEN
        RAISE EXCEPTION 'Principal payment exceeds outstanding balance'
            USING ERRCODE = '22003';
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

    IF v_account_currency <> v_debt.currency_code THEN
        RAISE EXCEPTION 'Payment account currency must match debt currency'
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
        p_amount,
        v_debt.currency_code,
        'Trả nợ: ' || v_debt.name,
        NULLIF(trim(p_note), ''),
        COALESCE(p_paid_on, CURRENT_DATE),
        p_debt_id
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.debt_payments (
        user_id, debt_id, transaction_id, account_id,
        amount, principal_amount, interest_amount, currency_code,
        paid_on, note
    )
    VALUES (
        v_user_id, p_debt_id, v_transaction_id, p_account_id,
        p_amount, p_principal_amount, p_interest_amount, v_debt.currency_code,
        COALESCE(p_paid_on, CURRENT_DATE), NULLIF(trim(p_note), '')
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.debts
    SET outstanding_amount = outstanding_amount - p_principal_amount,
        updated_at = NOW()
    WHERE id = p_debt_id AND user_id = v_user_id;

    RETURN v_payment_id;
END;
$$;

-- RLS: all records are isolated to the authenticated owner.
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own debts" ON public.debts;
CREATE POLICY "Users can select own debts"
    ON public.debts FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
CREATE POLICY "Users can insert own debts"
    ON public.debts FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
CREATE POLICY "Users can update own debts"
    ON public.debts FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own debt payments" ON public.debt_payments;
CREATE POLICY "Users can select own debt payments"
    ON public.debt_payments FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Least-privilege grants. Payment mutation is RPC-only.
REVOKE ALL ON TABLE public.debts FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.debts TO authenticated;
GRANT INSERT (
    user_id, name, lender_name, debt_type, principal_amount,
    outstanding_amount, currency_code, interest_rate, minimum_payment,
    payment_frequency, first_due_date, due_day, note
) ON public.debts TO authenticated;
GRANT UPDATE (
    name, lender_name, debt_type, currency_code, interest_rate,
    minimum_payment, payment_frequency, first_due_date, due_day, note, is_archived
) ON public.debts TO authenticated;

REVOKE ALL ON TABLE public.debt_payments FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.debt_payments TO authenticated;

REVOKE ALL ON public.debt_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.debt_details TO authenticated;

REVOKE ALL ON public.debt_payment_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.debt_payment_details TO authenticated;

REVOKE ALL ON public.transaction_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.transaction_details TO authenticated;

-- The RPC is the only authenticated mutation path for a repayment.
REVOKE ALL ON FUNCTION public.record_debt_payment(
    UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(
    UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT
) TO authenticated;

COMMIT;
