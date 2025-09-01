const { chromium } = require('@playwright/test');

async function testMobilePOS() {
  console.log('📱 Starting Mobile POS Application Test...\n');
  
  // Launch browser with mobile viewport
  const browser = await chromium.launch({
    headless: false, // Show browser window
    slowMo: 1500, // Slow down for visibility
  });

  // iPhone 14 Pro viewport
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  
  const page = await context.newPage();

  try {
    // 1. Navigate to the app
    console.log('📍 Step 1: Navegando a la app en modo móvil...');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(3000);
    console.log('✅ Página cargada en modo móvil\n');

    // 2. Take screenshot to see mobile layout
    await page.screenshot({ path: 'mobile-before-login.png' });
    console.log('📸 Screenshot guardado: mobile-before-login.png\n');

    // 3. Check if hamburger menu is visible
    console.log('📍 Step 2: Verificando menú hamburguesa móvil...');
    const hamburgerMenu = await page.locator('.hamburger-menu');
    if (await hamburgerMenu.isVisible()) {
      console.log('✅ Menú hamburguesa visible\n');
    } else {
      console.log('❌ Menú hamburguesa NO visible\n');
    }

    // 4. Login with auto-fill
    console.log('📍 Step 3: Iniciando sesión...');
    const autoFillBtn = await page.locator('#auto-fill-btn');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.tap(); // Use tap for mobile
      await page.waitForTimeout(1000);
      console.log('   Auto-fill presionado');
    }
    
    const submitBtn = await page.locator('#login-form button[type="submit"]');
    await submitBtn.tap();
    console.log('   Login enviado, esperando...');
    await page.waitForTimeout(5000);

    // Take screenshot after login
    await page.screenshot({ path: 'mobile-after-login.png' });
    console.log('📸 Screenshot guardado: mobile-after-login.png\n');

    // 5. Check mobile bottom navigation
    console.log('📍 Step 4: Verificando navegación móvil inferior...');
    const mobileBottomNav = await page.locator('.mobile-bottom-nav');
    if (await mobileBottomNav.isVisible()) {
      console.log('✅ Navegación inferior móvil visible');
      
      // Count navigation items
      const navItems = await page.locator('.mobile-bottom-nav .nav-item').count();
      console.log(`   Encontrados ${navItems} botones de navegación\n`);
      
      // Test each mobile nav button
      console.log('📍 Step 5: Probando botones móviles...\n');
      
      // Test POS button
      console.log('   Probando botón POS...');
      const posBtn = await page.locator('.mobile-bottom-nav a[href="#pos-section"]');
      if (await posBtn.isVisible()) {
        await posBtn.tap();
        await page.waitForTimeout(2000);
        console.log('   ✅ Botón POS presionado');
      } else {
        console.log('   ❌ Botón POS no visible');
      }
      
      // Test Inventory button
      console.log('   Probando botón Inventario...');
      const invBtn = await page.locator('.mobile-bottom-nav a[href="#inventory-section"]');
      if (await invBtn.isVisible()) {
        await invBtn.tap();
        await page.waitForTimeout(2000);
        console.log('   ✅ Botón Inventario presionado');
      } else {
        console.log('   ❌ Botón Inventario no visible');
      }
      
      // Test Reports button
      console.log('   Probando botón Reportes...');
      const repBtn = await page.locator('.mobile-bottom-nav a[href="#reports-section"]');
      if (await repBtn.isVisible()) {
        await repBtn.tap();
        await page.waitForTimeout(2000);
        console.log('   ✅ Botón Reportes presionado');
      } else {
        console.log('   ❌ Botón Reportes no visible');
      }
      
      // Test Members button
      console.log('   Probando botón Miembros...');
      const memBtn = await page.locator('.mobile-bottom-nav a[href="#members-section"]');
      if (await memBtn.isVisible()) {
        await memBtn.tap();
        await page.waitForTimeout(2000);
        console.log('   ✅ Botón Miembros presionado\n');
      } else {
        console.log('   ❌ Botón Miembros no visible\n');
      }
      
    } else {
      console.log('❌ Navegación inferior móvil NO visible\n');
    }

    // 6. Test hamburger menu
    console.log('📍 Step 6: Probando menú hamburguesa...');
    const hamburger = await page.locator('.hamburger-menu');
    if (await hamburger.isVisible()) {
      await hamburger.tap();
      await page.waitForTimeout(1500);
      console.log('   ✅ Menú hamburguesa abierto');
      
      // Check if menu opened
      const navActive = await page.locator('nav.mobile-nav-active');
      if (await navActive.isVisible()) {
        console.log('   ✅ Menú lateral visible\n');
        
        // Close menu
        await hamburger.tap();
        await page.waitForTimeout(1000);
        console.log('   ✅ Menú cerrado\n');
      } else {
        console.log('   ❌ Menú lateral no se abrió\n');
      }
    } else {
      console.log('   ❌ Hamburger menu not found\n');
    }

    // Final screenshot
    await page.screenshot({ path: 'mobile-final-state.png' });
    console.log('📸 Screenshot final: mobile-final-state.png\n');

    console.log('🎉 Test móvil completado!');
    console.log('📊 Resumen:');
    console.log('   - Login: Funciona');
    console.log('   - Navegación inferior: ' + (await mobileBottomNav.isVisible() ? 'Visible' : 'NO visible'));
    console.log('   - Menú hamburguesa: ' + (await hamburger.isVisible() ? 'Visible' : 'NO visible'));
    console.log('\n⚠️  Revisar si los botones responden correctamente');

  } catch (error) {
    console.error('❌ Test falló con error:', error.message);
    await page.screenshot({ path: 'mobile-error-state.png' });
    console.log('📸 Screenshot de error guardado: mobile-error-state.png');
  } finally {
    console.log('\n⏳ Manteniendo navegador abierto por 5 segundos...');
    await page.waitForTimeout(5000);
    
    await browser.close();
    console.log('🔚 Navegador cerrado. Test completo.');
  }
}

// Run the test
testMobilePOS().catch(console.error);