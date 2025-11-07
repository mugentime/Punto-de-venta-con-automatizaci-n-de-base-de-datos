-- Migration 003: Add performance indexes for frequently queried columns
-- These indexes improve query performance for order listing, customer lookups, and coworking sessions

BEGIN;

-- Index for orders by creation date (descending for recent orders first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at
ON orders(created_at DESC);

-- Index for orders by customer (for customer history queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id
ON orders("customerId")
WHERE "customerId" IS NOT NULL;

-- Index for coworking sessions by status (for active session queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coworking_status
ON coworking_sessions(status);

-- Index for customer credits by customer (for credit history queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_credits_customer
ON customer_credits("customerId");

-- Index for customer credits by order (for order detail queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_credits_order
ON customer_credits("orderId")
WHERE "orderId" IS NOT NULL;

COMMIT;
