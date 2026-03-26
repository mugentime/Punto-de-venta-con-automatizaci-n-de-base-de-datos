import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection with proper SSL configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@caboose.proxy.rlwy.net:27640/railway',
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

async function extractAllData() {
  const client = await pool.connect();

  try {
    console.log('📊 Extrayendo todos los datos de la base de datos...\n');

    // Extract all data from different tables
    const queries = {
      ventas: 'SELECT * FROM ventas ORDER BY fecha DESC',
      detalles_venta: 'SELECT * FROM detalles_venta ORDER BY venta_id',
      gastos: 'SELECT * FROM gastos ORDER BY fecha DESC',
      productos: 'SELECT * FROM productos ORDER BY nombre',
      usuarios: 'SELECT id, nombre, apellido, email, rol, activo, created_at FROM usuarios',
      categorias: 'SELECT * FROM categorias ORDER BY nombre',
      clientes: 'SELECT * FROM clientes ORDER BY nombre',
      proveedores: 'SELECT * FROM proveedores ORDER BY nombre',
      inventario_movimientos: 'SELECT * FROM inventario_movimientos ORDER BY fecha DESC',
      cortes_caja: 'SELECT * FROM cortes_caja ORDER BY fecha_inicio DESC'
    };

    const allData = {};
    const estadisticas = {};

    // Execute all queries
    for (const [tableName, query] of Object.entries(queries)) {
      console.log(`Extrayendo ${tableName}...`);
      const result = await client.query(query);
      allData[tableName] = result.rows;
      estadisticas[tableName] = {
        total_registros: result.rows.length,
        tabla: tableName
      };
    }

    // Calculate summary statistics
    const resumen = await calculateSummary(client, allData);

    // Generate comprehensive report
    const report = generateReport(allData, estadisticas, resumen);

    // Save to file
    const outputPath = path.join(__dirname, '..', 'docs', 'reporte-completo-datos.md');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, report, 'utf8');

    // Also save raw JSON data
    const jsonPath = path.join(__dirname, '..', 'docs', 'datos-completos.json');
    await fs.writeFile(jsonPath, JSON.stringify({
      fecha_extraccion: new Date().toISOString(),
      estadisticas,
      resumen,
      datos: allData
    }, null, 2), 'utf8');

    console.log('\n✅ Datos extraídos exitosamente!');
    console.log(`📄 Reporte markdown: ${outputPath}`);
    console.log(`📄 Datos JSON: ${jsonPath}`);

    return { allData, estadisticas, resumen };

  } catch (error) {
    console.error('❌ Error al extraer datos:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function calculateSummary(client, allData) {
  const summary = {};

  // Total sales
  const totalVentas = allData.ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
  const totalGastos = allData.gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);

  // Sales by month
  const ventasPorMes = {};
  allData.ventas.forEach(venta => {
    const fecha = new Date(venta.fecha);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!ventasPorMes[mes]) {
      ventasPorMes[mes] = { cantidad: 0, total: 0 };
    }
    ventasPorMes[mes].cantidad++;
    ventasPorMes[mes].total += parseFloat(venta.total || 0);
  });

  // Expenses by month
  const gastosPorMes = {};
  allData.gastos.forEach(gasto => {
    const fecha = new Date(gasto.fecha);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!gastosPorMes[mes]) {
      gastosPorMes[mes] = { cantidad: 0, total: 0 };
    }
    gastosPorMes[mes].cantidad++;
    gastosPorMes[mes].total += parseFloat(gasto.monto || 0);
  });

  // Products sold
  const productosMasVendidos = {};
  allData.detalles_venta.forEach(detalle => {
    const producto = detalle.nombre_producto || 'Desconocido';
    if (!productosMasVendidos[producto]) {
      productosMasVendidos[producto] = {
        cantidad: 0,
        total: 0
      };
    }
    productosMasVendidos[producto].cantidad += parseInt(detalle.cantidad || 0);
    productosMasVendidos[producto].total += parseFloat(detalle.subtotal || 0);
  });

  // Sort products by quantity
  const topProductos = Object.entries(productosMasVendidos)
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .slice(0, 20);

  // Date range
  const fechas = allData.ventas.map(v => new Date(v.fecha)).filter(f => !isNaN(f));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  return {
    total_ventas: totalVentas,
    total_gastos: totalGastos,
    utilidad_neta: totalVentas - totalGastos,
    cantidad_ventas: allData.ventas.length,
    cantidad_gastos: allData.gastos.length,
    ventas_por_mes: ventasPorMes,
    gastos_por_mes: gastosPorMes,
    productos_mas_vendidos: Object.fromEntries(topProductos),
    fecha_inicio: fechaInicio?.toISOString().split('T')[0],
    fecha_fin: fechaFin?.toISOString().split('T')[0],
    total_productos: allData.productos.length,
    total_clientes: allData.clientes.length,
    total_proveedores: allData.proveedores.length
  };
}

