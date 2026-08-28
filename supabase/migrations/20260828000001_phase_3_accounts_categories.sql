-- ==============================================================================
-- FINORA — PHASE 3 MIGRATION: ACCOUNTS + CATEGORIES
-- Target: Supabase PostgreSQL (qibfitbnlfgiqctntufr)
-- Invariant: User A cannot read, insert, update, or archive User B's accounts or categories.
-- ==============================================================================

-- 1. Create public.accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(TRIM(name)) > 0 AND char_length(TRIM(name)) <= 100),
    type TEXT NOT NULL CHECK (type IN ('CASH', 'BANK', 'EWALLET', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'OTHER')),
    currency_code TEXT NOT NULL CHECK (currency_code ~ '^[A-Z]{3,5}$'),
    opening_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
    institution TEXT NULL,
    color TEXT NOT NULL DEFAULT '#005a3c' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.accounts IS 'User financial accounts managed under RLS.';

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id_active ON public.accounts(user_id) WHERE is_archived = FALSE;

-- 2. Create public.categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(TRIM(name)) > 0 AND char_length(TRIM(name)) <= 80),
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.categories IS 'User financial categories managed under RLS.';

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id_active ON public.categories(user_id) WHERE is_archived = FALSE;

-- 3. Automatic updated_at triggers
DROP TRIGGER IF EXISTS set_accounts_updated_at ON public.accounts;
CREATE TRIGGER set_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Category provisioning function
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- INCOME CATEGORIES
    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Lương', 'INCOME', 'Briefcase', '#22c55e'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Lương' AND type = 'INCOME');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'YouTube & AdSense', 'INCOME', 'Video', '#dc2626'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'YouTube & AdSense' AND type = 'INCOME');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Freelance', 'INCOME', 'Laptop', '#3b82f6'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Freelance' AND type = 'INCOME');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Đầu tư', 'INCOME', 'TrendingUp', '#14b8a6'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Đầu tư' AND type = 'INCOME');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Khác', 'INCOME', 'MoreHorizontal', '#64748b'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Khác' AND type = 'INCOME');

    -- EXPENSE CATEGORIES
    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Ăn uống', 'EXPENSE', 'Utensils', '#f97316'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Ăn uống' AND type = 'EXPENSE');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Di chuyển', 'EXPENSE', 'Car', '#0ea5e9'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Di chuyển' AND type = 'EXPENSE');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Mua sắm', 'EXPENSE', 'ShoppingBag', '#8b5cf6'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Mua sắm' AND type = 'EXPENSE');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Hóa đơn & Nhà cửa', 'EXPENSE', 'Home', '#ef4444'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Hóa đơn & Nhà cửa' AND type = 'EXPENSE');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Giải trí', 'EXPENSE', 'Film', '#ec4899'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Giải trí' AND type = 'EXPENSE');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Sức khỏe', 'EXPENSE', 'HeartPulse', '#10b981'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Sức khỏe' AND type = 'EXPENSE');

    INSERT INTO public.categories (user_id, name, type, icon, color)
    SELECT p_user_id, 'Khác', 'EXPENSE', 'MoreHorizontal', '#64748b'
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND name = 'Khác' AND type = 'EXPENSE');
END;
$$;

-- Revoke direct execution of the seeding function from roles other than postgres/superuser
REVOKE ALL EXECUTE ON FUNCTION public.seed_default_categories(UUID) FROM PUBLIC;
REVOKE ALL EXECUTE ON FUNCTION public.seed_default_categories(UUID) FROM authenticated;
REVOKE ALL EXECUTE ON FUNCTION public.seed_default_categories(UUID) FROM anon;

-- Trigger to run on auth.users for seeding categories
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.seed_default_categories(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_categories();

-- 5. Safe backfill for existing auth users
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM auth.users
    LOOP
        PERFORM public.seed_default_categories(r.id);
    END LOOP;
END;
$$;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies
-- Accounts: Users can SELECT, INSERT, UPDATE their own accounts
DROP POLICY IF EXISTS "Users can select own accounts" ON public.accounts;
CREATE POLICY "Users can select own accounts"
    ON public.accounts
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts"
    ON public.accounts
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
CREATE POLICY "Users can update own accounts"
    ON public.accounts
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Categories: Users can SELECT, INSERT, UPDATE their own categories
DROP POLICY IF EXISTS "Users can select own categories" ON public.categories;
CREATE POLICY "Users can select own categories"
    ON public.categories
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories"
    ON public.categories
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories"
    ON public.categories
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Table Grants and Column-Level Privileges
REVOKE ALL ON TABLE public.accounts FROM anon;
REVOKE ALL ON TABLE public.accounts FROM authenticated;
REVOKE ALL ON TABLE public.accounts FROM PUBLIC;

REVOKE ALL ON TABLE public.categories FROM anon;
REVOKE ALL ON TABLE public.categories FROM authenticated;
REVOKE ALL ON TABLE public.categories FROM PUBLIC;

-- Accounts Grants
GRANT SELECT ON TABLE public.accounts TO authenticated;
GRANT INSERT (user_id, name, type, currency_code, opening_balance, institution, color, is_archived) ON TABLE public.accounts TO authenticated;
GRANT UPDATE (name, type, currency_code, opening_balance, institution, color, is_archived) ON TABLE public.accounts TO authenticated;

-- Categories Grants
GRANT SELECT ON TABLE public.categories TO authenticated;
GRANT INSERT (user_id, name, type, icon, color, is_archived) ON TABLE public.categories TO authenticated;
GRANT UPDATE (name, type, icon, color, is_archived) ON TABLE public.categories TO authenticated;
