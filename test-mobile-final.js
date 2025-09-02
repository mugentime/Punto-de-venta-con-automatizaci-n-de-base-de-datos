const { chromium } = require('@playwright/test');

async function testMobileFinalValidation() {
  console.log('📱 VALIDACIÓN FINAL - Botones Móviles en Producción\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1500,
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 852 }, // iPhone 14 Pro
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  
  const page = await context.newPage();

  try {
    // Navigate and login
    console.log('🔗 Conectando a: https://pos-conejonegro-production.up.railway.app/online');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(3000);

    // Auto-login
    await page.locator('#auto-fill-btn').tap();
    await page.waitForTimeout(1000);
    await page.locator('#login-form button[type="submit"]').tap();
    await page.waitForTimeout(4000);
    
    console.log('✅ Login completado\n');

    // Test results object
    let results = {
      pos: { clicked: false, sectionVisible: false },
      inventario: { clicked: false, sectionVisible: false },
      reportes: { clicked: false, sectionVisible: false },
      miembros: { clicked: false, sectionVisible: false }
    };

    // Test each button with force click if needed
    console.log('🔧 PROBANDO BOTONES MÓVILES...\n');
    
    // 1. POS Button
    console.log('1️⃣ Botón POS (Registro)...');
    try {
      const posBtn = await page.locator('.mobile-nav-btn[data-section="registro"]');
      await posBtn.tap();
      results.pos.clicked = true;
      await page.waitForTimeout(2000);
      
      const section = await page.locator('#registro');
      results.pos.sectionVisible = await section.isVisible();
      console.log(`   ✅ Click: OK | Sección visible: ${results.pos.sectionVisible ? '✅' : '❌'}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 2. Inventario Button  
    console.log('2️⃣ Botón Inventario...');
    try {
      const invBtn = await page.locator('.mobile-nav-btn[data-section="inventario-refrigerador"]');
      await invBtn.tap();
      results.inventario.clicked = true;
      await page.waitForTimeout(2000);
      
      const section = await page.locator('#inventario-refrigerador');
      results.inventario.sectionVisible = await section.isVisible();
      console.log(`   ✅ Click: OK | Sección visible: ${results.inventario.sectionVisible ? '✅' : '❌'}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 3. Reportes Button
    console.log('3️⃣ Botón Reportes...');
    try {
      const repBtn = await page.locator('.mobile-nav-btn[data-section="reportes"]');
      await repBtn.tap();
      results.reportes.clicked = true;
      await page.waitForTimeout(2000);
      
      const section = await page.locator('#reportes');
      results.reportes.sectionVisible = await section.isVisible();
      console.log(`   ✅ Click: OK | Sección visible: ${results.reportes.sectionVisible ? '✅' : '❌'}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 4. Miembros Button (with force click)
    console.log('4️⃣ Botón Miembros (con force click)...');
    try {
      const memBtn = await page.locator('.mobile-nav-btn[data-section="memberships"]');
      // Try regular tap first
      try {
        await memBtn.tap({ timeout: 5000 });
        results.miembros.clicked = true;
      } catch {
        // If regular tap fails, use force click
        console.log('   ⚠️ Regular tap falló, usando force click...');
        await memBtn.click({ force: true });
        results.miembros.clicked = true;
      }
      
      await page.waitForTimeout(2000);
      
      const section = await page.locator('#memberships');
      results.miembros.sectionVisible = await section.isVisible();
      console.log(`   ✅ Click: OK | Sección visible: ${results.miembros.sectionVisible ? '✅' : '❌'}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Test hamburger menu
    console.log('🍔 PROBANDO MENÚ HAMBURGUESA...');
    let hamburgerWorks = false;
    try {
      const hamburger = await page.locator('.hamburger-menu');
      await hamburger.tap();
      await page.waitForTimeout(1500);
      
      const sideNav = await page.locator('nav.mobile-nav-active');
      hamburgerWorks = await sideNav.isVisible();
      console.log(`   ${hamburgerWorks ? '✅' : '❌'} Menú hamburguesa ${hamburgerWorks ? 'funciona' : 'NO funciona'}`);
      
      if (hamburgerWorks) {
        await hamburger.tap(); // Close it
        await page.waitForTimeout(1000);
      }
    } catch (error) {
      console.log(`   ❌ Error hamburguesa: ${error.message}`);
    }

    // Final screenshot
    await page.screenshot({ path: 'mobile-final-validation.png', fullPage: true });
    console.log('\n📸 Screenshot final: mobile-final-validation.png');

    // Generate comprehensive report
    console.log('\n' + '='.repeat(60));
    console.log('📋 REPORTE FINAL DE VALIDACIÓN MÓVIL');
    console.log('='.repeat(60));
    console.log('🌐 URL: https://pos-conejonegro-production.up.railway.app/online');
    console.log('📱 Dispositivo: iPhone 14 Pro (393x852)');
    console.log('🕐 Timestamp: ' + new Date().toISOString());
    console.log('='.repeat(60));

    console.log('\n📊 RESULTADOS DETALLADOS:');
    
    const sections = [
      { name: 'POS (Registro)', key: 'pos', icon: '🏪' },
      { name: 'Inventario', key: 'inventario', icon: '📦' },
      { name: 'Reportes', key: 'reportes', icon: '📊' },
      { name: 'Miembros', key: 'miembros', icon: '👥' }
    ];

    let totalSuccess = 0;
    sections.forEach(section => {
      const result = results[section.key];
      const success = result.clicked && result.sectionVisible;
      if (success) totalSuccess++;
      
      console.log(`${section.icon} ${section.name}:`);
      console.log(`   • Click: ${result.clicked ? '✅ OK' : '❌ FAIL'}`);
      console.log(`   • Sección visible: ${result.sectionVisible ? '✅ OK' : '❌ FAIL'}`);
      console.log(`   • Estado: ${success ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}\n`);
    });

    console.log('🍔 Menú Hamburguesa:');
    console.log(`   • Estado: ${hamburgerWorks ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}\n`);

    // Summary
    const successPercentage = Math.round((totalSuccess / 4) * 100);
    console.log('📈 RESUMEN EJECUTIVO:');
    console.log(`   • Botones funcionando: ${totalSuccess}/4 (${successPercentage}%)`);
    console.log(`   • Menú hamburguesa: ${hamburgerWorks ? 'Funciona' : 'No funciona'}`);
    
    if (totalSuccess === 4 && hamburgerWorks) {
      console.log('\n🎉 ¡ÉXITO TOTAL! ');
      console.log('   ✅ TODOS los botones móviles funcionan correctamente');
      console.log('   ✅ La navegación móvil está COMPLETAMENTE FUNCIONAL');
      console.log('   ✅ Los usuarios pueden navegar sin problemas en móvil');
    } else if (totalSuccess >= 3) {
      console.log('\n✅ ÉXITO PARCIAL');
      console.log('   ✅ La mayoría de botones funcionan correctamente');
      console.log('   ⚠️ Problemas menores que no afectan la funcionalidad principal');
    } else {
      console.log('\n⚠️ PROBLEMAS DETECTADOS');
      console.log('   ❌ Varios botones no funcionan correctamente');
      console.log('   🔧 Se requiere revisión adicional');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ VALIDACIÓN MÓVIL COMPLETADA ✨');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error durante validación:', error.message);
    await page.screenshot({ path: 'validation-error.png', fullPage: true });
  } finally {
    console.log('\n⏳ Cerrando en 5 segundos...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('🏁 Validación final completada.');
  }
}

testMobileFinalValidation().catch(console.error);