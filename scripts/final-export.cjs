const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
    console.log('🚀 Iniciando extracción completa...\n');

    // Test connection
    await client.query('SELECT NOW()');
    console.log('✅ Conectado a la base de datos\n');

    // Extract all data
    console.log('📊 Extrayendo tablas...\n');

    const tables = {
      usuarios: 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC',
      productos: 'SELECT * FROM products WHERE is_active = true ORDER BY name',
      registros: 'SELECT * FROM records WHERE is_deleted = false ORDER BY date DESC',
      cortes_caja: 'SELECT * FROM cashcuts WHERE is_deleted = false ORDER BY created_at DESC LIMIT 500',
      sesiones_coworking: 'SELECT * FROM coworking_sessions ORDER BY created_at DESC'
    };

    const allData = {};
    for (const [name, query] of Object.entries(tables)) {
      try {
        console.log(`  ⏳ ${name}...`);
        const result = await client.query(query);
        allData[name] = result.rows;
        console.log(`  ✅ ${name}: ${result.rows.length} registros`);
      } catch (error) {
        console.log(`  ⚠️  ${name}: ${error.message}`);
        allData[name] = [];
      }
    }

    console.log('\n📈 Calculando estadísticas...\n');

    // Statistics
    const stats = calculateStatistics(allData);

    console.log('📝 Generando reportes...\n');

    // Generate files
    const report = generateReport(allData, stats);
    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      base_datos: 'PostgreSQL (Railway)',
      estadisticas: stats,
      datos: allData
    };

    // Save
    const docsDir = path.join(__dirname, '..', 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    const mdPath = path.join(docsDir, 'reporte-completo-punto-venta.md');
    const jsonPath = path.join(docsDir, 'datos-completos-punto-venta.json');

    await fs.writeFile(mdPath, report, 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    console.log('✅ Archivos generados:\n');
    console.log(`   📄 Markdown: ${mdPath}`);
    console.log(`   📄 JSON: ${jsonPath}\n`);

    console.log('🎉 Completado!\n');
    console.log(`📊 Resumen:`);
    console.log(`   Registros: ${stats.cantidad_registros}`);
    console.log(`   Ventas: $${stats.total_ventas.toFixed(2)}`);
    console.log(`   Ganancias: $${stats.total_ganancias.toFixed(2)}`);
    console.log(`   Margen: ${stats.margen}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function calculateStatistics(data) {
  const records = data.registros || [];
  const products = data.productos || [];

  const totalVentas = records.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalCostos = records.reduce((s, r) => s + parseFloat(r.cost || 0), 0);
  const totalGanancias = records.reduce((s, r) => s + parseFloat(r.profit || 0), 0);
  const totalPropinas = records.reduce((s, r) => s + parseFloat(r.tip || 0), 0);

  const ventasPorMes = {};
  const ventasPorServicio = {};
  const metodosPago = {};

  records.forEach(r => {
    const fecha = new Date(r.date);
    if (!isNaN(fecha)) {
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!ventasPorMes[mes]) ventasPorMes[mes] = { cantidad: 0, total: 0, ganancias: 0 };
      ventasPorMes[mes].cantidad++;
      ventasPorMes[mes].total += parseFloat(r.total || 0);
      ventasPorMes[mes].ganancias += parseFloat(r.profit || 0);
    }

    const servicio = r.service || 'Sin especificar';
    if (!ventasPorServicio[servicio]) ventasPorServicio[servicio] = { cantidad: 0, total: 0 };
    ventasPorServicio[servicio].cantidad++;
    ventasPorServicio[servicio].total += parseFloat(r.total || 0);

    const metodo = r.payment || 'Sin especificar';
    if (!metodosPago[metodo]) metodosPago[metodo] = { cantidad: 0, total: 0 };
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].total += parseFloat(r.total || 0);
  });

  const fechas = records.map(r => new Date(r.date)).filter(f => !isNaN(f));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;
  const diasOperacion = fechaInicio && fechaFin
    ? Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1 : 0;

  let valorInventarioCosto = 0;
  let valorInventarioVenta = 0;
  products.forEach(p => {
    valorInventarioCosto += parseFloat(p.cost || 0) * parseInt(p.quantity || 0);
    valorInventarioVenta += parseFloat(p.price || 0) * parseInt(p.quantity || 0);
  });

  return {
    cantidad_registros: records.length,
    cantidad_productos: products.length,
    total_ventas: totalVentas,
    total_costos: totalCostos,
    total_ganancias: totalGanancias,
    total_propinas: totalPropinas,
    margen: totalVentas > 0 ? ((totalGanancias / totalVentas) * 100).toFixed(2) + '%' : '0%',
    fecha_inicio: fechaInicio?.toISOString().split('T')[0],
    fecha_fin: fechaFin?.toISOString().split('T')[0],
    dias_operacion: diasOperacion,
    promedio_diario: diasOperacion > 0 ? (totalVentas / diasOperacion).toFixed(2) : 0,
    valor_inventario_costo: valorInventarioCosto,
    valor_inventario_venta: valorInventarioVenta,
    ventas_por_mes: ventasPorMes,
    ventas_por_servicio: ventasPorServicio,
    metodos_pago: metodosPago
  };
}

function generateReport(data, stats) {
  const fecha = new Date().toISOString().split('T')[0];
  let r = `# 📊 Reporte Completo - Punto de Venta Conejo Negro\n\n`;
  r += `**Generado:** ${fecha}\n`;
  r += `**Período:** ${stats.fecha_inicio || 'N/A'} - ${stats.fecha_fin || 'N/A'}\n`;
  r += `**Días operación:** ${stats.dias_operacion}\n\n`;
  r += `---\n\n`;

  r += `## 💰 Resumen Ejecutivo\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| Ventas Totales | $${stats.total_ventas.toFixed(2)} |\n`;
  r += `| Costos | $${stats.total_costos.toFixed(2)} |\n`;
  r += `| Ganancias | $${stats.total_ganancias.toFixed(2)} |\n`;
  r += `| Propinas | $${stats.total_propinas.toFixed(2)} |\n`;
  r += `| Margen | ${stats.margen} |\n`;
  r += `| Promedio/Día | $${stats.promedio_diario} |\n`;
  r += `| Registros | ${stats.cantidad_registros} |\n`;
  r += `| Productos | ${stats.cantidad_productos} |\n\n`;

  r += `## 📦 Inventario\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| Valor Costo | $${stats.valor_inventario_costo.toFixed(2)} |\n`;
  r += `| Valor Venta | $${stats.valor_inventario_venta.toFixed(2)} |\n`;
  r += `| Ganancia Potencial | $${(stats.valor_inventario_venta - stats.valor_inventario_costo).toFixed(2)} |\n\n`;

  r += `## 📅 Ventas por Mes\n\n`;
  r += `| Mes | Cantidad | Total | Ganancias |\n|-----|----------|-------|------------|\n`;
  Object.keys(stats.ventas_por_mes).sort().forEach(mes => {
    const d = stats.ventas_por_mes[mes];
    r += `| ${mes} | ${d.cantidad} | $${d.total.toFixed(2)} | $${d.ganancias.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 🎯 Por Servicio\n\n`;
  r += `| Servicio | Cantidad | Total |\n|----------|----------|-------|\n`;
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

  if (data.registros.length > 0) {
    r += `## 🛒 Últimas 100 Ventas\n\n`;
    r += `| Fecha | Cliente | Servicio | Total | Pago | Ganancia |\n`;
    r += `|-------|---------|----------|-------|------|----------|\n`;
    data.registros.slice(0, 100).forEach(rec => {
      const f = new Date(rec.date).toISOString().split('T')[0];
      r += `| ${f} | ${rec.client} | ${rec.service} | $${parseFloat(rec.total ||0).toFixed(2)} | ${rec.payment} | $${parseFloat(rec.profit || 0).toFixed(2)} |\n`;
    });
    r += `\n`;
  }

  if (data.productos.length > 0) {
    r += `## 📦 Inventario Completo\n\n`;
    r += `| Producto | Categoría | Precio | Costo | Stock | Valor |\n`;
    r += `|----------|-----------|--------|-------|-------|-------|\n`;
    data.productos.forEach(p => {
      const valor = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
      r += `| ${p.name} | ${p.category || 'N/A'} | $${parseFloat(p.price || 0).toFixed(2)} | $${parseFloat(p.cost || 0).toFixed(2)} | ${p.quantity || 0} | $${valor.toFixed(2)} |\n`;
    });
    r += `\n`;
  }

  r += `---\n*Generado ${fecha} desde PostgreSQL Railway*\n`;
  return r;
}

// Run
exportAllData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
