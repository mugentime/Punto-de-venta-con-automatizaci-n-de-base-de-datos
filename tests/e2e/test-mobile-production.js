const { chromium } = require('@playwright/test');

async function testMobileProductionPOS() {
  console.log('📱 Testing Mobile POS on Production Railway...\n');
  
  // Launch browser in mobile mode
  const browser = await chromium.launch({
    headless: false, // Show browser window
    slowMo: 2000, // Slow down for visibility
  });

  // iPhone 14 Pro Max viewport
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  
  const page = await context.newPage();

  try {
    // 1. Navigate to production app
    console.log('📍 Step 1: Navegando a Railway production app...');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(4000);
    console.log('✅ Página cargada en Railway\n');

    // 2. Login
    console.log('📍 Step 2: Iniciando sesión...');
    const autoFillBtn = await page.locator('#auto-fill-btn');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.tap();
      await page.waitForTimeout(1000);
    }
    
    await page.locator('#login-form button[type="submit"]').tap();
    await page.waitForTimeout(5000);
    
    // Check if login was successful
    const loginForm = await page.locator('#login-form');
    if (await loginForm.isVisible()) {
      console.log('❌ Login falló, reintentando...');
      await page.fill('#login-email', 'admin@conejo.com');
      await page.fill('#login-password', 'admin123');
      await page.locator('#login-form button[type="submit"]').tap();
      await page.waitForTimeout(5000);
    }
    
    const mainApp = await page.locator('#main-app');
    if (await mainApp.isVisible()) {
      console.log('✅ Login exitoso - App principal visible\n');
    } else {
      console.log('❌ Login falló - no se puede continuar con pruebas\n');
      return;
    }

    // 3. Verificar navegación móvil inferior
    console.log('📍 Step 3: Verificando navegación móvil...');
    const mobileNav = await page.locator('.mobile-bottom-nav');
    if (await mobileNav.isVisible()) {
      console.log('✅ Navegación móvil inferior visible\n');
    } else {
      console.log('❌ Navegación móvil NO visible\n');
      return;
    }

    // 4. Test cada botón móvil y verificar que cambien las secciones
    console.log('📍 Step 4: Probando funcionalidad de botones móviles...\n');
    
    let testResults = {
      pos: false,
      inventario: false,
      reportes: false,
      miembros: false
    };

    // Test POS button
    console.log('   🔧 Probando botón POS...');
    const posBtn = await page.locator('.mobile-nav-btn[data-section="registro"]');
    if (await posBtn.isVisible()) {
      await posBtn.tap();
      await page.waitForTimeout(3000);
      
      // Check if POS section is active
      const registroSection = await page.locator('#registro');
      const isVisible = await registroSection.isVisible();
      testResults.pos = isVisible;
      console.log(`      ${isVisible ? '✅' : '❌'} Sección POS ${isVisible ? 'visible' : 'NO visible'}`);
    }

    // Test Inventory button  
    console.log('   🔧 Probando botón Inventario...');
    const invBtn = await page.locator('.mobile-nav-btn[data-section="inventario-refrigerador"]');
    if (await invBtn.isVisible()) {
      await invBtn.tap();
      await page.waitForTimeout(3000);
      
      // Check if inventory section is active
      const invSection = await page.locator('#inventario-refrigerador');
      const isVisible = await invSection.isVisible();
      testResults.inventario = isVisible;
      console.log(`      ${isVisible ? '✅' : '❌'} Sección Inventario ${isVisible ? 'visible' : 'NO visible'}`);
    }

    // Test Reports button
    console.log('   🔧 Probando botón Reportes...');
    const repBtn = await page.locator('.mobile-nav-btn[data-section="reportes"]');
    if (await repBtn.isVisible()) {
      await repBtn.tap();
      await page.waitForTimeout(3000);
      
      // Check if reports section is active
      const repSection = await page.locator('#reportes');
      const isVisible = await repSection.isVisible();
      testResults.reportes = isVisible;
      console.log(`      ${isVisible ? '✅' : '❌'} Sección Reportes ${isVisible ? 'visible' : 'NO visible'}`);
    }

    // Test Members button
    console.log('   🔧 Probando botón Miembros...');
    const memBtn = await page.locator('.mobile-nav-btn[data-section="memberships"]');
    if (await memBtn.isVisible()) {
      await memBtn.tap();
      await page.waitForTimeout(3000);
      
      // Check if members section is active
      const memSection = await page.locator('#memberships');
      const isVisible = await memSection.isVisible();
      testResults.miembros = isVisible;
      console.log(`      ${isVisible ? '✅' : '❌'} Sección Miembros ${isVisible ? 'visible' : 'NO visible'}\n`);
    }

    // 5. Test hamburger menu
    console.log('📍 Step 5: Probando menú hamburguesa...');
    const hamburger = await page.locator('.hamburger-menu');
    if (await hamburger.isVisible()) {
      console.log('   🔧 Abriendo menú hamburguesa...');
      await hamburger.tap();
      await page.waitForTimeout(2000);
      
      // Check if side menu opened
      const sideNav = await page.locator('nav.mobile-nav-active');
      const menuOpened = await sideNav.isVisible();
      console.log(`      ${menuOpened ? '✅' : '❌'} Menú lateral ${menuOpened ? 'se abrió correctamente' : 'NO se abrió'}`);
      
      if (menuOpened) {
        // Close menu
        console.log('   🔧 Cerrando menú...');
        await hamburger.tap();
        await page.waitForTimeout(1500);
        const menuClosed = !(await sideNav.isVisible());
        console.log(`      ${menuClosed ? '✅' : '❌'} Menú ${menuClosed ? 'cerrado correctamente' : 'NO se cerró'}\n`);
      }
    } else {
      console.log('   ❌ Menú hamburguesa NO visible\n');
    }

    // Final screenshots
    await page.screenshot({ path: 'production-mobile-final.png', fullPage: true });
    console.log('📸 Screenshot final guardado: production-mobile-final.png\n');

    // 6. Generate final report
    console.log('📊 REPORTE FINAL DE PRUEBAS MÓVILES:\n');
    console.log('='.repeat(50));
    console.log('🌐 URL: https://pos-conejonegro-production.up.railway.app/online');
    console.log('📱 Dispositivo: iPhone 14 Pro Max simulado');
    console.log('⏰ Fecha: ' + new Date().toLocaleString());
    console.log('='.repeat(50));
    
    console.log('\n🔍 RESULTADOS DE FUNCIONALIDAD:');
    console.log(`   🏪 POS (Registro): ${testResults.pos ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
    console.log(`   📦 Inventario: ${testResults.inventario ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
    console.log(`   📊 Reportes: ${testResults.reportes ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
    console.log(`   👥 Miembros: ${testResults.miembros ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
    
    const allWorking = Object.values(testResults).every(result => result === true);
    const workingCount = Object.values(testResults).filter(result => result === true).length;
    
    console.log('\n📈 RESUMEN EJECUTIVO:');
    console.log(`   Botones funcionando: ${workingCount}/4 (${Math.round(workingCount/4*100)}%)`);
    console.log(`   Estado general: ${allWorking ? '✅ TODOS LOS BOTONES FUNCIONAN' : '⚠️ ALGUNOS BOTONES NO FUNCIONAN'}`);
    
    if (allWorking) {
      console.log('\n🎉 ¡FELICITACIONES! La versión móvil está completamente funcional.');
      console.log('   Todos los botones responden correctamente y cambian las secciones como esperado.');
    } else {
      console.log('\n⚠️ Se encontraron problemas con algunos botones móviles.');
      console.log('   Revisar la implementación de las secciones que no funcionan.');
    }
    
    console.log('\n' + '='.repeat(50));

  } catch (error) {
    console.error('❌ Test falló con error:', error.message);
    await page.screenshot({ path: 'production-mobile-error.png', fullPage: true });
    console.log('📸 Screenshot de error: production-mobile-error.png');
  } finally {
    console.log('\n⏳ Manteniendo navegador abierto por 8 segundos para revisar...');
    await page.waitForTimeout(8000);
    
    await browser.close();
    console.log('🔚 Test de producción móvil completado.');
  }
}

// Run the test
testMobileProductionPOS().catch(console.error);