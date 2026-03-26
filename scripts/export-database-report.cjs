const db = require('../utils/database');
const fs = require('fs').promises;
const path = require('path');

async function exportAllData() {
  try {
    console.log('🚀 Iniciando extracción de datos...\n');

    // Initialize database connection
    await db.init();

    console.log('📊 Extrayendo datos de todas las tablas...\n');

    // Extract all data using existing database utilities
    const [
      users,
      products,
      records,
      cashCuts,
      coworkingSessions
    ] = await Promise.all([
      db.getUsers(),
      db.getProducts(),
      db.getRecords(),
      db.getCashCuts(1000), // Get up to 1000 cash cuts
      db.getCoworkingSessions()
    ]);

    console.log(`✅ Datos extraídos:`);
    console.log(`   - Usuarios: ${users.length}`);
    console.log(`   - Productos: ${products.length}`);
    console.log(`   - Registros: ${records.length}`);
    console.log(`   - Cortes de caja: ${cashCuts.length}`);
    console.log(`   - Sesiones coworking: ${coworkingSessions.length}\n`);

    // Calculate statistics
    const statistics = calculateStatistics(records, products, cashCuts);

    // Generate reports
    const markdownReport = generateMarkdownReport({
      users,
      products,
      records,
      cashCuts,
      coworkingSessions,
      statistics
    });

    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      estadisticas: statistics,
      datos: {
        usuarios: users.map(u => ({
          id: u._id,
          username: u.username,
          rol: u.role,
          activo: u.isActive,
          creado: u.createdAt
        })),
        productos: products,
        registros: records,
        cortes_caja: cashCuts,
        sesiones_coworking: coworkingSessions
      }
    };

    // Save files
    const docsDir = path.join(__dirname, '..', 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    const markdownPath = path.join(docsDir, 'reporte-completo-punto-venta.md');
    const jsonPath = path.join(docsDir, 'datos-completos-punto-venta.json');

    await fs.writeFile(markdownPath, markdownReport, 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    console.log('✅ Reportes generados exitosamente:\n');
    console.log(`📄 Reporte Markdown: ${markdownPath}`);
    console.log(`📄 Datos JSON: ${jsonPath}\n`);

    // Close database connection
    await db.close();

    console.log('🎉 Proceso completado!');
    return { markdownPath, jsonPath, statistics };

  } catch (error) {
    console.error('❌ Error:', error);
    await db.close();
    throw error;
  }
}

function calculateStatistics(records, products, cashCuts) {
  // Total sales and expenses
  const totalVentas = records.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
  const totalCostos = records.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0);
  const totalGanancias = records.reduce((sum, r) => sum + parseFloat(r.profit || 0), 0);

  // Sales by month
  const ventasPorMes = {};
  records.forEach(record => {
    const fecha = new Date(record.date);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!ventasPorMes[mes]) {
      ventasPorMes[mes] = {
        cantidad: 0,
        total: 0,
        ganancias: 0
      };
    }
    ventasPorMes[mes].cantidad++;
    ventasPorMes[mes].total += parseFloat(record.total || 0);
    ventasPorMes[mes].ganancias += parseFloat(record.profit || 0);
  });

  // Sales by service type
  const ventasPorServicio = {};
  records.forEach(record => {
    const servicio = record.service || 'Desconocido';
    if (!ventasPorServicio[servicio]) {
      ventasPorServicio[servicio] = {
        cantidad: 0,
        total: 0
      };
    }
    ventasPorServicio[servicio].cantidad++;
    ventasPorServicio[servicio].total += parseFloat(record.total || 0);
  });

  // Payment methods
  const metodosPago = {};
  records.forEach(record => {
    const metodo = record.payment || 'Desconocido';
    if (!metodosPago[metodo]) {
      metodosPago[metodo] = {
        cantidad: 0,
        total: 0
      };
    }
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].total += parseFloat(record.total || 0);
  });

  // Product inventory value
  const valorInventario = products.reduce((sum, p) => {
    return sum + (parseFloat(p.cost || 0) * parseInt(p.quantity || 0));
  }, 0);

  const valorInventarioVenta = products.reduce((sum, p) => {
    return sum + (parseFloat(p.price || 0) * parseInt(p.quantity || 0));
  }, 0);

  // Date range
  const fechas = records.map(r => new Date(r.date)).filter(f => !isNaN(f));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  // Calculate days of operation
  const diasOperacion = fechaInicio && fechaFin
    ? Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const promedioDiario = diasOperacion > 0 ? totalVentas / diasOperacion : 0;

  return {
    resumen: {
      total_ventas: totalVentas,
      total_costos: totalCostos,
      total_ganancias: totalGanancias,
      margen_ganancia: totalVentas > 0 ? ((totalGanancias / totalVentas) * 100).toFixed(2) + '%' : '0%',
      cantidad_registros: records.length,
      cantidad_productos: products.length,
      valor_inventario_costo: valorInventario,
      valor_inventario_venta: valorInventarioVenta,
      ganancia_potencial_inventario: valorInventarioVenta - valorInventario
    },
    periodo: {
      fecha_inicio: fechaInicio?.toISOString().split('T')[0],
      fecha_fin: fechaFin?.toISOString().split('T')[0],
      dias_operacion: diasOperacion,
      promedio_ventas_diario: promedioDiario
    },
    ventas_por_mes: ventasPorMes,
    ventas_por_servicio: ventasPorServicio,
    metodos_pago: metodosPago
  };
}

