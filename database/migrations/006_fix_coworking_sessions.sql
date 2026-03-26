-- Migration: Fix coworking sessions with future dates and orphaned sessions
-- Description: Updates sessions with future dates and closes orphaned active sessions
-- Author: Claude Code
-- Date: 2026-03-25

-- Report affected sessions
DO $$
DECLARE
    future_count INTEGER;
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO future_count
    FROM coworking_sessions
    WHERE start_time > CURRENT_TIMESTAMP OR end_time > CURRENT_TIMESTAMP;

    SELECT COUNT(*) INTO orphaned_count
    FROM coworking_sessions
    WHERE status = 'active'
      AND created_at < (CURRENT_TIMESTAMP - INTERVAL '7 days');

    RAISE NOTICE 'Found % sessions with future dates', future_count;
    RAISE NOTICE 'Found % orphaned active sessions', orphaned_count;
END $$;

-- Fix future start times
UPDATE coworking_sessions
SET start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE start_time > CURRENT_TIMESTAMP;

-- Fix future end times
UPDATE coworking_sessions
SET end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE end_time > CURRENT_TIMESTAMP AND status = 'closed';

-- Close orphaned active sessions (older than 7 days)
UPDATE coworking_sessions
SET
    end_time = start_time + INTERVAL '2 hours',
    status = 'closed',
    payment = 'efectivo',
    notes = CONCAT(COALESCE(notes, ''), ' [Auto-closed: orphaned session]'),
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
  AND created_at < (CURRENT_TIMESTAMP - INTERVAL '7 days');

-- Verify the fix
SELECT
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
    COUNT(*) FILTER (WHERE start_time > CURRENT_TIMESTAMP) as future_start_times,
    COUNT(*) FILTER (WHERE end_time > CURRENT_TIMESTAMP) as future_end_times,
    MAX(start_time) as latest_start_time,
    MAX(end_time) as latest_end_time
FROM coworking_sessions;
