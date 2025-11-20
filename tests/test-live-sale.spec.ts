import { test, expect } from '@playwright/test';

const RAILWAY_URL = 'https://punto-de-venta-con-automatizaci-n-de-base-de-dat-production.up.railway.app';

test.describe('Live Sale Test on Railway', () => {
  test('should be able to create a sale on Railway deployment', async ({ page }) => {
    console.log('🌐 Testing live Railway deployment...');

    // Navigate to Railway URL
    await page.goto(RAILWAY_URL, { waitUntil: 'networkidle' });

    // Wait for the app to load
    await page.waitForSelector('text=Conejo Negro', { timeout: 10000 });

    // Try to login
    const loginButton = page.locator('button:has-text("Iniciar Sesión"), button:has-text("Login")').first();
    if (await loginButton.isVisible({ timeout: 2000 })) {
      await loginButton.click();

      // Fill in login credentials
      await page.fill('input[type="text"], input[placeholder*="usuario"], input[placeholder*="Usuario"]', 'Admin1');
      await page.fill('input[type="password"], input[placeholder*="contraseña"], input[placeholder*="Contraseña"]', '1357');

      // Submit login
      await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Ingresar")');

      // Wait for login to complete
      await page.waitForTimeout(2000);
    }

    // Navigate to Sales screen
    const salesButton = page.locator('button:has-text("Ventas"), button:has-text("Sales"), [data-screen="sales"]').first();
    if (await salesButton.isVisible({ timeout: 2000 })) {
      await salesButton.click();
      await page.waitForTimeout(1000);
    }

    // Add a product to cart
    console.log('🛒 Adding product to cart...');
    const productCard = page.locator('.product-card, [data-testid="product-card"]').first();
    await productCard.waitFor({ state: 'visible', timeout: 5000 });
    await productCard.click();
    await page.waitForTimeout(500);

    // Check if cart has items
    const cartTotal = await page.locator('text=/Total|Subtotal/i').first().textContent();
    console.log('📊 Cart total:', cartTotal);

    // Try to checkout
    console.log('💳 Attempting checkout...');
    const checkoutButton = page.locator('button:has-text("Cobrar"), button:has-text("Checkout"), button:has-text("Finalizar")').first();
    await checkoutButton.click();

    // Fill in customer name
    const nameInput = page.locator('input[placeholder*="Cliente"], input[placeholder*="Nombre"]').first();
    if (await nameInput.isVisible({ timeout: 2000 })) {
      await nameInput.fill('Test Customer Playwright');
    }

    // Listen for network request to /api/orders
    const orderPromise = page.waitForResponse(
      response => response.url().includes('/api/orders') && response.request().method() === 'POST',
      { timeout: 15000 }
    );

    // Submit the order
    const submitButton = page.locator('button:has-text("Confirmar"), button:has-text("Pagar"), button[type="submit"]').last();
    await submitButton.click();

    // Wait for the order response
    console.log('⏳ Waiting for order creation...');
    const orderResponse = await orderPromise;
    const orderStatus = orderResponse.status();
    const orderBody = await orderResponse.json().catch(() => ({}));

    console.log('📡 Order Response:', {
      status: orderStatus,
      body: orderBody
    });

    // Check if order was successful
    if (orderStatus >= 200 && orderStatus < 300) {
      console.log('✅ Sale created successfully!');
      expect(orderStatus).toBeLessThan(300);
    } else {
      console.error('❌ Sale failed with status:', orderStatus);
      console.error('Error body:', orderBody);
      throw new Error(`Sale failed: ${orderStatus} - ${JSON.stringify(orderBody)}`);
    }
  });

  test('should check if API is accessible from the deployed frontend', async ({ page }) => {
    console.log('🔍 Testing API accessibility...');

    // Navigate to Railway URL
    await page.goto(RAILWAY_URL);

    // Check if we can fetch from the API
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/products');
        return {
          ok: response.ok,
          status: response.status,
          hasData: (await response.json()).length > 0
        };
      } catch (error) {
        return {
          ok: false,
          error: error.message
        };
      }
    });

    console.log('📡 API Response:', apiResponse);

    expect(apiResponse.ok).toBeTruthy();
    expect(apiResponse.hasData).toBeTruthy();
  });
});
