-- Migration 004: Fix idempotency_keys table schema
-- Ensures the order_id column exists in the idempotency_keys table

BEGIN;

-- Drop existing table if it has incorrect schema
DROP TABLE IF EXISTS idempotency_keys CASCADE;

-- Recreate table with correct schema
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL DEFAULT 'order',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  response_data JSONB
);

-- Index for efficient expiration cleanup
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Index for querying by resource type and creation date
CREATE INDEX idx_idempotency_resource ON idempotency_keys(resource_type, created_at);

-- Index for querying by order_id
CREATE INDEX idx_idempotency_order ON idempotency_keys(order_id);

COMMIT;
