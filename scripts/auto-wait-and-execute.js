// Auto wait for deployment and execute price increase

const API_PRODUCTS = 'https://hotfix-production.up.railway.app/api/products';
const API_INCREASE = 'https://hotfix-production.up.railway.app/api/products/increase-prices';
const MAX_WAIT = 180000; // 3 minutes
const CHECK_INTERVAL = 10000; // 10 seconds

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDeployment() {
    console.log('⏳ Esperando a que el deployment esté listo...\n');
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT) {
        try {
            const response = await fetch(API_PRODUCTS);

            if (response.ok) {
                console.log('✅ ¡Deployment exitoso! API respondiendo correctamente.\n');
                return true;
            }

            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`   ⏸️  Esperando... (${elapsed}s transcurridos)`);

        } catch (error) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`   ⏸️  Esperando... (${elapsed}s transcurridos)`);
        }

        await sleep(CHECK_INTERVAL);
    }

    return false;
}

async function getProducts() {
    console.log('🔍 Obteniendo productos de la base de datos...\n');

    const response = await fetch(API_PRODUCTS);
    const products = await response.json();

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

        const newPrice = Math.floor(currentPrice * 1.25);
        const increase = newPrice - currentPrice;
        const margin = newPrice > 0 ? (((newPrice - cost) / newPrice) * 100).toFixed(2) : '0.00';

        csvLines.push(`${p.id},${p.category},"${p.name}",$${currentPrice.toFixed(2)},$${newPrice},$${increase},$${cost.toFixed(2)},${margin}%`);
    });

    console.log('\n📊 Total de productos:', products.length);

    // Save CSV
    const fs = require('fs');
    fs.writeFileSync('docs/precios-reales-25-porciento.csv', csvLines.join('\n'));
    console.log('\n✅ CSV guardado: docs/precios-reales-25-porciento.csv');

    return products;
}

async function executePriceIncrease() {
    console.log('\n🚀 EJECUTANDO AUMENTO DE PRECIOS DEL 25%...\n');

    const response = await fetch(API_INCREASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: 25 })
    });

    if (!response.ok) {
        throw new Error(`Error al ejecutar aumento: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ ¡AUMENTO COMPLETADO EXITOSAMENTE!\n');
    console.log('═'.repeat(90));
    console.log(`\n📊 Resumen:`);
    console.log(`   - Productos actualizados: ${result.productsUpdated}`);
    console.log(`   - Precio promedio: $${result.summary.avg_price}`);
    console.log(`   - Precio mínimo: $${result.summary.min_price}`);
    console.log(`   - Precio máximo: $${result.summary.max_price}`);

    console.log('\n📋 PRECIOS FINALES:\n');
    console.log('═'.repeat(90));
    console.log('Categoría'.padEnd(15) + 'Producto'.padEnd(40) + 'Nuevo Precio');
    console.log('─'.repeat(90));

    result.after.forEach(p => {
        console.log(
            p.category.padEnd(15) +
            p.name.padEnd(40) +
            `$${p.price}`
        );
    });

    return result;
}

async function main() {
    try {
        // Wait for deployment
        const ready = await waitForDeployment();

        if (!ready) {
            throw new Error('Timeout: Deployment no completado en 3 minutos');
        }

        // Get and show products
        await getProducts();

        // Execute price increase
        await executePriceIncrease();

        console.log('\n✅ ¡PROCESO COMPLETADO EXITOSAMENTE!');
        console.log('\n📄 Revisa el archivo: docs/precios-reales-25-porciento.csv');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();
