const { test, expect } = require('@playwright/test');

test.describe('POS System Tests', () => {
  test.use({ storageState: './tests/auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/online');
    
    // Wait for main app to be visible
    await page.waitForSelector('#main-app', { state: 'visible' });
    await expect(page.locator('#main-app')).toBeVisible();
  });

  test('should display main navigation', async ({ page }) => {
    // Check that navigation links are present
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('.nav-link[data-section="registro"]')).toBeVisible();
    await expect(page.locator('.nav-link[data-section="inventario-refrigerador"]')).toBeVisible();
    await expect(page.locator('.nav-link[data-section="reportes"]')).toBeVisible();
  });

  test('should navigate to different sections', async ({ page }) => {
    // Test navigation to inventory section
    await page.click('[data-section="inventario-refrigerador"]');
    
    // Wait for section to become active
    await page.waitForSelector('#inventario-refrigerador.active', { timeout: 5000 });
    await expect(page.locator('#inventario-refrigerador')).toHaveClass(/active/);
    
    // Test navigation to reports section
    await page.click('[data-section="reportes"]');
    
    // Wait for reports section
    await page.waitForSelector('#reportes.active', { timeout: 5000 });
    await expect(page.locator('#reportes')).toHaveClass(/active/);
  });

  test('should show client registration form', async ({ page }) => {
    // Navigate to client registration
    await page.click('[data-section="registro"]');
    
    // Wait for registration section
    await page.waitForSelector('#registro.active', { timeout: 5000 });
    
    // Check form elements are present
    await expect(page.locator('#client-form')).toBeVisible();
    await expect(page.locator('#client-name')).toBeVisible();
    await expect(page.locator('#service-type')).toBeVisible();
  });

  test('should display user information in header', async ({ page }) => {
    // Check user info is displayed
    await expect(page.locator('#user-name')).toBeVisible();
    await expect(page.locator('.logout-btn')).toBeVisible();
  });
});
