import { test, expect } from '@playwright/test';

test.describe('Coworking Extras Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');

    // Login if needed (adjust credentials as needed)
    const loginButton = page.locator('button:has-text("Iniciar Sesión")');
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await loginButton.click();
    }

    // Navigate to Coworking tab
    await page.click('text=Coworking');
    await page.waitForTimeout(1000);
  });

  test('should open extras modal and add items', async ({ page }) => {
    // Start a new coworking session
    await page.click('button:has-text("Nueva Sesión")');
    await page.fill('input[placeholder*="Nombre"]', 'Test Client');
    await page.click('button:has-text("Iniciar")');

    // Wait for session to be created
    await page.waitForTimeout(1000);

    // Click Extras button
    await page.click('button:has-text("Extras")');

    // Wait for modal to open
    await expect(page.locator('text=Agregar Extras para')).toBeVisible();

    // Take screenshot of modal
    await page.screenshot({ path: 'tests/screenshots/extras-modal.png' });

    // Count initial extras
    const sessionCard = page.locator('.bg-white.p-5.rounded-3xl').first();
    const initialExtrasCount = await sessionCard.locator('li').count().catch(() => 0);

    console.log('Initial extras count:', initialExtrasCount);

    // Try to add an extra by clicking the "Agregar" button
    const addButtons = page.locator('button:has-text("Agregar")');
    const addButtonCount = await addButtons.count();
    console.log('Number of Agregar buttons found:', addButtonCount);

    if (addButtonCount > 0) {
      // Click first "Agregar" button
      await addButtons.first().click();
      await page.waitForTimeout(500);

      // Check if extra was added
      const newExtrasCount = await sessionCard.locator('li').count().catch(() => 0);
      console.log('New extras count:', newExtrasCount);

      // Take screenshot after adding
      await page.screenshot({ path: 'tests/screenshots/after-add-extra.png' });

      expect(newExtrasCount).toBeGreaterThan(initialExtrasCount);
    }

    // Close modal using "Cerrar" button
    await page.click('button:has-text("Cerrar")');

    // Verify modal is closed
    await expect(page.locator('text=Agregar Extras para')).not.toBeVisible();

    // Verify session is still active (not closed)
    await expect(page.locator('text=Test Client')).toBeVisible();
    await expect(page.locator('button:has-text("Finalizar")')).toBeVisible();
  });

  test('should show product cards with images and prices', async ({ page }) => {
    // Start a session
    await page.click('button:has-text("Nueva Sesión")');
    await page.fill('input[placeholder*="Nombre"]', 'Test Client 2');
    await page.click('button:has-text("Iniciar")');
    await page.waitForTimeout(1000);

    // Open extras modal
    await page.click('button:has-text("Extras")');

    // Check for product cards
    const productCards = page.locator('.bg-slate-50.rounded-xl');
    const cardCount = await productCards.count();
    console.log('Number of product cards:', cardCount);

    expect(cardCount).toBeGreaterThan(0);

    // Verify first product has image, name, price, and button
    const firstCard = productCards.first();
    await expect(firstCard.locator('img')).toBeVisible();
    await expect(firstCard.locator('button:has-text("Agregar")')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/product-cards.png' });
  });
});
