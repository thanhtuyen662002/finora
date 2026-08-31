BEGIN;

-- 1. Add cross-currency columns to public.transfers table
ALTER TABLE public.transfers
    ADD COLUMN IF NOT EXISTS source_currency_code TEXT,
    ADD COLUMN IF NOT EXISTS destination_currency_code TEXT,
    ADD COLUMN IF NOT EXISTS destination_amount NUMERIC(20,4),
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(30,12);

-- 2. Backfill legacy same-currency transfers
UPDATE public.transfers
SET 
    source_currency_code = COALESCE(source_currency_code, currency_code),
    destination_currency_code = COALESCE(destination_currency_code, currency_code),
    destination_amount = COALESCE(destination_amount, amount),
    exchange_rate = COALESCE(exchange_rate, 1.000000000000)
WHERE source_currency_code IS NULL 
   OR destination_currency_code IS NULL 
   OR destination_amount IS NULL 
   OR exchange_rate IS NULL;

-- 3. Set NOT NULL constraints
ALTER TABLE public.transfers
    ALTER COLUMN source_currency_code SET NOT NULL,
    ALTER COLUMN destination_currency_code SET NOT NULL,
    ALTER COLUMN destination_amount SET NOT NULL,
    ALTER COLUMN exchange_rate SET NOT NULL;

-- 4. Set DEFAULT for exchange_rate
ALTER TABLE public.transfers
    ALTER COLUMN exchange_rate SET DEFAULT 1.000000000000;

-- 5. Add constraints
ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS check_transfer_source_currency,
    ADD CONSTRAINT check_transfer_source_currency CHECK (source_currency_code ~ '^[A-Z]{3,5}$');

ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS check_transfer_destination_currency,
    ADD CONSTRAINT check_transfer_destination_currency CHECK (destination_currency_code ~ '^[A-Z]{3,5}$');

ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS check_transfer_destination_amount_positive,
    ADD CONSTRAINT check_transfer_destination_amount_positive CHECK (destination_amount > 0);

ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS check_transfer_exchange_rate_positive,
    ADD CONSTRAINT check_transfer_exchange_rate_positive CHECK (exchange_rate > 0);

-- 6. Replace old composite FKs with per-currency composite FKs enforcing user isolation and currency authority
ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS transfers_from_account_fkey,
    DROP CONSTRAINT IF EXISTS transfers_to_account_fkey;

ALTER TABLE public.transfers
    ADD CONSTRAINT transfers_from_account_fkey FOREIGN KEY (from_account_id, user_id, source_currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT,
    ADD CONSTRAINT transfers_to_account_fkey FOREIGN KEY (to_account_id, user_id, destination_currency_code)
        REFERENCES public.accounts (id, user_id, currency_code) ON DELETE RESTRICT;

-- 7. Grant INSERT and UPDATE privileges on new columns to authenticated
GRANT INSERT (source_currency_code, destination_currency_code, destination_amount, exchange_rate) ON TABLE public.transfers TO authenticated;
GRANT UPDATE (source_currency_code, destination_currency_code, destination_amount, exchange_rate) ON TABLE public.transfers TO authenticated;

-- 8. Rebuild transfer_details exact-read view
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
    ta.color AS to_account_color,
    t.source_currency_code,
    t.destination_currency_code,
    CAST(t.destination_amount AS TEXT) AS destination_amount,
    CAST(t.exchange_rate AS TEXT) AS exchange_rate,
    fa.currency_code AS from_account_currency,
    ta.currency_code AS to_account_currency
FROM public.transfers t
JOIN public.accounts fa ON t.from_account_id = fa.id
JOIN public.accounts ta ON t.to_account_id = ta.id;

-- 9. Rebuild account_balances view supporting cross-currency transfers
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

-- 10. Grants for Views
REVOKE ALL ON TABLE public.transfer_details FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.transfer_details TO authenticated;

REVOKE ALL ON TABLE public.account_balances FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.account_balances TO authenticated;

COMMIT;
