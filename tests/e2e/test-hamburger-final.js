const { chromium } = require('@playwright/test');

async function testHamburgerFinal() {
  console.log('🍔 VALIDACIÓN ESPECÍFICA - Hamburger Menu Fix\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000,
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
    console.log('🔗 Conectando a Railway...');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(3000);

    await page.locator('#auto-fill-btn').tap();
    await page.waitForTimeout(1000);
    await page.locator('#login-form button[type="submit"]').tap();
    await page.waitForTimeout(4000);
    console.log('✅ Login completado\n');

    let results = {
      hamburgerVisible: false,
      hamburgerClicks: false,
      sideMenuOpens: false,
      finishDayButton: false
    };

    // 1. Check if hamburger is visible
    console.log('1️⃣ Verificando visibilidad del hamburger...');
    try {
      const hamburger = await page.locator('.hamburger-menu');
      results.hamburgerVisible = await hamburger.isVisible();
      console.log(`   ${results.hamburgerVisible ? '✅' : '❌'} Hamburger visible: ${results.hamburgerVisible}`);
    } catch (error) {
      console.log(`   ❌ Error checking visibility: ${error.message}`);
    }

    // 2. Test hamburger click with multiple methods
    console.log('\n2️⃣ Probando click en hamburger...');
    if (results.hamburgerVisible) {
      try {
        const hamburger = await page.locator('.hamburger-menu');
        
        // Method 1: Regular click
        try {
          await hamburger.click({ timeout: 5000 });
          results.hamburgerClicks = true;
          console.log('   ✅ Regular click funcionó');
        } catch {
          console.log('   ⚠️ Regular click falló, probando force click...');
          // Method 2: Force click
          try {
            await hamburger.click({ force: true });
            results.hamburgerClicks = true;
            console.log('   ✅ Force click funcionó');
          } catch {
            console.log('   ❌ Ambos métodos de click fallaron');
          }
        }
        
        await page.waitForTimeout(2000);
        
        // Check if side menu opened
        const sideNav = await page.locator('nav.mobile-nav-active');
        results.sideMenuOpens = await sideNav.isVisible();
        console.log(`   ${results.sideMenuOpens ? '✅' : '❌'} Menú lateral abierto: ${results.sideMenuOpens}`);
        
      } catch (error) {
        console.log(`   ❌ Error durante click test: ${error.message}`);
      }
    }

    // 3. Navigate to reports and test "Finalizar Día"
    console.log('\n3️⃣ Probando botón "Finalizar Día"...');
    try {
      // Navigate to reports
      const reportBtn = await page.locator('.mobile-nav-btn[data-section="reportes"]');
      await reportBtn.click({ force: true });
      await page.waitForTimeout(2000);
      
      // Look for finish day button
      const finishBtn = await page.locator('#finish-day');
      if (await finishBtn.isVisible()) {
        results.finishDayButton = true;
        console.log('   ✅ Botón "Finalizar Día" encontrado y accesible');
        
        // Try to click it (but don't confirm the action)
        try {
          await finishBtn.click({ force: true, timeout: 3000 });
          console.log('   ✅ Click en "Finalizar Día" funcionó');
        } catch (clickError) {
          console.log(`   ⚠️ Click falló: ${clickError.message}`);
          results.finishDayButton = false;
        }
      } else {
        console.log('   ❌ Botón "Finalizar Día" no encontrado');
      }
    } catch (error) {
      console.log(`   ❌ Error testando Finalizar Día: ${error.message}`);
    }

    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📋 REPORTE DE VALIDACIÓN ESPECÍFICA');
    console.log('='.repeat(60));
    console.log('🕐 Timestamp: ' + new Date().toLocaleString('es-ES'));
    
    console.log('\n🎯 RESULTADOS:');
    console.log(`🍔 Hamburger Menu:`);
    console.log(`   • Visible: ${results.hamburgerVisible ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   • Click funciona: ${results.hamburgerClicks ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   • Menú se abre: ${results.sideMenuOpens ? '✅ SÍ' : '❌ NO'}`);
    
    console.log(`\n🔚 Botón Finalizar Día:`);
    console.log(`   • Funciona: ${results.finishDayButton ? '✅ SÍ' : '❌ NO'}`);
    
    // Overall assessment
    const hamburgerWorks = results.hamburgerVisible && results.hamburgerClicks && results.sideMenuOpens;
    const allFixed = hamburgerWorks && results.finishDayButton;
    
    console.log('\n📈 EVALUACIÓN FINAL:');
    if (allFixed) {
      console.log('🎉 ¡ÉXITO TOTAL! Todos los arreglos funcionan correctamente');
    } else if (hamburgerWorks || results.finishDayButton) {
      console.log('✅ ÉXITO PARCIAL - Algunos arreglos funcionan');
    } else {
      console.log('❌ PROBLEMAS PERSISTENTES - Necesita más trabajo');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    console.log('\n⏳ Cerrando en 3 segundos...');
    await page.waitForTimeout(3000);
    await browser.close();
    console.log('🏁 Validación específica completada.');
  }
}

testHamburgerFinal().catch(console.error);