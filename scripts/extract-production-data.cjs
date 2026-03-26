const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Production database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres:CdSUGzLIGZhijHJPPTsLVVJjDvtWawvg@yamabiko.proxy.rlwy.net:45660/railway',
  ssl: {
    rejectUnauthorized: false,
    require: true,
    servername: undefined,
    checkServerIdentity: () => undefined
  },
  max: 20,
  connectionTimeoutMillis: 30000
});

async function exportAllData() {
  const client = await pool.connect();

  try {
    console.log('🚀 Conectando a base de datos de producción...\n');

    // Test connection
    const testResult = await client.query('SELECT NOW(), version()');
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log(`📅 Hora del servidor: ${testResult.rows[0].now}`);
    console.log(`🗄️  Versión: ${testResult.rows[0].version.split(' ').slice(0, 2).join(' ')}\n`);

    console.log('📊 Extrayendo TODOS los datos de producción...\n');

    // Extract ALL data from all tables
    const tables = {
      usuarios: 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC',
      productos: 'SELECT * FROM products WHERE is_active = true ORDER BY name',
      registros: 'SELECT * FROM records WHERE is_deleted = false ORDER BY date DESC',
      cortes_caja: 'SELECT * FROM cashcuts WHERE is_deleted = false ORDER BY created_at DESC',
      sesiones_coworking: 'SELECT * FROM coworking_sessions ORDER BY created_at DESC'
    };

    const allData = {};
    let totalRecords = 0;

    for (const [name, query] of Object.entries(tables)) {
      try {
        console.log(`  ⏳ Extrayendo ${name}...`);
        const result = await client.query(query);
        allData[name] = result.rows;
        totalRecords += result.rows.length;
        console.log(`  ✅ ${name}: ${result.rows.length} registros`);
      } catch (error) {
        console.log(`  ⚠️  ${name}: ${error.message}`);
        allData[name] = [];
      }
    }

    console.log(`\n📈 Total registros extraídos: ${totalRecords}\n`);
    console.log('📊 Calculando estadísticas completas...\n');

    // Calculate comprehensive statistics
    const stats = calculateStatistics(allData);

    console.log('📝 Generando reportes completos...\n');

    // Generate reports
    const report = generateReport(allData, stats);
    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      base_datos: 'PostgreSQL Production (Railway)',
      servidor: 'yamabiko.proxy.rlwy.net:45660',
      total_registros_extraidos: totalRecords,
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
    console.log(`   📄 Markdown: ${mdPath}`);
    console.log(`   📄 JSON: ${jsonPath}\n`);

    console.log('🎉 Exportación completada exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`   Total registros: ${stats.cantidad_registros}`);
    console.log(`   Período: ${stats.fecha_inicio} a ${stats.fecha_fin}`);
    console.log(`   Días operación: ${stats.dias_operacion}`);
    console.log(`   Ventas totales: $${stats.total_ventas.toFixed(2)}`);
    console.log(`   Ganancias: $${stats.total_ganancias.toFixed(2)}`);
    console.log(`   Margen: ${stats.margen}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function calculateStatistics(data) {
  const records = data.registros || [];
  const products = data.productos || [];
  const cashCuts = data.cortes_caja || [];
  const coworkingSessions = data.sesiones_coworking || [];

  // Financial totals
  const totalVentas = records.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalCostos = records.reduce((s, r) => s + parseFloat(r.cost || 0), 0);
  const totalGanancias = records.reduce((s, r) => s + parseFloat(r.profit || 0), 0);
  const totalPropinas = records.reduce((s, r) => s + parseFloat(r.tip || 0), 0);
  const totalServiceCharges = records.reduce((s, r) => s + parseFloat(r.service_charge || 0), 0);

  // Sales by month
  const ventasPorMes = {};
  const ventasPorServicio = {};
  const metodosPago = {};
  const clientesTop = {};

  records.forEach(r => {
    const fecha = new Date(r.date);
    if (!isNaN(fecha)) {
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!ventasPorMes[mes]) {
        ventasPorMes[mes] = { cantidad: 0, total: 0, ganancias: 0, propinas: 0 };
      }
      ventasPorMes[mes].cantidad++;
      ventasPorMes[mes].total += parseFloat(r.total || 0);
      ventasPorMes[mes].ganancias += parseFloat(r.profit || 0);
      ventasPorMes[mes].propinas += parseFloat(r.tip || 0);
    }

    const servicio = r.service || 'Sin especificar';
    if (!ventasPorServicio[servicio]) {
      ventasPorServicio[servicio] = { cantidad: 0, total: 0, ganancias: 0 };
    }
    ventasPorServicio[servicio].cantidad++;
    ventasPorServicio[servicio].total += parseFloat(r.total || 0);
    ventasPorServicio[servicio].ganancias += parseFloat(r.profit || 0);

    const metodo = r.payment || 'Sin especificar';
    if (!metodosPago[metodo]) {
      metodosPago[metodo] = { cantidad: 0, total: 0 };
    }
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].total += parseFloat(r.total || 0);

    const cliente = r.client || 'Sin nombre';
    if (!clientesTop[cliente]) {
      clientesTop[cliente] = { cantidad: 0, total: 0, ultima_visita: r.date };
    }
    clientesTop[cliente].cantidad++;
    clientesTop[cliente].total += parseFloat(r.total || 0);
    if (new Date(r.date) > new Date(clientesTop[cliente].ultima_visita)) {
      clientesTop[cliente].ultima_visita = r.date;
    }
  });

  // Date range
  const fechas = records.map(r => new Date(r.date)).filter(f => !isNaN(f));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;
  const diasOperacion = fechaInicio && fechaFin
    ? Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1 : 0;

  // Inventory value
  let valorInventarioCosto = 0;
  let valorInventarioVenta = 0;
  const productosPorCategoria = {};

  products.forEach(p => {
    const costo = parseFloat(p.cost || 0) * parseInt(p.quantity || 0);
    const venta = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
    valorInventarioCosto += costo;
    valorInventarioVenta += venta;

    const cat = p.category || 'Sin categoría';
    if (!productosPorCategoria[cat]) {
      productosPorCategoria[cat] = {
        cantidad: 0,
        valor_costo: 0,
        valor_venta: 0,
        stock_total: 0
      };
    }
    productosPorCategoria[cat].cantidad++;
    productosPorCategoria[cat].valor_costo += costo;
    productosPorCategoria[cat].valor_venta += venta;
    productosPorCategoria[cat].stock_total += parseInt(p.quantity || 0);
  });

  // Top clients
  const topClientes = Object.entries(clientesTop)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 30);

  // Cash cuts analysis
  const totalEfectivoEsperado = cashCuts.reduce((s, c) => s + parseFloat(c.expected_cash || 0), 0);
  const totalEfectivoReal = cashCuts.reduce((s, c) => s + parseFloat(c.actual_cash || 0), 0);
  const diferenciaTotal = totalEfectivoReal - totalEfectivoEsperado;

  return {
    // Counts
    cantidad_registros: records.length,
    cantidad_productos: products.length,
    cantidad_cortes_caja: cashCuts.length,
    cantidad_sesiones_coworking: coworkingSessions.length,

    // Financial
    total_ventas: totalVentas,
    total_costos: totalCostos,
    total_ganancias: totalGanancias,
    total_propinas: totalPropinas,
    total_service_charges: totalServiceCharges,
    margen: totalVentas > 0 ? ((totalGanancias / totalVentas) * 100).toFixed(2) + '%' : '0%',

    // Period
    fecha_inicio: fechaInicio?.toISOString().split('T')[0],
    fecha_fin: fechaFin?.toISOString().split('T')[0],
    dias_operacion: diasOperacion,
    promedio_ventas_diario: diasOperacion > 0 ? (totalVentas / diasOperacion) : 0,
    promedio_ganancias_diario: diasOperacion > 0 ? (totalGanancias / diasOperacion) : 0,

    // Inventory
    valor_inventario_costo: valorInventarioCosto,
    valor_inventario_venta: valorInventarioVenta,
    ganancia_potencial_inventario: valorInventarioVenta - valorInventarioCosto,
    productos_por_categoria: productosPorCategoria,

    // Breakdown
    ventas_por_mes: ventasPorMes,
    ventas_por_servicio: ventasPorServicio,
    metodos_pago: metodosPago,
    top_clientes: Object.fromEntries(topClientes),

    // Cash cuts
    total_efectivo_esperado: totalEfectivoEsperado,
    total_efectivo_real: totalEfectivoReal,
    diferencia_efectivo: diferenciaTotal
  };
}

function generateReport(data, stats) {
  const fecha = new Date().toISOString().split('T')[0];
  const horaLocal = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  let r = `# 📊 Reporte Completo del Punto de Venta - Conejo Negro\n\n`;
  r += `**Fecha de extracción:** ${fecha}\n`;
  r += `**Hora:** ${horaLocal}\n`;
  r += `**Período de datos:** ${stats.fecha_inicio || 'N/A'} hasta ${stats.fecha_fin || 'N/A'}\n`;
  r += `**Días de operación:** ${stats.dias_operacion} días\n`;
  r += `**Base de datos:** PostgreSQL Production (Railway)\n\n`;
  r += `---\n\n`;

  r += `## 💰 Resumen Ejecutivo\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| **Ventas Totales** | $${stats.total_ventas.toFixed(2)} |\n`;
  r += `| **Costos Totales** | $${stats.total_costos.toFixed(2)} |\n`;
  r += `| **Ganancias Totales** | $${stats.total_ganancias.toFixed(2)} |\n`;
  r += `| **Propinas Totales** | $${stats.total_propinas.toFixed(2)} |\n`;
  r += `| **Cargos por Servicio** | $${stats.total_service_charges.toFixed(2)} |\n`;
  r += `| **Margen de Ganancia** | ${stats.margen} |\n`;
  r += `| **Promedio Ventas/Día** | $${stats.promedio_ventas_diario.toFixed(2)} |\n`;
  r += `| **Promedio Ganancias/Día** | $${stats.promedio_ganancias_diario.toFixed(2)} |\n`;
  r += `| **Total Registros** | ${stats.cantidad_registros} |\n\n`;

  r += `## 📊 Registros en Base de Datos\n\n`;
  r += `| Categoría | Cantidad |\n|-----------|----------|\n`;
  r += `| Usuarios Activos | ${data.usuarios.length} |\n`;
  r += `| Productos | ${data.productos.length} |\n`;
  r += `| Registros de Ventas | ${data.registros.length} |\n`;
  r += `| Cortes de Caja | ${data.cortes_caja.length} |\n`;
  r += `| Sesiones Coworking | ${data.sesiones_coworking.length} |\n\n`;

  r += `## 📦 Análisis de Inventario\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| Total Productos | ${stats.cantidad_productos} |\n`;
  r += `| Valor Inventario (Costo) | $${stats.valor_inventario_costo.toFixed(2)} |\n`;
  r += `| Valor Inventario (Venta) | $${stats.valor_inventario_venta.toFixed(2)} |\n`;
  r += `| Ganancia Potencial | $${stats.ganancia_potencial_inventario.toFixed(2)} |\n\n`;

  r += `### Productos por Categoría\n\n`;
  r += `| Categoría | Productos | Stock | Valor Costo | Valor Venta | Margen |\n`;
  r += `|-----------|-----------|-------|-------------|-------------|--------|\n`;
  Object.entries(stats.productos_por_categoria).forEach(([cat, d]) => {
    const margen = d.valor_venta - d.valor_costo;
    r += `| ${cat} | ${d.cantidad} | ${d.stock_total} | $${d.valor_costo.toFixed(2)} | $${d.valor_venta.toFixed(2)} | $${margen.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 📅 Ventas por Mes\n\n`;
  r += `| Mes | Cantidad | Total | Ganancias | Propinas | Promedio |\n`;
  r += `|-----|----------|-------|-----------|----------|----------|\n`;
  Object.keys(stats.ventas_por_mes).sort().forEach(mes => {
    const d = stats.ventas_por_mes[mes];
    const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
    r += `| ${mes} | ${d.cantidad} | $${d.total.toFixed(2)} | $${d.ganancias.toFixed(2)} | $${d.propinas.toFixed(2)} | $${promedio.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 🎯 Ventas por Tipo de Servicio\n\n`;
  r += `| Servicio | Cantidad | Total | Ganancias | Promedio |\n`;
  r += `|----------|----------|-------|-----------|----------|\n`;
  Object.entries(stats.ventas_por_servicio).sort((a,b) => b[1].total - a[1].total).forEach(([s, d]) => {
    const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
    r += `| ${s} | ${d.cantidad} | $${d.total.toFixed(2)} | $${d.ganancias.toFixed(2)} | $${promedio.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 💳 Análisis de Métodos de Pago\n\n`;
  r += `| Método | Transacciones | Total | % del Total | Promedio/Transacción |\n`;
  r += `|--------|---------------|-------|-------------|----------------------|\n`;
  Object.entries(stats.metodos_pago).sort((a,b) => b[1].total - a[1].total).forEach(([m, d]) => {
    const porcentaje = ((d.total / stats.total_ventas) * 100).toFixed(1);
    const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
    r += `| ${m} | ${d.cantidad} | $${d.total.toFixed(2)} | ${porcentaje}% | $${promedio.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 👥 Top 30 Clientes\n\n`;
  r += `| # | Cliente | Visitas | Total Gastado | Promedio/Visita | Última Visita |\n`;
  r += `|---|---------|---------|---------------|-----------------|---------------|\n`;
  let clienteNum = 1;
  Object.entries(stats.top_clientes).forEach(([c, d]) => {
    const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
    const ultimaVisita = new Date(d.ultima_visita).toISOString().split('T')[0];
    r += `| ${clienteNum++} | ${c} | ${d.cantidad} | $${d.total.toFixed(2)} | $${promedio.toFixed(2)} | ${ultimaVisita} |\n`;
  });
  r += `\n`;

  r += `## 💵 Análisis de Cortes de Caja\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| Total Cortes Realizados | ${stats.cantidad_cortes_caja} |\n`;
  r += `| Efectivo Esperado Total | $${stats.total_efectivo_esperado.toFixed(2)} |\n`;
  r += `| Efectivo Real Total | $${stats.total_efectivo_real.toFixed(2)} |\n`;
  r += `| Diferencia | $${stats.diferencia_efectivo.toFixed(2)} |\n\n`;

  if (data.cortes_caja.length > 0) {
    r += `### Detalle de Cortes de Caja\n\n`;
    r += `| Fecha | Efectivo Esperado | Efectivo Real | Diferencia | Notas |\n`;
    r += `|-------|-------------------|---------------|------------|-------|\n`;
    data.cortes_caja.slice(0, 50).forEach(cut => {
      const fecha = new Date(cut.created_at).toISOString().split('T')[0];
      const esperado = parseFloat(cut.expected_cash || 0);
      const real = parseFloat(cut.actual_cash || 0);
      const diff = real - esperado;
      const diffStr = diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`;
      r += `| ${fecha} | $${esperado.toFixed(2)} | $${real.toFixed(2)} | ${diffStr} | ${cut.notes || '-'} |\n`;
    });
    r += `\n`;
  }

  if (data.registros.length > 0) {
    r += `## 🛒 Últimas 100 Ventas\n\n`;
    r += `| Fecha | Cliente | Servicio | Total | Pago | Ganancia | Propina |\n`;
    r += `|-------|---------|----------|-------|------|----------|----------|\n`;
    data.registros.slice(0, 100).forEach(rec => {
      const f = new Date(rec.date).toISOString().split('T')[0];
      r += `| ${f} | ${rec.client} | ${rec.service} | $${parseFloat(rec.total || 0).toFixed(2)} | ${rec.payment} | $${parseFloat(rec.profit || 0).toFixed(2)} | $${parseFloat(rec.tip || 0).toFixed(2)} |\n`;
    });
    r += `\n`;
  }

  if (data.productos.length > 0) {
    r += `## 📦 Inventario Completo de Productos\n\n`;
    r += `| Producto | Categoría | Precio | Costo | Stock | Valor Total | Ganancia/Unidad |\n`;
    r += `|----------|-----------|--------|-------|-------|-------------|------------------|\n`;
    data.productos.forEach(p => {
      const valor = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
      const gananciaUnidad = parseFloat(p.price || 0) - parseFloat(p.cost || 0);
      r += `| ${p.name} | ${p.category || 'N/A'} | $${parseFloat(p.price || 0).toFixed(2)} | $${parseFloat(p.cost || 0).toFixed(2)} | ${p.quantity || 0} | $${valor.toFixed(2)} | $${gananciaUnidad.toFixed(2)} |\n`;
    });
    r += `\n`;
  }

  if (data.sesiones_coworking.length > 0) {
    r += `## 💼 Sesiones de Coworking\n\n`;
    r += `| Cliente | Inicio | Fin | Duración | Total | Estado |\n`;
    r += `|---------|--------|-----|----------|-------|--------|\n`;
    data.sesiones_coworking.forEach(session => {
      const inicio = new Date(session.start_time).toISOString().split('T')[0];
      const fin = session.end_time ? new Date(session.end_time).toISOString().split('T')[0] : 'En curso';
      const duracion = session.end_time
        ? Math.round((new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60 * 60)) + 'h'
        : '-';
      r += `| ${session.client} | ${inicio} | ${fin} | ${duracion} | $${parseFloat(session.total || 0).toFixed(2)} | ${session.status} |\n`;
    });
    r += `\n`;
  }

  r += `---\n\n`;
  r += `*Reporte generado automáticamente el ${fecha}*\n`;
  r += `*Sistema de Punto de Venta - Conejo Negro*\n`;
  r += `*Datos extraídos de PostgreSQL Production en Railway*\n`;
  r += `*Total de ${stats.cantidad_registros} registros procesados*\n`;

  return r;
}

// Execute
exportAllData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
  });
