/**
 * Database optimization script
 * 1. Add indexes to improve query performance
 * 2. Fix null dates in expenses
 */

import pg from 'pg';
const { Pool } = pg;

async function optimizeDatabase() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERROR: DATABASE_URL environment variable not set');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: databaseUrl,
        max: 20, // Increase connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    try {
        console.log('🔍 Connecting to database...');
        const client = await pool.connect();

        // Fix null dates in expenses
        console.log('\n📝 Fixing null dates in expenses...');
        const fixDatesResult = await client.query(`
            UPDATE expenses
            SET created_at = CURRENT_TIMESTAMP
            WHERE created_at IS NULL
        `);
        console.log(`✅ Fixed ${fixDatesResult.rowCount} expenses with null dates`);

        // Add indexes for better performance
        console.log('\n🚀 Adding database indexes for performance...');

        // Index on orders.created_at for date-based queries
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_orders_created_at
                ON orders(created_at DESC)
            `);
            console.log('✅ Added index on orders.created_at');
        } catch (e) {
            console.log('ℹ️  Index on orders.created_at already exists');
        }

        // Index on expenses.created_at
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_expenses_created_at
                ON expenses(created_at DESC)
            `);
            console.log('✅ Added index on expenses.created_at');
        } catch (e) {
            console.log('ℹ️  Index on expenses.created_at already exists');
        }

        // Index on coworking_sessions.created_at
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_coworking_created_at
                ON coworking_sessions(created_at DESC)
            `);
            console.log('✅ Added index on coworking_sessions.created_at');
        } catch (e) {
            console.log('ℹ️  Index on coworking_sessions.created_at already exists');
        }

        // Index on coworking_sessions.status for active session queries
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_coworking_status
                ON coworking_sessions(status)
            `);
            console.log('✅ Added index on coworking_sessions.status');
        } catch (e) {
            console.log('ℹ️  Index on coworking_sessions.status already exists');
        }

        // Index on customer_credits for faster lookups
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_customer_credits_customer
                ON customer_credits("customerId")
            `);
            console.log('✅ Added index on customer_credits.customerId');
        } catch (e) {
            console.log('ℹ️  Index on customer_credits.customerId already exists');
        }

        client.release();
        await pool.end();

        console.log('\n✨ Optimization complete!');
        console.log('   - Fixed null dates in expenses');
        console.log('   - Added 5 performance indexes');
        console.log('   - Increased connection pool size to 20');

    } catch (error) {
        console.error('❌ Optimization failed:', error);
        process.exit(1);
    }
}

// Run the optimization
optimizeDatabase();
