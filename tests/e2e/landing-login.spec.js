const { test, expect } = require('@playwright/test');

// Reemplaza esta URL por la de tu deployment Railway
const BASE_URL = 'https://pos-conejonegro-production.up.railway.app';

test.use({ headless: true });
test('La landing muestra el login', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.locator('form#login-form')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Iniciar sesión')).toBeVisible();
});
