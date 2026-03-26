const fs = require('fs').promises;
const path = require('path');

async function generateCSVFiles() {
  try {
    console.log('📊 Generando archivos para Google Sheets...\n');

    // Load data
    const dataPath = path.join(__dirname, '..', 'docs', 'datos-completos-punto-venta.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const jsonData = JSON.parse(rawData);

    const stats = jsonData.estadisticas;
    const datos = jsonData.datos;

    const exportDir = path.join(__dirname, '..', 'docs', 'export-sheets');
    await fs.mkdir(exportDir, { recursive: true });

    // 1. RESUMEN EJECUTIVO
    let resumen = 'Métrica,Valor\n';
    resumen += `"Ventas Totales","$${stats.total_ventas.toFixed(2)}"\n`;
    resumen += `"Subtotal","$${stats.total_subtotal.toFixed(2)}"\n`;
    resumen += `"Propinas","$${stats.total_propinas.toFixed(2)}"\n`;
    resumen += `"Descuentos","$${stats.total_descuentos.toFixed(2)}"\n`;
    resumen += `"Costos","$${stats.total_costos.toFixed(2)}"\n`;
    resumen += `"Ganancias","$${stats.total_ganancias.toFixed(2)}"\n`;
    resumen += `"Gastos Operativos","$${stats.total_gastos.toFixed(2)}"\n`;
    resumen += `"Utilidad Neta","$${stats.utilidad_neta.toFixed(2)}"\n`;
    resumen += `"Margen de Ganancia","${stats.margen}"\n`;
    resumen += `"Período","${stats.fecha_inicio} - ${stats.fecha_fin}"\n`;
    resumen += `"Días de Operación","${stats.dias_operacion}"\n`;
    resumen += `"Promedio Diario","$${stats.promedio_diario.toFixed(2)}"\n`;
    resumen += `"Total Órdenes","${stats.cantidad_ordenes}"\n`;
    resumen += `"Total Productos","${stats.cantidad_productos}"\n`;
    resumen += `"Total Gastos Registrados","${stats.cantidad_gastos}"\n`;
    await fs.writeFile(path.join(exportDir, '1-resumen-ejecutivo.csv'), resumen, 'utf8');
    console.log('✅ 1-resumen-ejecutivo.csv');

    // 2. VENTAS POR MES
    let ventasMes = 'Mes,Cantidad de Órdenes,Total Ventas,Subtotal,Propinas,Promedio por Orden\n';
    Object.keys(stats.ventas_por_mes).sort().forEach(mes => {
      const d = stats.ventas_por_mes[mes];
      const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
      ventasMes += `"${mes}",${d.cantidad},"${d.total.toFixed(2)}","${d.subtotal.toFixed(2)}","${d.propinas.toFixed(2)}","${promedio.toFixed(2)}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '2-ventas-por-mes.csv'), ventasMes, 'utf8');
    console.log('✅ 2-ventas-por-mes.csv');

    // 3. VENTAS POR SERVICIO
    let ventasServicio = 'Tipo de Servicio,Cantidad,Total,Promedio\n';
    Object.entries(stats.ventas_por_servicio).sort((a,b) => b[1].total - a[1].total).forEach(([tipo, d]) => {
      const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
      ventasServicio += `"${tipo}",${d.cantidad},"${d.total.toFixed(2)}","${promedio.toFixed(2)}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '3-ventas-por-servicio.csv'), ventasServicio, 'utf8');
    console.log('✅ 3-ventas-por-servicio.csv');

    // 4. MÉTODOS DE PAGO
    let metodosPago = 'Método de Pago,Transacciones,Total,Porcentaje,Promedio\n';
    Object.entries(stats.metodos_pago).sort((a,b) => b[1].total - a[1].total).forEach(([metodo, d]) => {
      const porcentaje = ((d.total / stats.total_ventas) * 100).toFixed(1);
      const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
      metodosPago += `"${metodo}",${d.cantidad},"${d.total.toFixed(2)}","${porcentaje}%","${promedio.toFixed(2)}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '4-metodos-de-pago.csv'), metodosPago, 'utf8');
    console.log('✅ 4-metodos-de-pago.csv');

    // 5. TOP CLIENTES
    let topClientes = 'Ranking,Cliente,Número de Órdenes,Total Gastado,Promedio por Visita\n';
    let num = 1;
    Object.entries(stats.top_clientes).forEach(([cliente, d]) => {
      const promedio = d.cantidad > 0 ? d.total / d.cantidad : 0;
      topClientes += `${num++},"${cliente.replace(/"/g, '""')}",${d.cantidad},"${d.total.toFixed(2)}","${promedio.toFixed(2)}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '5-top-clientes.csv'), topClientes, 'utf8');
    console.log('✅ 5-top-clientes.csv');

    // 6. INVENTARIO DE PRODUCTOS
    let productos = 'Producto,Categoría,Precio,Costo,Stock,Valor Total,Margen %\n';
    datos.productos.forEach(p => {
      const valorTotal = parseFloat(p.price) * parseInt(p.stock);
      const margen = ((parseFloat(p.price) - parseFloat(p.cost)) / parseFloat(p.price) * 100).toFixed(1);
      productos += `"${p.name.replace(/"/g, '""')}","${p.category}","${parseFloat(p.price).toFixed(2)}","${parseFloat(p.cost).toFixed(2)}",${p.stock},"${valorTotal.toFixed(2)}","${margen}%"\n`;
    });
    await fs.writeFile(path.join(exportDir, '6-inventario-productos.csv'), productos, 'utf8');
    console.log('✅ 6-inventario-productos.csv');

    // 7. TODAS LAS ÓRDENES
    let ordenes = 'Fecha,Cliente,Tipo de Servicio,Método de Pago,Subtotal,Propina,Descuento,Total\n';
    datos.ordenes.forEach(o => {
      const fecha = new Date(o.created_at).toISOString().split('T')[0];
      ordenes += `"${fecha}","${o.clientName.replace(/"/g, '""')}","${o.serviceType}","${o.paymentMethod}","${parseFloat(o.subtotal).toFixed(2)}","${parseFloat(o.tip || 0).toFixed(2)}","${parseFloat(o.discount || 0).toFixed(2)}","${parseFloat(o.total).toFixed(2)}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '7-todas-las-ordenes.csv'), ordenes, 'utf8');
    console.log('✅ 7-todas-las-ordenes.csv');

    // 8. GASTOS
    let gastos = 'Fecha,Descripción,Categoría,Monto,Método de Pago\n';
    datos.gastos.forEach(g => {
      const fecha = new Date(g.created_at).toISOString().split('T')[0];
      gastos += `"${fecha}","${g.description.replace(/"/g, '""')}","${g.category}","${parseFloat(g.amount).toFixed(2)}","${g.payment_method || 'N/A'}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '8-gastos.csv'), gastos, 'utf8');
    console.log('✅ 8-gastos.csv');

    // 9. CLIENTES
    let clientes = 'Nombre,Email,Teléfono,% Descuento,Límite de Crédito,Crédito Actual,Fecha de Registro\n';
    datos.clientes.forEach(c => {
      const fecha = new Date(c.created_at).toISOString().split('T')[0];
      clientes += `"${c.name.replace(/"/g, '""')}","${c.email || 'N/A'}","${c.phone || 'N/A'}","${c.discountPercentage || 0}%","${c.creditLimit || 0}","${c.currentCredit || 0}","${fecha}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '9-clientes.csv'), clientes, 'utf8');
    console.log('✅ 9-clientes.csv');

    // 10. SESIONES COWORKING
    let coworking = 'Fecha Inicio,Fecha Fin,Cliente,Duración (min),Tarifa/Hora,Total,Método de Pago,Estado\n';
    datos.sesiones_coworking.forEach(s => {
      const inicio = new Date(s.startTime).toISOString().split('T')[0];
      const fin = s.endTime ? new Date(s.endTime).toISOString().split('T')[0] : 'En curso';
      coworking += `"${inicio}","${fin}","${s.clientName.replace(/"/g, '""')}","${s.duration || 0}","${s.hourlyRate || 0}","${s.total || 0}","${s.paymentMethod || 'N/A'}","${s.status}"\n`;
    });
    await fs.writeFile(path.join(exportDir, '10-sesiones-coworking.csv'), coworking, 'utf8');
    console.log('✅ 10-sesiones-coworking.csv');

    console.log('\n🎉 Archivos generados en: docs/export-sheets/\n');
    console.log('📋 Para importar a Google Sheets:');
    console.log('   1. Ve a Google Sheets');
    console.log('   2. Archivo → Importar');
    console.log('   3. Subir → Selecciona cada archivo CSV');
    console.log('   4. Opciones: Crear hoja nueva para cada archivo\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

generateCSVFiles();
