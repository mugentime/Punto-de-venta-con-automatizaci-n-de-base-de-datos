-- Rollback for Migration 003: Drop performance indexes

BEGIN;

DROP INDEX CONCURRENTLY IF EXISTS idx_customer_credits_order;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_credits_customer;
DROP INDEX CONCURRENTLY IF EXISTS idx_coworking_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_created_at;

COMMIT;
