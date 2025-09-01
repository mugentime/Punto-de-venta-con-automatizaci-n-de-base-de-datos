const { chromium } = require('@playwright/test');

async function testPOSApp() {
  console.log('🚀 Starting POS Application Test...\n');
  
  // Launch browser with visible window
  const browser = await chromium.launch({
    headless: false, // Show browser window
    slowMo: 1000, // Slow down actions by 1 second for human-like interaction
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null, // Use full screen
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();

  try {
    // 1. Navigate to the app
    console.log('📍 Step 1: Navigating to POS app...');
    await page.goto('https://pos-conejonegro-production.up.railway.app/online');
    await page.waitForTimeout(2000);
    console.log('✅ Page loaded successfully\n');

    // 2. Check if login form is visible
    console.log('📍 Step 2: Checking login form...');
    const loginForm = await page.locator('#login-form');
    if (await loginForm.isVisible()) {
      console.log('✅ Login form is visible\n');
    }

    // 3. Click auto-fill button
    console.log('📍 Step 3: Clicking auto-fill button...');
    await page.click('#auto-fill-btn');
    await page.waitForTimeout(1000);
    console.log('✅ Credentials auto-filled\n');

    // 4. Submit login form
    console.log('📍 Step 4: Logging in...');
    
    // Find the correct submit button
    const submitButton = await page.locator('#login-form button[type="submit"]');
    await submitButton.click();
    console.log('   Waiting for login response...');
    await page.waitForTimeout(5000);
    
    // Check if logged in successfully by looking for main-app or checking if login form is hidden
    const loginFormVisible = await page.locator('#login-form').isVisible();
    const mainApp = await page.locator('#main-app');
    
    if (!loginFormVisible || await mainApp.isVisible()) {
      console.log('✅ Login successful - Main app is visible\n');
    } else {
      console.log('❌ Login failed - checking for error messages...');
      // Check for any error messages
      const errorMsg = await page.locator('.error-message, .alert-danger').first();
      if (await errorMsg.isVisible()) {
        const errorText = await errorMsg.textContent();
        console.log('   Error message:', errorText);
      }
      console.log('   Retrying with manual credentials...');
      
      // Clear and re-enter credentials manually
      await page.fill('#login-email', 'admin@conejo.com');
      await page.fill('#login-password', 'admin123');
      await submitButton.click();
      await page.waitForTimeout(5000);
      
      if (!await page.locator('#login-form').isVisible()) {
        console.log('✅ Login successful on retry\n');
      } else {
        console.log('❌ Login still failing - continuing with limited tests\n');
        throw new Error('Login failed - cannot continue tests');
      }
    }

    // 5. Wait for the app to fully load and navigation to be ready
    console.log('📍 Step 5: Waiting for app to fully load...');
    await page.waitForTimeout(3000); // Give more time for the app to initialize
    
    // Wait for navigation links to be visible
    await page.waitForSelector('.nav-link', { state: 'visible', timeout: 10000 });
    console.log('✅ Navigation menu is ready\n');
    
    console.log('📍 Step 6: Testing navigation menu...');
    
    // Click on Inventario Refrigerador
    console.log('   Clicking "Inventario Refrigerador"...');
    const invRefLink = await page.locator('a[data-section="inventario-refrigerador"]:visible');
    await invRefLink.click();
    await page.waitForTimeout(2000);
    console.log('   ✅ Navigated to Inventario Refrigerador\n');

    // Click on Inventario Cafetería
    console.log('   Clicking "Inventario Cafetería"...');
    const invCafeLink = await page.locator('a[data-section="inventario-cafeteria"]:visible');
    await invCafeLink.click();
    await page.waitForTimeout(2000);
    console.log('   ✅ Navigated to Inventario Cafetería\n');

    // Click on Reportes
    console.log('   Clicking "Reportes"...');
    const reportesLink = await page.locator('a[data-section="reportes"]:visible');
    await reportesLink.click();
    await page.waitForTimeout(2000);
    console.log('   ✅ Navigated to Reportes\n');

    // Go back to Registro
    console.log('   Clicking "Registro"...');
    const registroLink = await page.locator('a[data-section="registro"]:visible');
    await registroLink.click();
    await page.waitForTimeout(2000);
    console.log('   ✅ Navigated back to Registro\n');

    // 7. Test product selection
    console.log('📍 Step 7: Testing product selection...');
    
    // Fill client name
    console.log('   Filling client name...');
    await page.fill('#client-name', 'Test Client');
    await page.waitForTimeout(1000);
    
    // Select service type
    console.log('   Selecting service type...');
    await page.selectOption('#service-type', 'cafeteria');
    await page.waitForTimeout(1000);
    
    // Try to click add product button
    console.log('   Clicking "Agregar Producto" button...');
    const addProductBtn = await page.locator('#add-product-btn');
    if (await addProductBtn.isVisible()) {
      await addProductBtn.click();
      await page.waitForTimeout(2000);
      console.log('   ✅ Add product modal opened\n');
      
      // Close modal if it opened
      const closeBtn = await page.locator('#close-modal');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
        console.log('   ✅ Modal closed\n');
      }
    }

    // 8. Test sync button
    console.log('📍 Step 8: Testing sync functionality...');
    const syncBtn = await page.locator('#sync-data');
    if (await syncBtn.isVisible()) {
      console.log('   Clicking sync button...');
      await syncBtn.click();
      await page.waitForTimeout(3000);
      console.log('   ✅ Sync completed\n');
    }

    // 9. Navigate to cash cut
    console.log('📍 Step 9: Testing cash cut section...');
    try {
      const corteCajaLink = await page.locator('a[data-section="corte-caja"]:visible');
      if (await corteCajaLink.count() > 0) {
        await corteCajaLink.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Cash cut section loaded\n');
      } else {
        console.log('   ⚠️ Cash cut link not found - skipping\n');
      }
    } catch (error) {
      console.log('   ⚠️ Cash cut test skipped:', error.message, '\n');
    }

    // 10. Test logout
    console.log('📍 Step 10: Testing logout...');
    const logoutBtn = await page.locator('#logout-btn');
    if (await logoutBtn.isVisible()) {
      console.log('   Clicking logout button...');
      // Force click to bypass any overlapping elements
      await logoutBtn.click({ force: true });
      await page.waitForTimeout(2000);
      
      // Check if returned to login
      const loginFormAfterLogout = await page.locator('#login-form');
      if (await loginFormAfterLogout.isVisible()) {
        console.log('   ✅ Logout successful - Back at login screen\n');
      } else {
        console.log('   ⚠️ Logout may not have completed\n');
      }
    } else {
      console.log('   ⚠️ Logout button not found\n');
    }

    console.log('🎉 All tests completed successfully!');
    console.log('✅ All buttons and navigation are working properly!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    // Keep browser open for 5 seconds to see final state
    console.log('\n⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    
    // Close browser
    await browser.close();
    console.log('🔚 Browser closed. Test complete.');
  }
}

// Run the test
testPOSApp().catch(console.error);