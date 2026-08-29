DO $$
BEGIN
  -- 1. Check auto_fx_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'auto_fx_enabled'
  ) THEN
    RAISE EXCEPTION 'auto_fx_enabled column missing';
  END IF;

  -- 2. Check snapshot table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction_fx_snapshots'
  ) THEN
    RAISE EXCEPTION 'transaction_fx_snapshots table missing';
  END IF;

  -- 3. Check composite FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_snapshot_transaction'
  ) THEN
    RAISE EXCEPTION 'fk_snapshot_transaction constraint missing';
  END IF;
  
  -- 4. Check view
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'transaction_fx_snapshot_details'
  ) THEN
    RAISE EXCEPTION 'transaction_fx_snapshot_details view missing';
  END IF;

  RAISE NOTICE 'Phase 8 DB Verification PASSED';
END $$;
