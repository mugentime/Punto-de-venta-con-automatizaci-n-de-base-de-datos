/**
 * Checkout Performance Test
 * Measures the exact timing of the checkout flow from order creation to completion
 */

import { test, expect } from '@playwright/test';

// Railway deployment URL - HOTFIX BRANCH
const BASE_URL = 'https://fixbranch.up.railway.app';

test.describe('Checkout Performance Analysis', () => {
  test.setTimeout(90000); // 90 second timeout for production tests

  test('Measure complete checkout workflow timing', async ({ page }) => {
    const timings: Record<string, number> = {};
    const startTime = Date.now();

    console.log('\n🕐 CHECKOUT PERFORMANCE TEST');
    console.log('='.repeat(50));

    // Navigate to the app
    const navStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    timings['1. Page Load'] = Date.now() - navStart;
    console.log(`✅ Page loaded in ${timings['1. Page Load']}ms`);

    // Login if needed
    const loginStart = Date.now();
    const loginButton = page.getByRole('button', { name: /Ingresar/i });
    if (await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Find inputs by label text
      await page.getByLabel('Usuario').fill('Admin1');
      await page.getByLabel('Contraseña').fill('1357');
      await loginButton.click();
      await page.waitForTimeout(3000); // Wait for login to process
      timings['2. Login'] = Date.now() - loginStart;
      console.log(`✅ Login completed in ${timings['2. Login']}ms`);
    } else {
      timings['2. Login'] = 0;
      console.log(`✅ Already logged in (0ms)`);
    }

    // Wait for products to load
    const productsStart = Date.now();
    await page.waitForSelector('.grid', { timeout: 30000 });
    const productCards = page.locator('.bg-white.rounded-xl.shadow-md, .bg-white.rounded-2xl.shadow-md');
    await expect(productCards.first()).toBeVisible({ timeout: 30000 });
    timings['3. Products Load'] = Date.now() - productsStart;
    console.log(`✅ Products loaded in ${timings['3. Products Load']}ms`);

    // Add product to cart
    const addToCartStart = Date.now();
    await productCards.first().click();
    await page.waitForTimeout(100); // Small wait for cart update
    timings['4. Add to Cart'] = Date.now() - addToCartStart;
    console.log(`✅ Product added to cart in ${timings['4. Add to Cart']}ms`);

    // Click "Cobrar" button to open checkout form
    const openCheckoutStart = Date.now();
    const cobrarButton = page.getByRole('button', { name: /Cobrar/i });
    await cobrarButton.click();
    await page.waitForTimeout(100);
    timings['5. Open Checkout Form'] = Date.now() - openCheckoutStart;
    console.log(`✅ Checkout form opened in ${timings['5. Open Checkout Form']}ms`);

    // Fill checkout details
    const fillFormStart = Date.now();
    // Service type dropdown might already be set
    // Payment method - select Efectivo
    const paymentSelect = page.locator('select[id="paymentMethod"]');
    if (await paymentSelect.isVisible().catch(() => false)) {
      await paymentSelect.selectOption('Efectivo');
    }
    timings['6. Fill Form'] = Date.now() - fillFormStart;
    console.log(`✅ Form filled in ${timings['6. Fill Form']}ms`);

    // Click "Pagar" to submit order
    const submitStart = Date.now();
    const pagarButton = page.getByRole('button', { name: /Pagar/i });

    // Setup network monitoring
    const orderPromise = page.waitForResponse(
      response => response.url().includes('/api/orders') && response.request().method() === 'POST',
      { timeout: 30000 }
    );

    await pagarButton.click();

    // Wait for API response
    const apiResponseStart = Date.now();
    const orderResponse = await orderPromise;
    timings['7. API Request (network)'] = Date.now() - apiResponseStart;
    console.log(`✅ API request completed in ${timings['7. API Request (network)']}ms`);
    console.log(`   Response status: ${orderResponse.status()}`);

    // Wait for cart to clear (UI update)
    const uiUpdateStart = Date.now();
    await expect(page.locator('text=El carrito está vacío')).toBeVisible({ timeout: 5000 });
    timings['8. UI Update (cart clear)'] = Date.now() - uiUpdateStart;
    console.log(`✅ Cart cleared in ${timings['8. UI Update (cart clear)']}ms`);

    // Total submit time
    timings['7-8. Total Submit'] = Date.now() - submitStart;

    // Calculate totals
    const totalTime = Date.now() - startTime;

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TIMING SUMMARY');
    console.log('='.repeat(50));

    Object.entries(timings).forEach(([step, time]) => {
      console.log(`${step}: ${time}ms`);
    });

    console.log('-'.repeat(50));
    console.log(`🏁 TOTAL TIME: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log('='.repeat(50));

    // Assertions for performance
    expect(timings['7. API Request (network)']).toBeLessThan(5000); // API should respond in <5s
    expect(timings['8. UI Update (cart clear)']).toBeLessThan(1000); // UI should update in <1s
  });

  test.skip('Analyze network requests during checkout', async ({ page }) => {
    const requests: Array<{url: string, method: string, duration: number, size: number}> = [];

    // Monitor all network requests
    page.on('request', request => {
      (request as any)._startTime = Date.now();
    });

    page.on('response', async response => {
      const request = response.request();
      const duration = Date.now() - ((request as any)._startTime || Date.now());
      const size = (await response.body().catch(() => Buffer.from(''))).length;

      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          duration,
          size
        });
      }
    });

    // Perform checkout flow
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Login
    const usernameInput = page.locator('input[placeholder*="Usuario"]');
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('Admin1');
      await page.locator('input[placeholder*="Contraseña"]').fill('1357');
      await page.getByRole('button', { name: /Iniciar|Entrar/i }).click();
      await page.waitForLoadState('networkidle');
    }

    // Wait and perform checkout
    await page.waitForSelector('.grid', { timeout: 10000 });
    const productCards = page.locator('.bg-white.rounded-xl.shadow-md, .bg-white.rounded-2xl.shadow-md');
    await productCards.first().click();
    await page.getByRole('button', { name: /Cobrar/i }).click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: /Pagar/i }).click();
    await expect(page.locator('text=El carrito está vacío')).toBeVisible({ timeout: 10000 });

    // Print network analysis
    console.log('\n' + '='.repeat(60));
    console.log('🌐 NETWORK REQUESTS ANALYSIS');
    console.log('='.repeat(60));

    requests.forEach(req => {
      console.log(`${req.method.padEnd(6)} ${req.url.split('/api/')[1] || req.url}`);
      console.log(`       Duration: ${req.duration}ms | Size: ${(req.size/1024).toFixed(2)}KB`);
    });

    console.log('-'.repeat(60));
    console.log(`Total API calls: ${requests.length}`);
    console.log(`Total duration: ${requests.reduce((sum, r) => sum + r.duration, 0)}ms`);
    console.log(`Total data: ${(requests.reduce((sum, r) => sum + r.size, 0)/1024).toFixed(2)}KB`);
    console.log('='.repeat(60));
  });
});
