// Direct connection to Railway PostgreSQL to get products and increase prices
import pg from 'pg';
import fs from 'fs';

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

        // Get all products
        console.log('📊 Obteniendo productos de la base de datos...\n');
        const result = await pool.query(`
            SELECT id, name, category, price, cost, stock
            FROM products
            ORDER BY category, name
        `);

        const products = result.rows;
        console.log(`✅ ${products.length} productos encontrados\n`);

        // Display current prices
        console.log('═'.repeat(90));
        console.log('ID'.padEnd(8) + 'Categoría'.padEnd(15) + 'Producto'.padEnd(40) + 'Precio'.padEnd(12) + 'Costo');
        console.log('─'.repeat(90));

        const csvLines = ['ID,Categoría,Nombre del Producto,Precio Actual,Precio Nuevo (+25%),Aumento,Costo,Margen %'];

        products.forEach(p => {
            const currentPrice = parseFloat(p.price);
            const cost = parseFloat(p.cost || 0);

            console.log(
                p.id.toString().padEnd(8) +
                p.category.padEnd(15) +
                p.name.padEnd(40) +
                `$${currentPrice.toFixed(2)}`.padEnd(12) +
                `$${cost.toFixed(2)}`
            );

            // Calculate new prices with FLOOR
            const newPrice = Math.floor(currentPrice * 1.25);
            const increase = newPrice - currentPrice;
            const margin = newPrice > 0 ? (((newPrice - cost) / newPrice) * 100).toFixed(2) : '0.00';

            csvLines.push(`${p.id},${p.category},"${p.name}",$${currentPrice.toFixed(2)},$${newPrice},$${increase},$${cost.toFixed(2)},${margin}%`);
        });

        console.log('\n📊 Total de productos:', products.length);

        // Show preview of new prices
        console.log('\n💰 PREVIEW - PRECIOS NUEVOS (+25%, SIN DECIMALES):\n');
        console.log('═'.repeat(90));
        console.log('Categoría'.padEnd(15) + 'Producto'.padEnd(40) + 'Actual → Nuevo (+Aumento)');
        console.log('─'.repeat(90));

        products.forEach(p => {
            const currentPrice = parseFloat(p.price);
            const newPrice = Math.floor(currentPrice * 1.25);
            const increase = newPrice - currentPrice;

            console.log(
                p.category.padEnd(15) +
                p.name.padEnd(40) +
                `$${currentPrice.toFixed(2)} → $${newPrice} (+$${increase})`
            );
        });

        // Save CSV
        const csvContent = csvLines.join('\n');
        fs.writeFileSync('docs/precios-reales-25-porciento.csv', csvContent);
        console.log('\n✅ Archivo CSV guardado: docs/precios-reales-25-porciento.csv');

        // Ask for confirmation before updating
        console.log('\n⚠️  ¿Ejecutar el UPDATE en la base de datos? (Los precios serán redondeados hacia abajo sin decimales)');
        console.log('   Para ejecutar el UPDATE, corre: node scripts/execute-price-update.js\n');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

main();
