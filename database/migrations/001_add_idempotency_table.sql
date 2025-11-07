-- Migration 001: Add idempotency_keys table for preventing duplicate orders
-- This table stores idempotency keys to ensure order creation is idempotent
-- Keys expire after 24 hours and can be safely cleaned up

BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
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

COMMIT;
