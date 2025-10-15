import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function addCashWithdrawalsTable() {
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
                WHERE table_name = 'cash_withdrawals'
            );
        `);

        if (checkTable.rows[0].exists) {
            console.log('ℹ️  cash_withdrawals table already exists');
            client.release();
            await pool.end();
            return;
        }

        console.log('📝 Creating cash_withdrawals table...');

        // Create cash_withdrawals table for tracking cash taken out during session
        await client.query(`
            CREATE TABLE cash_withdrawals (
                id VARCHAR(255) PRIMARY KEY,
                cash_session_id VARCHAR(255) NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                description TEXT NOT NULL,
                withdrawn_by VARCHAR(255),
                withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_cash_session
                    FOREIGN KEY (cash_session_id)
                    REFERENCES cash_sessions(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_withdrawn_by
                    FOREIGN KEY (withdrawn_by)
                    REFERENCES users(id)
                    ON DELETE SET NULL,
                CONSTRAINT check_positive_amount CHECK (amount > 0)
            );
        `);

        console.log('✅ cash_withdrawals table created successfully');

        // Create index on cash_session_id for faster queries
        await client.query(`
            CREATE INDEX idx_cash_withdrawals_session ON cash_withdrawals(cash_session_id);
        `);

        console.log('✅ Index created on cash_withdrawals.cash_session_id');

        // Create index on withdrawn_at
        await client.query(`
            CREATE INDEX idx_cash_withdrawals_date ON cash_withdrawals(withdrawn_at DESC);
        `);

        console.log('✅ Index created on cash_withdrawals.withdrawn_at');

        console.log(`
✅ Migration Complete!

📋 Next Steps:
1. Add API endpoints in server.js:
   - GET /api/cash-withdrawals (list all withdrawals)
   - GET /api/cash-withdrawals/session/:sessionId (get withdrawals for session)
   - POST /api/cash-withdrawals (create new withdrawal)
   - DELETE /api/cash-withdrawals/:id (delete withdrawal)

2. Update CashReportScreen to show withdrawal button and list

3. Update cash session closure logic to account for withdrawals

📊 Table Structure:
- Tracks cash withdrawals during an active session
- Links to cash_sessions with CASCADE delete
- Stores amount, description, and who withdrew
- Automatically timestamps each withdrawal
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
addCashWithdrawalsTable().then(() => {
    console.log('🎉 Cash withdrawals table migration completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
