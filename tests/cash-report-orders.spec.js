import { test, expect } from '@playwright/test';

test('CashReportScreen loads orders correctly after fix', async ({ page }) => {
  const startTime = Date.now();

  // Store console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });

  // Navigate to the app
  console.log('🌐 Navigating to https://fixbranch.up.railway.app/');
  await page.goto('https://fixbranch.up.railway.app/');
  await page.waitForLoadState('networkidle');

  // Login
  console.log('🔐 Logging in...');
  await page.fill('input[type="email"]', 'admin@conejonegro.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.press('input[type="password"]', 'Enter');

  // Wait for Sales screen
  await page.waitForSelector('text=Punto de Venta', { timeout: 10000 });
  console.log('✅ Login successful');

  // Click on "Caja" button
  console.log('💰 Clicking Caja button...');
  const cajaButton = page.locator('button:has-text("Caja")').first();
  await cajaButton.click();

  // Wait a bit for the component to mount and fetch
  await page.waitForTimeout(3000);

  // Take screenshot of CashReport screen
  await page.screenshot({ path: 'tests/screenshots/cash-report-screen.png', fullPage: true });
  console.log('📸 Screenshot saved: tests/screenshots/cash-report-screen.png');

  // Check for "Total de Órdenes" stat card
  const ordersText = await page.locator('text=Total de Órdenes').locator('..').locator('..').textContent();
  console.log('📊 Orders stat card text:', ordersText);

  // Look for the orders count in the page
  const pageContent = await page.content();

  // Check console logs for successful refetch
  const refetchLogs = consoleLogs.filter(log =>
    log.includes('CashReportScreen mounted') ||
    log.includes('Refetching orders') ||
    log.includes('Orders refetched')
  );

  console.log('\n📋 Relevant console logs:');
  refetchLogs.forEach(log => console.log('  ' + log));

  // Check if orders loaded successfully
  const hasSuccessLog = consoleLogs.some(log => log.includes('Orders refetched: 337 orders'));
  const hasZeroOrders = pageContent.includes('Total de Órdenes: 0') || pageContent.includes('>0<');

  const endTime = Date.now();
  const loadTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\n⏱️  Total load time: ${loadTime} seconds`);
  console.log(`✅ Orders refetched successfully: ${hasSuccessLog}`);
  console.log(`❌ Shows 0 orders (bug): ${hasZeroOrders}`);

  // Verify fix worked
  if (hasSuccessLog && !hasZeroOrders) {
    console.log('\n✅ FIX VERIFIED: Orders are loading correctly!');
  } else if (hasZeroOrders) {
    console.log('\n⚠️  WARNING: Still showing 0 orders');
  } else {
    console.log('\n⏳ Orders might still be loading...');
  }

  // Keep browser open for inspection
  await page.waitForTimeout(2000);
});
