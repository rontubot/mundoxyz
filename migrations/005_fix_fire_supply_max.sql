-- Fix fire supply max to 1 billion (1,000,000,000)
-- Current value is 1 million, needs to be 1 billion

BEGIN;

-- Update the max supply to 1 billion
UPDATE fire_supply 
SET total_max = 1000000000.00 
WHERE id = 1;

-- Verify the update
DO $$
DECLARE
  current_max DECIMAL(24,2);
BEGIN
  SELECT total_max INTO current_max FROM fire_supply WHERE id = 1;
  IF current_max != 1000000000.00 THEN
    RAISE EXCEPTION 'Fire supply max not updated correctly. Expected 1000000000.00, got %', current_max;
  END IF;
  RAISE NOTICE 'Fire supply max successfully updated to 1,000,000,000 (mil millones)';
END $$;

COMMIT;
