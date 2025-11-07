-- Rollback for Migration 001: Remove idempotency_keys table

BEGIN;

DROP INDEX IF EXISTS idx_idempotency_resource;
DROP INDEX IF EXISTS idx_idempotency_expires;
DROP TABLE IF EXISTS idempotency_keys;

COMMIT;
