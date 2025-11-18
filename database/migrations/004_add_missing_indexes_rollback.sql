-- Rollback for Migration 004: Remove performance indexes

BEGIN;

DROP INDEX CONCURRENTLY IF EXISTS idx_orders_userId;
DROP INDEX CONCURRENTLY IF EXISTS idx_customers_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_expenses_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_coworking_sessions_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_cash_sessions_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_cash_sessions_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_cash_withdrawals_sessionId;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_created_at_userId;

COMMIT;
