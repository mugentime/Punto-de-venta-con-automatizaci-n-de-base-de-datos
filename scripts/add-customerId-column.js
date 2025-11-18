/**
 * Migration script to add customerId column to orders table
 * This fixes the "column customerId does not exist" error
 */

import pg from 'pg';
const { Pool } = pg;

async function addCustomerIdColumn() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERROR: DATABASE_URL environment variable not set');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: databaseUrl });

    try {
        console.log('🔍 Connecting to database...');
        const client = await pool.connect();

        // Check if customerId column already exists
        const checkColumn = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'orders'
            AND column_name = 'customerId'
        `);

        if (checkColumn.rows.length > 0) {
            console.log('ℹ️  Column customerId already exists in orders table');
        } else {
            console.log('📝 Adding customerId column to orders table...');
            await client.query(`
                ALTER TABLE orders
                ADD COLUMN "customerId" VARCHAR(255)
            `);
            console.log('✅ Successfully added customerId column to orders table');
        }

        client.release();
        await pool.end();

        console.log('\n✨ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
addCustomerIdColumn();
