-- Script to identify and remove duplicate orders
-- Run this on your Railway PostgreSQL database

-- Step 1: Identify duplicate orders (same clientName, total, and created_at within 1 second)
SELECT
    id,
    "clientName",
    total,
    created_at,
    COUNT(*) OVER (
        PARTITION BY "clientName", total, DATE_TRUNC('second', created_at)
    ) as duplicate_count
FROM orders
WHERE created_at >= '2024-10-27' AND created_at < '2024-10-28'
ORDER BY created_at DESC, "clientName";

-- Step 2: Show orders with duplicates (for verification before deletion)
WITH duplicates AS (
    SELECT
        id,
        "clientName",
        total,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY "clientName", total, DATE_TRUNC('second', created_at)
            ORDER BY created_at DESC
        ) as row_num
    FROM orders
    WHERE created_at >= '2024-10-27' AND created_at < '2024-10-28'
)
SELECT * FROM duplicates WHERE row_num > 1;

-- Step 3: Delete duplicates (keeping only the first occurrence)
-- CAUTION: This will permanently delete duplicate records!
-- Run this ONLY after verifying the duplicates above

-- Uncomment the following lines to execute the deletion:
/*
WITH duplicates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "clientName", total, DATE_TRUNC('second', created_at)
            ORDER BY created_at DESC
        ) as row_num
    FROM orders
    WHERE created_at >= '2024-10-27' AND created_at < '2024-10-28'
)
DELETE FROM orders
WHERE id IN (
    SELECT id FROM duplicates WHERE row_num > 1
);
*/

-- Step 4: Verify totals after cleanup
SELECT
    DATE(created_at) as date,
    COUNT(*) as order_count,
    SUM(total) as total_sales,
    SUM(CASE WHEN "paymentMethod" = 'Efectivo' THEN total ELSE 0 END) as efectivo_sales,
    SUM(CASE WHEN "paymentMethod" = 'Tarjeta' THEN total ELSE 0 END) as tarjeta_sales,
    SUM(CASE WHEN "paymentMethod" = 'Crédito' THEN total ELSE 0 END) as credito_sales
FROM orders
WHERE created_at >= '2024-10-27' AND created_at < '2024-10-28'
GROUP BY DATE(created_at);
