BEGIN;

-- 1. Create transfers table
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    from_account_id UUID NOT NULL,
    to_account_id UUID NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    currency_code TEXT NOT NULL,
    note TEXT,
    occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_transfer_amount_positive CHECK (amount > 0),
    CONSTRAINT check_transfer_accounts_distinct CHECK (from_account_id <> to_account_id),
    CONSTRAINT check_transfer_currency_code_format CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_transfer_note_length CHECK (note IS NULL OR char_length(note) <= 1000),

    -- Ownership-safe composite foreign keys enforcing user isolation and same-currency invariant
    CONSTRAINT transfers_from_account_fkey FOREIGN KEY (from_account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT,
    CONSTRAINT transfers_to_account_fkey FOREIGN KEY (to_account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT
);

COMMENT ON TABLE public.transfers IS 'User financial transfers between own accounts.';

CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id_active ON public.transfers(user_id) WHERE is_voided = FALSE;
CREATE INDEX IF NOT EXISTS idx_transfers_from_account_id ON public.transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account_id ON public.transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_occurred_on ON public.transfers(occurred_on);

-- 2. Automatic updated_at trigger for transfers
DROP TRIGGER IF EXISTS set_transfers_updated_at ON public.transfers;
CREATE TRIGGER set_transfers_updated_at
    BEFORE UPDATE ON public.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. Create derived transfer_details exact-read view
CREATE OR REPLACE VIEW public.transfer_details WITH (security_invoker = true) AS
SELECT 
    t.id,
    t.user_id,
    t.from_account_id,
    t.to_account_id,
    CAST(t.amount AS TEXT) AS amount,
    t.currency_code,
    t.note,
    t.occurred_on,
    t.is_voided,
    t.created_at,
    t.updated_at,
    fa.name AS from_account_name,
    fa.type AS from_account_type,
    fa.color AS from_account_color,
    ta.name AS to_account_name,
    ta.type AS to_account_type,
    ta.color AS to_account_color
FROM public.transfers t
JOIN public.accounts fa ON t.from_account_id = fa.id
JOIN public.accounts ta ON t.to_account_id = ta.id;

-- 4. Rebuild derived account_balances view with transfer support and Cartesian multiplication protection
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
        SUM(amount) AS in_transfers
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
)
SELECT 
    a.id AS account_id,
    a.user_id,
    a.currency_code,
    CAST(
        a.opening_balance + 
        COALESCE(tx.net_transactions, 0) + 
        COALESCE(it.in_transfers, 0) - 
        COALESCE(ot.out_transfers, 0)
    AS TEXT) AS current_balance
FROM public.accounts a
LEFT JOIN tx_totals tx ON a.id = tx.account_id
LEFT JOIN incoming_transfers it ON a.id = it.account_id
LEFT JOIN outgoing_transfers ot ON a.id = ot.account_id;

-- 5. Enable Row Level Security (RLS) on transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- 6. Row Level Security Policies for transfers
DROP POLICY IF EXISTS "Users can select own transfers" ON public.transfers;
CREATE POLICY "Users can select own transfers"
    ON public.transfers
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
CREATE POLICY "Users can insert own transfers"
    ON public.transfers
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
CREATE POLICY "Users can update own transfers"
    ON public.transfers
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 7. Table Grants and Column-Level Privileges for transfers
REVOKE ALL ON TABLE public.transfers FROM anon;
REVOKE ALL ON TABLE public.transfers FROM authenticated;
REVOKE ALL ON TABLE public.transfers FROM PUBLIC;

GRANT SELECT ON TABLE public.transfers TO authenticated;
GRANT INSERT (user_id, from_account_id, to_account_id, amount, currency_code, note, occurred_on) ON TABLE public.transfers TO authenticated;
GRANT UPDATE (from_account_id, to_account_id, amount, currency_code, note, occurred_on, is_voided) ON TABLE public.transfers TO authenticated;

-- 8. Grants for Views
REVOKE ALL ON TABLE public.transfer_details FROM anon;
REVOKE ALL ON TABLE public.transfer_details FROM authenticated;
REVOKE ALL ON TABLE public.transfer_details FROM PUBLIC;
GRANT SELECT ON TABLE public.transfer_details TO authenticated;

REVOKE ALL ON TABLE public.account_balances FROM anon;
REVOKE ALL ON TABLE public.account_balances FROM authenticated;
REVOKE ALL ON TABLE public.account_balances FROM PUBLIC;
GRANT SELECT ON TABLE public.account_balances TO authenticated;

COMMIT;
