const { test, expect } = require('@playwright/test');

// Cambia esta URL por la de tu deployment Railway
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test('La landing muestra el login', async ({ page }) => {
  await page.goto(BASE_URL);
  // Espera a que el formulario de login esté visible
  await expect(page.locator('form#login-form')).toBeVisible({ timeout: 15000 });
  // Opcional: verifica que el título o algún texto clave esté presente
  await expect(page.locator('text=Iniciar sesión')).toBeVisible();
});
