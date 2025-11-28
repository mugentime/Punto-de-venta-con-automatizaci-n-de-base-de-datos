import { test, expect } from '@playwright/test';

test.describe('PWA Render Performance', () => {
  test('Measure PWA render time with Service Worker', async ({ page, context }) => {
    console.log('\n🔵 TESTING PWA PERFORMANCE\n');

    // Enable service workers in the test context
    await context.grantPermissions(['notifications']);

    // Navigate to production PWA
    const navStart = Date.now();
    await page.goto('https://fixbranch.up.railway.app/');
    const navEnd = Date.now();
    console.log(`⏱️  Initial navigation: ${navEnd - navStart}ms\n`);

    await page.waitForLoadState('networkidle');

    // Check if Service Worker is registered
    const swStatus = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const registration = registrations.find(reg => reg.active);

        return {
          registered: !!registration,
          state: registration?.active?.state || 'not registered',
          scriptURL: registration?.active?.scriptURL || 'N/A',
          scope: registration?.scope || 'N/A'
        };
      }
      return { registered: false, state: 'N/A' };
    });

    console.log('📱 PWA STATUS:');
    console.log(`   - Service Worker: ${swStatus.registered ? '✅ Active' : '❌ Not registered'}`);
    console.log(`   - State: ${swStatus.state}`);
    console.log(`   - Scope: ${swStatus.scope}`);
    console.log(`   - Script: ${swStatus.scriptURL}\n`);

    // Check PWA manifest
    const manifestInfo = await page.evaluate(() => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      return {
        hasManifest: !!manifestLink,
        href: manifestLink?.href || 'N/A'
      };
    });

    console.log('📋 MANIFEST:');
    console.log(`   - Manifest link: ${manifestInfo.hasManifest ? '✅ Present' : '❌ Missing'}`);
    console.log(`   - Href: ${manifestInfo.href}\n`);

    // Get performance metrics with Service Worker impact
    const perfMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');

      // Get resource timing for cached vs network
      const resources = performance.getEntriesByType('resource');
      const cachedResources = resources.filter(r => r.transferSize === 0);
      const networkResources = resources.filter(r => r.transferSize > 0);

      return {
        // Navigation
        domComplete: perfData.domComplete - perfData.fetchStart,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,

        // Resource loading
        totalResources: resources.length,
        cachedCount: cachedResources.length,
        networkCount: networkResources.length,
        cacheHitRate: ((cachedResources.length / resources.length) * 100).toFixed(1),

        // Transfer sizes
        totalTransferred: resources.reduce((sum, r) => sum + r.transferSize, 0),
        totalSize: resources.reduce((sum, r) => sum + r.encodedBodySize, 0)
      };
    });

    console.log('🚀 PWA PERFORMANCE METRICS:');
    console.log(`   - DOM Complete: ${perfMetrics.domComplete.toFixed(2)}ms`);
    console.log(`   - First Contentful Paint: ${perfMetrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`   - Resources: ${perfMetrics.totalResources} total`);
    console.log(`   - Cache hits: ${perfMetrics.cachedCount} (${perfMetrics.cacheHitRate}%)`);
    console.log(`   - Network requests: ${perfMetrics.networkCount}`);
    console.log(`   - Data transferred: ${(perfMetrics.totalTransferred / 1024).toFixed(2)} KB`);
    console.log(`   - Total size: ${(perfMetrics.totalSize / 1024).toFixed(2)} KB\n`);

    // Now test a second visit (should be faster with SW cache)
    console.log('🔄 TESTING SECOND VISIT (with cache)...\n');

    const secondVisitStart = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const secondVisitEnd = Date.now();

    const secondVisitMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');

      return {
        domComplete: perfData.domComplete - perfData.fetchStart,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
      };
    });

    console.log('⚡ SECOND VISIT (CACHED):');
    console.log(`   - Total time: ${secondVisitEnd - secondVisitStart}ms`);
    console.log(`   - DOM Complete: ${secondVisitMetrics.domComplete.toFixed(2)}ms`);
    console.log(`   - First Contentful Paint: ${secondVisitMetrics.firstContentfulPaint.toFixed(2)}ms\n`);

    // Compare first vs second visit
    const improvement = ((perfMetrics.firstContentfulPaint - secondVisitMetrics.firstContentfulPaint) / perfMetrics.firstContentfulPaint * 100);

    console.log('📊 PWA CACHE BENEFIT:');
    console.log(`   - First visit FCP: ${perfMetrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`   - Second visit FCP: ${secondVisitMetrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`   - Improvement: ${improvement.toFixed(1)}% faster\n`);

    if (improvement > 20) {
      console.log('✅ EXCELLENT: PWA cache provides >20% performance boost');
    } else if (improvement > 10) {
      console.log('✅ GOOD: PWA cache provides >10% performance boost');
    } else if (improvement > 0) {
      console.log('⚠️  MINIMAL: PWA cache benefit <10%');
    } else {
      console.log('❌ NO BENEFIT: PWA cache not working effectively');
    }

    // Test offline capability
    console.log('\n🔌 TESTING OFFLINE MODE...\n');

    // Go offline
    await context.setOffline(true);

    try {
      await page.reload({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 });

      const offlineContent = await page.evaluate(() => {
        return {
          hasContent: document.body.innerText.length > 100,
          title: document.title
        };
      });

      if (offlineContent.hasContent) {
        console.log('✅ OFFLINE MODE: App loads from cache');
        console.log(`   - Title: ${offlineContent.title}`);
      } else {
        console.log('⚠️  OFFLINE MODE: Limited content available');
      }
    } catch (error) {
      console.log('❌ OFFLINE MODE: App does not work offline');
      console.log(`   - Error: ${error.message}`);
    }

    // Go back online
    await context.setOffline(false);

    console.log('\n');

    // Performance rating
    if (secondVisitMetrics.firstContentfulPaint < 500) {
      console.log('🚀 EXCELLENT PWA: Sub-500ms render with cache');
    } else if (secondVisitMetrics.firstContentfulPaint < 1000) {
      console.log('✅ VERY GOOD PWA: Sub-1s render with cache');
    } else if (secondVisitMetrics.firstContentfulPaint < 2000) {
      console.log('👍 GOOD PWA: Sub-2s render with cache');
    } else {
      console.log('⚠️  NEEDS OPTIMIZATION: PWA cache not effective');
    }

    expect(swStatus.registered).toBe(true);
    expect(secondVisitMetrics.firstContentfulPaint).toBeLessThan(5000);
  });
});
