-- Migration: Fix future dates in records table
-- Description: Updates any records with dates in the future to today's date
-- Author: Claude Code
-- Date: 2026-01-19

-- Step 1: Report affected records
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO affected_count
    FROM records
    WHERE date > CURRENT_TIMESTAMP;

    RAISE NOTICE 'Found % records with future dates', affected_count;
END $$;

-- Step 2: Update future dates to current date
UPDATE records
SET
    date = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE date > CURRENT_TIMESTAMP;

-- Step 3: Add constraint to prevent future dates (optional, can be enabled later)
-- ALTER TABLE records
-- ADD CONSTRAINT records_date_not_future
-- CHECK (date <= CURRENT_TIMESTAMP);

-- Note: Constraint is commented out to allow flexibility
-- Enable it if you want strict database-level validation

-- Verify the fix
SELECT
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE date > CURRENT_TIMESTAMP) as future_records,
    MAX(date) as latest_date
FROM records;
