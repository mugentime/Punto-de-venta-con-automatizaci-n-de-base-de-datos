const { test, expect } = require('@playwright/test');

// Reemplaza esta URL por la de tu deployment Railway
const BASE_URL = '/';

test.use({ headless: true });
test('La landing muestra el login', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForSelector('form#login-form', { timeout: 20000 });
  await expect(page.locator('form#login-form')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('form#login-form button[type="submit"]')).toBeVisible();
});
