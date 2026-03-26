const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:CdSUGzLIGZhijHJPPTsLVVJjDvtWawvg@yamabiko.proxy.rlwy.net:45660/railway',
  ssl: {
    rejectUnauthorized: false,
    require: true,
    servername: undefined,
    checkServerIdentity: () => undefined
  }
});

async function checkSchema() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verificando esquema de la base de datos...\n');

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tablas encontradas:\n');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('\n📊 Columnas por tabla:\n');

    // For each table, show columns
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      console.log(`\n🔹 ${tableName} (${columnsResult.rows.length} columnas):`);
      columnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ', NOT NULL' : ''})`);
      });

      // Count records
      const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`   📊 Registros: ${countResult.rows[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
