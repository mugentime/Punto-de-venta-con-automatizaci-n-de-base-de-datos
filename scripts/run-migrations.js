const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration(migrationFile, databaseUrl) {
    console.log(`🔗 Connecting to: ${databaseUrl.substring(0, 40)}...`);

    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log(`\n✅ Connected to database`);

        const sqlPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`📄 Executing migration: ${migrationFile}`);
        await client.query(sql);
        console.log(`✅ Migration completed: ${migrationFile}\n`);
    } catch (error) {
        console.error(`❌ Error executing migration ${migrationFile}:`);
        console.error('Error details:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        await client.end();
    }
}

async function main() {
    const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ Please provide DATABASE_URL as argument or environment variable');
        console.error('Usage: node run-migrations.js <DATABASE_URL>');
        process.exit(1);
    }

    const migrations = [
        '001_add_idempotency_table.sql',
        '002_create_stored_procedures.sql',
        '003_add_performance_indexes.sql'
    ];

    console.log('🗄️  Starting database migrations...\n');

    for (const migration of migrations) {
        await runMigration(migration, databaseUrl);
    }

    console.log('✅ All migrations completed successfully!');
}

main().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
