-- Increase all product prices by 25% to reach break-even point
-- Executed on: 2026-01-07
-- Reason: Business requirement to reach break-even point

-- Show current prices before update
SELECT
    id,
    name,
    price AS old_price,
    FLOOR(price * 1.25) AS new_price,
    FLOOR(price * 1.25) - price AS increase
FROM products
ORDER BY category, name;

-- Update all product prices by multiplying by 1.25 (25% increase)
-- FLOOR rounds down, no decimals
UPDATE products
SET
    price = FLOOR(price * 1.25),
    updated_at = CURRENT_TIMESTAMP;

-- Show updated prices
SELECT
    id,
    name,
    category,
    price AS new_price,
    cost,
    ROUND(((price - cost) / price) * 100, 2) AS margin_percentage
FROM products
ORDER BY category, name;

-- Summary
SELECT
    'Total products updated' AS summary,
    COUNT(*) AS count,
    ROUND(AVG(price), 2) AS avg_new_price
FROM products;
