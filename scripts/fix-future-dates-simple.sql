-- Simple SQL to fix future dates
-- Run this directly in Railway PostgreSQL console

-- Step 1: Check affected records
SELECT
  COUNT(*) as future_records,
  MAX(date) as latest_future_date
FROM records
WHERE date > CURRENT_TIMESTAMP;

-- Step 2: Show examples (optional)
SELECT _id, client, date, service, total
FROM records
WHERE date > CURRENT_TIMESTAMP
ORDER BY date DESC
LIMIT 10;

-- Step 3: Fix future dates
UPDATE records
SET
  date = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP
WHERE date > CURRENT_TIMESTAMP;

-- Step 4: Verify fix
SELECT
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE date > CURRENT_TIMESTAMP) as future_records,
  MAX(date) as latest_date
FROM records;
