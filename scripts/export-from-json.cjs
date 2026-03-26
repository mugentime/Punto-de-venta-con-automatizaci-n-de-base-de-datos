const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const docsDir = path.join(__dirname, '..', 'docs');

async function loadJSONFile(filename) {
  try {
    const filePath = path.join(dataDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.log(`  ⚠️  ${filename}: ${error.message}`);
    return [];
  }
}

async function exportData() {
  try {
    console.log('🚀 Extrayendo datos de archivos JSON locales...\n');

    // Load all JSON files
    console.log('📊 Cargando archivos...\n');

    const [
      records,
      products,
      users,
      cashcuts,
      coworking,
      expenses,
      customers,
      memberships
    ] = await Promise.all([
      loadJSONFile('records.json'),
      loadJSONFile('products.json'),
      loadJSONFile('users.json'),
      loadJSONFile('cashcuts.json'),
      loadJSONFile('coworking_sessions.json'),
      loadJSONFile('expenses.json'),
      loadJSONFile('customers.json'),
      loadJSONFile('memberships.json')
    ]);

    console.log('✅ Archivos cargados:');
    console.log(`   Registros: ${records.length}`);
    console.log(`   Productos: ${products.length}`);
    console.log(`   Usuarios: ${users.length}`);
    console.log(`   Cortes de caja: ${cashcuts.length}`);
    console.log(`   Sesiones coworking: ${coworking.length}`);
    console.log(`   Gastos: ${expenses.length}`);
    console.log(`   Clientes: ${customers.length}`);
    console.log(`   Membresías: ${memberships.length}\n`);

    console.log('📈 Calculando estadísticas...\n');

    const allData = {
      registros: records,
      productos: products,
      usuarios: users,
      cortes_caja: cashcuts,
      sesiones_coworking: coworking,
      gastos: expenses,
      clientes: customers,
      membresias: memberships
    };

    const stats = calculateStatistics(allData);

    console.log('📝 Generando reportes...\n');

    const report = generateMarkdownReport(allData, stats);
    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      fuente: 'Archivos JSON locales (data/)',
      estadisticas: stats,
      datos: allData
    };

    await fs.mkdir(docsDir, { recursive: true });

    const mdPath = path.join(docsDir, 'reporte-completo-punto-venta.md');
    const jsonPath = path.join(docsDir, 'datos-completos-punto-venta.json');

    await fs.writeFile(mdPath, report, 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    console.log('✅ Archivos generados:\n');
    console.log(`   📄 Markdown: ${mdPath}`);
    console.log(`   📄 JSON: ${jsonPath}\n`);

    console.log('🎉 Exportación completada!\n');
    console.log('📊 Resumen:');
    console.log(`   Ventas: $${stats.total_ventas.toFixed(2)}`);
    console.log(`   Ganancias: $${stats.total_ganancias.toFixed(2)}`);
    console.log(`   Margen: ${stats.margen}\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function calculateStatistics(data) {
  const records = data.registros || [];
  const products = data.productos || [];
  const expenses = data.gastos || [];

  const totalVentas = records.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalCostos = records.reduce((s, r) => s + parseFloat(r.cost || 0), 0);
  const totalGanancias = records.reduce((s, r) => s + parseFloat(r.profit || 0), 0);
  const totalPropinas = records.reduce((s, r) => s + parseFloat(r.tip || 0), 0);
  const totalGastos = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  const ventasPorMes = {};
  const gastosPorMes = {};
  const ventasPorServicio = {};
  const metodosPago = {};
  const clientesTop = {};

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

    const cliente = r.client || 'Sin nombre';
    if (!clientesTop[cliente]) clientesTop[cliente] = { cantidad: 0, total: 0 };
    clientesTop[cliente].cantidad++;
    clientesTop[cliente].total += parseFloat(r.total || 0);
  });

  expenses.forEach(e => {
    const fecha = new Date(e.date);
    if (!isNaN(fecha)) {
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!gastosPorMes[mes]) gastosPorMes[mes] = { cantidad: 0, total: 0 };
      gastosPorMes[mes].cantidad++;
      gastosPorMes[mes].total += parseFloat(e.amount || 0);
    }
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

  const topClientes = Object.entries(clientesTop)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20);

  return {
    cantidad_registros: records.length,
    cantidad_productos: products.length,
    cantidad_gastos: expenses.length,
    total_ventas: totalVentas,
    total_costos: totalCostos,
    total_ganancias: totalGanancias,
    total_propinas: totalPropinas,
    total_gastos: totalGastos,
    utilidad_neta: totalGanancias - totalGastos,
    margen: totalVentas > 0 ? ((totalGanancias / totalVentas) * 100).toFixed(2) + '%' : '0%',
    fecha_inicio: fechaInicio?.toISOString().split('T')[0],
    fecha_fin: fechaFin?.toISOString().split('T')[0],
    dias_operacion: diasOperacion,
    promedio_diario: diasOperacion > 0 ? (totalVentas / diasOperacion).toFixed(2) : 0,
    valor_inventario_costo: valorInventarioCosto,
    valor_inventario_venta: valorInventarioVenta,
    ventas_por_mes: ventasPorMes,
    gastos_por_mes: gastosPorMes,
    ventas_por_servicio: ventasPorServicio,
    metodos_pago: metodosPago,
    top_clientes: Object.fromEntries(topClientes)
  };
}

function generateMarkdownReport(data, stats) {
  const fecha = new Date().toISOString().split('T')[0];
  let r = `# 📊 Reporte Completo - Punto de Venta Conejo Negro\n\n`;
  r += `**Fecha de generación:** ${fecha}\n`;
  r += `**Período de datos:** ${stats.fecha_inicio || 'N/A'} hasta ${stats.fecha_fin || 'N/A'}\n`;
  r += `**Días de operación:** ${stats.dias_operacion} días\n`;
  r += `**Fuente:** Archivos JSON locales\n\n`;
  r += `---\n\n`;

  r += `## 💰 Resumen Ejecutivo\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| **Ventas Totales** | $${stats.total_ventas.toFixed(2)} |\n`;
  r += `| **Costos Totales** | $${stats.total_costos.toFixed(2)} |\n`;
  r += `| **Gastos Totales** | $${stats.total_gastos.toFixed(2)} |\n`;
  r += `| **Ganancias Brutas** | $${stats.total_ganancias.toFixed(2)} |\n`;
  r += `| **Utilidad Neta** | $${stats.utilidad_neta.toFixed(2)} |\n`;
  r += `| **Propinas** | $${stats.total_propinas.toFixed(2)} |\n`;
  r += `| **Margen de Ganancia** | ${stats.margen} |\n`;
  r += `| **Promedio Ventas/Día** | $${stats.promedio_diario} |\n`;
  r += `| **Total Registros** | ${stats.cantidad_registros} |\n`;
  r += `| **Total Gastos Registrados** | ${stats.cantidad_gastos} |\n\n`;

  r += `## 📊 Registros en Base de Datos\n\n`;
  r += `| Categoría | Cantidad |\n|-----------|----------|\n`;
  r += `| Usuarios | ${data.usuarios.length} |\n`;
  r += `| Productos | ${data.productos.length} |\n`;
  r += `| Registros de Ventas | ${data.registros.length} |\n`;
  r += `| Cortes de Caja | ${data.cortes_caja.length} |\n`;
  r += `| Sesiones Coworking | ${data.sesiones_coworking.length} |\n`;
  r += `| Gastos | ${data.gastos.length} |\n`;
  r += `| Clientes | ${data.clientes.length} |\n`;
  r += `| Membresías | ${data.membresias.length} |\n\n`;

  r += `## 📦 Inventario\n\n`;
  r += `| Métrica | Valor |\n|---------|-------|\n`;
  r += `| Productos Registrados | ${stats.cantidad_productos} |\n`;
  r += `| Valor Inventario (Costo) | $${stats.valor_inventario_costo.toFixed(2)} |\n`;
  r += `| Valor Inventario (Venta) | $${stats.valor_inventario_venta.toFixed(2)} |\n`;
  r += `| Ganancia Potencial | $${(stats.valor_inventario_venta - stats.valor_inventario_costo).toFixed(2)} |\n\n`;

  r += `## 📅 Ventas por Mes\n\n`;
  r += `| Mes | Cantidad | Total | Ganancias |\n|-----|----------|-------|------------|\n`;
  Object.keys(stats.ventas_por_mes).sort().forEach(mes => {
    const d = stats.ventas_por_mes[mes];
    r += `| ${mes} | ${d.cantidad} | $${d.total.toFixed(2)} | $${d.ganancias.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 💸 Gastos por Mes\n\n`;
  r += `| Mes | Cantidad | Total |\n|-----|----------|-------|\n`;
  Object.keys(stats.gastos_por_mes).sort().forEach(mes => {
    const d = stats.gastos_por_mes[mes];
    r += `| ${mes} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 🎯 Ventas por Tipo de Servicio\n\n`;
  r += `| Servicio | Cantidad | Total |\n|----------|----------|-------|\n`;
  Object.entries(stats.ventas_por_servicio).sort((a,b) => b[1].total - a[1].total).forEach(([s, d]) => {
    r += `| ${s} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 💳 Métodos de Pago\n\n`;
  r += `| Método | Cantidad | Total |\n|--------|----------|-------|\n`;
  Object.entries(stats.metodos_pago).sort((a,b) => b[1].total - a[1].total).forEach(([m, d]) => {
    r += `| ${m} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  r += `## 👥 Top 20 Clientes\n\n`;
  r += `| Cliente | Visitas | Total Gastado |\n|---------|---------|---------------|\n`;
  Object.entries(stats.top_clientes).forEach(([c, d]) => {
    r += `| ${c} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });
  r += `\n`;

  if (data.registros.length > 0) {
    r += `## 🛒 Últimas 100 Ventas\n\n`;
    r += `| Fecha | Cliente | Servicio | Total | Pago | Ganancia |\n`;
    r += `|-------|---------|----------|-------|------|----------|\n`;
    data.registros.slice(0, 100).forEach(rec => {
      const f = new Date(rec.date).toISOString().split('T')[0];
      r += `| ${f} | ${rec.client} | ${rec.service} | $${parseFloat(rec.total || 0).toFixed(2)} | ${rec.payment} | $${parseFloat(rec.profit || 0).toFixed(2)} |\n`;
    });
    r += `\n`;
  }

  if (data.gastos.length > 0) {
    r += `## 💸 Últimos 50 Gastos\n\n`;
    r += `| Fecha | Concepto | Monto | Categoría |\n`;
    r += `|-------|----------|-------|------------|\n`;
    data.gastos.slice(0, 50).forEach(g => {
      const f = new Date(g.date).toISOString().split('T')[0];
      r += `| ${f} | ${g.description || 'N/A'} | $${parseFloat(g.amount || 0).toFixed(2)} | ${g.category || 'N/A'} |\n`;
    });
    r += `\n`;
  }

  if (data.productos.length > 0) {
    r += `## 📦 Inventario Completo de Productos\n\n`;
    r += `| Producto | Categoría | Precio | Costo | Stock | Valor Total |\n`;
    r += `|----------|-----------|--------|-------|-------|-------------|\n`;
    data.productos.forEach(p => {
      const valor = parseFloat(p.price || 0) * parseInt(p.quantity || 0);
      r += `| ${p.name} | ${p.category || 'N/A'} | $${parseFloat(p.price || 0).toFixed(2)} | $${parseFloat(p.cost || 0).toFixed(2)} | ${p.quantity || 0} | $${valor.toFixed(2)} |\n`;
    });
    r += `\n`;
  }

  if (data.clientes.length > 0) {
    r += `## 👥 Clientes Registrados\n\n`;
    r += `| Nombre | Email | Teléfono |\n|--------|-------|----------|\n`;
    data.clientes.forEach(c => {
      r += `| ${c.name || 'N/A'} | ${c.email || 'N/A'} | ${c.phone || 'N/A'} |\n`;
    });
    r += `\n`;
  }

  r += `---\n\n`;
  r += `*Reporte generado automáticamente el ${fecha}*\n`;
  r += `*Sistema de Punto de Venta - Conejo Negro*\n`;
  r += `*Datos extraídos de archivos JSON locales*\n`;

  return r;
}

exportData();
