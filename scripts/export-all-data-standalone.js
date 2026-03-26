import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection with proper SSL configuration (matching utils/database.js)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true,
    servername: undefined,
    checkServerIdentity: () => undefined
  },
  max: 20,
  min: 1,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 600000,
  connectionTimeoutMillis: 30000
});

async function exportAllData() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando extracción completa de datos...\n');

    // Test connection
    await client.query('SELECT NOW()');
    console.log('✅ Conexión a base de datos establecida\n');

    console.log('📊 Extrayendo datos de todas las tablas...\n');

    // Extract all data from all tables
    const tables = {
      usuarios: 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC',
      productos: 'SELECT * FROM products WHERE is_active = true ORDER BY category, name',
      registros: 'SELECT * FROM records WHERE is_deleted = false ORDER BY date DESC',
      cortes_caja: 'SELECT * FROM cashcuts WHERE is_deleted = false ORDER BY created_at DESC LIMIT 500',
      sesiones_coworking: 'SELECT * FROM coworking_sessions ORDER BY created_at DESC'
    };

    const allData = {};

    for (const [tableName, query] of Object.entries(tables)) {
      try {
        console.log(`  ⏳ Extrayendo ${tableName}...`);
        const result = await client.query(query);
        allData[tableName] = result.rows;
        console.log(`  ✅ ${tableName}: ${result.rows.length} registros`);
      } catch (error) {
        console.log(`  ⚠️  ${tableName}: ${error.message}`);
        allData[tableName] = [];
      }
    }

    console.log('\n📈 Calculando estadísticas...\n');

    // Calculate comprehensive statistics
    const statistics = calculateStatistics(allData);

    console.log('📝 Generando reportes...\n');

    // Generate reports
    const markdownReport = generateMarkdownReport(allData, statistics);
    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      base_datos: 'PostgreSQL (Railway)',
      estadisticas: statistics,
      datos: allData
    };

    // Save files
    const docsDir = path.join(__dirname, '..', 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    const markdownPath = path.join(docsDir, 'reporte-completo-punto-venta.md');
    const jsonPath = path.join(docsDir, 'datos-completos-punto-venta.json');

    await fs.writeFile(markdownPath, markdownReport, 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    console.log('✅ Archivos generados:\n');
    console.log(`   📄 Reporte Markdown: ${markdownPath}`);
    console.log(`   📄 Datos JSON: ${jsonPath}\n`);

    return { markdownPath, jsonPath, statistics, allData };

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function calculateStatistics(allData) {
  const records = allData.registros || [];
  const products = allData.productos || [];
  const cashCuts = allData.cortes_caja || [];

  // Total sales and costs
  const totalVentas = records.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
  const totalCostos = records.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0);
  const totalGanancias = records.reduce((sum, r) => sum + parseFloat(r.profit || 0), 0);
  const totalPropinas = records.reduce((sum, r) => sum + parseFloat(r.tip || 0), 0);

  // Sales by month
  const ventasPorMes = {};
  records.forEach(record => {
    const fecha = new Date(record.date);
    if (isNaN(fecha.getTime())) return;
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!ventasPorMes[mes]) {
      ventasPorMes[mes] = {
        cantidad: 0,
        total: 0,
        ganancias: 0,
        propinas: 0
      };
    }
    ventasPorMes[mes].cantidad++;
    ventasPorMes[mes].total += parseFloat(record.total || 0);
    ventasPorMes[mes].ganancias += parseFloat(record.profit || 0);
    ventasPorMes[mes].propinas += parseFloat(record.tip || 0);
  });

  // Sales by service type
  const ventasPorServicio = {};
  records.forEach(record => {
    const servicio = record.service || 'Sin especificar';
    if (!ventasPorServicio[servicio]) {
      ventasPorServicio[servicio] = {
        cantidad: 0,
        total: 0,
        ganancias: 0
      };
    }
    ventasPorServicio[servicio].cantidad++;
    ventasPorServicio[servicio].total += parseFloat(record.total || 0);
    ventasPorServicio[servicio].ganancias += parseFloat(record.profit || 0);
  });

  // Payment methods
  const metodosPago = {};
  records.forEach(record => {
    const metodo = record.payment || 'Sin especificar';
    if (!metodosPago[metodo]) {
      metodosPago[metodo] = {
        cantidad: 0,
        total: 0
      };
    }
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].total += parseFloat(record.total || 0);
  });

  // Products analysis
  const productosPorCategoria = {};
  let valorInventarioCosto = 0;
  let valorInventarioVenta = 0;

  products.forEach(p => {
    const cat = p.category || 'Sin categoría';
    if (!productosPorCategoria[cat]) {
      productosPorCategoria[cat] = {
        cantidad: 0,
        valor_costo: 0,
        valor_venta: 0
      };
    }
    productosPorCategoria[cat].cantidad++;
    const costo = parseFloat(p.cost || 0) * parseInt(p.quantity || 0);
    const venta = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
    productosPorCategoria[cat].valor_costo += costo;
    productosPorCategoria[cat].valor_venta += venta;
    valorInventarioCosto += costo;
    valorInventarioVenta += venta;
  });

  // Date range
  const fechas = records.map(r => new Date(r.date)).filter(f => !isNaN(f.getTime()));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  const diasOperacion = fechaInicio && fechaFin
    ? Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const promedioDiario = diasOperacion > 0 ? totalVentas / diasOperacion : 0;
  const promedioGananciasDiario = diasOperacion > 0 ? totalGanancias / diasOperacion : 0;

  // Top clients
  const clientesTop = {};
  records.forEach(r => {
    const cliente = r.client || 'Sin nombre';
    if (!clientesTop[cliente]) {
      clientesTop[cliente] = {
        cantidad: 0,
        total: 0
      };
    }
    clientesTop[cliente].cantidad++;
    clientesTop[cliente].total += parseFloat(r.total || 0);
  });

  const topClientes = Object.entries(clientesTop)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20);

  return {
    resumen: {
      total_ventas: totalVentas,
      total_costos: totalCostos,
      total_ganancias: totalGanancias,
      total_propinas: totalPropinas,
      margen_ganancia: totalVentas > 0 ? ((totalGanancias / totalVentas) * 100).toFixed(2) + '%' : '0%',
      cantidad_registros: records.length,
      cantidad_productos: products.length,
      cantidad_cortes_caja: cashCuts.length,
      valor_inventario_costo: valorInventarioCosto,
      valor_inventario_venta: valorInventarioVenta,
      ganancia_potencial_inventario: valorInventarioVenta - valorInventarioCosto
    },
    periodo: {
      fecha_inicio: fechaInicio?.toISOString().split('T')[0],
      fecha_fin: fechaFin?.toISOString().split('T')[0],
      dias_operacion: diasOperacion,
      promedio_ventas_diario: promedioDiario,
      promedio_ganancias_diario: promedioGananciasDiario
    },
    ventas_por_mes: ventasPorMes,
    ventas_por_servicio: ventasPorServicio,
    metodos_pago: metodosPago,
    productos_por_categoria: productosPorCategoria,
    top_clientes: Object.fromEntries(topClientes)
  };
}

