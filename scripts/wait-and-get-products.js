// Wait for deployment and get real products from production

const API_URL = 'https://hotfix-production.up.railway.app/api/products';
const MAX_RETRIES = 10;
const RETRY_DELAY = 15000; // 15 seconds

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitAndGetProducts() {
    console.log('⏳ Esperando a que el deployment finalice...\n');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🔍 Intento ${attempt}/${MAX_RETRIES} - Consultando API...`);

            const response = await fetch(API_URL);

            if (response.ok) {
                const products = await response.json();

                console.log('\n✅ ¡DEPLOYMENT COMPLETADO! Productos obtenidos.\n');
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

                // Calculate preview
                console.log('\n💰 NUEVOS PRECIOS (+25%, FLOOR, SIN DECIMALES):\n');
                console.log('═'.repeat(80));
                console.log('Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Actual → Nuevo');
                console.log('─'.repeat(80));

                const csvLines = ['ID,Categoría,Nombre del Producto,Precio Actual,Precio Nuevo (+25%),Aumento,Costo,Margen %'];

                products.forEach(p => {
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
                const fs = require('fs');
                const csvContent = csvLines.join('\n');
                fs.writeFileSync('docs/precios-reales-25-porciento.csv', csvContent);

                console.log('\n✅ CSV guardado en: docs/precios-reales-25-porciento.csv');

                return products;
            }

            console.log(`   ⏸️  Deployment aún no listo (${response.status}), esperando ${RETRY_DELAY/1000}s...\n`);

        } catch (error) {
            console.log(`   ⏸️  Error: ${error.message}, reintentando en ${RETRY_DELAY/1000}s...\n`);
        }

        if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY);
        }
    }

    throw new Error('❌ Timeout: El deployment no finalizó en el tiempo esperado');
}

waitAndGetProducts()
    .then(() => {
        console.log('\n✅ Proceso completado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n' + error.message);
        process.exit(1);
    });