function generateMarkdownReport(data) {
  const { users, products, records, cashCuts, coworkingSessions, statistics } = data;
  const fecha = new Date().toISOString().split('T')[0];

  let report = `# 📊 Reporte Completo del Punto de Venta - Conejo Negro\n\n`;
  report += `**Fecha de extracción:** ${fecha}\n`;
  report += `**Período de datos:** ${statistics.periodo.fecha_inicio || 'N/A'} a ${statistics.periodo.fecha_fin || 'N/A'}\n`;
  report += `**Días de operación:** ${statistics.periodo.dias_operacion} días\n\n`;
  report += `---\n\n`;

  // Executive Summary
  report += `## 💰 Resumen Ejecutivo\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| **Ventas Totales** | $${statistics.resumen.total_ventas.toFixed(2)} |\n`;
  report += `| **Costos Totales** | $${statistics.resumen.total_costos.toFixed(2)} |\n`;
  report += `| **Ganancias Totales** | $${statistics.resumen.total_ganancias.toFixed(2)} |\n`;
  report += `| **Margen de Ganancia** | ${statistics.resumen.margen_ganancia} |\n`;
  report += `| **Promedio Ventas/Día** | $${statistics.periodo.promedio_ventas_diario.toFixed(2)} |\n`;
  report += `| **Total Registros** | ${statistics.resumen.cantidad_registros} |\n`;
  report += `| **Cortes de Caja** | ${cashCuts.length} |\n`;
  report += `| **Sesiones Coworking** | ${coworkingSessions.length} |\n\n`;

  // Inventory Summary
  report += `## 📦 Resumen de Inventario\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| **Productos Registrados** | ${statistics.resumen.cantidad_productos} |\n`;
  report += `| **Valor Inventario (Costo)** | $${statistics.resumen.valor_inventario_costo.toFixed(2)} |\n`;
  report += `| **Valor Inventario (Venta)** | $${statistics.resumen.valor_inventario_venta.toFixed(2)} |\n`;
  report += `| **Ganancia Potencial** | $${statistics.resumen.ganancia_potencial_inventario.toFixed(2)} |\n\n`;

  // Monthly Sales
  report += `## 📅 Ventas por Mes\n\n`;
  report += `| Mes | Cantidad | Total Ventas | Ganancias |\n`;
  report += `|-----|----------|--------------|------------|\n`;
  const mesesOrdenados = Object.keys(statistics.ventas_por_mes).sort();
  mesesOrdenados.forEach(mes => {
    const data = statistics.ventas_por_mes[mes];
    report += `| ${mes} | ${data.cantidad} | $${data.total.toFixed(2)} | $${data.ganancias.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Sales by Service Type
  report += `## 🎯 Ventas por Tipo de Servicio\n\n`;
  report += `| Servicio | Cantidad | Total |\n`;
  report += `|----------|----------|-------|\n`;
  Object.entries(statistics.ventas_por_servicio)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([servicio, data]) => {
      report += `| ${servicio} | ${data.cantidad} | $${data.total.toFixed(2)} |\n`;
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

  // Products by Category
  const productosPorCategoria = {};
  products.forEach(p => {
    const cat = p.category || 'Sin categoría';
    if (!productosPorCategoria[cat]) {
      productosPorCategoria[cat] = [];
    }
    productosPorCategoria[cat].push(p);
  });

  report += `## 📦 Productos por Categoría\n\n`;
  Object.entries(productosPorCategoria).forEach(([categoria, prods]) => {
    report += `### ${categoria} (${prods.length} productos)\n\n`;
    report += `| Producto | Precio | Stock | Valor Total |\n`;
    report += `|----------|--------|-------|-------------|\n`;
    prods.forEach(p => {
      const valorTotal = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
      report += `| ${p.name} | $${parseFloat(p.price || 0).toFixed(2)} | ${p.quantity || 0} | $${valorTotal.toFixed(2)} |\n`;
    });
    report += `\n`;
  });

  // Recent Sales (last 100)
  report += `## 🛒 Últimas 100 Ventas\n\n`;
  report += `| Fecha | Cliente | Servicio | Total | Pago | Ganancia |\n`;
  report += `|-------|---------|----------|-------|------|----------|\n`;
  records.slice(0, 100).forEach(r => {
    const fecha = new Date(r.date).toISOString().split('T')[0];
    report += `| ${fecha} | ${r.client} | ${r.service} | $${parseFloat(r.total || 0).toFixed(2)} | ${r.payment} | $${parseFloat(r.profit || 0).toFixed(2)} |\n`;
  });
  report += `\n`;

  // Cash Cuts Summary
  if (cashCuts.length > 0) {
    report += `## 💵 Cortes de Caja\n\n`;
    report += `| Fecha | Efectivo Esperado | Efectivo Real | Diferencia |\n`;
    report += `|-------|-------------------|---------------|------------|\n`;
    cashCuts.forEach(cut => {
      const fecha = new Date(cut.createdAt).toISOString().split('T')[0];
      const esperado = parseFloat(cut.expectedCash || 0);
      const real = parseFloat(cut.actualCash || 0);
      const diff = real - esperado;
      const diffStr = diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`;
      report += `| ${fecha} | $${esperado.toFixed(2)} | $${real.toFixed(2)} | ${diffStr} |\n`;
    });
    report += `\n`;
  }

  // Coworking Sessions Summary
  if (coworkingSessions.length > 0) {
    report += `## 💼 Sesiones de Coworking\n\n`;
    report += `| Cliente | Inicio | Fin | Duración | Total | Estado |\n`;
    report += `|---------|--------|-----|----------|-------|--------|\n`;
    coworkingSessions.forEach(session => {
      const inicio = new Date(session.startTime).toISOString().split('T')[0];
      const fin = session.endTime ? new Date(session.endTime).toISOString().split('T')[0] : 'En curso';
      const duracion = session.endTime
        ? Math.round((new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60)) + 'h'
        : '-';
      report += `| ${session.client} | ${inicio} | ${fin} | ${duracion} | $${parseFloat(session.total || 0).toFixed(2)} | ${session.status} |\n`;
    });
    report += `\n`;
  }

  // Users Summary
  report += `## 👥 Usuarios del Sistema\n\n`;
  report += `| Usuario | Rol | Estado | Fecha Creación |\n`;
  report += `|---------|-----|--------|----------------|\n`;
  users.forEach(u => {
    const fecha = new Date(u.createdAt).toISOString().split('T')[0];
    const estado = u.isActive ? '✅ Activo' : '❌ Inactivo';
    report += `| ${u.username} | ${u.role} | ${estado} | ${fecha} |\n`;
  });
  report += `\n`;

  report += `---\n\n`;
  report += `*Reporte generado automáticamente el ${fecha}*\n`;
  report += `*Sistema de Punto de Venta - Conejo Negro*\n`;

  return report;
}

// Execute export
exportAllData()
  .then(() => {
    console.log('\n✅ Exportación completada exitosamente!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error en la exportación:', error);
    process.exit(1);
  });
