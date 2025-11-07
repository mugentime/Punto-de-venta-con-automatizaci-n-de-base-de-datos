-- Rollback for Migration 002: Drop stored procedures

BEGIN;

DROP FUNCTION IF EXISTS create_order_atomic CASCADE;

COMMIT;
