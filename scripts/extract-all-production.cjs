const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres:CdSUGzLIGZhijHJPPTsLVVJjDvtWawvg@yamabiko.proxy.rlwy.net:45660/railway',
  ssl: {
    rejectUnauthorized: false,
    require: true,
    servername: undefined,
    checkServerIdentity: () => undefined
  }
});

async function extractAllData() {
  const client = await pool.connect();

  try {
    console.log('🚀 Extrayendo TODOS los datos de producción...\n');

    const allData = {};
    let totalRecords = 0;

    // Extract all tables
    const tables = {
      usuarios: 'SELECT * FROM users ORDER BY created_at DESC',
      productos: 'SELECT * FROM products ORDER BY name',
      ordenes: 'SELECT * FROM orders ORDER BY created_at DESC',
      sesiones_coworking: 'SELECT * FROM coworking_sessions ORDER BY created_at DESC',
      sesiones_caja: 'SELECT * FROM cash_sessions ORDER BY created_at DESC',
      retiros_efectivo: 'SELECT * FROM cash_withdrawals ORDER BY created_at DESC',
      gastos: 'SELECT * FROM expenses ORDER BY created_at DESC',
      clientes: 'SELECT * FROM customers ORDER BY created_at DESC',
      creditos_clientes: 'SELECT * FROM customer_credits ORDER BY created_at DESC',
      registro_caja: 'SELECT * FROM cash_registry ORDER BY date DESC'
    };

    for (const [name, query] of Object.entries(tables)) {
      console.log(`  ⏳ Extrayendo ${name}...`);
      const result = await client.query(query);
      allData[name] = result.rows;
      totalRecords += result.rows.length;
      console.log(`  ✅ ${name}: ${result.rows.length} registros`);
    }

    console.log(`\n📈 Total registros: ${totalRecords}\n`);

    // Calculate statistics
    const stats = calculateStats(allData);

    // Generate reports
    const report = generateReport(allData, stats);
    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      total_registros: totalRecords,
      estadisticas: stats,
      datos: allData
    };

    // Save files
    const docsDir = path.join(__dirname, '..', 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    const mdPath = path.join(docsDir, 'reporte-completo-punto-venta.md');
    const jsonPath = path.join(docsDir, 'datos-completos-punto-venta.json');

    await fs.writeFile(mdPath, report, 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    console.log('✅ Archivos generados:\n');
    console.log(`   📄 ${mdPath}`);
    console.log(`   📄 ${jsonPath}\n`);

    console.log('🎉 Completado!\n');
    console.log('📊 Resumen:');
    console.log(`   Órdenes: ${allData.ordenes.length}`);
    console.log(`   Ventas: $${stats.total_ventas.toFixed(2)}`);
    console.log(`   Ganancias: $${stats.total_ganancias.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function calculateStats(data) {
  const orders = data.ordenes || [];
  const products = data.productos || [];
  const expenses = data.gastos || [];
  const coworking = data.sesiones_coworking || [];

  // Financial
  const totalVentas = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const totalSubtotal = orders.reduce((s, o) => s + parseFloat(o.subtotal || 0), 0);
  const totalPropinas = orders.reduce((s, o) => s + parseFloat(o.tip || 0), 0);
  const totalDescuentos = orders.reduce((s, o) => s + parseFloat(o.discount || 0), 0);
  const totalGastos = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  // Calculate cost from items
  let totalCostos = 0;
  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          totalCostos += parseFloat(product.cost || 0) * parseInt(item.quantity || 0);
        }
      });
    }
  });

  const totalGanancias = totalSubtotal - totalCostos;
  const utilidadNeta = totalGanancias - totalGastos;

  // Date range
  const fechas = orders.map(o => new Date(o.created_at)).filter(f => !isNaN(f));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;
  const diasOperacion = fechaInicio && fechaFin
    ? Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1 : 0;

  // By month
  const ventasPorMes = {};
  orders.forEach(o => {
    const fecha = new Date(o.created_at);
    if (!isNaN(fecha)) {
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!ventasPorMes[mes]) {
        ventasPorMes[mes] = { cantidad: 0, total: 0, subtotal: 0, propinas: 0 };
      }
      ventasPorMes[mes].cantidad++;
      ventasPorMes[mes].total += parseFloat(o.total || 0);
      ventasPorMes[mes].subtotal += parseFloat(o.subtotal || 0);
      ventasPorMes[mes].propinas += parseFloat(o.tip || 0);
    }
  });

  // By service type
  const ventasPorServicio = {};
  orders.forEach(o => {
    const tipo = o.serviceType || 'Sin especificar';
    if (!ventasPorServicio[tipo]) {
      ventasPorServicio[tipo] = { cantidad: 0, total: 0 };
    }
    ventasPorServicio[tipo].cantidad++;
    ventasPorServicio[tipo].total += parseFloat(o.total || 0);
  });

  // By payment method
  const metodosPago = {};
  orders.forEach(o => {
    const metodo = o.paymentMethod || 'Sin especificar';
    if (!metodosPago[metodo]) {
      metodosPago[metodo] = { cantidad: 0, total: 0 };
    }
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].total += parseFloat(o.total || 0);
  });

  // Top clients
  const clientesTop = {};
  orders.forEach(o => {
    const cliente = o.clientName || 'Sin nombre';
    if (!clientesTop[cliente]) {
      clientesTop[cliente] = { cantidad: 0, total: 0 };
    }
    clientesTop[cliente].cantidad++;
    clientesTop[cliente].total += parseFloat(o.total || 0);
  });

  const topClientes = Object.entries(clientesTop)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 30);

  // Inventory value
  let valorInventario = 0;
  products.forEach(p => {
    valorInventario += parseFloat(p.price || 0) * parseInt(p.stock || 0);
  });

  return {
    total_ventas: totalVentas,
    total_subtotal: totalSubtotal,
    total_costos: totalCostos,
    total_ganancias: totalGanancias,
    total_propinas: totalPropinas,
    total_descuentos: totalDescuentos,
    total_gastos: totalGastos,
    utilidad_neta: utilidadNeta,
    margen: totalSubtotal > 0 ? ((totalGanancias / totalSubtotal) * 100).toFixed(2) + '%' : '0%',
    cantidad_ordenes: orders.length,
    cantidad_productos: products.length,
    cantidad_gastos: expenses.length,
    fecha_inicio: fechaInicio?.toISOString().split('T')[0],
    fecha_fin: fechaFin?.toISOString().split('T')[0],
    dias_operacion: diasOperacion,
    promedio_diario: diasOperacion > 0 ? (totalVentas / diasOperacion) : 0,
    valor_inventario: valorInventario,
    ventas_por_mes: ventasPorMes,
    ventas_por_servicio: ventasPorServicio,
    metodos_pago: metodosPago,
    top_clientes: Object.fromEntries(topClientes)
  };
}

function generateReport(data, stats) {
  const fecha = new Date().toISOString().split('T')[0];
  let r = `# 📊 Reporte Completo - Punto de Venta Conejo Negro\n\n`;
  r += `**Generado:** ${fecha}\n`;
  r += `**Período:** ${stats.fecha_inicio} - ${stats.fecha_fin}\n`;
  r += `**Días:** ${stats.dias_operacion}\n\n`;

  r += `## 💰 Resumen Ejecutivo\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| Ventas Totales | $${stats.total_ventas.toFixed(2)} |\n`;
  r += `| Subtotal | $${stats.total_subtotal.toFixed(2)} |\n`;
  r += `| Propinas | $${stats.total_propinas.toFixed(2)} |\n`;
  r += `| Descuentos | $${stats.total_descuentos.toFixed(2)} |\n`;
  r += `| Costos | $${stats.total_costos.toFixed(2)} |\n`;
  r += `| Ganancias | $${stats.total_ganancias.toFixed(2)} |\n`;
  r += `| Gastos | $${stats.total_gastos.toFixed(2)} |\n`;
  r += `| Utilidad Neta | $${stats.utilidad_neta.toFixed(2)} |\n`;
  r += `| Margen | ${stats.margen} |\n`;
  r += `| Promedio/Día | $${stats.promedio_diario.toFixed(2)} |\n`;
  r += `| Órdenes | ${stats.cantidad_ordenes} |\n\n`;

  r += `## 📊 Datos\n\n`;
  r += `| Categoría | Cantidad |\n|-----------|----------|\n`;
  r += `| Órdenes | ${data.ordenes.length} |\n`;
  r += `| Productos | ${data.productos.length} |\n`;
  r += `| Clientes | ${data.clientes.length} |\n`;
  r += `| Gastos | ${data.gastos.length} |\n`;
  r += `| Sesiones Coworking | ${data.sesiones_coworking.length} |\n`;
  r += `| Sesiones Caja | ${data.sesiones_caja.length} |\n\n`;

  r += `## 📅 Ventas por Mes\n\n`;
  r += `| Mes | Cantidad | Total | Subtotal | Propinas |\n`;
  r += `|-----|----------|-------|----------|----------|\n`;
  Object.keys(stats.ventas_por_mes).sort().forEach(mes => {
    const d = stats.ventas_por_mes[mes];
    r += `| ${mes} | ${d.cantidad} | $${d.total.toFixed(2)} | $${d.subtotal.toFixed(2)} | $${d.propinas.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 🎯 Por Servicio\n\n`;
  r += `| Tipo | Cantidad | Total |\n|------|----------|-------|\n`;
  Object.entries(stats.ventas_por_servicio).sort((a,b) => b[1].total - a[1].total).forEach(([s, d]) => {
    r += `| ${s} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 💳 Por Método de Pago\n\n`;
  r += `| Método | Cantidad | Total |\n|--------|----------|-------|\n`;
  Object.entries(stats.metodos_pago).sort((a,b) => b[1].total - a[1].total).forEach(([m, d]) => {
    r += `| ${m} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 👥 Top 30 Clientes\n\n`;
  r += `| Cliente | Órdenes | Total |\n|---------|---------|-------|\n`;
  Object.entries(stats.top_clientes).forEach(([c, d]) => {
    r += `| ${c} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 🛒 Últimas 100 Órdenes\n\n`;
  r += `| Fecha | Cliente | Tipo | Total | Pago |\n`;
  r += `|-------|---------|------|-------|------|\n`;
  data.ordenes.slice(0, 100).forEach(o => {
    const f = new Date(o.created_at).toISOString().split('T')[0];
    r += `| ${f} | ${o.clientName} | ${o.serviceType} | $${parseFloat(o.total || 0).toFixed(2)} | ${o.paymentMethod} |\n`;
  });
  r += `\n`;

  r += `## 📦 Productos\n\n`;
  r += `| Producto | Categoría | Precio | Costo | Stock |\n`;
  r += `|----------|-----------|--------|-------|-------|\n`;
  data.productos.forEach(p => {
    r += `| ${p.name} | ${p.category} | $${parseFloat(p.price || 0).toFixed(2)} | $${parseFloat(p.cost || 0).toFixed(2)} | ${p.stock} |\n`;
  });
  r += `\n`;

  r += `---\n*${fecha}*\n`;
  return r;
}

extractAllData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
