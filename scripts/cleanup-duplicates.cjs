const { Client } = require('pg');
require('dotenv').config();

async function cleanupDuplicates() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✅ Connected to database');

  // Find and delete duplicate orders
  // Keep the first occurrence (smallest ID), delete the rest
  const findDuplicatesQuery = `
    WITH duplicates AS (
      SELECT
        id,
        client_name,
        total,
        created_at,
        FLOOR(EXTRACT(EPOCH FROM created_at)) as timestamp_sec,
        ROW_NUMBER() OVER (
          PARTITION BY client_name, total, FLOOR(EXTRACT(EPOCH FROM created_at))
          ORDER BY id ASC
        ) as row_num
      FROM orders
    )
    SELECT id, client_name, total, created_at
    FROM duplicates
    WHERE row_num > 1
    ORDER BY created_at DESC;
  `;

  const duplicates = await client.query(findDuplicatesQuery);
  console.log(`\n📊 Found ${duplicates.rows.length} duplicate orders to delete:`);

  if (duplicates.rows.length === 0) {
    console.log('✅ No duplicates found!');
    await client.end();
    return;
  }

  // Show duplicates
  duplicates.rows.forEach((dup, idx) => {
    console.log(`${idx + 1}. ID: ${dup.id}, Client: ${dup.client_name}, Total: $${dup.total}, Date: ${dup.created_at}`);
  });

  // Delete duplicates
  console.log(`\n🗑️ Deleting ${duplicates.rows.length} duplicate orders...`);

  const deleteQuery = `
    WITH duplicates AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY client_name, total, FLOOR(EXTRACT(EPOCH FROM created_at))
          ORDER BY id ASC
        ) as row_num
      FROM orders
    )
    DELETE FROM orders
    WHERE id IN (
      SELECT id FROM duplicates WHERE row_num > 1
    )
    RETURNING id, client_name, total;
  `;

  const deleteResult = await client.query(deleteQuery);
  console.log(`\n✅ Deleted ${deleteResult.rows.length} duplicate orders:`);
  deleteResult.rows.forEach((deleted, idx) => {
    console.log(`${idx + 1}. ID: ${deleted.id}, Client: ${deleted.client_name}, Total: $${deleted.total}`);
  });

  // Verify no duplicates remain
  const verifyQuery = await client.query(findDuplicatesQuery);
  console.log(`\n🔍 Verification: ${verifyQuery.rows.length} duplicates remaining (should be 0)`);

  await client.end();
  console.log('\n✅ Cleanup complete!');
}

cleanupDuplicates().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
