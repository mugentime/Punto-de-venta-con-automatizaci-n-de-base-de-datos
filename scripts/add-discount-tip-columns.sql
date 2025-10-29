-- Migration script to add discount and tip columns to orders table
-- Run this on your Railway PostgreSQL database

-- Add discount column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'orders' AND column_name = 'discount') THEN
        ALTER TABLE orders ADD COLUMN discount NUMERIC(10, 2) DEFAULT 0;
        RAISE NOTICE 'Added discount column to orders table';
    ELSE
        RAISE NOTICE 'discount column already exists';
    END IF;
END $$;

-- Add tip column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'orders' AND column_name = 'tip') THEN
        ALTER TABLE orders ADD COLUMN tip NUMERIC(10, 2) DEFAULT 0;
        RAISE NOTICE 'Added tip column to orders table';
    ELSE
        RAISE NOTICE 'tip column already exists';
    END IF;
END $$;

-- Update existing orders to set discount = 0 and tip = 0 if they are null
UPDATE orders SET discount = 0 WHERE discount IS NULL;
UPDATE orders SET tip = 0 WHERE tip IS NULL;

RAISE NOTICE 'Migration completed successfully';
