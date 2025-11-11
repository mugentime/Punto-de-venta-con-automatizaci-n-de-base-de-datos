-- Migration 003: Add performance indexes
-- Purpose: Optimize query performance for frequently accessed data

-- Orders table indexes (camelCase column names)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customerId ON orders("customerId");
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders("userId");
CREATE INDEX IF NOT EXISTS idx_orders_paymentMethod ON orders("paymentMethod");
CREATE INDEX IF NOT EXISTS idx_orders_serviceType ON orders("serviceType");

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Cash sessions indexes
CREATE INDEX IF NOT EXISTS idx_cash_sessions_userId ON cash_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_cash_sessions_startTime ON cash_sessions("startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_endTime ON cash_sessions("endTime" DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);

-- Cash registry indexes
CREATE INDEX IF NOT EXISTS idx_cash_registry_date ON cash_registry(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_registry_status ON cash_registry(status);
CREATE INDEX IF NOT EXISTS idx_cash_registry_openedBy ON cash_registry("openedBy");

-- Coworking sessions indexes
CREATE INDEX IF NOT EXISTS idx_coworking_clientName ON coworking_sessions("clientName");
CREATE INDEX IF NOT EXISTS idx_coworking_startTime ON coworking_sessions("startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_coworking_endTime ON coworking_sessions("endTime" DESC);
CREATE INDEX IF NOT EXISTS idx_coworking_status ON coworking_sessions(status);

-- Customer credits indexes
CREATE INDEX IF NOT EXISTS idx_customer_credits_customerId ON customer_credits("customerId");
CREATE INDEX IF NOT EXISTS idx_customer_credits_orderId ON customer_credits("orderId");
CREATE INDEX IF NOT EXISTS idx_customer_credits_type ON customer_credits(type);
CREATE INDEX IF NOT EXISTS idx_customer_credits_status ON customer_credits(status);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses("userId");
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders("userId", created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders("customerId", created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_status ON cash_sessions("userId", status);

COMMENT ON INDEX idx_orders_created_at IS 'Fast date range queries for order history';
COMMENT ON INDEX idx_orders_user_date IS 'Optimized for sales by user reports';
COMMENT ON INDEX idx_orders_customer_date IS 'Optimized for customer order history';
COMMENT ON INDEX idx_cash_sessions_user_status IS 'Fast lookup for active cash sessions by user';
