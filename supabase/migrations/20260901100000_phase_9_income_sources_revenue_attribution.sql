BEGIN;

-- ============================================================================
-- Phase 9: Income Sources & Revenue Attribution
-- ============================================================================

-- 1. Create public.income_sources table
CREATE TABLE IF NOT EXISTS public.income_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT check_income_source_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT check_income_source_type CHECK (type IN ('SALARY', 'YOUTUBE', 'FREELANCE', 'INVESTMENT', 'OTHER')),
    CONSTRAINT income_sources_id_user_id_key UNIQUE (id, user_id)
);

COMMENT ON TABLE public.income_sources IS 'User income sources for revenue attribution metadata.';

CREATE INDEX IF NOT EXISTS idx_income_sources_user_id ON public.income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_user_active ON public.income_sources(user_id) WHERE is_archived = FALSE;

-- 2. Create public.income_source_streams table
CREATE TABLE IF NOT EXISTS public.income_source_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    income_source_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT check_income_source_stream_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT income_source_streams_id_income_source_id_user_id_key UNIQUE (id, income_source_id, user_id),
    CONSTRAINT income_source_streams_parent_fkey FOREIGN KEY (income_source_id, user_id)
        REFERENCES public.income_sources (id, user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.income_source_streams IS 'Optional sub-sources or channels underneath an income source.';

CREATE INDEX IF NOT EXISTS idx_income_source_streams_user_id ON public.income_source_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_income_source_streams_source_id ON public.income_source_streams(income_source_id);
CREATE INDEX IF NOT EXISTS idx_income_source_streams_user_active ON public.income_source_streams(user_id) WHERE is_archived = FALSE;

-- 3. Automatic updated_at triggers reusing public.handle_updated_at()
DROP TRIGGER IF EXISTS set_income_sources_updated_at ON public.income_sources;
CREATE TRIGGER set_income_sources_updated_at
    BEFORE UPDATE ON public.income_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_income_source_streams_updated_at ON public.income_source_streams;
CREATE TRIGGER set_income_source_streams_updated_at
    BEFORE UPDATE ON public.income_source_streams
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Extend transactions table with attribution columns and composite FKs
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS income_source_id UUID,
    ADD COLUMN IF NOT EXISTS income_source_stream_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transactions_income_source_fkey'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_income_source_fkey
            FOREIGN KEY (income_source_id, user_id)
            REFERENCES public.income_sources (id, user_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transactions_income_source_stream_fkey'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_income_source_stream_fkey
            FOREIGN KEY (income_source_stream_id, income_source_id, user_id)
            REFERENCES public.income_source_streams (id, income_source_id, user_id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_income_source_id ON public.transactions(income_source_id) WHERE income_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_income_source_stream_id ON public.transactions(income_source_stream_id) WHERE income_source_stream_id IS NOT NULL;

-- 5. Transaction CHECK invariants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_transaction_expense_no_attribution'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT check_transaction_expense_no_attribution
            CHECK (
                (type = 'EXPENSE' AND income_source_id IS NULL AND income_source_stream_id IS NULL)
                OR (type = 'INCOME')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_transaction_stream_requires_source'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT check_transaction_stream_requires_source
            CHECK (
                income_source_stream_id IS NULL
                OR income_source_id IS NOT NULL
            );
    END IF;
END $$;

-- 6. Active-attribution trigger on transactions
CREATE OR REPLACE FUNCTION public.check_transaction_attribution_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_source_archived BOOLEAN;
    v_stream_archived BOOLEAN;
BEGIN
    -- If no source attribution, nothing to validate
    IF NEW.income_source_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Validate source is active
    SELECT is_archived INTO v_source_archived
    FROM public.income_sources
    WHERE id = NEW.income_source_id AND user_id = NEW.user_id;

    IF v_source_archived IS TRUE THEN
        RAISE EXCEPTION 'Cannot attribute transaction to an archived income source'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Validate stream is active if provided
    IF NEW.income_source_stream_id IS NOT NULL THEN
        SELECT is_archived INTO v_stream_archived
        FROM public.income_source_streams
        WHERE id = NEW.income_source_stream_id
          AND income_source_id = NEW.income_source_id
          AND user_id = NEW.user_id;

        IF v_stream_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot attribute transaction to an archived income source stream'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_transaction_attribution_active_trigger ON public.transactions;
CREATE TRIGGER check_transaction_attribution_active_trigger
    BEFORE INSERT OR UPDATE OF type, income_source_id, income_source_stream_id ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_transaction_attribution_active();

-- 7. Row Level Security Policies
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_source_streams ENABLE ROW LEVEL SECURITY;

-- income_sources RLS policies
DROP POLICY IF EXISTS "Users can view own income sources" ON public.income_sources;
CREATE POLICY "Users can view own income sources"
    ON public.income_sources
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own income sources" ON public.income_sources;
CREATE POLICY "Users can insert own income sources"
    ON public.income_sources
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own income sources" ON public.income_sources;
CREATE POLICY "Users can update own income sources"
    ON public.income_sources
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- income_source_streams RLS policies
DROP POLICY IF EXISTS "Users can view own income source streams" ON public.income_source_streams;
CREATE POLICY "Users can view own income source streams"
    ON public.income_source_streams
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own income source streams" ON public.income_source_streams;
CREATE POLICY "Users can insert own income source streams"
    ON public.income_source_streams
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own income source streams" ON public.income_source_streams;
CREATE POLICY "Users can update own income source streams"
    ON public.income_source_streams
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Fail-closed privileges and explicit column allowlists
REVOKE ALL ON TABLE public.income_sources FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.income_source_streams FROM anon, authenticated, PUBLIC;

GRANT SELECT ON TABLE public.income_sources TO authenticated;
GRANT INSERT (name, type) ON TABLE public.income_sources TO authenticated;
GRANT UPDATE (name, type, is_archived) ON TABLE public.income_sources TO authenticated;

GRANT SELECT ON TABLE public.income_source_streams TO authenticated;
GRANT INSERT (income_source_id, name) ON TABLE public.income_source_streams TO authenticated;
GRANT UPDATE (name, is_archived) ON TABLE public.income_source_streams TO authenticated;

-- Grant column-level mutation authority on new transaction attribution columns to authenticated
GRANT INSERT (
    income_source_id,
    income_source_stream_id
)
ON TABLE public.transactions
TO authenticated;

GRANT UPDATE (
    income_source_id,
    income_source_stream_id
)
ON TABLE public.transactions
TO authenticated;

-- 9. Replace transaction_details view preserving exact 17-column prefix and appending 18-22
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
    strm.name AS income_source_stream_name
FROM public.transactions t
JOIN public.accounts a ON t.account_id = a.id
JOIN public.categories c ON t.category_id = c.id
LEFT JOIN public.income_sources src ON t.income_source_id = src.id AND t.user_id = src.user_id
LEFT JOIN public.income_source_streams strm ON t.income_source_stream_id = strm.id AND t.income_source_id = strm.income_source_id AND t.user_id = strm.user_id;

GRANT SELECT ON public.transaction_details TO authenticated;

COMMIT;
