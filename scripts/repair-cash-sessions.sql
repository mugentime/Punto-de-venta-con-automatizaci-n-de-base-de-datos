-- Script to repair cash sessions with incorrect expectedCash calculations
-- Bug: Old code was subtracting totalExpenses from expectedCash
-- Fix: expectedCash should be: startAmount + cashSales - totalWithdrawals (NO expenses)

-- Step 1: Find the problematic session from Oct 30
SELECT
    id,
    "startTime" AT TIME ZONE 'America/Mexico_City' as start_time_mex,
    "endTime" AT TIME ZONE 'America/Mexico_City' as end_time_mex,
    "startAmount",
    "endAmount",
    "totalSales",
    "totalExpenses",
    "expectedCash",
    difference,
    status
FROM cash_sessions
WHERE DATE("startTime" AT TIME ZONE 'America/Mexico_City') = '2025-10-30'
AND status = 'closed'
ORDER BY "startTime";

-- Step 2: Check if there are more sessions with negative or suspicious expectedCash
SELECT
    id,
    "startTime" AT TIME ZONE 'America/Mexico_City' as start_time_mex,
    "endTime" AT TIME ZONE 'America/Mexico_City' as end_time_mex,
    "startAmount",
    "endAmount",
    "totalSales",
    "totalExpenses",
    "expectedCash",
    difference,
    status
FROM cash_sessions
WHERE status = 'closed'
AND ("expectedCash" < 0 OR "expectedCash" < "startAmount" - 1000)
ORDER BY "startTime" DESC;

-- Step 3: For the Oct 30 session, we need to calculate cash sales
-- We need the session ID first, then we can calculate:

-- Get cash sales for a specific session (replace session_id)
-- This query will help us recalculate the correct expectedCash
WITH session_info AS (
    SELECT
        id,
        "startTime",
        "endTime",
        "startAmount",
        "endAmount"
    FROM cash_sessions
    WHERE DATE("startTime" AT TIME ZONE 'America/Mexico_City') = '2025-10-30'
    AND status = 'closed'
    LIMIT 1
),
cash_sales AS (
    SELECT
        COALESCE(SUM(total), 0) as orders_cash
    FROM orders o, session_info s
    WHERE o.date >= s."startTime"
    AND o.date < COALESCE(s."endTime", NOW())
    AND o."paymentMethod" = 'Efectivo'
),
withdrawals AS (
    SELECT
        COALESCE(SUM(amount), 0) as total_withdrawals
    FROM cash_withdrawals w, session_info s
    WHERE w.cash_session_id = s.id
)
SELECT
    s.id,
    s."startAmount",
    s."endAmount",
    cs.orders_cash,
    w.total_withdrawals,
    -- Correct calculation: startAmount + cashSales - withdrawals
    (s."startAmount" + cs.orders_cash - w.total_withdrawals) as correct_expected_cash,
    -- Correct difference
    (s."endAmount" - (s."startAmount" + cs.orders_cash - w.total_withdrawals)) as correct_difference
FROM session_info s, cash_sales cs, withdrawals w;

-- Step 4: After reviewing the output above, update the session
-- (We'll generate the UPDATE statement after seeing the data)
