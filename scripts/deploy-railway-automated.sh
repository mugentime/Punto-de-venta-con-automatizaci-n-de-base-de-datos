#!/bin/bash
# Automated Railway Deployment Script
set -e

echo "🚀 Starting automated Railway deployment..."
echo ""

# Get DATABASE_URL from Railway
echo "📡 Fetching DATABASE_URL from Railway..."
export DATABASE_URL=$(railway variables --service Postgres get DATABASE_URL 2>/dev/null || railway variables get DATABASE_URL 2>/dev/null)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: Could not fetch DATABASE_URL from Railway"
    echo "Please run manually:"
    echo "  railway variables"
    echo "  Copy DATABASE_URL and export it"
    exit 1
fi

echo "✅ DATABASE_URL obtained"
echo ""

# Execute migrations
echo "🗄️  Executing database migrations..."
echo ""

echo "→ Migration 1/3: Idempotency table..."
psql "$DATABASE_URL" -f database/migrations/001_add_idempotency_table.sql
echo "✅ Migration 1 complete"
echo ""

echo "→ Migration 2/3: Stored procedures..."
psql "$DATABASE_URL" -f database/migrations/002_create_stored_procedures.sql
echo "✅ Migration 2 complete"
echo ""

echo "→ Migration 3/3: Performance indexes..."
psql "$DATABASE_URL" -f database/migrations/003_add_performance_indexes.sql
echo "✅ Migration 3 complete"
echo ""

# Verify migrations
echo "🔍 Verifying migrations..."
psql "$DATABASE_URL" -c "\dt idempotency_keys" | grep idempotency_keys && echo "✅ Idempotency table exists"
psql "$DATABASE_URL" -c "\df create_order_atomic" | grep create_order_atomic && echo "✅ Stored procedure exists"
psql "$DATABASE_URL" -c "\di idx_orders_created_at" | grep idx_orders_created_at && echo "✅ Index exists"
echo ""

# Deploy application
echo "🚢 Deploying application to Railway..."
railway up --detach --service POS.CLAUDE
echo "✅ Deployment triggered"
echo ""

echo "📊 Monitoring deployment logs..."
railway logs --service POS.CLAUDE

echo ""
echo "✅ Deployment complete!"
