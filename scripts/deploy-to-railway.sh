#!/bin/bash
# Deployment Script for Railway - POS Conejo Negro
# Run this script to deploy all phases to Railway

set -e  # Exit on error

echo "🚀 Starting Railway Deployment Process"
echo "========================================"
echo ""

# Step 1: Link to Railway project
echo "📡 Step 1: Linking to Railway project..."
echo "Please select 'POS.CLAUDE' from the list"
railway link

# Verify link
echo ""
echo "✅ Project linked. Current status:"
railway status
echo ""

# Step 2: Run database migrations
echo "🗄️  Step 2: Running database migrations..."
echo ""

echo "→ Migration 1/3: Creating idempotency_keys table..."
railway run psql \$DATABASE_URL -f database/migrations/001_add_idempotency_table.sql
echo "✅ Idempotency table created"
echo ""

echo "→ Migration 2/3: Creating stored procedures..."
railway run psql \$DATABASE_URL -f database/migrations/002_create_stored_procedures.sql
echo "✅ Stored procedures created"
echo ""

echo "→ Migration 3/3: Adding performance indexes..."
railway run psql \$DATABASE_URL -f database/migrations/003_add_performance_indexes.sql
echo "✅ Performance indexes added"
echo ""

# Step 3: Verify migrations
echo "🔍 Step 3: Verifying migrations..."
railway run psql \$DATABASE_URL -c "\\dt idempotency_keys"
railway run psql \$DATABASE_URL -c "\\df create_order_atomic"
echo "✅ Migrations verified"
echo ""

# Step 4: Deploy application
echo "🚢 Step 4: Deploying application to Railway..."
railway up --detach
echo "✅ Deployment triggered"
echo ""

# Step 5: Monitor deployment
echo "📊 Step 5: Monitoring deployment logs..."
echo "Press Ctrl+C to stop monitoring (deployment will continue)"
railway logs

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Open your Railway dashboard to verify deployment status"
echo "2. Run smoke tests (see DEPLOYMENT_COMPLETE.md)"
echo "3. Monitor for any errors in the first hour"
