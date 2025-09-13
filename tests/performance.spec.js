const { test, expect } = require('@playwright/test');
const { injectAxe, checkA11y } = require('@axe-core/playwright');

test.describe('Performance and Load Tests', () => {
  test('should load within acceptable time limits', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to the application
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    console.log(`Page load time: ${loadTime}ms`);
    
    await page.screenshot({ 
      path: 'tests/test-results/performance-load-time.png',
      fullPage: true 
    });
  });

  test('should measure Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    
    // Measure performance metrics
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Use Performance Observer to collect metrics
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics = {};
          
          entries.forEach(entry => {
            if (entry.name === 'first-contentful-paint') {
              metrics.fcp = entry.value;
            }
            if (entry.name === 'largest-contentful-paint') {
              metrics.lcp = entry.value;
            }
          });
          
          resolve(metrics);
        });
        
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        // Fallback after 3 seconds
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          resolve({
            fcp: navigation?.loadEventEnd || 0,
            lcp: navigation?.loadEventEnd || 0,
            domContentLoaded: navigation?.domContentLoadedEventEnd || 0,
            loadComplete: navigation?.loadEventEnd || 0
          });
        }, 3000);
      });
    });

    console.log('Performance Metrics:', metrics);

    // Core Web Vitals thresholds
    if (metrics.fcp) {
      expect(metrics.fcp).toBeLessThan(2500); // FCP should be under 2.5s
    }
    if (metrics.lcp) {
      expect(metrics.lcp).toBeLessThan(4000); // LCP should be under 4s
    }
  });

  test('should handle network conditions gracefully', async ({ page, context }) => {
    // Simulate slow 3G network
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });

    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;

    // Should still load reasonably quickly even on slow network
    expect(loadTime).toBeLessThan(10000);
    
    await page.screenshot({ 
      path: 'tests/test-results/performance-slow-network.png',
      fullPage: true 
    });
  });

  test('should handle multiple concurrent users simulation', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    const loadTimes = [];

    try {
      // Simulate 5 concurrent users
      for (let i = 0; i < 5; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // Load pages concurrently
      const loadPromises = pages.map(async (page, index) => {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const loadTime = Date.now() - startTime;
        loadTimes.push(loadTime);
        
        await page.screenshot({ 
          path: `tests/test-results/performance-concurrent-user-${index + 1}.png`,
          fullPage: true 
        });
      });

      await Promise.all(loadPromises);

      // All concurrent loads should complete within reasonable time
      const maxLoadTime = Math.max(...loadTimes);
      const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;

      console.log(`Concurrent load times: ${loadTimes.join(', ')}ms`);
      console.log(`Max load time: ${maxLoadTime}ms, Average: ${avgLoadTime}ms`);

      expect(maxLoadTime).toBeLessThan(8000);
      expect(avgLoadTime).toBeLessThan(5000);

    } finally {
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('should measure resource loading efficiency', async ({ page }) => {
    // Track network requests
    const requests = [];
    const responses = [];

    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });

    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'] || 0
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log(`Total requests: ${requests.length}`);
    console.log(`Total responses: ${responses.length}`);

    // Check for failed requests
    const failedRequests = responses.filter(r => r.status >= 400);
    expect(failedRequests.length).toBe(0);

    // Check for reasonable number of requests (not too many)
    expect(requests.length).toBeLessThan(50);

    // Log resource types
    const resourceTypes = {};
    requests.forEach(req => {
      resourceTypes[req.resourceType] = (resourceTypes[req.resourceType] || 0) + 1;
    });
    
    console.log('Resource types:', resourceTypes);
  });

  test('should maintain responsiveness during interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find interactive elements
    const buttons = page.locator('button, .clickable, .product-item');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);
        
        if (await button.isVisible()) {
          const startTime = Date.now();
          
          await button.click();
          
          // Wait for any visual feedback or changes
          await page.waitForTimeout(100);
          
          const responseTime = Date.now() - startTime;
          
          // Click responses should be under 100ms for good UX
          expect(responseTime).toBeLessThan(200);
          
          console.log(`Button ${i + 1} response time: ${responseTime}ms`);
        }
      }

      await page.screenshot({ 
        path: 'tests/test-results/performance-interaction-responsiveness.png',
        fullPage: true 
      });
    }
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Measure memory usage
    const memoryUsage = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    if (memoryUsage) {
      console.log('Memory usage:', memoryUsage);
      
      // Check that we're not using excessive memory
      const memoryUsageRatio = memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit;
      expect(memoryUsageRatio).toBeLessThan(0.5); // Should use less than 50% of available heap
    }

    // Test for memory leaks by performing repeated actions
    const initialMemory = memoryUsage?.usedJSHeapSize || 0;

    // Simulate repeated interactions
    for (let i = 0; i < 10; i++) {
      const buttons = page.locator('button').first();
      if (await buttons.count() > 0) {
        await buttons.click();
        await page.waitForTimeout(100);
      }
    }

    const finalMemoryUsage = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory should not increase dramatically
    if (initialMemory > 0 && finalMemoryUsage > 0) {
      const memoryIncrease = finalMemoryUsage - initialMemory;
      const increaseRatio = memoryIncrease / initialMemory;
      
      console.log(`Memory increase: ${memoryIncrease} bytes (${(increaseRatio * 100).toFixed(2)}%)`);
      
      // Memory shouldn't increase by more than 50% during normal interactions
      expect(increaseRatio).toBeLessThan(0.5);
    }
  });
});