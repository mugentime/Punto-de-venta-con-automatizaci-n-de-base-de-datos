const { chromium } = require('@playwright/test');

async function debugJavaScript() {
  console.log('🔧 DEBUG - JavaScript Hamburger Function\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000,
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  });
  
  const page = await context.newPage();

  // Listen to console logs
  page.on('console', msg => {
    console.log(`🟡 BROWSER: ${msg.text()}`);
  });

  // Listen to errors
  page.on('pageerror', error => {
    console.log(`❌ PAGE ERROR: ${error.message}`);
  });

  try {
    console.log('🔗 Conectando...');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(3000);

    // Login
    await page.locator('#auto-fill-btn').tap();
    await page.waitForTimeout(1000);
    await page.locator('#login-form button[type="submit"]').tap();
    await page.waitForTimeout(4000);
    console.log('✅ Login completado\n');

    // Debug 1: Check if toggleMobileNav function exists
    console.log('1️⃣ Verificando función toggleMobileNav...');
    const functionExists = await page.evaluate(() => {
      return typeof window.toggleMobileNav === 'function';
    });
    console.log(`   ${functionExists ? '✅' : '❌'} toggleMobileNav exists: ${functionExists}\n`);

    // Debug 2: Check nav element
    console.log('2️⃣ Verificando elemento nav...');
    const navInfo = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      return {
        exists: !!nav,
        hasClass: nav ? nav.classList.contains('mobile-nav-active') : false,
        classes: nav ? Array.from(nav.classList) : []
      };
    });
    console.log(`   Nav exists: ${navInfo.exists ? '✅' : '❌'}`);
    console.log(`   Has mobile-nav-active: ${navInfo.hasClass ? '✅' : '❌'}`);
    console.log(`   Classes: [${navInfo.classes.join(', ')}]\n`);

    // Debug 3: Check hamburger element
    console.log('3️⃣ Verificando elemento hamburger...');
    const hamburgerInfo = await page.evaluate(() => {
      const hamburger = document.querySelector('.hamburger-menu');
      return {
        exists: !!hamburger,
        visible: hamburger ? getComputedStyle(hamburger).display !== 'none' : false,
        onclick: hamburger ? hamburger.getAttribute('onclick') : null,
        hasEventListener: hamburger ? hamburger.onclick !== null : false
      };
    });
    console.log(`   Hamburger exists: ${hamburgerInfo.exists ? '✅' : '❌'}`);
    console.log(`   Visible: ${hamburgerInfo.visible ? '✅' : '❌'}`);
    console.log(`   onclick attribute: ${hamburgerInfo.onclick}`);
    console.log(`   Has event listener: ${hamburgerInfo.hasEventListener ? '✅' : '❌'}\n`);

    // Debug 4: Try to call function manually
    console.log('4️⃣ Intentando llamar toggleMobileNav() manualmente...');
    const manualResult = await page.evaluate(() => {
      try {
        if (typeof window.toggleMobileNav === 'function') {
          window.toggleMobileNav();
          const nav = document.querySelector('nav');
          return {
            success: true,
            navHasActiveClass: nav ? nav.classList.contains('mobile-nav-active') : false
          };
        } else {
          return { success: false, error: 'Function not found' };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log(`   Manual call success: ${manualResult.success ? '✅' : '❌'}`);
    if (manualResult.success) {
      console.log(`   Nav has active class after call: ${manualResult.navHasActiveClass ? '✅' : '❌'}`);
    } else {
      console.log(`   Error: ${manualResult.error}`);
    }

    await page.waitForTimeout(2000);

    // Debug 5: Check CSS loading
    console.log('\n5️⃣ Verificando CSS...');
    const cssInfo = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return { error: 'Nav not found' };
      
      nav.classList.add('mobile-nav-active');
      const styles = getComputedStyle(nav);
      
      return {
        display: styles.display,
        position: styles.position,
        zIndex: styles.zIndex,
        transform: styles.transform,
        width: styles.width
      };
    });
    
    console.log('   CSS cuando nav.mobile-nav-active está activo:');
    Object.entries(cssInfo).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN DE DEBUG');
    console.log('='.repeat(60));
    
    if (functionExists && hamburgerInfo.exists) {
      console.log('✅ JavaScript y elementos están presentes');
      console.log('🔧 El problema puede ser timing o CSS');
    } else {
      console.log('❌ Problema con JavaScript o elementos faltantes');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n⏳ Cerrando en 3 segundos...');
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

debugJavaScript().catch(console.error);