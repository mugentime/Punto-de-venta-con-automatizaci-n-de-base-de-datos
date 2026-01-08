// Execute the price increase UPDATE on PostgreSQL
import pg from 'pg';

const { Pool } = pg;

const DATABASE_PUBLIC_URL = 'postgresql://postgres:CdSUGzLIGZhijHJPPTsLVVJjDvtWawvg@yamabiko.proxy.rlwy.net:45660/railway';

const pool = new Pool({
    connectionString: DATABASE_PUBLIC_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function main() {
    try {
        console.log('🔌 Conectando a PostgreSQL de Railway...\n');

        // Get products before update
        console.log('📊 Precios ANTES del aumento:\n');
        const before = await pool.query(`
            SELECT id, name, category, price
            FROM products
            ORDER BY category, name
        `);

        console.log('═'.repeat(70));
        console.log('ID'.padEnd(8) + 'Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Precio');
        console.log('─'.repeat(70));
        before.rows.forEach(p => {
            console.log(
                p.id.toString().padEnd(8) +
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                `$${parseFloat(p.price).toFixed(2)}`
            );
        });

        // Execute UPDATE with FLOOR
        console.log('\n🚀 EJECUTANDO AUMENTO DE PRECIOS DEL 25%...\n');
        const updateResult = await pool.query(`
            UPDATE products
            SET price = FLOOR(price * 1.25)
            RETURNING id, name, category, price
        `);

        console.log(`✅ ${updateResult.rowCount} productos actualizados exitosamente!\n`);

        // Get products after update
        console.log('📊 Precios DESPUÉS del aumento:\n');
        console.log('═'.repeat(70));
        console.log('ID'.padEnd(8) + 'Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Nuevo Precio');
        console.log('─'.repeat(70));
        updateResult.rows.forEach(p => {
            console.log(
                p.id.toString().padEnd(8) +
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                `$${p.price}`
            );
        });

        // Get summary statistics
        const summary = await pool.query(`
            SELECT
                COUNT(*) as total_products,
                ROUND(AVG(price), 2) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM products
        `);

        console.log('\n📈 RESUMEN FINAL:\n');
        console.log('═'.repeat(50));
        console.log(`   Total productos: ${summary.rows[0].total_products}`);
        console.log(`   Precio promedio: $${summary.rows[0].avg_price}`);
        console.log(`   Precio mínimo: $${summary.rows[0].min_price}`);
        console.log(`   Precio máximo: $${summary.rows[0].max_price}`);
        console.log('═'.repeat(50));

        console.log('\n✅ ¡AUMENTO DE PRECIOS COMPLETADO EXITOSAMENTE!\n');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

main();
