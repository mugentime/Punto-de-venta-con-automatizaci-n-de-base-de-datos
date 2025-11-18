-- ═══════════════════════════════════════════════════════════════
-- 📊 DATABASE INTEGRITY CHECK: Orders Table
-- ═══════════════════════════════════════════════════════════════
-- Purpose: Identify corrupted or malformed order records that may
--          cause API endpoint failures or calculation errors
--
-- Run this query when debugging orders fetch failures or $0.00 bugs
-- ═══════════════════════════════════════════════════════════════

-- 1️⃣ CHECK FOR NULL OR INVALID DATA
-- ────────────────────────────────────────────────────────────────
SELECT
    id,
    "clientName",
    items IS NULL as items_null,
    jsonb_typeof(items) as items_type,
    subtotal IS NULL as subtotal_null,
    subtotal,
    discount IS NULL as discount_null,
    discount,
    tip IS NULL as tip_null,
    tip,
    total IS NULL as total_null,
    total,
    created_at IS NULL as created_at_null,
    created_at
FROM orders
WHERE
    items IS NULL
    OR jsonb_typeof(items) != 'array'
    OR subtotal IS NULL
    OR total IS NULL
    OR created_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 2️⃣ CHECK FOR ITEMS ARRAY ISSUES
-- ────────────────────────────────────────────────────────────────
-- Find orders where items array is empty or malformed
SELECT
    id,
    "clientName",
    jsonb_array_length(items) as items_count,
    items,
    total,
    created_at
FROM orders
WHERE
    jsonb_array_length(items) = 0
    OR items = '[]'::jsonb
    OR total > 0 AND jsonb_array_length(items) = 0
ORDER BY created_at DESC
LIMIT 10;

-- 3️⃣ CHECK FOR NUMERIC DATA TYPE ISSUES
-- ────────────────────────────────────────────────────────────────
-- Find orders where numeric fields might have invalid values
SELECT
    id,
    "clientName",
    subtotal,
    pg_typeof(subtotal) as subtotal_type,
    discount,
    pg_typeof(discount) as discount_type,
    tip,
    pg_typeof(tip) as tip_type,
    total,
    pg_typeof(total) as total_type
FROM orders
WHERE
    subtotal::text !~ '^[0-9]+\.?[0-9]*$'
    OR total::text !~ '^[0-9]+\.?[0-9]*$'
ORDER BY created_at DESC
LIMIT 10;

-- 4️⃣ CHECK FOR CALCULATION MISMATCHES
-- ────────────────────────────────────────────────────────────────
-- Find orders where total != subtotal - discount + tip
SELECT
    id,
    "clientName",
    subtotal,
    discount,
    tip,
    total,
    (subtotal - discount + tip) as calculated_total,
    ABS(total - (subtotal - discount + tip)) as difference,
    created_at
FROM orders
WHERE
    ABS(total - (subtotal - COALESCE(discount, 0) + COALESCE(tip, 0))) > 0.01
ORDER BY difference DESC
LIMIT 20;

-- 5️⃣ SUMMARY STATISTICS
-- ────────────────────────────────────────────────────────────────
SELECT
    COUNT(*) as total_orders,
    COUNT(CASE WHEN items IS NULL THEN 1 END) as null_items_count,
    COUNT(CASE WHEN subtotal IS NULL THEN 1 END) as null_subtotal_count,
    COUNT(CASE WHEN discount IS NULL THEN 1 END) as null_discount_count,
    COUNT(CASE WHEN tip IS NULL THEN 1 END) as null_tip_count,
    COUNT(CASE WHEN total IS NULL THEN 1 END) as null_total_count,
    COUNT(CASE WHEN created_at IS NULL THEN 1 END) as null_date_count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders;

-- 6️⃣ FIX SCRIPT: Update NULL values to defaults
-- ────────────────────────────────────────────────────────────────
-- ⚠️ ONLY RUN THIS IF YOU FOUND ISSUES IN CHECKS 1-4
--
-- UPDATE orders
-- SET
--     discount = COALESCE(discount, 0),
--     tip = COALESCE(tip, 0)
-- WHERE
--     discount IS NULL
--     OR tip IS NULL;
--
-- -- Verify fix
-- SELECT COUNT(*) as fixed_count
-- FROM orders
-- WHERE discount = 0 OR tip = 0;
