-- Migration 004: Add missing performance indexes for critical queries
-- These indexes address performance bottlenecks identified in production monitoring

BEGIN;

-- Index for orders by userId (for user-specific order queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_userId
ON orders("userId")
WHERE "userId" IS NOT NULL;

-- Index for customers by name (for alphabetical sorting and search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name
ON customers(name);

-- Index for expenses by creation date (descending for recent expenses first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_created_at
ON expenses(created_at DESC);

-- Index for coworking sessions by creation date (descending for recent sessions first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coworking_sessions_created_at
ON coworking_sessions(created_at DESC);

-- Index for cash sessions by creation date (descending for recent sessions first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_sessions_created_at
ON cash_sessions(created_at DESC);

-- Index for cash sessions by status (for active/closed session queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_sessions_status
ON cash_sessions(status);

-- Index for cash withdrawals by session (for session detail queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_withdrawals_sessionId
ON cash_withdrawals("sessionId")
WHERE "sessionId" IS NOT NULL;

-- Composite index for orders by date range queries (common in reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at_userId
ON orders(created_at DESC, "userId")
WHERE "userId" IS NOT NULL;

COMMIT;