function generateReport(allData, estadisticas, resumen) {
  const fecha = new Date().toISOString().split('T')[0];

  let report = `# 📊 Reporte Completo de Datos - Punto de Venta\n\n`;
  report += `**Fecha de extracción:** ${fecha}\n`;
  report += `**Período:** ${resumen.fecha_inicio || 'N/A'} - ${resumen.fecha_fin || 'N/A'}\n\n`;
  report += `---\n\n`;

  // Executive Summary
  report += `## 📈 Resumen Ejecutivo\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| **Total Ventas** | $${resumen.total_ventas.toFixed(2)} |\n`;
  report += `| **Total Gastos** | $${resumen.total_gastos.toFixed(2)} |\n`;
  report += `| **Utilidad Neta** | $${resumen.utilidad_neta.toFixed(2)} |\n`;
  report += `| **Cantidad de Ventas** | ${resumen.cantidad_ventas} |\n`;
  report += `| **Cantidad de Gastos** | ${resumen.cantidad_gastos} |\n`;
  report += `| **Productos Registrados** | ${resumen.total_productos} |\n`;
  report += `| **Clientes Registrados** | ${resumen.total_clientes} |\n`;
  report += `| **Proveedores Registrados** | ${resumen.total_proveedores} |\n\n`;

  // Sales by month
  report += `## 💰 Ventas por Mes\n\n`;
  report += `| Mes | Cantidad | Total |\n`;
  report += `|-----|----------|-------|\n`;
  const mesesOrdenados = Object.keys(resumen.ventas_por_mes).sort();
  mesesOrdenados.forEach(mes => {
    const data = resumen.ventas_por_mes[mes];
    report += `| ${mes} | ${data.cantidad} | $${data.total.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Expenses by month
  report += `## 💸 Gastos por Mes\n\n`;
  report += `| Mes | Cantidad | Total |\n`;
  report += `|-----|----------|-------|\n`;
  const mesesGastos = Object.keys(resumen.gastos_por_mes).sort();
  mesesGastos.forEach(mes => {
    const data = resumen.gastos_por_mes[mes];
    report += `| ${mes} | ${data.cantidad} | $${data.total.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Top products
  report += `## 🏆 Top 20 Productos Más Vendidos\n\n`;
  report += `| Producto | Cantidad | Total Vendido |\n`;
  report += `|----------|----------|---------------|\n`;
  Object.entries(resumen.productos_mas_vendidos).forEach(([producto, data]) => {
    report += `| ${producto} | ${data.cantidad} | $${data.total.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Database statistics
  report += `## 📊 Estadísticas de Base de Datos\n\n`;
  report += `| Tabla | Total Registros |\n`;
  report += `|-------|----------------|\n`;
  Object.values(estadisticas).forEach(stat => {
    report += `| ${stat.tabla} | ${stat.total_registros} |\n`;
  });
  report += `\n`;

  // Recent sales (last 50)
  report += `## 🛒 Últimas 50 Ventas\n\n`;
  report += `| Fecha | ID Venta | Total | Método Pago | Usuario |\n`;
  report += `|-------|----------|-------|-------------|----------|\n`;
  allData.ventas.slice(0, 50).forEach(venta => {
    const fecha = new Date(venta.fecha).toISOString().split('T')[0];
    report += `| ${fecha} | ${venta.id} | $${parseFloat(venta.total).toFixed(2)} | ${venta.metodo_pago || 'N/A'} | ${venta.usuario_nombre || 'N/A'} |\n`;
  });
  report += `\n`;

  // Recent expenses (last 50)
  report += `## 💳 Últimos 50 Gastos\n\n`;
  report += `| Fecha | Concepto | Monto | Categoría |\n`;
  report += `|-------|----------|-------|------------|\n`;
  allData.gastos.slice(0, 50).forEach(gasto => {
    const fecha = new Date(gasto.fecha).toISOString().split('T')[0];
    report += `| ${fecha} | ${gasto.concepto || 'N/A'} | $${parseFloat(gasto.monto || 0).toFixed(2)} | ${gasto.categoria || 'N/A'} |\n`;
  });
  report += `\n`;

  // Products inventory
  report += `## 📦 Inventario de Productos\n\n`;
  report += `| Producto | SKU | Precio | Stock | Categoría |\n`;
  report += `|----------|-----|--------|-------|------------|\n`;
  allData.productos.forEach(producto => {
    report += `| ${producto.nombre} | ${producto.sku || 'N/A'} | $${parseFloat(producto.precio || 0).toFixed(2)} | ${producto.stock || 0} | ${producto.categoria || 'N/A'} |\n`;
  });
  report += `\n`;

  // Clients
  report += `## 👥 Clientes Registrados\n\n`;
  report += `| Nombre | Email | Teléfono |\n`;
  report += `|--------|-------|----------|\n`;
  allData.clientes.forEach(cliente => {
    report += `| ${cliente.nombre || 'N/A'} | ${cliente.email || 'N/A'} | ${cliente.telefono || 'N/A'} |\n`;
  });
  report += `\n`;

  // Providers
  report += `## 🏢 Proveedores Registrados\n\n`;
  report += `| Nombre | Empresa | Teléfono | Email |\n`;
  report += `|--------|---------|----------|-------|\n`;
  allData.proveedores.forEach(proveedor => {
    report += `| ${proveedor.nombre || 'N/A'} | ${proveedor.empresa || 'N/A'} | ${proveedor.telefono || 'N/A'} | ${proveedor.email || 'N/A'} |\n`;
  });
  report += `\n`;

  report += `---\n\n`;
  report += `*Reporte generado automáticamente el ${fecha}*\n`;
  report += `*Datos extraídos de la base de datos PostgreSQL en Railway*\n`;

  return report;
}

// Run extraction
extractAllData()
  .then(() => {
    console.log('\n🎉 Proceso completado exitosamente!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
