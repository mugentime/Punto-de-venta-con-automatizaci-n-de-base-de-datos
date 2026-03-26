-- Migration: Recalculate missing discounts for customer orders
-- Description: Updates orders that belong to customers with discount percentage but have discount = 0
-- Author: Claude Code
-- Date: 2026-03-25

-- Report affected orders
DO $$
DECLARE
    missing_discount_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_discount_count
    FROM orders o
    INNER JOIN customers c ON o."customerId" = c.id
    WHERE c."discountPercentage" > 0
      AND (o.discount IS NULL OR o.discount = 0);

    RAISE NOTICE 'Found % orders with missing discount calculation', missing_discount_count;
END $$;

-- Update orders to add the correct discount value (for display purposes only)
-- This does NOT change the total - it just marks what discount was applied
UPDATE orders o
SET discount = (o.subtotal * (c."discountPercentage" / 100))
FROM customers c
WHERE o."customerId" = c.id
  AND c."discountPercentage" > 0
  AND (o.discount IS NULL OR o.discount = 0);

-- Verify the update
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM orders o
    INNER JOIN customers c ON o."customerId" = c.id
    WHERE c."discountPercentage" > 0
      AND o.discount > 0;

    RAISE NOTICE 'Successfully updated % orders with discount values', updated_count;
END $$;
