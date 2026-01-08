import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function increasePrices() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('🔗 Connecting to database...');
        const client = await pool.connect();
        console.log('✅ Connected successfully\n');

        // Show current prices
        console.log('📊 CURRENT PRICES:');
        console.log('─'.repeat(80));
        const currentPrices = await client.query(`
            SELECT id, name, category, price
            FROM products
            ORDER BY category, name
        `);
        currentPrices.rows.forEach(p => {
            console.log(`${p.category.padEnd(15)} | ${p.name.padEnd(30)} | $${p.price.toString().padStart(6)}`);
        });

        console.log('\n💰 CALCULATING 25% INCREASE:');
        console.log('─'.repeat(80));
        const preview = await client.query(`
            SELECT
                id,
                name,
                category,
                price AS old_price,
                ROUND(price * 1.25, 2) AS new_price,
                ROUND((price * 1.25) - price, 2) AS increase
            FROM products
            ORDER BY category, name
        `);
        preview.rows.forEach(p => {
            console.log(`${p.category.padEnd(15)} | ${p.name.padEnd(30)} | $${p.old_price.toString().padStart(6)} → $${p.new_price.toString().padStart(6)} (+$${p.increase})`);
        });

        // Confirm with user (in production, this would be automatic)
        console.log('\n⚠️  UPDATING ALL PRICES BY 25%...');

        // Execute update
        const result = await client.query(`
            UPDATE products
            SET
                price = ROUND(price * 1.25, 2),
                updated_at = CURRENT_TIMESTAMP
        `);

        console.log(`✅ Updated ${result.rowCount} products\n`);

        // Show new prices
        console.log('📊 NEW PRICES:');
        console.log('─'.repeat(80));
        const newPrices = await client.query(`
            SELECT
                id,
                name,
                category,
                price AS new_price,
                cost,
                ROUND(((price - cost) / NULLIF(price, 0)) * 100, 2) AS margin_percentage
            FROM products
            ORDER BY category, name
        `);
        newPrices.rows.forEach(p => {
            const margin = p.margin_percentage || 0;
            console.log(`${p.category.padEnd(15)} | ${p.name.padEnd(30)} | $${p.new_price.toString().padStart(6)} | Margin: ${margin.toString().padStart(5)}%`);
        });

        // Summary
        const summary = await client.query(`
            SELECT
                COUNT(*) AS total_products,
                ROUND(AVG(price), 2) AS avg_price,
                ROUND(MIN(price), 2) AS min_price,
                ROUND(MAX(price), 2) AS max_price
            FROM products
        `);

        console.log('\n📈 SUMMARY:');
        console.log('─'.repeat(80));
        console.log(`Total products: ${summary.rows[0].total_products}`);
        console.log(`Average price: $${summary.rows[0].avg_price}`);
        console.log(`Min price: $${summary.rows[0].min_price}`);
        console.log(`Max price: $${summary.rows[0].max_price}`);

        client.release();
        console.log('\n✅ Price increase completed successfully!');
    } catch (error) {
        console.error('❌ Error updating prices:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

increasePrices();
