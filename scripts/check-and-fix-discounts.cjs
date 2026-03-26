// Check and fix discount values in orders
const pg = require('pg');
const { Pool } = pg;
require('dotenv').config();

async function checkAndFixDiscounts() {
  console.log('🔍 Checking discount values in orders...\n');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: No DATABASE_URL found in .env file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Connected to production database\n');

    // Check if discount column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name IN ('discount', 'tip')
      ORDER BY column_name
    `);

    console.log('📊 Column information:');
    columnCheck.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'none'})`);
    });
    console.log('');

    // Check orders with NULL or missing discount values
    const nullDiscountCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE discount IS NULL OR tip IS NULL
    `);

    console.log(`📊 Orders with NULL discount/tip: ${nullDiscountCheck.rows[0].count}\n`);

    // Check orders with customers but no discount applied
    const customerOrdersCheck = await client.query(`
      SELECT
        o.id,
        o."clientName",
        o."customerId",
        o.subtotal,
        o.discount,
        o.total,
        c.name as customer_name,
        c."discountPercentage",
        o.created_at
      FROM orders o
      LEFT JOIN customers c ON o."customerId" = c.id
      WHERE o."customerId" IS NOT NULL
        AND c."discountPercentage" > 0
        AND (o.discount IS NULL OR o.discount = 0)
      ORDER BY o.created_at DESC
      LIMIT 20
    `);

    if (customerOrdersCheck.rows.length > 0) {
      console.log(`⚠️  Found ${customerOrdersCheck.rows.length} customer orders with missing discounts:\n`);
      customerOrdersCheck.rows.forEach((order, i) => {
        const expectedDiscount = (order.subtotal * (order.discountPercentage / 100)).toFixed(2);
        console.log(`${i + 1}. Order: ${order.id}`);
        console.log(`   Cliente: ${order.customer_name} (${order.discountPercentage}% descuento)`);
        console.log(`   Subtotal: $${order.subtotal}`);
        console.log(`   Descuento guardado: $${order.discount || 0}`);
        console.log(`   Descuento esperado: $${expectedDiscount}`);
        console.log(`   Total: $${order.total}`);
        console.log(`   Fecha: ${new Date(order.created_at).toLocaleDateString('es-MX')}`);
        console.log('');
      });

      console.log('\n🔧 ¿Quieres recalcular y actualizar estos descuentos?');
      console.log('   (Esto NO cambiará el total, solo marcará el descuento correctamente)');
      console.log('\n⚠️  NOTA: Esto es solo para propósitos de visualización en el historial.');
      console.log('   Los totales originales no cambiarán.\n');

      // For now, just report. Uncomment to actually fix:
      /*
      console.log('🔄 Actualizando descuentos...\n');

      for (const order of customerOrdersCheck.rows) {
        const expectedDiscount = order.subtotal * (order.discountPercentage / 100);

        await client.query(`
          UPDATE orders
          SET discount = $1
          WHERE id = $2
        `, [expectedDiscount, order.id]);

        console.log(`✅ Actualizado: ${order.id} - Descuento: $${expectedDiscount.toFixed(2)}`);
      }

      console.log('\n✅ Descuentos actualizados exitosamente!');
      */
    } else {
      console.log('✅ Todos los pedidos de clientes con descuento tienen el campo discount correctamente configurado.\n');
    }

    // Check recent orders summary
    const recentOrders = await client.query(`
      SELECT
        o."clientName",
        o.subtotal,
        o.discount,
        o.tip,
        o.total,
        c."discountPercentage",
        o.created_at
      FROM orders o
      LEFT JOIN customers c ON o."customerId" = c.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    console.log('\n📊 Últimas 10 órdenes:\n');
    recentOrders.rows.forEach((order, i) => {
      const date = new Date(order.created_at).toLocaleDateString('es-MX');
      const discountText = order.discount > 0 ? ` (desc: -$${order.discount})` : '';
      const tipText = order.tip > 0 ? ` (propina: +$${order.tip})` : '';
      const customerDiscountText = order.discountPercentage > 0 ? ` [Cliente con ${order.discountPercentage}% desc]` : '';
      console.log(`${i + 1}. ${order.clientName}${customerDiscountText}`);
      console.log(`   ${date} - Subtotal: $${order.subtotal}${discountText}${tipText} = Total: $${order.total}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n⚠️  DATABASE_URL credentials are outdated');
      console.log('\n📝 To fix:');
      console.log('1. Go to Railway Dashboard > PostgreSQL > Variables');
      console.log('2. Copy current DATABASE_URL');
      console.log('3. Update .env file');
      console.log('4. Run this script again');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

checkAndFixDiscounts();
