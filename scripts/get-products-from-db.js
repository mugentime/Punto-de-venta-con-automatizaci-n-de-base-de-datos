import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function getProductsFromDB() {
    // Use Railway's DATABASE_URL from environment
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔗 Conectando a base de datos de producción...\n');

        const client = await pool.connect();
        console.log('✅ Conectado exitosamente\n');

        const result = await client.query(`
            SELECT id, name, category, price, cost, stock
            FROM products
            ORDER BY category, name
        `);

        console.log('📊 PRODUCTOS EN BASE DE DATOS:\n');
        console.log('═'.repeat(80));
        console.log('ID'.padEnd(8) + 'Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Precio');
        console.log('─'.repeat(80));

        result.rows.forEach(p => {
            const price = `$${parseFloat(p.price).toFixed(2)}`;
            console.log(
                p.id.toString().padEnd(8) +
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                price.padStart(10)
            );
        });

        console.log('\n📊 Total de productos:', result.rows.length);

        // Calculate preview
        console.log('\n💰 NUEVOS PRECIOS (+25%, FLOOR, SIN DECIMALES):\n');
        console.log('═'.repeat(80));
        console.log('Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Actual → Nuevo');
        console.log('─'.repeat(80));

        const csvLines = ['ID,Categoría,Nombre del Producto,Precio Actual,Precio Nuevo (+25%),Aumento,Costo,Margen %'];

        result.rows.forEach(p => {
            const currentPrice = parseFloat(p.price);
            const newPrice = Math.floor(currentPrice * 1.25);
            const increase = newPrice - currentPrice;
            const cost = parseFloat(p.cost || 0);
            const margin = newPrice > 0 ? (((newPrice - cost) / newPrice) * 100).toFixed(2) : '0.00';

            console.log(
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                `$${currentPrice} → $${newPrice} (+$${increase})`
            );

            csvLines.push(`${p.id},${p.category},"${p.name}",$${currentPrice.toFixed(2)},$${newPrice}.00,$${increase}.00,$${cost.toFixed(2)},${margin}%`);
        });

        // Save CSV
        const fs = await import('fs');
        const csvContent = csvLines.join('\n');
        fs.writeFileSync('docs/precios-reales-25-porciento.csv', csvContent);

        console.log('\n✅ CSV guardado en: docs/precios-reales-25-porciento.csv');

        client.release();
        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

getProductsFromDB();
