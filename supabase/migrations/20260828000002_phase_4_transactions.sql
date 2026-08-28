BEGIN;

-- 1. Add unique constraints to support composite ownership-safe foreign keys
ALTER TABLE public.accounts 
  ADD CONSTRAINT accounts_id_user_id_currency_code_key 
  UNIQUE (id, user_id, currency_code);

ALTER TABLE public.categories
  ADD CONSTRAINT categories_id_user_id_type_key
  UNIQUE (id, user_id, type);

-- 2. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    category_id UUID NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    currency_code TEXT NOT NULL,
    merchant TEXT NOT NULL,
    note TEXT,
    occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_transaction_amount_positive CHECK (amount > 0),
    CONSTRAINT check_transaction_type CHECK (type IN ('INCOME', 'EXPENSE')),
    CONSTRAINT check_merchant_not_empty CHECK (trim(merchant) <> ''),
    CONSTRAINT check_currency_code_format CHECK (currency_code ~ '^[A-Z]{3,5}$'),

    -- Ownership-safe foreign keys
    CONSTRAINT transactions_account_fkey FOREIGN KEY (account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT,
    CONSTRAINT transactions_category_fkey FOREIGN KEY (category_id, user_id, type)
        REFERENCES public.categories (id, user_id, type) ON DELETE RESTRICT
);

COMMENT ON TABLE public.transactions IS 'User financial transactions (Income/Expense).';

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_active ON public.transactions(user_id) WHERE is_voided = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on ON public.transactions(occurred_on);

-- 3. Automatic updated_at trigger for transactions
DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Create derived account_balances view
CREATE OR REPLACE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT 
    a.id AS account_id,
    a.user_id,
    a.opening_balance + COALESCE(SUM(
        CASE 
            WHEN t.type = 'INCOME' THEN t.amount
            WHEN t.type = 'EXPENSE' THEN -t.amount
            ELSE 0
        END
    ), 0) AS current_balance
FROM public.accounts a
LEFT JOIN public.transactions t ON a.id = t.account_id AND t.is_voided = FALSE
GROUP BY a.id, a.user_id, a.opening_balance;

-- 5. Enable Row Level Security (RLS) on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 6. Row Level Security Policies for transactions
DROP POLICY IF EXISTS "Users can select own transactions" ON public.transactions;
CREATE POLICY "Users can select own transactions"
    ON public.transactions
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
    ON public.transactions
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
    ON public.transactions
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 7. Table Grants and Column-Level Privileges for transactions
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.transactions FROM authenticated;
REVOKE ALL ON TABLE public.transactions FROM PUBLIC;

GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT INSERT (user_id, account_id, category_id, type, amount, currency_code, merchant, note, occurred_on, is_voided) ON TABLE public.transactions TO authenticated;
GRANT UPDATE (account_id, category_id, type, amount, currency_code, merchant, note, occurred_on, is_voided) ON TABLE public.transactions TO authenticated;

-- 8. View Grants
REVOKE ALL ON public.account_balances FROM anon;
REVOKE ALL ON public.account_balances FROM authenticated;
REVOKE ALL ON public.account_balances FROM PUBLIC;
GRANT SELECT ON public.account_balances TO authenticated;

COMMIT;
