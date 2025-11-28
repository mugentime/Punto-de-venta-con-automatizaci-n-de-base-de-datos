import { test, expect } from '@playwright/test';

test('Medir tiempo de renderizado del historial de cortes de caja', async ({ page }) => {
  const metrics = {
    navigationStart: 0,
    loginStart: 0,
    loginEnd: 0,
    clickCajaStart: 0,
    clickCajaEnd: 0,
    historyRenderStart: 0,
    historyRenderEnd: 0,
    totalTime: 0
  };

  // Store console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });

  // 1️⃣ NAVEGACIÓN - Inicio
  metrics.navigationStart = Date.now();
  console.log('🌐 Navegando a https://fixbranch.up.railway.app/');
  await page.goto('https://fixbranch.up.railway.app/');
  await page.waitForLoadState('networkidle');
  const navigationTime = Date.now() - metrics.navigationStart;
  console.log(`⏱️  Tiempo de navegación: ${navigationTime}ms (${(navigationTime / 1000).toFixed(3)}s)`);

  // 2️⃣ LOGIN - Inicio
  metrics.loginStart = Date.now();
  console.log('\n🔐 Iniciando sesión...');
  await page.fill('input[type="email"]', 'admin@conejonegro.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.press('input[type="password"]', 'Enter');

  // Wait for Sales screen (login exitoso)
  await page.waitForSelector('text=Punto de Venta', { timeout: 10000 });
  metrics.loginEnd = Date.now();
  const loginTime = metrics.loginEnd - metrics.loginStart;
  console.log(`✅ Login completado en: ${loginTime}ms (${(loginTime / 1000).toFixed(3)}s)`);

  // 3️⃣ CLIC EN BOTÓN CAJA - Inicio
  metrics.clickCajaStart = Date.now();
  console.log('\n💰 Haciendo clic en botón Caja...');
  const cajaButton = page.locator('button:has-text("Caja")').first();
  await cajaButton.click();

  // Esperar a que la pantalla de Caja esté visible
  await page.waitForSelector('text=Reporte de Caja', { timeout: 5000 });
  metrics.clickCajaEnd = Date.now();
  const cajaClickTime = metrics.clickCajaEnd - metrics.clickCajaStart;
  console.log(`✅ Pantalla de Caja cargada en: ${cajaClickTime}ms (${(cajaClickTime / 1000).toFixed(3)}s)`);

  // 4️⃣ RENDERIZADO DEL HISTORIAL - Inicio
  metrics.historyRenderStart = Date.now();
  console.log('\n📊 Esperando renderizado del historial de cortes de caja...');

  // Esperar a que aparezca la tabla de historial
  await page.waitForSelector('text=Historial de Cortes de Caja', { timeout: 5000 });

  // Esperar a que la tabla esté completamente renderizada
  // Buscamos las filas de la tabla (tbody > tr)
  const historyTable = page.locator('table tbody tr').first();
  await historyTable.waitFor({ state: 'visible', timeout: 5000 });

  metrics.historyRenderEnd = Date.now();
  const historyRenderTime = metrics.historyRenderEnd - metrics.historyRenderStart;
  console.log(`✅ Historial renderizado en: ${historyRenderTime}ms (${(historyRenderTime / 1000).toFixed(3)}s)`);

  // 5️⃣ CONTAR REGISTROS EN LA TABLA
  const rowCount = await page.locator('table tbody tr').count();
  console.log(`📋 Registros en el historial: ${rowCount}`);

  // 6️⃣ TIEMPO TOTAL
  metrics.totalTime = Date.now() - metrics.navigationStart;

  // 7️⃣ CAPTURA DE PANTALLA
  await page.screenshot({
    path: 'tests/screenshots/cash-report-history-performance.png',
    fullPage: true
  });
  console.log('📸 Screenshot guardado en: tests/screenshots/cash-report-history-performance.png');

  // 8️⃣ ANÁLISIS DE CONSOLE LOGS
  const errorLogs = consoleLogs.filter(log => log.startsWith('error:'));
  const warningLogs = consoleLogs.filter(log => log.startsWith('warning:'));
  const refetchLogs = consoleLogs.filter(log =>
    log.includes('CashReportScreen mounted') ||
    log.includes('Refetching orders') ||
    log.includes('deduplication')
  );

  console.log('\n📋 Logs relevantes del componente:');
  refetchLogs.forEach(log => console.log('  ' + log));

  if (errorLogs.length > 0) {
    console.log('\n❌ Errores encontrados en console:');
    errorLogs.forEach(log => console.log('  ' + log));
  }

  if (warningLogs.length > 0) {
    console.log('\n⚠️  Warnings encontrados en console:');
    warningLogs.forEach(log => console.log('  ' + log));
  }

  // 9️⃣ REPORTE FINAL DE PERFORMANCE
  console.log('\n' + '='.repeat(70));
  console.log('📊 REPORTE DE PERFORMANCE - HISTORIAL DE CORTES DE CAJA');
  console.log('='.repeat(70));
  console.log(`
┌─────────────────────────────────────────┬──────────────┬─────────────┐
│ Métrica                                 │ Milisegundos │ Segundos    │
├─────────────────────────────────────────┼──────────────┼─────────────┤
│ 1️⃣  Navegación a la página              │ ${navigationTime.toString().padEnd(12)} │ ${(navigationTime / 1000).toFixed(3).padEnd(11)} │
│ 2️⃣  Login (autenticación)               │ ${loginTime.toString().padEnd(12)} │ ${(loginTime / 1000).toFixed(3).padEnd(11)} │
│ 3️⃣  Clic en botón Caja                  │ ${cajaClickTime.toString().padEnd(12)} │ ${(cajaClickTime / 1000).toFixed(3).padEnd(11)} │
│ 4️⃣  Renderizado del historial           │ ${historyRenderTime.toString().padEnd(12)} │ ${(historyRenderTime / 1000).toFixed(3).padEnd(11)} │
├─────────────────────────────────────────┼──────────────┼─────────────┤
│ ⏱️  TIEMPO TOTAL                         │ ${metrics.totalTime.toString().padEnd(12)} │ ${(metrics.totalTime / 1000).toFixed(3).padEnd(11)} │
└─────────────────────────────────────────┴──────────────┴─────────────┘

📋 Registros renderizados: ${rowCount}
${errorLogs.length > 0 ? `❌ Errores: ${errorLogs.length}` : '✅ Sin errores'}
${warningLogs.length > 0 ? `⚠️  Warnings: ${warningLogs.length}` : '✅ Sin warnings'}
  `);

  // 🔟 MÉTRICAS ESPECÍFICAS DEL HISTORIAL
  const historyTimePerRecord = rowCount > 0 ? (historyRenderTime / rowCount) : 0;
  console.log(`📊 Tiempo promedio por registro: ${historyTimePerRecord.toFixed(2)}ms`);

  // Performance thresholds
  const thresholds = {
    historyRender: 2000, // 2 segundos máximo para renderizar historial
    totalTime: 8000 // 8 segundos máximo total
  };

  if (historyRenderTime > thresholds.historyRender) {
    console.log(`\n⚠️  WARNING: El tiempo de renderizado del historial (${historyRenderTime}ms) excede el umbral recomendado (${thresholds.historyRender}ms)`);
  } else {
    console.log(`\n✅ El tiempo de renderizado del historial está dentro del umbral aceptable`);
  }

  if (metrics.totalTime > thresholds.totalTime) {
    console.log(`⚠️  WARNING: El tiempo total (${metrics.totalTime}ms) excede el umbral recomendado (${thresholds.totalTime}ms)`);
  } else {
    console.log(`✅ El tiempo total está dentro del umbral aceptable`);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Mantener el navegador abierto para inspección
  await page.waitForTimeout(2000);
});
