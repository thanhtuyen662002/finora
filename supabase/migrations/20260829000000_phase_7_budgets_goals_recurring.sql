BEGIN;

-- 1. Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id UUID NOT NULL,
    category_type TEXT NOT NULL DEFAULT 'EXPENSE',
    limit_amount NUMERIC(20,4) NOT NULL,
    currency_code TEXT NOT NULL,
    period_month DATE NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_budget_limit_positive CHECK (limit_amount > 0),
    CONSTRAINT check_budget_category_type CHECK (category_type = 'EXPENSE'),
    CONSTRAINT check_budget_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_budget_period_month_first_day CHECK (period_month = date_trunc('month', period_month)::DATE),
    CONSTRAINT budgets_user_category_currency_period_key UNIQUE (user_id, category_id, currency_code, period_month),

    -- Ownership-safe composite foreign key
    CONSTRAINT budgets_category_fkey FOREIGN KEY (category_id, user_id, category_type)
        REFERENCES public.categories (id, user_id, type) ON DELETE RESTRICT
);

COMMENT ON TABLE public.budgets IS 'Monthly category budget limits.';

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets(user_id, period_month);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON public.budgets(category_id);

-- 2. Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC(20,4) NOT NULL,
    current_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    monthly_contribution NUMERIC(20,4) NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL,
    target_date DATE NULL,
    category TEXT NOT NULL DEFAULT 'OTHER',
    icon TEXT NOT NULL DEFAULT 'Target',
    color TEXT NOT NULL DEFAULT '#10b981',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_goal_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT check_goal_target_amount_positive CHECK (target_amount > 0),
    CONSTRAINT check_goal_current_amount_non_negative CHECK (current_amount >= 0),
    CONSTRAINT check_goal_monthly_contribution_non_negative CHECK (monthly_contribution >= 0),
    CONSTRAINT check_goal_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_goal_category_length CHECK (char_length(trim(category)) BETWEEN 1 AND 100),
    CONSTRAINT check_goal_icon_length CHECK (char_length(trim(icon)) BETWEEN 1 AND 100),
    CONSTRAINT check_goal_color_length CHECK (char_length(trim(color)) BETWEEN 1 AND 32)
);

COMMENT ON TABLE public.goals IS 'Financial savings and planning goals.';

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_active ON public.goals(user_id) WHERE is_archived = FALSE;

-- 3. Create recurring_items table
CREATE TABLE IF NOT EXISTS public.recurring_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    category_id UUID NOT NULL,
    transaction_type TEXT NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    currency_code TEXT NOT NULL,
    frequency TEXT NOT NULL,
    anchor_date DATE NOT NULL,
    end_date DATE NULL,
    note TEXT NULL,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_recurring_amount_positive CHECK (amount > 0),
    CONSTRAINT check_recurring_transaction_type CHECK (transaction_type IN ('INCOME', 'EXPENSE')),
    CONSTRAINT check_recurring_frequency CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'YEARLY')),
    CONSTRAINT check_recurring_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    CONSTRAINT check_recurring_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT check_recurring_note_length CHECK (note IS NULL OR char_length(note) <= 1000),
    CONSTRAINT check_recurring_dates CHECK (end_date IS NULL OR end_date >= anchor_date),

    -- Ownership-safe composite foreign keys
    CONSTRAINT recurring_items_account_fkey FOREIGN KEY (account_id, user_id, currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT,
    CONSTRAINT recurring_items_category_fkey FOREIGN KEY (category_id, user_id, transaction_type)
        REFERENCES public.categories (id, user_id, type) ON DELETE RESTRICT
);

COMMENT ON TABLE public.recurring_items IS 'Recurring income and expense schedules/templates.';

