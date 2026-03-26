// Simple database export script
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import database module
let db;
try {
  db = require('../utils/database');
} catch (error) {
  console.error('Error loading database module:', error.message);
  process.exit(1);
}

async function exportData() {
  try {
    console.log('🚀 Iniciando extracción de datos...\n');

    // Initialize database
    await db.init();
    console.log('✅ Base de datos inicializada\n');

    console.log('📊 Extrayendo datos...\n');

    // Get all data
    const [usuarios, productos, registros, cortesCaja, sesionesCoworking] = await Promise.all([
      db.getUsers().catch(() => []),
      db.getProducts().catch(() => []),
      db.getRecords().catch(() => []),
      db.getCashCuts(1000).catch(() => []),
      db.getCoworkingSessions().catch(() => [])
    ]);

    console.log(`✅ Datos extraídos:`);
    console.log(`   Usuarios: ${usuarios.length}`);
    console.log(`   Productos: ${productos.length}`);
    console.log(`   Registros: ${registros.length}`);
    console.log(`   Cortes de caja: ${cortesCaja.length}`);
    console.log(`   Sesiones coworking: ${sesionesCoworking.length}\n`);

    // Calculate statistics
    const stats = calculateStats(registros, productos);

    // Prepare data
    const allData = {
      fecha_extraccion: new Date().toISOString(),
      estadisticas: stats,
      datos: {
        usuarios: usuarios.map(u => ({
          id: u._id,
          username: u.username,
          rol: u.role,
          activo: u.isActive
        })),
        productos,
        registros,
        cortes_caja: cortesCaja,
        sesiones_coworking: sesionesCoworking
      }
    };

    // Generate report
    const report = generateReport(allData, stats);

    // Save files
    const docsDir = path.join(__dirname, '..', 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    const markdownPath = path.join(docsDir, 'reporte-completo-punto-venta.md');
    const jsonPath = path.join(docsDir, 'datos-completos-punto-venta.json');

    await fs.writeFile(markdownPath, report, 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(allData, null, 2), 'utf8');

    console.log('✅ Archivos generados:\n');
    console.log(`   📄 ${markdownPath}`);
    console.log(`   📄 ${jsonPath}\n`);

    // Close database
    await db.close();

    console.log('🎉 Exportación completada!\n');
    console.log(`📊 Resumen:`);
    console.log(`   Total ventas: $${stats.total_ventas.toFixed(2)}`);
    console.log(`   Total ganancias: $${stats.total_ganancias.toFixed(2)}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await db.close().catch(() => {});
    process.exit(1);
  }
}

function calculateStats(registros, productos) {
  const totalVentas = registros.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
  const totalCostos = registros.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0);
  const totalGanancias = registros.reduce((sum, r) => sum + parseFloat(r.profit || 0), 0);

  const ventasPorMes = {};
  registros.forEach(r => {
    const fecha = new Date(r.date);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!ventasPorMes[mes]) ventasPorMes[mes] = { cantidad: 0, total: 0 };
    ventasPorMes[mes].cantidad++;
    ventasPorMes[mes].total += parseFloat(r.total || 0);
  });

  const fechas = registros.map(r => new Date(r.date)).filter(f => !isNaN(f));
  const fechaInicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
  const fechaFin = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  return {
    total_ventas: totalVentas,
    total_costos: totalCostos,
    total_ganancias: totalGanancias,
    cantidad_registros: registros.length,
    cantidad_productos: productos.length,
    fecha_inicio: fechaInicio?.toISOString().split('T')[0],
    fecha_fin: fechaFin?.toISOString().split('T')[0],
    ventas_por_mes: ventasPorMes
  };
}

function generateReport(data, stats) {
  const fecha = new Date().toISOString().split('T')[0];
  let report = `# 📊 Reporte Completo - Punto de Venta Conejo Negro\n\n`;
  report += `**Generado:** ${fecha}\n`;
  report += `**Período:** ${stats.fecha_inicio} - ${stats.fecha_fin}\n\n`;
  report += `## Resumen\n\n`;
  report += `| Métrica | Valor |\n`;
  report += `|---------|-------|\n`;
  report += `| Ventas Totales | $${stats.total_ventas.toFixed(2)} |\n`;
  report += `| Costos | $${stats.total_costos.toFixed(2)} |\n`;
  report += `| Ganancias | $${stats.total_ganancias.toFixed(2)} |\n`;
  report += `| Registros | ${stats.cantidad_registros} |\n`;
  report += `| Productos | ${stats.cantidad_productos} |\n\n`;

  report += `## Ventas por Mes\n\n`;
  report += `| Mes | Cantidad | Total |\n`;
  report += `|-----|----------|-------|\n`;
  Object.keys(stats.ventas_por_mes).sort().forEach(mes => {
    const d = stats.ventas_por_mes[mes];
    report += `| ${mes} | ${d.cantidad} | $${d.total.toFixed(2)} |\n`;
  });

  return report;
}

// Run
exportData();
