-- Phase 8: Multi-Currency + FX (Pass A)
-- Creates immutable historical transaction FX snapshots and auto_fx_enabled setting.

-- 1. Add auto_fx_enabled to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS auto_fx_enabled boolean NOT NULL DEFAULT true;

-- Grant UPDATE on the new column to authenticated users
GRANT UPDATE (auto_fx_enabled) ON public.user_settings TO authenticated;

-- 2. Create transaction_fx_snapshots table
CREATE TABLE IF NOT EXISTS public.transaction_fx_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  source_currency_code text NOT NULL,
  target_currency_code text NOT NULL,
  source_amount numeric(20,4) NOT NULL,
  rate numeric(30,12) NOT NULL,
  converted_amount numeric(20,4) NOT NULL,
  requested_date date NOT NULL,
  effective_date date NOT NULL,
  provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_snapshot_source_currency CHECK (source_currency_code ~ '^[A-Z]{3,5}$'),
  CONSTRAINT check_snapshot_target_currency CHECK (target_currency_code ~ '^[A-Z]{3,5}$'),
  CONSTRAINT check_snapshot_currency_diff CHECK (source_currency_code <> target_currency_code),
  CONSTRAINT check_snapshot_source_amount CHECK (source_amount > 0),
  CONSTRAINT check_snapshot_rate CHECK (rate > 0),
  CONSTRAINT check_snapshot_converted_amount CHECK (converted_amount > 0),
  CONSTRAINT check_snapshot_effective_date CHECK (effective_date <= requested_date),
  CONSTRAINT check_snapshot_provider_length CHECK (char_length(trim(provider)) BETWEEN 1 AND 100),
  CONSTRAINT fk_snapshot_transaction FOREIGN KEY (transaction_id, user_id) REFERENCES public.transactions(id, user_id) ON DELETE RESTRICT
);

-- Note: We need transactions(id, user_id) to be UNIQUE for the composite FK.
-- But wait, typically primary key is just `id`. We added `UNIQUE (id, user_id)` in an earlier phase if it didn't exist.
-- Let's ensure transactions has this unique constraint to support the composite FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_id_user_id_key'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_id_user_id_key UNIQUE (id, user_id);
  END IF;
END $$;

-- Enforce snapshot version uniqueness
ALTER TABLE public.transaction_fx_snapshots
ADD CONSTRAINT transaction_fx_snapshots_version_key UNIQUE (
  user_id,
  transaction_id,
  target_currency_code,
  source_currency_code,
  source_amount,
  requested_date
);

-- Enable RLS
ALTER TABLE public.transaction_fx_snapshots ENABLE ROW LEVEL SECURITY;

-- Revoke all by default
REVOKE ALL ON public.transaction_fx_snapshots FROM anon, public, authenticated;

-- Grant SELECT to authenticated
GRANT SELECT ON public.transaction_fx_snapshots TO authenticated;

-- Create single SELECT policy for ownership
CREATE POLICY select_own_snapshots ON public.transaction_fx_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Create view public.transaction_fx_snapshot_details
CREATE OR REPLACE VIEW public.transaction_fx_snapshot_details
  WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  transaction_id,
  source_currency_code,
  target_currency_code,
  source_amount::text AS source_amount,
  rate::text AS rate,
  converted_amount::text AS converted_amount,
  requested_date,
  effective_date,
  provider,
  created_at
FROM public.transaction_fx_snapshots;

REVOKE ALL ON public.transaction_fx_snapshot_details FROM anon, public, authenticated;
GRANT SELECT ON public.transaction_fx_snapshot_details TO authenticated;
