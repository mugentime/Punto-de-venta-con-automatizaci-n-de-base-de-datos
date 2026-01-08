// Final attempt to get products - try both old and new deployments

const URLS = [
    'https://hotfix-production.up.railway.app/api/products',
    'https://punto-de-venta-con-automatizaci-n-de-base-de-datos-production.up.railway.app/api/products'
];

async function tryGetProducts() {
    console.log('🔍 Intentando obtener productos de múltiples URLs...\n');

    for (const url of URLS) {
        try {
            console.log(`📡 Probando: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            if (response.ok) {
                const products = await response.json();

                console.log('\n✅ ¡PRODUCTOS OBTENIDOS EXITOSAMENTE!\n');
                console.log('═'.repeat(90));
                console.log('ID'.padEnd(8) + 'Categoría'.padEnd(15) + 'Producto'.padEnd(40) + 'Precio'.padEnd(12) + 'Costo');
                console.log('─'.repeat(90));

                const csvLines = ['ID,Categoría,Nombre del Producto,Precio Actual,Precio Nuevo (+25%),Aumento,Costo,Margen %'];

                products.forEach(p => {
                    const currentPrice = parseFloat(p.price);
                    const cost = parseFloat(p.cost || 0);
                    const price = `$${currentPrice.toFixed(2)}`;
                    const costStr = `$${cost.toFixed(2)}`;

                    console.log(
                        p.id.toString().padEnd(8) +
                        p.category.padEnd(15) +
                        p.name.padEnd(40) +
                        price.padEnd(12) +
                        costStr
                    );

                    // Calculate new prices with FLOOR
                    const newPrice = Math.floor(currentPrice * 1.25);
                    const increase = newPrice - currentPrice;
                    const margin = newPrice > 0 ? (((newPrice - cost) / newPrice) * 100).toFixed(2) : '0.00';

                    csvLines.push(`${p.id},${p.category},"${p.name}",$${currentPrice.toFixed(2)},$${newPrice},$${increase},$${cost.toFixed(2)},${margin}%`);
                });

                console.log('\n📊 Total de productos:', products.length);

                // Show preview
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
                const fs = require('fs');
                const csvContent = csvLines.join('\n');
                fs.writeFileSync('docs/precios-reales-25-porciento.csv', csvContent);

                console.log('\n✅ Archivo CSV guardado: docs/precios-reales-25-porciento.csv');
                console.log('\n📄 Puedes abrir el archivo para revisar los precios antes de aplicar el aumento.');

                return products;
            }

            console.log(`   ❌ Status: ${response.status}\n`);

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }
    }

    throw new Error('❌ No se pudo conectar a ningún endpoint de la API');
}

tryGetProducts()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('\n' + error.message);
        console.log('\n💡 Sugerencia: El deployment puede estar aún en proceso.');
        console.log('   Intenta ejecutar este script nuevamente en 1-2 minutos.');
        process.exit(1);
    });