CREATE INDEX IF NOT EXISTS idx_recurring_items_user_id ON public.recurring_items(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_user_active ON public.recurring_items(user_id) WHERE is_archived = FALSE AND is_paused = FALSE;
CREATE INDEX IF NOT EXISTS idx_recurring_items_account_id ON public.recurring_items(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_category_id ON public.recurring_items(category_id);

-- 4. Automatic updated_at triggers
DROP TRIGGER IF EXISTS set_budgets_updated_at ON public.budgets;
CREATE TRIGGER set_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_goals_updated_at ON public.goals;
CREATE TRIGGER set_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_recurring_items_updated_at ON public.recurring_items;
CREATE TRIGGER set_recurring_items_updated_at
    BEFORE UPDATE ON public.recurring_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Derived security_invoker exact-money views

-- 5.1 budget_progress view
CREATE OR REPLACE VIEW public.budget_progress WITH (security_invoker = true) AS
SELECT 
    b.id,
    b.user_id,
    b.category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    CAST(b.limit_amount AS TEXT) AS limit_amount,
    CAST(COALESCE(SUM(t.amount), 0) AS TEXT) AS spent_amount,
    b.currency_code,
    b.period_month,
    b.is_archived,
    b.created_at,
    b.updated_at
FROM public.budgets b
JOIN public.categories c ON b.category_id = c.id
LEFT JOIN public.transactions t ON 
    t.user_id = b.user_id AND
    t.category_id = b.category_id AND
    t.currency_code = b.currency_code AND
    t.type = 'EXPENSE' AND
    t.is_voided = FALSE AND
    t.occurred_on >= b.period_month AND
    t.occurred_on < (b.period_month + INTERVAL '1 month')::DATE
GROUP BY b.id, b.user_id, b.category_id, c.name, c.icon, c.color, b.limit_amount, b.currency_code, b.period_month, b.is_archived, b.created_at, b.updated_at;

-- 5.2 goal_details view
CREATE OR REPLACE VIEW public.goal_details WITH (security_invoker = true) AS
SELECT 
    g.id,
    g.user_id,
    g.name,
    CAST(g.target_amount AS TEXT) AS target_amount,
    CAST(g.current_amount AS TEXT) AS current_amount,
    CAST(g.monthly_contribution AS TEXT) AS monthly_contribution,
    g.currency_code,
    g.target_date,
    g.category,
    g.icon,
    g.color,
    g.is_archived,
    g.created_at,
    g.updated_at
FROM public.goals g;

-- 5.3 recurring_details view
CREATE OR REPLACE VIEW public.recurring_details WITH (security_invoker = true) AS
SELECT 
    r.id,
    r.user_id,
    r.account_id,
    a.name AS account_name,
    a.color AS account_color,
    r.category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    r.transaction_type,
    r.name,
    CAST(r.amount AS TEXT) AS amount,
    r.currency_code,
    r.frequency,
    r.anchor_date,
    r.end_date,
    r.note,
    r.is_paused,
    r.is_archived,
    r.created_at,
    r.updated_at
FROM public.recurring_items r
JOIN public.accounts a ON r.account_id = a.id
JOIN public.categories c ON r.category_id = c.id;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies (9 total)

-- Budgets policies (3)
DROP POLICY IF EXISTS "Users can select own budgets" ON public.budgets;
CREATE POLICY "Users can select own budgets"
    ON public.budgets
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
CREATE POLICY "Users can insert own budgets"
    ON public.budgets
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets"
    ON public.budgets
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Goals policies (3)
DROP POLICY IF EXISTS "Users can select own goals" ON public.goals;
CREATE POLICY "Users can select own goals"
    ON public.goals
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
CREATE POLICY "Users can insert own goals"
    ON public.goals
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
CREATE POLICY "Users can update own goals"
    ON public.goals
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Recurring items policies (3)
DROP POLICY IF EXISTS "Users can select own recurring items" ON public.recurring_items;
CREATE POLICY "Users can select own recurring items"
    ON public.recurring_items
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own recurring items" ON public.recurring_items;
CREATE POLICY "Users can insert own recurring items"
    ON public.recurring_items
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own recurring items" ON public.recurring_items;
CREATE POLICY "Users can update own recurring items"
    ON public.recurring_items
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Table Grants and Column-Level Privileges

-- Budgets grants
REVOKE ALL ON TABLE public.budgets FROM anon;
REVOKE ALL ON TABLE public.budgets FROM authenticated;
REVOKE ALL ON TABLE public.budgets FROM PUBLIC;

GRANT SELECT ON TABLE public.budgets TO authenticated;
GRANT INSERT (user_id, category_id, category_type, limit_amount, currency_code, period_month) ON TABLE public.budgets TO authenticated;
GRANT UPDATE (category_id, category_type, limit_amount, currency_code, period_month, is_archived) ON TABLE public.budgets TO authenticated;

-- Goals grants
REVOKE ALL ON TABLE public.goals FROM anon;
REVOKE ALL ON TABLE public.goals FROM authenticated;
REVOKE ALL ON TABLE public.goals FROM PUBLIC;

GRANT SELECT ON TABLE public.goals TO authenticated;
GRANT INSERT (user_id, name, target_amount, current_amount, monthly_contribution, currency_code, target_date, category, icon, color) ON TABLE public.goals TO authenticated;
GRANT UPDATE (name, target_amount, current_amount, monthly_contribution, currency_code, target_date, category, icon, color, is_archived) ON TABLE public.goals TO authenticated;

-- Recurring items grants
REVOKE ALL ON TABLE public.recurring_items FROM anon;
REVOKE ALL ON TABLE public.recurring_items FROM authenticated;
REVOKE ALL ON TABLE public.recurring_items FROM PUBLIC;

GRANT SELECT ON TABLE public.recurring_items TO authenticated;
GRANT INSERT (user_id, account_id, category_id, transaction_type, name, amount, currency_code, frequency, anchor_date, end_date, note) ON TABLE public.recurring_items TO authenticated;
GRANT UPDATE (account_id, category_id, transaction_type, name, amount, currency_code, frequency, anchor_date, end_date, note, is_paused, is_archived) ON TABLE public.recurring_items TO authenticated;

-- 9. View Grants
REVOKE ALL ON public.budget_progress FROM anon;
REVOKE ALL ON public.budget_progress FROM authenticated;
REVOKE ALL ON public.budget_progress FROM PUBLIC;
GRANT SELECT ON public.budget_progress TO authenticated;

REVOKE ALL ON public.goal_details FROM anon;
REVOKE ALL ON public.goal_details FROM authenticated;
REVOKE ALL ON public.goal_details FROM PUBLIC;
GRANT SELECT ON public.goal_details TO authenticated;

REVOKE ALL ON public.recurring_details FROM anon;
REVOKE ALL ON public.recurring_details FROM authenticated;
REVOKE ALL ON public.recurring_details FROM PUBLIC;
GRANT SELECT ON public.recurring_details TO authenticated;

COMMIT;
