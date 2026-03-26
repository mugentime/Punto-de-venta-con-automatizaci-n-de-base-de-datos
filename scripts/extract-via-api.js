import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = 'http://localhost:3000/api';

// Admin credentials from the report
const ADMIN_EMAIL = 'gerencia@conejonegro.mx';
const ADMIN_PASSWORD = 'conejonegro2024';

async function login() {
  console.log('🔐 Iniciando sesión...');
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ Sesión iniciada correctamente\n');
  return data.token;
}

async function fetchData(endpoint, token) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.log(`⚠️  Error fetching ${endpoint}: ${response.statusText}`);
    return null;
  }

  return await response.json();
}

async function extractAllData() {
  try {
    console.log('🚀 Iniciando extracción de datos del servidor...\n');

    // Login to get auth token
    const token = await login();

    console.log('📊 Extrayendo datos...\n');

    // Fetch all data from different endpoints
    const endpoints = {
      usuarios: '/users',
      productos: '/products',
      registros: '/records',
      cortes_caja: '/cashcuts',
      sesiones_coworking: '/coworking'
    };

    const allData = {};

    for (const [name, endpoint] of Object.entries(endpoints)) {
      console.log(`  ⏳ Extrayendo ${name}...`);
      const data = await fetchData(endpoint, token);
      allData[name] = data || [];
      const count = Array.isArray(data) ? data.length : (data?.records?.length || 0);
      console.log(`  ✅ ${name}: ${count} registros`);
    }

    console.log('\n📈 Calculando estadísticas...\n');

    // Calculate statistics
    const statistics = calculateStatistics(allData);

    console.log('📝 Generando reportes...\n');

    // Generate reports
    const markdownReport = generateMarkdownReport(allData, statistics);
    const jsonData = {
      fecha_extraccion: new Date().toISOString(),
      fuente: 'API Local (Puerto 3000)',
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
    console.error('❌ Error:', error.message);
    throw error;
  }
}

function calculateStatistics(allData) {
  const records = Array.isArray(allData.registros) ? allData.registros : (allData.registros?.records || []);
  const products = Array.isArray(allData.productos) ? allData.productos : (allData.productos?.products || []);

  // Total sales and costs
  const totalVentas = records.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
  const totalCostos = records.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0);
  const totalGanancias = records.reduce((sum, r) => sum + parseFloat(r.profit || 0), 0);

  // Sales by month
  const ventasPorMes = {};
  records.forEach(record => {
    const fecha = new Date(record.date);
    if (isNaN(fecha.getTime())) return;
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!ventasPorMes[mes]) {
      ventasPorMes[mes] = { cantidad: 0, total: 0, ganancias: 0 };
    }
    ventasPorMes[mes].cantidad++;
    ventasPorMes[mes].total += parseFloat(record.total || 0);
    ventasPorMes[mes].ganancias += parseFloat(record.profit || 0);
  });

  // Date range
  const fechas = records.map(r => new Date(r.date)).filter(f => !isNaN(f.getTime()));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  const diasOperacion = fechaInicio && fechaFin
    ? Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return {
    resumen: {
      total_ventas: totalVentas,
      total_costos: totalCostos,
      total_ganancias: totalGanancias,
      margen_ganancia: totalVentas > 0 ? ((totalGanancias / totalVentas) * 100).toFixed(2) + '%' : '0%',
      cantidad_registros: records.length,
      cantidad_productos: products.length
    },
    periodo: {
      fecha_inicio: fechaInicio?.toISOString().split('T')[0],
      fecha_fin: fechaFin?.toISOString().split('T')[0],
      dias_operacion: diasOperacion,
      promedio_ventas_diario: diasOperacion > 0 ? totalVentas / diasOperacion : 0
    },
    ventas_por_mes: ventasPorMes
  };
}

function generateMarkdownReport(allData, statistics) {
  const fecha = new Date().toISOString().split('T')[0];
  const records = Array.isArray(allData.registros) ? allData.registros : (allData.registros?.records || []);
  const products = Array.isArray(allData.productos) ? allData.productos : (allData.productos?.products || []);

  let report = `# 📊 Reporte Completo del Punto de Venta - Conejo Negro\n\n`;
  report += `**Fecha de extracción:** ${fecha}\n`;
  report += `**Período:** ${statistics.periodo.fecha_inicio || 'N/A'} hasta ${statistics.periodo.fecha_fin || 'N/A'}\n`;
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
  report += `| **Total Registros** | ${statistics.resumen.cantidad_registros} |\n\n`;

  // Monthly Sales
  report += `## 📅 Ventas por Mes\n\n`;
  report += `| Mes | Cantidad | Total | Ganancias |\n`;
  report += `|-----|----------|-------|------------|\n`;
  const mesesOrdenados = Object.keys(statistics.ventas_por_mes).sort();
  mesesOrdenados.forEach(mes => {
    const data = statistics.ventas_por_mes[mes];
    report += `| ${mes} | ${data.cantidad} | $${data.total.toFixed(2)} | $${data.ganancias.toFixed(2)} |\n`;
  });
  report += `\n`;

  // Recent Sales
  report += `## 🛒 Últimas 50 Ventas\n\n`;
  report += `| Fecha | Cliente | Servicio | Total | Ganancia |\n`;
  report += `|-------|---------|----------|-------|----------|\n`;
  records.slice(0, 50).forEach(r => {
    const fecha = new Date(r.date).toISOString().split('T')[0];
    report += `| ${fecha} | ${r.client} | ${r.service} | $${parseFloat(r.total || 0).toFixed(2)} | $${parseFloat(r.profit || 0).toFixed(2)} |\n`;
  });
  report += `\n`;

  // Products
  if (products.length > 0) {
    report += `## 📦 Inventario de Productos\n\n`;
    report += `| Producto | Categoría | Precio | Stock |\n`;
    report += `|----------|-----------|--------|-------|\n`;
    products.forEach(p => {
      report += `| ${p.name} | ${p.category || 'N/A'} | $${parseFloat(p.price || 0).toFixed(2)} | ${p.quantity || 0} |\n`;
    });
    report += `\n`;
  }

  report += `---\n\n`;
  report += `*Reporte generado automáticamente el ${fecha}*\n`;
  report += `*Sistema de Punto de Venta - Conejo Negro*\n`;

  return report;
}

// Execute
extractAllData()
  .then((result) => {
    console.log('🎉 Exportación completada!\n');
    console.log('📊 Estadísticas:');
    console.log(`   Total ventas: $${result.statistics.resumen.total_ventas.toFixed(2)}`);
    console.log(`   Total ganancias: $${result.statistics.resumen.total_ganancias.toFixed(2)}`);
    console.log(`   Margen: ${result.statistics.resumen.margen_ganancia}\n`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
