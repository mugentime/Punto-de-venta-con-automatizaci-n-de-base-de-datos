const { Client } = require('pg');

async function inspectSchema(databaseUrl) {
    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Get all tables
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        console.log('📊 Tables in database:');
        for (const row of tablesResult.rows) {
            console.log(`  - ${row.table_name}`);
        }

        console.log('\n📋 Table structures:\n');

        // For each table, get columns
        for (const tableRow of tablesResult.rows) {
            const tableName = tableRow.table_name;

            const columnsResult = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                ORDER BY ordinal_position;
            `, [tableName]);

            console.log(`\n${tableName}:`);
            for (const col of columnsResult.rows) {
                console.log(`  - ${col.column_name} (${col.data_type}${col.is_nullable === 'YES' ? ', nullable' : ''})`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

const databaseUrl = process.argv[2] || process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('❌ Please provide DATABASE_URL');
    process.exit(1);
}

inspectSchema(databaseUrl);
