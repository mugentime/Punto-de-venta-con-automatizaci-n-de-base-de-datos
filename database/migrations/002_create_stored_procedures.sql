-- Migration 002: Create stored procedures for atomic operations
-- This migration adds the create_order_atomic stored procedure

BEGIN;

\i database/procedures/create_order_atomic.sql

COMMIT;
