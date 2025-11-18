import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function addCashRegistryTable() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable not set');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: databaseUrl,
        max: 5,
        connectionTimeoutMillis: 10000,
    });

    try {
        console.log('🔍 Connecting to database...');
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');

        // Check if table already exists
        const checkTable = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'cash_registry'
            );
        `);

        if (checkTable.rows[0].exists) {
            console.log('ℹ️  cash_registry table already exists');
            client.release();
            await pool.end();
            return;
        }

        console.log('📝 Creating cash_registry table...');

        // Create cash_registry table for daily cash tracking
        await client.query(`
            CREATE TABLE cash_registry (
                id VARCHAR(255) PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                opening_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
                closing_balance NUMERIC(10, 2),
                expected_balance NUMERIC(10, 2),
                difference NUMERIC(10, 2),
                total_sales NUMERIC(10, 2) DEFAULT 0,
                total_expenses NUMERIC(10, 2) DEFAULT 0,
                total_cash_payments NUMERIC(10, 2) DEFAULT 0,
                total_card_payments NUMERIC(10, 2) DEFAULT 0,
                session_count INTEGER DEFAULT 0,
                notes TEXT,
                status VARCHAR(50) DEFAULT 'open',
                opened_by VARCHAR(255),
                closed_by VARCHAR(255),
                opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
                CONSTRAINT fk_closed_by FOREIGN KEY (closed_by) REFERENCES users(id),
                CONSTRAINT check_status CHECK (status IN ('open', 'closed')),
                CONSTRAINT check_positive_amounts CHECK (
                    opening_balance >= 0 AND
                    (closing_balance IS NULL OR closing_balance >= 0) AND
                    total_sales >= 0 AND
                    total_expenses >= 0 AND
                    total_cash_payments >= 0 AND
                    total_card_payments >= 0
                )
            );
        `);

        console.log('✅ cash_registry table created successfully');

        // Create index on date for faster queries
        await client.query(`
            CREATE INDEX idx_cash_registry_date ON cash_registry(date DESC);
        `);

        console.log('✅ Index created on cash_registry.date');

        // Create index on status
        await client.query(`
            CREATE INDEX idx_cash_registry_status ON cash_registry(status);
        `);

        console.log('✅ Index created on cash_registry.status');

        // Add foreign key to cash_sessions to link to daily registry
        console.log('📝 Adding cash_registry_id column to cash_sessions...');

        try {
            await client.query(`
                ALTER TABLE cash_sessions
                ADD COLUMN "cashRegistryId" VARCHAR(255),
                ADD CONSTRAINT fk_cash_registry
                    FOREIGN KEY ("cashRegistryId")
                    REFERENCES cash_registry(id)
                    ON DELETE SET NULL;
            `);
            console.log('✅ Added cashRegistryId to cash_sessions table');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('ℹ️  cashRegistryId column already exists');
            } else {
                throw err;
            }
        }

        // Create API endpoint helper comment
        console.log(`
✅ Migration Complete!

📋 Next Steps:
1. Add API endpoints in server.js:
   - GET /api/cash-registry (list all registries)
   - GET /api/cash-registry/:id (get specific registry)
   - GET /api/cash-registry/date/:date (get by date)
   - POST /api/cash-registry (create new registry)
   - PUT /api/cash-registry/:id (update registry)
   - POST /api/cash-registry/:id/close (close daily registry)

2. Update frontend to use new cash_registry table

3. Link cash_sessions to cash_registry when creating sessions

📊 Table Structure:
- Tracks ONE registry entry per DAY
- Multiple cash_sessions can belong to one registry
- Tracks opening/closing balances for the entire day
- Aggregates all sales, expenses, and payments
- Foreign keys to users for accountability
`);

        client.release();
        await pool.end();
        console.log('✅ Database connection closed');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

// Run the migration
addCashRegistryTable().then(() => {
    console.log('🎉 Cash registry table migration completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
