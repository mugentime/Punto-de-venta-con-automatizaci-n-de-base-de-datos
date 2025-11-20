import { test, expect } from '@playwright/test';

const RAILWAY_URL = 'https://punto-de-venta-con-automatizaci-n-de-base-de-dat-production.up.railway.app';

test('Quick test: Create order on Railway', async ({ page }) => {
  console.log('🌐 Testing live Railway deployment...');

  // Navigate to Railway
  await page.goto(RAILWAY_URL, { waitUntil: 'networkidle' });
  console.log('✅ Page loaded');

  // Wait for app to load
  await page.waitForSelector('text=Conejo Negro', { timeout: 10000 });

  // Navigate to Sales if needed
  const salesButton = page.locator('button:has-text("Ventas")').first();
  if (await salesButton.isVisible({ timeout: 2000 })) {
    await salesButton.click();
    await page.waitForTimeout(1000);
  }

  // Add product
  console.log('🛒 Adding product to cart...');
  const productCard = page.locator('.product-card').first();
  await productCard.waitFor({ state: 'visible', timeout: 5000 });
  await productCard.click();
  await page.waitForTimeout(500);

  // Checkout
  console.log('💳 Checking out...');
  const checkoutButton = page.locator('button:has-text("Cobrar")').first();
  await checkoutButton.click();

  // Wait for checkout modal
  await page.waitForTimeout(1000);

  // Listen for order request
  const orderPromise = page.waitForResponse(
    response => response.url().includes('/api/orders') && response.request().method() === 'POST',
    { timeout: 20000 }
  );

  // Submit order
  console.log('✅ Submitting order...');
  const submitButton = page.locator('button:has-text("Confirmar"), button:has-text("Pagar")').last();
  await submitButton.click();

  // Wait for response
  try {
    const orderResponse = await orderPromise;
    const status = orderResponse.status();
    console.log(`📡 Order response status: ${status}`);

    if (status >= 200 && status < 300) {
      const body = await orderResponse.json();
      console.log('✅ ORDER CREATED SUCCESSFULLY!');
      console.log('Order ID:', body.id);
      expect(status).toBeLessThan(300);
    } else {
      console.error('❌ Order failed with status:', status);
      const body = await orderResponse.text();
      console.error('Response body:', body);
      throw new Error(`Order failed with status ${status}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
});
