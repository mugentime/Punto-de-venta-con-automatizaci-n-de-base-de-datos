const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://pos-conejonegro-production.up.railway.app';

test.use({ headless: true });
test('Captura el DOM de la landing', async ({ page }) => {
  await page.goto(BASE_URL);
  // Espera a que la página cargue completamente
  await page.waitForTimeout(5000);
  // Captura el HTML completo del body
  const dom = await page.content();
  require('fs').writeFileSync('landing-dom.html', dom);
  // Captura una screenshot
  await page.screenshot({ path: 'landing-screenshot.png', fullPage: true });
});