function generateMarkdownReport(allData, statistics) {
  const fecha = new Date().toISOString().split('T')[0];
  const { usuarios, productos, registros, cortes_caja, sesiones_coworking } = allData;

  let report = `# 📊 Reporte Completo del Punto de Venta - Conejo Negro\n\n`;
  report += `**Fecha de extracción:** ${fecha}\n`;
  report += `**Período de datos:** ${statistics.periodo.fecha_inicio || 'N/A'} hasta ${statistics.periodo.fecha_fin || 'N/A'}\n`;
  report += `**Días de operación:** ${statistics.periodo.dias_operacion} días\n`;
  report += `**Base de datos:** PostgreSQL en Railway\n\n`;
  report += `---\n\n`;

  // Executive Summary
  report += `## 💰 Resumen Ejecutivo\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| **Ventas Totales** | $${statistics.resumen.total_ventas.toFixed(2)} |\n`;
  report += `| **Costos Totales** | $${statistics.resumen.total_costos.toFixed(2)} |\n`;
  report += `| **Ganancias Totales** | $${statistics.resumen.total_ganancias.toFixed(2)} |\n`;
  report += `| **Propinas Totales** | $${statistics.resumen.total_propinas.toFixed(2)} |\n`;
  report += `| **Margen de Ganancia** | ${statistics.resumen.margen_ganancia} |\n`;
  report += `| **Promedio Ventas/Día** | $${statistics.periodo.promedio_ventas_diario.toFixed(2)} |\n`;
  report += `| **Promedio Ganancias/Día** | $${statistics.periodo.promedio_ganancias_diario.toFixed(2)} |\n\n`;

  // Database Counts
  report += `## 📊 Registros en Base de Datos\n\n`;
  report += `| Tabla | Cantidad |\n`;
  report += `|-------|----------|\n`;
  report += `| Usuarios | ${usuarios.length} |\n`;
  report += `| Productos | ${productos.length} |\n`;
  report += `| Registros de Ventas | ${registros.length} |\n`;
  report += `| Cortes de Caja | ${cortes_caja.length} |\n`;
  report += `| Sesiones Coworking | ${sesiones_coworking.length} |\n\n`;

  // Inventory
  report += `## 📦 Inventario\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| **Total Productos** | ${statistics.resumen.cantidad_productos} |\n`;
  report += `| **Valor Inventario (Costo)** | $${statistics.resumen.valor_inventario_costo.toFixed(2)} |\n`;
  report += `| **Valor Inventario (Venta)** | $${statistics.resumen.valor_inventario_venta.toFixed(2)} |\n`;
  report += `| **Ganancia Potencial** | $${statistics.resumen.ganancia_potencial_inventario.toFixed(2)} |\n\n`;

  // Products by Category
  report += `### Productos por Categoría\n\n`;
  report += `| Categoría | Cantidad | Valor Costo | Valor Venta | Ganancia Potencial |\n`;
  report += `|-----------|----------|-------------|-------------|--------------------|\n`;
  Object.entries(statistics.productos_por_categoria)
    .sort((a, b) => b[1].valor_venta - a[1].valor_venta)
    .forEach(([cat, data]) => {
      const ganancia = data.valor_venta - data.valor_costo;
      report += `| ${cat} | ${data.cantidad} | $${data.valor_costo.toFixed(2)} | $${data.valor_venta.toFixed(2)} | $${ganancia.toFixed(2)} |\n`;
    });
  report += `\n`;

  // Monthly Sales
  report += `## 📅 Ventas por Mes\n\n`;
  report += `| Mes | Cantidad | Ventas | Ganancias | Propinas |\n`;
  report += `|-----|----------|--------|-----------|----------|\n`;
  const mesesOrdenados = Object.keys(statistics.ventas_por_mes).sort();
  mesesOrdenados.forEach(mes => {
    const data = statistics.ventas_por_mes[mes];
    report += `| ${mes} | ${data.cantidad} | $${data.total.toFixed(2)} | $${data.ganancias.toFixed(2)} | $${data.propinas.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Service Types
  report += `## 🎯 Ventas por Tipo de Servicio\n\n`;
  report += `| Servicio | Cantidad | Total | Ganancias |\n`;
  report += `|----------|----------|-------|------------|\n`;
  Object.entries(statistics.ventas_por_servicio)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([servicio, data]) => {
      report += `| ${servicio} | ${data.cantidad} | $${data.total.toFixed(2)} | $${data.ganancias.toFixed(2)} |\n`;
    });
  report += `\n`;

  // Payment Methods
  report += `## 💳 Métodos de Pago\n\n`;
  report += `| Método | Cantidad | Total |\n`;
  report += `|--------|----------|-------|\n`;
  Object.entries(statistics.metodos_pago)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([metodo, data]) => {
      report += `| ${metodo} | ${data.cantidad} | $${data.total.toFixed(2)} |\n`;
    });
  report += `\n`;

  // Top Clients
  report += `## 👥 Top 20 Clientes\n\n`;
  report += `| Cliente | Visitas | Total Gastado |\n`;
  report += `|---------|---------|---------------|\n`;
  Object.entries(statistics.top_clientes).forEach(([cliente, data]) => {
    report += `| ${cliente} | ${data.cantidad} | $${data.total.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Recent Sales
  if (registros.length > 0) {
    report += `## 🛒 Últimas 50 Ventas\n\n`;
    report += `| Fecha | Cliente | Servicio | Total | Pago | Ganancia |\n`;
    report += `|-------|---------|----------|-------|------|----------|\n`;
    registros.slice(0, 50).forEach(r => {
      const fecha = new Date(r.date).toISOString().split('T')[0];
      report += `| ${fecha} | ${r.client} | ${r.service} | $${parseFloat(r.total || 0).toFixed(2)} | ${r.payment} | $${parseFloat(r.profit || 0).toFixed(2)} |\n`;
    });
    report += `\n`;
  }

  // All Products
  if (productos.length > 0) {
    report += `## 📦 Inventario Completo de Productos\n\n`;
    report += `| Producto | Categoría | Precio | Costo | Stock | Valor Total |\n`;
    report += `|----------|-----------|--------|-------|-------|-------------|\n`;
    productos.forEach(p => {
      const valorTotal = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
      report += `| ${p.name} | ${p.category || 'N/A'} | $${parseFloat(p.price || 0).toFixed(2)} | $${parseFloat(p.cost || 0).toFixed(2)} | ${p.quantity || 0} | $${valorTotal.toFixed(2)} |\n`;
    });
    report += `\n`;
  }

  // Cash Cuts
  if (cortes_caja.length > 0) {
    report += `## 💵 Cortes de Caja\n\n`;
    report += `| Fecha | Efectivo Esperado | Efectivo Real | Diferencia |\n`;
    report += `|-------|-------------------|---------------|------------|\n`;
    cortes_caja.slice(0, 50).forEach(cut => {
      const fecha = new Date(cut.created_at).toISOString().split('T')[0];
      const esperado = parseFloat(cut.expected_cash || 0);
      const real = parseFloat(cut.actual_cash || 0);
      const diff = real - esperado;
      const diffStr = diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`;
      report += `| ${fecha} | $${esperado.toFixed(2)} | $${real.toFixed(2)} | ${diffStr} |\n`;
    });
    report += `\n`;
  }

  // Coworking Sessions
  if (sesiones_coworking.length > 0) {
    report += `## 💼 Sesiones de Coworking\n\n`;
    report += `| Cliente | Inicio | Fin | Total | Estado |\n`;
    report += `|---------|--------|-----|-------|--------|\n`;
    sesiones_coworking.forEach(session => {
      const inicio = new Date(session.start_time).toISOString().split('T')[0];
      const fin = session.end_time ? new Date(session.end_time).toISOString().split('T')[0] : 'En curso';
      report += `| ${session.client} | ${inicio} | ${fin} | $${parseFloat(session.total || 0).toFixed(2)} | ${session.status} |\n`;
    });
    report += `\n`;
  }

  // Users
  if (usuarios.length > 0) {
    report += `## 👤 Usuarios del Sistema\n\n`;
    report += `| Usuario | Rol | Estado | Fecha Creación |\n`;
    report += `|---------|-----|--------|----------------|\n`;
    usuarios.forEach(u => {
      const fecha = new Date(u.created_at).toISOString().split('T')[0];
      const estado = u.is_active ? '✅ Activo' : '❌ Inactivo';
      report += `| ${u.username} | ${u.role} | ${estado} | ${fecha} |\n`;
    });
    report += `\n`;
  }

  report += `---\n\n`;
  report += `*Reporte generado automáticamente el ${fecha}*\n`;
  report += `*Sistema de Punto de Venta - Conejo Negro*\n`;
  report += `*Datos extraídos de PostgreSQL en Railway*\n`;

  return report;
}

// Execute export
exportAllData()
  .then((result) => {
    console.log('🎉 Exportación completada exitosamente!\n');
    console.log('📊 Estadísticas generales:');
    console.log(`   Total registros: ${result.allData.registros.length}`);
    console.log(`   Total ventas: $${result.statistics.resumen.total_ventas.toFixed(2)}`);
    console.log(`   Total ganancias: $${result.statistics.resumen.total_ganancias.toFixed(2)}`);
    console.log(`   Margen: ${result.statistics.resumen.margen_ganancia}\n`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error en la exportación:', error.message);
    process.exit(1);
  });
