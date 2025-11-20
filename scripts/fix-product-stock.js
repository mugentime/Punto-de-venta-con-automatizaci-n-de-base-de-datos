#!/usr/bin/env node
/**
 * Fix Product Stock Levels
 *
 * This script updates products with zero or negative stock to have reasonable inventory levels.
 *
 * Usage:
 *   railway run node scripts/fix-product-stock.js
 */

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not found');
  console.error('Please run: railway run node scripts/fix-product-stock.js');
  process.exit(1);
}

console.log('🔌 Connecting to Railway PostgreSQL database...\n');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixProductStock() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking current stock levels...\n');

    // Query products with low/zero stock
    const lowStockResult = await client.query(`
      SELECT id, name, stock, category, price
      FROM products
      WHERE stock <= 0
      ORDER BY name;
    `);

    if (lowStockResult.rows.length === 0) {
      console.log('✅ All products have positive stock! No updates needed.\n');
      return;
    }

    console.log(`⚠️  Found ${lowStockResult.rows.length} products with zero or negative stock:\n`);
    lowStockResult.rows.forEach(product => {
      console.log(`   - ${product.name} (${product.category}): ${product.stock} units [ID: ${product.id}]`);
    });

    console.log('\n📦 Updating stock levels...\n');

    // Set default stock based on category
    const updateResult = await client.query(`
      UPDATE products
      SET stock = CASE
        WHEN category = 'Cafetería' THEN 100
        WHEN category = 'Alimentos' THEN 50
        WHEN category = 'Refrigerador' THEN 60
        WHEN category = 'Membresías' THEN 100
        ELSE 75
      END
      WHERE stock <= 0
      RETURNING id, name, stock, category;
    `);

    console.log('✅ Stock levels updated successfully!\n');
    console.log(`📊 Updated ${updateResult.rows.length} products:\n`);
    updateResult.rows.forEach(product => {
      console.log(`   ✓ ${product.name}: ${product.stock} units (${product.category})`);
    });

    // Show summary of all products
    console.log('\n📋 Current stock summary:\n');
    const summaryResult = await client.query(`
      SELECT
        category,
        COUNT(*) as product_count,
        SUM(stock) as total_units,
        AVG(stock) as avg_stock_per_product
      FROM products
      GROUP BY category
      ORDER BY category;
    `);

    summaryResult.rows.forEach(row => {
      console.log(`   ${row.category}:`);
      console.log(`      Products: ${row.product_count}`);
      console.log(`      Total units: ${row.total_units}`);
      console.log(`      Avg per product: ${parseFloat(row.avg_stock_per_product).toFixed(1)}`);
      console.log('');
    });

    console.log('🎉 Product stock fix completed successfully!');
    console.log('✅ You can now process sales without stock errors.');

  } catch (error) {
    console.error('❌ Error fixing product stock:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixProductStock().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
