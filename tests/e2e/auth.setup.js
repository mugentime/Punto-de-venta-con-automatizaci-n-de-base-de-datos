const { test: setup, expect } = require('@playwright/test');

const authFile = './tests/auth/user.json';

/**
 * Authentication setup for all tests
 * This runs before other tests to establish authenticated session
 */
setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication...');

  // Navigate to POS application login page
  await page.goto('/online');
  
  // Wait for page to load completely
  await page.waitForLoadState('networkidle');
  
  // Debug: Print page title and URL
  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());
  
  // Check if already logged in
  const mainAppExists = await page.locator('#main-app').count() > 0;
  const mainAppVisible = mainAppExists && await page.locator('#main-app').isVisible();
  
  console.log('Main app status:');
  console.log('- #main-app exists:', mainAppExists);
  console.log('- #main-app visible:', mainAppVisible);
  
  // If already logged in, save state and return
  if (mainAppVisible) {
    console.log('Already logged in, saving authentication state...');
    await page.context().storageState({ path: authFile });
    console.log('✅ Authentication setup completed (already logged in)');
    return;
  }
  
  // Wait for login screen to appear
  try {
    await page.waitForSelector('#login-screen', { timeout: 10000 });
    console.log('Login screen found');
  } catch (error) {
    console.log('Login screen not found, checking for login form...');
  }
  
  // Wait for login form elements
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.waitForSelector('#login-password', { timeout: 15000 });
  
  console.log('Login form elements found, proceeding with authentication...');
  
  // Fill in login credentials
  await page.fill('#login-email', 'admin@conejonegro.com');
  await page.fill('#login-password', 'admin123');
  
  console.log('Filled credentials, submitting form...');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait a moment for the form to be processed
  await page.waitForTimeout(2000);
  
  // Check for any error messages first
  const errorMessages = await page.locator('.error, .alert-danger, [class*="error"]').count();
  if (errorMessages > 0) {
    const errorText = await page.locator('.error, .alert-danger, [class*="error"]').first().textContent();
    console.log('❌ Login error detected:', errorText);
  }
  
  // Check current page state after login attempt
  const loginScreenVisible = await page.locator('#login-screen').isVisible();
  const mainAppVisibleAfterLogin = await page.locator('#main-app').isVisible();
  
  console.log('After login attempt:');
  console.log('- Login screen visible:', loginScreenVisible);
  console.log('- Main app visible:', mainAppVisibleAfterLogin);
  
  // If still on login screen, there might be an authentication issue
  if (loginScreenVisible) {
    console.log('Still on login screen, checking for JavaScript errors...');
    // Check console logs for errors
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    await page.waitForTimeout(1000);
    
    if (consoleMessages.length > 0) {
      console.log('Browser console messages:', consoleMessages);
    }
  }
  
  // Wait for successful login - main app should become visible
  await page.waitForSelector('#main-app', { state: 'visible', timeout: 30000 });
  
  // Verify login was successful
  await expect(page.locator('#main-app')).toBeVisible();
  await expect(page.locator('#login-screen')).toBeHidden();
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Authentication setup completed');
});
