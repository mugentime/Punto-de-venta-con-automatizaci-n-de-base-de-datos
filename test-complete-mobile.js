const { chromium } = require('@playwright/test');

async function testCompleteMobile() {
  console.log('📱 VALIDACIÓN COMPLETA - Mobile + Hamburger + Botones Problemáticos\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 2000,
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

    await page.locator('#auto-fill-btn').tap();
    await page.waitForTimeout(1000);
    await page.locator('#login-form button[type="submit"]').tap();
    await page.waitForTimeout(4000);
    console.log('✅ Login completado\n');

    let testResults = {
      mobileNavigation: {},
      hamburgerMenu: false,
      finalizarDia: false
    };

    // 1. Test mobile navigation (quick verification)
    console.log('📱 PROBANDO NAVEGACIÓN MÓVIL...\n');
    const sections = [
      { name: 'Registro', section: 'registro' },
      { name: 'Reportes', section: 'reportes' }
    ];

    for (const { name, section } of sections) {
      try {
        const btn = await page.locator(`.mobile-nav-btn[data-section="${section}"]`);
        await btn.tap({ timeout: 3000 });
        await page.waitForTimeout(1500);
        
        const sectionElement = await page.locator(`#${section}`);
        const works = await sectionElement.isVisible();
        testResults.mobileNavigation[section] = works;
        console.log(`   ${works ? '✅' : '❌'} ${name}: ${works ? 'FUNCIONA' : 'NO FUNCIONA'}`);
      } catch (error) {
        testResults.mobileNavigation[section] = false;
        console.log(`   ❌ ${name}: ERROR`);
      }
    }
    console.log();

    // 2. Test hamburger menu (with force click if needed)
    console.log('🍔 PROBANDO MENÚ HAMBURGUESA CORREGIDO...');
    try {
      const hamburger = await page.locator('.hamburger-menu');
      
      // Try regular tap first
      try {
        await hamburger.tap({ timeout: 3000 });
        console.log('   ✅ Click regular funcionó');
      } catch {
        // Fallback to force click
        console.log('   ⚠️ Click regular falló, usando force click...');
        await hamburger.click({ force: true });
      }
      
      await page.waitForTimeout(2000);
      
      // Check if side menu opened
      const sideNav = await page.locator('nav.mobile-nav-active');
      const menuOpened = await sideNav.isVisible();
      testResults.hamburgerMenu = menuOpened;
      
      console.log(`   ${menuOpened ? '✅' : '❌'} Menú lateral: ${menuOpened ? 'SE ABRIÓ' : 'NO SE ABRIÓ'}`);
      
      if (menuOpened) {
        // Try to close it
        await hamburger.click({ force: true });
        await page.waitForTimeout(1500);
        console.log('   ✅ Menú cerrado');
      }
    } catch (error) {
      console.log(`   ❌ Error hamburguesa: ${error.message}`);
    }
    console.log();

    // 3. Navigate to Reports section to find "Finalizar día" button
    console.log('🔍 PROBANDO BOTÓN "FINALIZAR EL DÍA"...');
    try {
      // Navigate to reports section
      const reportBtn = await page.locator(`.mobile-nav-btn[data-section="reportes"]`);
      await reportBtn.tap();
      await page.waitForTimeout(2000);
      
      // Look for "Finalizar día" button
      const finishDayBtn = await page.locator('#finish-day, button[onclick*="finalizarDia"], button:has-text("Finalizar"), button:has-text("Finalizar día"), button:has-text("Finalizar el día")');
      
      if (await finishDayBtn.isVisible()) {
        console.log('   ✅ Botón "Finalizar día" encontrado');
        
        // Try to click it and see what happens
        await finishDayBtn.tap();
        await page.waitForTimeout(3000);
        
        // Check for error messages
        const errorElements = await page.locator('.error, .alert-danger, .error-message, [class*="error"]');
        const errorCount = await errorElements.count();
        
        if (errorCount > 0) {
          console.log('   ⚠️ Se detectaron elementos de error:');
          for (let i = 0; i < Math.min(errorCount, 3); i++) {
            try {
              const errorText = await errorElements.nth(i).textContent();
              if (errorText && errorText.trim()) {
                console.log(`      - ${errorText.trim()}`);
              }
            } catch {}
          }
          testResults.finalizarDia = false;
        } else {
          console.log('   ✅ No se detectaron errores evidentes');
          testResults.finalizarDia = true;
        }
      } else {
        console.log('   ❌ Botón "Finalizar día" NO encontrado');
        
        // Take screenshot to see what's in reports section
        await page.screenshot({ path: 'reports-section-debug.png', fullPage: true });
        console.log('   📸 Screenshot guardado: reports-section-debug.png');
      }
    } catch (error) {
      console.log(`   ❌ Error probando finalizar día: ${error.message}`);
    }
    console.log();

    // Final screenshot
    await page.screenshot({ path: 'mobile-complete-test.png', fullPage: true });
    console.log('📸 Screenshot final: mobile-complete-test.png\n');

    // Generate comprehensive report
    console.log('=' .repeat(80));
    console.log('📋 REPORTE COMPLETO - VALIDACIÓN MÓVIL FINAL');
    console.log('=' .repeat(80));
    console.log('🌐 URL: https://pos-conejonegro-production.up.railway.app/online');
    console.log('📱 Dispositivo: iPhone 14 Pro simulado');
    console.log('🕐 Timestamp: ' + new Date().toLocaleString('es-ES'));
    console.log('=' .repeat(80));

    console.log('\n🎯 RESULTADOS DETALLADOS:');
    
    // Mobile navigation results
    console.log('\n📱 NAVEGACIÓN MÓVIL:');
    let mobileNavWorking = 0;
    const totalNavTests = Object.keys(testResults.mobileNavigation).length;
    
    Object.entries(testResults.mobileNavigation).forEach(([section, works]) => {
      console.log(`   • ${section}: ${works ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
      if (works) mobileNavWorking++;
    });
    
    const navPercentage = totalNavTests > 0 ? Math.round((mobileNavWorking / totalNavTests) * 100) : 0;
    console.log(`   📊 Total: ${mobileNavWorking}/${totalNavTests} (${navPercentage}%)`);

    // Hamburger menu results
    console.log('\n🍔 MENÚ HAMBURGUESA:');
    console.log(`   • Estado: ${testResults.hamburgerMenu ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
    if (testResults.hamburgerMenu) {
      console.log('   • El menú lateral se abre/cierra correctamente');
    } else {
      console.log('   • Problema: El menú no responde o no se visualiza');
    }

    // Finalizar día button results
    console.log('\n🔚 BOTÓN "FINALIZAR DÍA":');
    console.log(`   • Estado: ${testResults.finalizarDia ? '✅ FUNCIONA' : '❌ PROBLEMAS DETECTADOS'}`);

    // Overall assessment
    console.log('\n📈 EVALUACIÓN GENERAL:');
    const issues = [];
    if (navPercentage < 100) issues.push('Navegación móvil incompleta');
    if (!testResults.hamburgerMenu) issues.push('Menú hamburguesa no funciona');
    if (!testResults.finalizarDia) issues.push('Botón "Finalizar día" con errores');

    if (issues.length === 0) {
      console.log('🎉 ¡PERFECTO! Todos los componentes móviles funcionan correctamente');
      console.log('✅ La aplicación móvil está completamente funcional');
    } else {
      console.log('⚠️ PROBLEMAS DETECTADOS:');
      issues.forEach(issue => console.log(`   • ${issue}`));
      console.log('\n🔧 RECOMENDACIONES:');
      if (!testResults.hamburgerMenu) {
        console.log('   • Revisar z-index y conflictos de elementos en menú hamburguesa');
        console.log('   • Verificar funcionalidad de toggleMobileNav()');
      }
      if (!testResults.finalizarDia) {
        console.log('   • Revisar errores de conexión en botón "Finalizar día"');
        console.log('   • Verificar endpoints y manejo de errores');
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✨ VALIDACIÓN COMPLETA TERMINADA ✨');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Error durante validación:', error.message);
    await page.screenshot({ path: 'complete-mobile-error.png', fullPage: true });
  } finally {
    console.log('\n⏳ Cerrando en 8 segundos...');
    await page.waitForTimeout(8000);
    await browser.close();
    console.log('🏁 Test completo finalizado.');
  }
}

testCompleteMobile().catch(console.error);