-- Migration 001: Add idempotency_keys table
-- Purpose: Prevent duplicate order creation from double-clicks/retry logic

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    request_data JSONB,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
    status VARCHAR(50) DEFAULT 'pending'
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key);

-- Index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- Cleanup function for expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys for request deduplication';
COMMENT ON COLUMN idempotency_keys.key IS 'Unique idempotency key (UUID v4)';
COMMENT ON COLUMN idempotency_keys.request_data IS 'Original request payload';
COMMENT ON COLUMN idempotency_keys.response_data IS 'Cached response for idempotent requests';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Expiration timestamp (24 hours from creation)';
COMMENT ON COLUMN idempotency_keys.status IS 'Status: pending, completed, failed';
