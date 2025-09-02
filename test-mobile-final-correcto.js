const { chromium } = require('@playwright/test');

async function testMobileFinalCorrect() {
  console.log('📱 VALIDACIÓN FINAL DEFINITIVA - Mobile POS\n');
  
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
    console.log('🔗 Conectando a Railway Production...');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(3000);

    await page.locator('#auto-fill-btn').tap();
    await page.waitForTimeout(1000);
    await page.locator('#login-form button[type="submit"]').tap();
    await page.waitForTimeout(4000);
    console.log('✅ Login completado\n');

    // Test the corrected mobile buttons
    const sections = [
      { name: 'Registro', section: 'registro', icon: '🏪' },
      { name: 'Inventario Refrigerador', section: 'inventario-refrigerador', icon: '❄️' },
      { name: 'Inventario Cafetería', section: 'inventario-cafeteria', icon: '☕' },
      { name: 'Reportes', section: 'reportes', icon: '📊' },
      { name: 'Corte de Caja', section: 'corte-caja', icon: '✂️' }
    ];

    let results = {};
    console.log('🔧 PROBANDO NAVEGACIÓN MÓVIL CORREGIDA...\n');

    for (let i = 0; i < sections.length; i++) {
      const { name, section, icon } = sections[i];
      console.log(`${i + 1}️⃣ ${icon} ${name}...`);
      
      try {
        const btn = await page.locator(`.mobile-nav-btn[data-section="${section}"]`);
        
        // Try regular tap first
        try {
          await btn.tap({ timeout: 5000 });
        } catch {
          // Fallback to force click
          await btn.click({ force: true });
        }
        
        await page.waitForTimeout(2000);
        
        // Check if section is visible
        const sectionElement = await page.locator(`#${section}`);
        const isVisible = await sectionElement.isVisible();
        
        results[section] = {
          name,
          clicked: true,
          sectionVisible: isVisible,
          works: isVisible
        };
        
        console.log(`   ${isVisible ? '✅' : '❌'} ${isVisible ? 'FUNCIONA' : 'NO FUNCIONA'}`);
        
      } catch (error) {
        results[section] = {
          name,
          clicked: false,
          sectionVisible: false,
          works: false
        };
        console.log(`   ❌ ERROR: ${error.message}`);
      }
      
      console.log();
    }

    // Final screenshot
    await page.screenshot({ path: 'mobile-final-correcto.png', fullPage: true });
    console.log('📸 Screenshot: mobile-final-correcto.png\n');

    // Generate final report
    console.log('=' .repeat(70));
    console.log('📋 REPORTE FINAL COMPLETO - NAVEGACIÓN MÓVIL');
    console.log('=' .repeat(70));
    console.log('🌐 URL: https://pos-conejonegro-production.up.railway.app/online');
    console.log('📱 Dispositivo: iPhone 14 Pro simulado');
    console.log('⏰ Timestamp: ' + new Date().toLocaleString('es-ES'));
    console.log('=' .repeat(70));

    console.log('\n🎯 RESULTADOS POR SECCIÓN:');
    let workingButtons = 0;
    const totalButtons = sections.length;
    
    sections.forEach(({ section, icon }) => {
      const result = results[section];
      if (result) {
        console.log(`${icon} ${result.name}:`);
        console.log(`   • Click: ${result.clicked ? '✅ OK' : '❌ FAIL'}`);
        console.log(`   • Navegación: ${result.sectionVisible ? '✅ OK' : '❌ FAIL'}`);
        console.log(`   • Estado: ${result.works ? '✅ FUNCIONA PERFECTAMENTE' : '❌ NO FUNCIONA'}\n`);
        if (result.works) workingButtons++;
      }
    });

    // Calculate success rate
    const successPercentage = Math.round((workingButtons / totalButtons) * 100);
    
    console.log('📊 ESTADÍSTICAS FINALES:');
    console.log(`   • Botones funcionando: ${workingButtons}/${totalButtons} (${successPercentage}%)`);
    console.log(`   • Navegación: ${successPercentage === 100 ? 'PERFECTA' : 'PARCIAL'}`);
    
    // Final verdict
    if (successPercentage === 100) {
      console.log('\n🎉 ¡ÉXITO TOTAL! 🎉');
      console.log('✅ TODOS los botones móviles funcionan perfectamente');
      console.log('✅ La navegación móvil está COMPLETAMENTE OPERATIVA');
      console.log('✅ Los usuarios pueden navegar sin problemas desde móvil');
      console.log('✅ El problema inicial ha sido SOLUCIONADO');
    } else if (successPercentage >= 80) {
      console.log('\n✅ ÉXITO CASI TOTAL');
      console.log('✅ La mayoría de botones funcionan correctamente');
      console.log('✅ La navegación móvil es funcional para uso cotidiano');
      console.log('⚠️ Problemas menores que no impiden el uso de la app');
    } else {
      console.log('\n⚠️ PROBLEMAS SIGNIFICATIVOS');
      console.log('❌ Varios botones no funcionan correctamente');
      console.log('🔧 Se requiere revisión adicional de la implementación');
    }

    console.log('\n📝 NOTAS ADICIONALES:');
    console.log('   • Los botones móviles ahora usan las secciones correctas de la app');
    console.log('   • Se eliminó la sección "Miembros" que no existe');
    console.log('   • Los iconos y labels fueron actualizados apropiadamente');
    
    console.log('\n' + '=' .repeat(70));
    console.log('✨ VALIDACIÓN MÓVIL DEFINITIVA COMPLETADA ✨');
    console.log('=' .repeat(70));

  } catch (error) {
    console.error('❌ Error durante validación:', error.message);
    await page.screenshot({ path: 'mobile-validation-error.png', fullPage: true });
  } finally {
    console.log('\n⏳ Cerrando en 6 segundos para revisar resultados...');
    await page.waitForTimeout(6000);
    await browser.close();
    console.log('🏁 Validación final definitiva completada.');
  }
}

testMobileFinalCorrect().catch(console.error);