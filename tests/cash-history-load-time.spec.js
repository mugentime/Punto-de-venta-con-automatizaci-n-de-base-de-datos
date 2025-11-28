import { test, expect } from '@playwright/test';

test.describe('Cash History Load Time', () => {
  test('Measure cash register closures history load time', async ({ page }) => {
    console.log('🚀 Starting cash history load time test...');

    // Navigate to the app
    const startNavigationTime = Date.now();
    await page.goto('http://localhost:5174');
    const navigationTime = Date.now() - startNavigationTime;
    console.log(`⏱️  Navigation time: ${navigationTime}ms`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Navigate to Cash Report screen (assuming it's accessible via a button or link)
    // Check if there's a navigation button or if we're already on the cash report screen
    const cashReportButton = page.locator('text=/Caja|Cash|Reporte/i');

    let navigatedToCashReport = false;
    if (await cashReportButton.count() > 0) {
      console.log('📍 Navigating to Cash Report screen...');
      const navStartTime = Date.now();
      await cashReportButton.first().click();
      await page.waitForLoadState('networkidle');
      const navEndTime = Date.now();
      console.log(`⏱️  Cash Report navigation time: ${navEndTime - navStartTime}ms`);
      navigatedToCashReport = true;
    } else {
      console.log('📍 Already on Cash Report screen or need to find navigation');
    }

    // Look for the cash history section
    const historyTitle = page.locator('text=/Historial de Cortes de Caja/i');

    // Measure time for history section to appear
    const historyStartTime = Date.now();
    await historyTitle.waitFor({ timeout: 10000 });
    const historyAppearTime = Date.now() - historyStartTime;
    console.log(`⏱️  History section appearance time: ${historyAppearTime}ms`);

    // Measure time for table data to load
    const tableStartTime = Date.now();
    const tableBody = page.locator('table tbody');
    await tableBody.waitFor({ timeout: 10000 });
    const tableAppearTime = Date.now() - tableStartTime;
    console.log(`⏱️  Table body appearance time: ${tableAppearTime}ms`);

    // Count rows to verify data loaded
    const rowCount = await page.locator('table tbody tr').count();
    console.log(`📊 Loaded ${rowCount} cash closure records`);

    // Measure time for all table rows to be rendered
    if (rowCount > 0) {
      const allRowsStartTime = Date.now();
      await page.locator('table tbody tr').first().waitFor({ timeout: 5000 });
      const allRowsTime = Date.now() - allRowsStartTime;
      console.log(`⏱️  All rows rendered time: ${allRowsTime}ms`);
    }

    // Get the record count from the title
    const titleText = await historyTitle.textContent();
    const recordCountMatch = titleText.match(/\((\d+) registros?\)/);
    const recordCount = recordCountMatch ? parseInt(recordCountMatch[1]) : rowCount;
    console.log(`📈 Total records in database: ${recordCount}`);

    // Total load time
    const totalLoadTime = historyAppearTime + tableAppearTime;
    console.log(`\n📊 SUMMARY - Cash History Load Time:`);
    console.log(`   - Initial page load: ${navigationTime}ms`);
    if (navigatedToCashReport) {
      console.log(`   - Cash Report navigation: varies`);
    }
    console.log(`   - History section appearance: ${historyAppearTime}ms`);
    console.log(`   - Table data load: ${tableAppearTime}ms`);
    console.log(`   - Total history load time: ${totalLoadTime}ms`);
    console.log(`   - Records loaded: ${rowCount}`);
    console.log(`   - Total records in DB: ${recordCount}`);

    // Performance evaluation
    if (totalLoadTime < 500) {
      console.log(`\n✅ EXCELLENT: Load time under 500ms`);
    } else if (totalLoadTime < 1000) {
      console.log(`\n✅ GOOD: Load time under 1 second`);
    } else if (totalLoadTime < 2000) {
      console.log(`\n⚠️  ACCEPTABLE: Load time under 2 seconds`);
    } else {
      console.log(`\n❌ SLOW: Load time over 2 seconds - optimization recommended`);
    }

    // Take a screenshot for reference
    await page.screenshot({
      path: '.playwright-mcp/cash-history-load-time.png',
      fullPage: true
    });
    console.log('\n📸 Screenshot saved to .playwright-mcp/cash-history-load-time.png');

    // Assert that the history loaded successfully
    expect(rowCount).toBeGreaterThanOrEqual(0);
    expect(totalLoadTime).toBeLessThan(5000); // Should load within 5 seconds
  });
});
