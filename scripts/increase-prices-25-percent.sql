-- Increase all product prices by 25% to reach break-even point
-- Executed on: 2026-01-07
-- Reason: Business requirement to reach break-even point

-- Show current prices before update
SELECT
    id,
    name,
    price AS old_price,
    ROUND(price * 1.25, 2) AS new_price,
    ROUND((price * 1.25) - price, 2) AS increase
FROM products
ORDER BY category, name;

-- Update all product prices by multiplying by 1.25 (25% increase)
UPDATE products
SET
    price = ROUND(price * 1.25, 2),
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
