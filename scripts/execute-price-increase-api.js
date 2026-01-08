// Execute price increase on production via API endpoint

const API_URL = 'https://hotfix-production.up.railway.app/api/products/increase-prices';

async function executePriceIncrease() {
    try {
        console.log('🚀 Ejecutando aumento de precios del 25%...\n');

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ percentage: 25 })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log('✅ AUMENTO DE PRECIOS COMPLETADO\n');
        console.log('═'.repeat(80));
        console.log(`\n📊 Resumen:`);
        console.log(`   - Productos actualizados: ${data.productsUpdated}`);
        console.log(`   - Porcentaje de aumento: ${data.percentage}%`);
        console.log(`   - Precio promedio: $${data.summary.avg_price}`);
        console.log(`   - Precio mínimo: $${data.summary.min_price}`);
        console.log(`   - Precio máximo: $${data.summary.max_price}`);

        console.log('\n📋 PRECIOS ACTUALIZADOS:\n');
        console.log('═'.repeat(80));
        console.log('Categoría'.padEnd(15) + 'Producto'.padEnd(35) + 'Nuevo Precio');
        console.log('─'.repeat(80));

        data.after.forEach(p => {
            const price = `$${p.price}`;
            console.log(
                p.category.padEnd(15) +
                p.name.padEnd(35) +
                price.padStart(12)
            );
        });

        console.log('\n✅ Todos los precios han sido actualizados exitosamente!');

    } catch (error) {
        console.error('❌ Error al ejecutar aumento de precios:', error.message);
        process.exit(1);
    }
}

executePriceIncrease();
