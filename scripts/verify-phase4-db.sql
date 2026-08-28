-- verify-phase4-db.sql
SELECT 
  EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') as has_transactions_table,
  EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'account_balances') as has_account_balances_view;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('id', 'user_id', 'account_id', 'category_id', 'type', 'amount', 'currency_code');
