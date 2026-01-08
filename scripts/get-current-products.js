// Get current products from production database

const API_URL = 'https://hotfix-production.up.railway.app/api/products';

async function getCurrentProducts() {
    try {
        console.log('🔍 Obteniendo productos de la base de datos...\n');

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const products = await response.json();

        console.log('✅ PRODUCTOS EN BASE DE DATOS:\n');
        console.log('═'.repeat(80));
        console.log('ID'.padEnd(8) + 'Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Precio');
        console.log('─'.repeat(80));

        products.forEach(p => {
            const price = `$${parseFloat(p.price).toFixed(2)}`;
            console.log(
                p.id.padEnd(8) +
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                price.padStart(10)
            );
        });

        console.log('\n📊 Total de productos:', products.length);

        // Calculate preview of 25% increase with FLOOR
        console.log('\n💰 PREVIEW - NUEVOS PRECIOS (+25%, FLOOR):\n');
        console.log('═'.repeat(80));
        console.log('Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Actual → Nuevo');
        console.log('─'.repeat(80));

        products.forEach(p => {
            const currentPrice = parseFloat(p.price);
            const newPrice = Math.floor(currentPrice * 1.25);
            const increase = newPrice - currentPrice;
            console.log(
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                `$${currentPrice} → $${newPrice} (+$${increase})`
            );
        });

        // Save to JSON for CSV generation
        const fs = require('fs');
        fs.writeFileSync(
            'docs/current-products.json',
            JSON.stringify(products, null, 2)
        );
        console.log('\n✅ Datos guardados en: docs/current-products.json');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

getCurrentProducts();
