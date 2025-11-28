import { test, expect } from '@playwright/test';

test.describe('Production Cash History Render Time', () => {
  test('Measure real render time on production', async ({ page }) => {
    console.log('\n🌐 Measuring PRODUCTION render time: https://fixbranch.up.railway.app/\n');

    const startTotal = Date.now();

    // Navigate to production
    console.log('⏱️  Starting navigation...');
    const navStart = Date.now();
    await page.goto('https://fixbranch.up.railway.app/');
    const navEnd = Date.now();
    console.log(`✅ Navigation completed: ${navEnd - navStart}ms\n`);

    await page.waitForLoadState('networkidle');

    // Get browser performance metrics
    const perfMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');

      return {
        // Navigation timing
        redirectTime: perfData.redirectEnd - perfData.redirectStart,
        dnsTime: perfData.domainLookupEnd - perfData.domainLookupStart,
        tcpTime: perfData.connectEnd - perfData.connectStart,
        requestTime: perfData.responseStart - perfData.requestStart,
        responseTime: perfData.responseEnd - perfData.responseStart,

        // Rendering timing
        domParse: perfData.domInteractive - perfData.responseEnd,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        domComplete: perfData.domComplete - perfData.fetchStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,

        // Paint timing
        firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,

        // Totals
        totalTime: perfData.loadEventEnd - perfData.fetchStart
      };
    });

    console.log('🌐 PRODUCTION NETWORK TIMING:');
    console.log(`   - DNS Lookup: ${perfMetrics.dnsTime.toFixed(2)}ms`);
    console.log(`   - TCP Connection: ${perfMetrics.tcpTime.toFixed(2)}ms`);
    console.log(`   - Server Response: ${perfMetrics.responseTime.toFixed(2)}ms\n`);

    console.log('⚛️  REACT APP RENDER TIMING:');
    console.log(`   - DOM Parsing: ${perfMetrics.domParse.toFixed(2)}ms`);
    console.log(`   - First Paint: ${perfMetrics.firstPaint.toFixed(2)}ms`);
    console.log(`   - First Contentful Paint: ${perfMetrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`   - DOM Content Loaded: ${perfMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`   - Page Load Complete: ${perfMetrics.totalTime.toFixed(2)}ms\n`);

    // Try to login and navigate to cash report
    console.log('🔐 Attempting to access Cash Report...');

    // Check if we need to login
    const loginButton = page.locator('button:has-text("Ingresar")');
    const isLoginPage = await loginButton.count() > 0;

    if (isLoginPage) {
      console.log('   - Login required, authenticating...');

      // Fill login form
      await page.fill('input[placeholder*="Usuario"], input[type="text"]:first-of-type', 'admin');
      await page.fill('input[placeholder*="Contraseña"], input[type="password"]', 'admin123');

      const loginStart = Date.now();
      await loginButton.click();

      // Wait for navigation after login
      await page.waitForLoadState('networkidle');
      const loginEnd = Date.now();
      console.log(`   ✅ Login completed: ${loginEnd - loginStart}ms\n`);
    }

    // Look for Cash Report / Reporte de Caja navigation
    console.log('📊 Navigating to Cash Report screen...');
    const cashReportNav = page.locator('text=/Caja|Cash|Reporte/i').first();

    if (await cashReportNav.count() > 0) {
      const navCashStart = Date.now();
      await cashReportNav.click();
      await page.waitForLoadState('networkidle');
      const navCashEnd = Date.now();
      console.log(`   ✅ Cash Report loaded: ${navCashEnd - navCashStart}ms\n`);
    }

    // CRITICAL: Measure time for history section to render
    console.log('⏱️  MEASURING CASH HISTORY RENDER TIME...');

    const historyRenderStart = Date.now();

    // Wait for the history title
    try {
      await page.locator('text=/Historial de Cortes de Caja/i').waitFor({ timeout: 10000 });
      const historyTitleTime = Date.now();
      console.log(`   ✅ History title appeared: ${historyTitleTime - historyRenderStart}ms`);

      // Wait for table to render
      await page.locator('table tbody').waitFor({ timeout: 5000 });
      const tableTime = Date.now();
      console.log(`   ✅ Table structure rendered: ${tableTime - historyTitleTime}ms`);

      // Count rows
      const rowCount = await page.locator('table tbody tr').count();
      const rowsTime = Date.now();
      console.log(`   ✅ ${rowCount} rows rendered: ${rowsTime - tableTime}ms`);

      const totalHistoryRender = rowsTime - historyRenderStart;

      console.log('\n📊 CASH HISTORY RENDER BREAKDOWN:');
      console.log(`   1. History section mount: ${historyTitleTime - historyRenderStart}ms`);
      console.log(`   2. Table structure: ${tableTime - historyTitleTime}ms`);
      console.log(`   3. Rows rendering: ${rowsTime - tableTime}ms`);
      console.log(`   ⚡ TOTAL HISTORY RENDER: ${totalHistoryRender}ms`);
      console.log(`   📈 Records displayed: ${rowCount}\n`);

      // Performance rating
      if (totalHistoryRender < 200) {
        console.log('🚀 EXCELLENT: Render time under 200ms (feels instant)');
      } else if (totalHistoryRender < 500) {
        console.log('✅ VERY GOOD: Render time under 500ms');
      } else if (totalHistoryRender < 1000) {
        console.log('👍 GOOD: Render time under 1 second');
      } else if (totalHistoryRender < 2000) {
        console.log('⚠️  ACCEPTABLE: Render time under 2 seconds');
      } else {
        console.log('❌ SLOW: Render time over 2 seconds - optimization needed');
      }

      // Take screenshot
      await page.screenshot({
        path: '.playwright-mcp/production-cash-history.png',
        fullPage: true
      });
      console.log('\n📸 Screenshot saved\n');

      const totalEnd = Date.now();
      console.log(`🎯 TOTAL TEST TIME: ${totalEnd - startTotal}ms\n`);

      // Assert performance
      expect(totalHistoryRender).toBeLessThan(3000);

    } catch (error) {
      console.log(`   ❌ History section not found: ${error.message}`);
      console.log('   📝 Current page state:');

      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`      URL: ${currentUrl}`);
      console.log(`      Title: ${pageTitle}\n`);

      // Take screenshot of current state
      await page.screenshot({ path: '.playwright-mcp/production-error-state.png' });

      throw error;
    }
  });
});
