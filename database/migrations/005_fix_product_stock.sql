-- Migration 005: Fix Product Stock Levels
-- Updates products with zero or negative stock to reasonable inventory levels

BEGIN;

-- Show current stock status before update
DO $$
DECLARE
  low_stock_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO low_stock_count FROM products WHERE stock <= 0;
  RAISE NOTICE 'Products with zero/negative stock: %', low_stock_count;
END $$;

-- Update stock levels based on category
UPDATE products
SET stock = CASE
  WHEN category = 'Cafetería' THEN 100
  WHEN category = 'Alimentos' THEN 50
  WHEN category = 'Refrigerador' THEN 60
  WHEN category = 'Membresías' THEN 100
  ELSE 75
END
WHERE stock <= 0;

-- Show results
DO $$
DECLARE
  total_products INTEGER;
  min_stock INTEGER;
BEGIN
  SELECT COUNT(*), MIN(stock) INTO total_products, min_stock FROM products;
  RAISE NOTICE 'Total products: %, Minimum stock: %', total_products, min_stock;
END $$;

COMMIT;
