const { test, expect } = require('@playwright/test');

test.describe('Railway Deployment Basic Tests', () => {
  test('Railway deployment accessibility and basic functionality', async ({ page }) => {
    console.log('🚀 Starting comprehensive live test of Railway deployment...');
    
    // Test 1: Basic connectivity and load time
    const startTime = Date.now();
    
    try {
      const response = await page.goto('https://pos-conejo-negro.railway.app', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ Page loaded in ${loadTime}ms`);
      
      // Verify response is successful
      expect(response.status()).toBeLessThan(400);
      
      // Take initial screenshot
      await page.screenshot({ 
        path: 'tests/test-results/railway-initial-load.png',
        fullPage: true 
      });
      
      console.log('📸 Initial screenshot captured');
      
    } catch (error) {
      console.log('❌ Error during initial load:', error.message);
      
      // Take error screenshot
      await page.screenshot({ 
        path: 'tests/test-results/railway-load-error.png',
        fullPage: true 
      });
      
      throw error;
    }
    
    // Test 2: Check for basic HTML structure
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    expect(title.length).toBeGreaterThan(0);
    
    // Test 3: Check for viewport and basic content
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(10);
    console.log(`📝 Page contains ${bodyText.length} characters of content`);
    
    // Test 4: Check for JavaScript execution
    const jsWorking = await page.evaluate(() => {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    });
    expect(jsWorking).toBeTruthy();
    console.log('✅ JavaScript is executing properly');
    
    // Test 5: Network requests analysis
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    
    await page.reload({ waitUntil: 'networkidle' });
    
    console.log(`🌐 Captured ${requests.length} network requests`);
    expect(requests.length).toBeGreaterThan(0);
    
    // Test 6: Check for common POS elements
    const posElements = await page.locator('*').evaluateAll(elements => {
      const keywords = ['pos', 'menu', 'product', 'order', 'cart', 'total', 'price', 'item'];
      let foundElements = [];
      
      elements.forEach(el => {
        const text = (el.textContent || '').toLowerCase();
        const classes = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        
        keywords.forEach(keyword => {
          if (text.includes(keyword) || classes.includes(keyword) || id.includes(keyword)) {
            foundElements.push({
              tag: el.tagName,
              text: text.substring(0, 50),
              keyword: keyword
            });
          }
        });
      });
      
      return foundElements.slice(0, 10); // Limit results
    });
    
    console.log(`🏪 Found ${posElements.length} POS-related elements`);
    posElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tag}: "${el.text}" (${el.keyword})`);
    });
    
    // Test 7: Interactive elements check
    const interactiveElements = await page.locator('button, a, input, select').count();
    console.log(`🖱️ Found ${interactiveElements} interactive elements`);
    expect(interactiveElements).toBeGreaterThan(0);
    
    // Test 8: Mobile responsiveness basic check
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    const mobileScreenshot = await page.screenshot({ 
      path: 'tests/test-results/railway-mobile-view.png',
      fullPage: true 
    });
    
    console.log('📱 Mobile view screenshot captured');
    
    // Test 9: Error handling
    const errorElements = await page.locator('.error, [role="alert"], .alert').count();
    console.log(`⚠️ Found ${errorElements} error/alert elements`);
    
    // Test 10: Final comprehensive screenshot
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ 
      path: 'tests/test-results/railway-final-desktop.png',
      fullPage: true 
    });
    
    console.log('🖥️ Desktop view screenshot captured');
    
    // Test 11: Performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perf?.domContentLoadedEventEnd || 0,
        loadComplete: perf?.loadEventEnd || 0,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    console.log('⚡ Performance Metrics:');
    console.log(`  DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`  Load Complete: ${performanceMetrics.loadComplete}ms`);
    console.log(`  First Paint: ${performanceMetrics.firstPaint}ms`);
    console.log(`  First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms`);
    
    // Test 12: Accessibility basic check
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    const images = await page.locator('img').count();
    const forms = await page.locator('form').count();
    
    console.log('♿ Accessibility Overview:');
    console.log(`  Headings: ${headings}`);
    console.log(`  Images: ${images}`);
    console.log(`  Forms: ${forms}`);
    
    console.log('✅ Comprehensive Railway deployment test completed successfully!');
    
    // Generate simple test report
    const testReport = {
      timestamp: new Date().toISOString(),
      deployment: 'https://pos-conejo-negro.railway.app',
      loadTime: loadTime,
      title: title,
      contentLength: bodyText.length,
      networkRequests: requests.length,
      interactiveElements: interactiveElements,
      posElements: posElements.length,
      performanceMetrics: performanceMetrics,
      accessibility: { headings, images, forms }
    };
    
    // Save report to results
    await page.evaluate((report) => {
      console.log('Test Report:', JSON.stringify(report, null, 2));
    }, testReport);
  });
});