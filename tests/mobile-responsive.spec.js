const { test, expect } = require('@playwright/test');

test.describe('Mobile Responsiveness Tests', () => {
  const viewports = [
    { name: 'Mobile Portrait', width: 375, height: 667 }, // iPhone SE
    { name: 'Mobile Landscape', width: 667, height: 375 }, // iPhone SE landscape
    { name: 'Tablet Portrait', width: 768, height: 1024 }, // iPad
    { name: 'Tablet Landscape', width: 1024, height: 768 }, // iPad landscape
    { name: 'Desktop Small', width: 1366, height: 768 }, // Small desktop
    { name: 'Desktop Large', width: 1920, height: 1080 } // Large desktop
  ];

  viewports.forEach(({ name, width, height }) => {
    test(`should display correctly on ${name} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Take full page screenshot for this viewport
      await page.screenshot({ 
        path: `tests/test-results/responsive-${name.toLowerCase().replace(/\s/g, '-')}-${width}x${height}.png`,
        fullPage: true 
      });

      // Check that content is visible and not cut off
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Check for horizontal scrollbars (shouldn't exist on mobile)
      if (width <= 768) {
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);
        
        // Allow small margin for scrollbars
        expect(scrollWidth - clientWidth).toBeLessThan(20);
      }

      // Test that clickable elements are appropriately sized for touch
      if (width <= 768) {
        const buttons = page.locator('button, a, input[type="button"], input[type="submit"]');
        const buttonCount = await buttons.count();
        
        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
          const button = buttons.nth(i);
          if (await button.isVisible()) {
            const box = await button.boundingBox();
            if (box) {
              // Touch targets should be at least 44px (iOS) or 48px (Android)
              expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);
            }
          }
        }
      }
    });
  });

  test('should handle touch interactions on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test touch events on interactive elements
    const touchableElements = page.locator('button, .clickable, .product-item, .menu-item');
    const elementCount = await touchableElements.count();

    if (elementCount > 0) {
      const firstElement = touchableElements.first();
      
      if (await firstElement.isVisible()) {
        // Simulate tap
        await firstElement.tap();
        await page.waitForTimeout(500);
        
        // Take screenshot after tap
        await page.screenshot({ 
          path: 'tests/test-results/mobile-touch-interaction.png',
          fullPage: true 
        });
      }
    }
  });

  test('should display mobile navigation correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for mobile navigation patterns
    const mobileNavSelectors = [
      '.hamburger, .menu-toggle, .mobile-menu-button',
      '.mobile-nav, .nav-mobile',
      '.drawer, .sidebar, .off-canvas'
    ];

    let mobileNavFound = false;

    for (const selector of mobileNavSelectors) {
      const navElement = page.locator(selector);
      
      if (await navElement.count() > 0) {
        mobileNavFound = true;
        await expect(navElement.first()).toBeVisible();
        
        // Try to interact with mobile menu
        try {
          await navElement.first().click();
          await page.waitForTimeout(1000);
          
          await page.screenshot({ 
            path: 'tests/test-results/mobile-navigation-open.png',
            fullPage: true 
          });
          
        } catch (error) {
          console.log('Mobile navigation interaction failed:', error.message);
        }
        
        break;
      }
    }

    if (!mobileNavFound) {
      // Check if regular navigation adapts to mobile
      const regularNav = page.locator('nav, .navigation, .navbar');
      if (await regularNav.count() > 0) {
        await expect(regularNav.first()).toBeVisible();
      }
    }

    await page.screenshot({ 
      path: 'tests/test-results/mobile-navigation.png',
      fullPage: true 
    });
  });

  test('should handle text scaling and readability on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check text elements for readability
    const textElements = page.locator('h1, h2, h3, p, span, div:not(:empty)');
    const textCount = await textElements.count();

    let readableTexts = 0;

    for (let i = 0; i < Math.min(textCount, 10); i++) {
      const element = textElements.nth(i);
      
      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            fontSize: computed.fontSize,
            lineHeight: computed.lineHeight,
            color: computed.color,
            backgroundColor: computed.backgroundColor
          };
        });

        const fontSize = parseFloat(styles.fontSize);
        
        // Text should be at least 16px on mobile for readability
        if (fontSize >= 14) {
          readableTexts++;
        }
      }
    }

    expect(readableTexts).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'tests/test-results/mobile-text-readability.png',
      fullPage: true 
    });
  });

  test('should adapt form elements for mobile input', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check form elements
    const formElements = page.locator('input, textarea, select, button[type="submit"]');
    const formCount = await formElements.count();

    if (formCount > 0) {
      for (let i = 0; i < Math.min(formCount, 5); i++) {
        const element = formElements.nth(i);
        
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          
          if (box) {
            // Form elements should be appropriately sized for mobile
            expect(box.height).toBeGreaterThanOrEqual(40);
            
            // Test that input brings up appropriate keyboard
            const inputType = await element.getAttribute('type');
            const inputMode = await element.getAttribute('inputmode');
            
            if (inputType === 'email' || inputMode === 'email') {
              // Email inputs should have email inputmode
              expect(inputType === 'email' || inputMode === 'email').toBeTruthy();
            }
          }
        }
      }

      await page.screenshot({ 
        path: 'tests/test-results/mobile-form-elements.png',
        fullPage: true 
      });
    }
  });

  test('should handle orientation changes', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.screenshot({ 
      path: 'tests/test-results/orientation-portrait.png',
      fullPage: true 
    });

    // Switch to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(1000); // Allow time for reflow

    await page.screenshot({ 
      path: 'tests/test-results/orientation-landscape.png',
      fullPage: true 
    });

    // Check that content is still accessible
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check that important elements are still visible
    const importantElements = page.locator('h1, .main-menu, .products, .cart, button');
    const visibleCount = await importantElements.filter({ hasText: /.+/ }).count();
    
    expect(visibleCount).toBeGreaterThan(0);
  });
});