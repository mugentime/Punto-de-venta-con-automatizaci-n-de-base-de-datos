const { test, expect } = require('@playwright/test');
const { injectAxe, checkA11y } = require('@axe-core/playwright');

test.describe('Accessibility Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await injectAxe(page);
  });

  test('should pass axe accessibility audit', async ({ page }) => {
    // Run axe accessibility tests
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-axe-audit.png',
      fullPage: true 
    });
  });

  test('should have proper heading structure', async ({ page }) => {
    // Check for heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    if (headings.length > 0) {
      // Should have at least one h1
      const h1Elements = page.locator('h1');
      const h1Count = await h1Elements.count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
      expect(h1Count).toBeLessThanOrEqual(1); // Should have exactly one h1

      // Check heading text content
      for (const heading of headings) {
        const text = await heading.textContent();
        expect(text?.trim()).toBeTruthy(); // Headings should have text content
      }
    }

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-heading-structure.png',
      fullPage: true 
    });
  });

  test('should have proper form labels and accessibility', async ({ page }) => {
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const inputId = await input.getAttribute('id');
        const inputName = await input.getAttribute('name');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Input should have some form of labeling
        if (inputId) {
          const label = page.locator(`label[for="${inputId}"]`);
          const hasLabel = await label.count() > 0;
          
          if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
            console.log(`Warning: Input with id="${inputId}" may lack proper labeling`);
          }
        }

        // Check for placeholder text (should not be the only label)
        const placeholder = await input.getAttribute('placeholder');
        if (placeholder && !ariaLabel && !inputId) {
          console.log('Warning: Input relies only on placeholder for labeling');
        }
      }
    }

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-form-labels.png',
      fullPage: true 
    });
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // Test color contrast using axe-core rules
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    // Additional manual checks for key elements
    const textElements = page.locator('p, span, div, button, a, h1, h2, h3, h4, h5, h6');
    const textCount = await textElements.count();

    let contrastIssues = 0;

    for (let i = 0; i < Math.min(textCount, 10); i++) {
      const element = textElements.nth(i);
      
      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        });

        // Log styles for manual review
        const text = await element.textContent();
        if (text && text.trim()) {
          console.log(`Element ${i}: "${text.slice(0, 50)}..." - Color: ${styles.color}, Background: ${styles.backgroundColor}`);
        }
      }
    }

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-color-contrast.png',
      fullPage: true 
    });
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Test keyboard navigation
    const focusableElements = page.locator('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    const focusableCount = await focusableElements.count();

    if (focusableCount > 0) {
      // Test Tab navigation through first few elements
      for (let i = 0; i < Math.min(focusableCount, 5); i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        // Check if focus is visible
        const focusedElement = await page.evaluate(() => document.activeElement);
        expect(focusedElement).toBeTruthy();
      }

      await page.screenshot({ 
        path: 'tests/test-results/accessibility-keyboard-navigation.png',
        fullPage: true 
      });

      // Test that focus is visible (should have focus indicators)
      const focusedElement = page.locator(':focus');
      if (await focusedElement.count() > 0) {
        await expect(focusedElement).toBeVisible();
      }
    }
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    // Check for important ARIA attributes
    const interactiveElements = page.locator('button, a, input, [role="button"], [role="link"]');
    const interactiveCount = await interactiveElements.count();

    for (let i = 0; i < Math.min(interactiveCount, 5); i++) {
      const element = interactiveElements.nth(i);
      
      const role = await element.getAttribute('role');
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaDescribedBy = await element.getAttribute('aria-describedby');
      const ariaExpanded = await element.getAttribute('aria-expanded');
      
      // Log ARIA attributes for review
      const tagName = await element.evaluate(el => el.tagName);
      console.log(`Element ${i} (${tagName}): role="${role}", aria-label="${ariaLabel}"`);
    }

    // Check for ARIA landmarks
    const landmarks = page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]');
    const landmarkCount = await landmarks.count();
    
    if (landmarkCount > 0) {
      console.log(`Found ${landmarkCount} ARIA landmark(s)`);
    }

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-aria-attributes.png',
      fullPage: true 
    });
  });

  test('should have proper image alt text', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    let imagesWithAlt = 0;
    let decorativeImages = 0;

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      const ariaHidden = await img.getAttribute('aria-hidden');

      if (alt !== null) {
        if (alt === '') {
          decorativeImages++;
        } else {
          imagesWithAlt++;
        }
      } else if (role === 'presentation' || ariaHidden === 'true') {
        decorativeImages++;
      } else {
        console.log(`Warning: Image ${i} lacks alt text and proper accessibility attributes`);
      }
    }

    console.log(`Images with alt text: ${imagesWithAlt}, Decorative images: ${decorativeImages}, Total: ${imageCount}`);

    if (imageCount > 0) {
      // Most images should have proper alt text or be marked as decorative
      expect(imagesWithAlt + decorativeImages).toBeGreaterThanOrEqual(imageCount * 0.8);
    }

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-image-alt-text.png',
      fullPage: true 
    });
  });

  test('should support screen reader navigation', async ({ page }) => {
    // Test screen reader-friendly navigation
    await checkA11y(page, null, {
      rules: {
        'bypass': { enabled: true }, // Skip links
        'page-has-heading-one': { enabled: true },
        'landmark-one-main': { enabled: true },
        'region': { enabled: true }
      }
    });

    // Check for skip links
    const skipLinks = page.locator('a[href*="#"], .skip-link, [class*="skip"]');
    const skipLinkCount = await skipLinks.count();

    if (skipLinkCount > 0) {
      console.log(`Found ${skipLinkCount} potential skip link(s)`);
      
      // Test that skip links are functional
      const firstSkipLink = skipLinks.first();
      if (await firstSkipLink.isVisible() || await firstSkipLink.count() > 0) {
        const href = await firstSkipLink.getAttribute('href');
        if (href && href.startsWith('#')) {
          const targetElement = page.locator(href);
          if (await targetElement.count() > 0) {
            console.log('Skip link target found');
          }
        }
      }
    }

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-screen-reader.png',
      fullPage: true 
    });
  });

  test('should handle focus management properly', async ({ page }) => {
    // Test focus management for dynamic content
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Focus first button
      await buttons.first().focus();
      
      let focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).toBe('BUTTON');

      // Click button and check focus management
      await buttons.first().click();
      await page.waitForTimeout(500);

      // Focus should still be manageable
      focusedElement = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : 'BODY');
      expect(['BUTTON', 'INPUT', 'A', 'BODY']).toContain(focusedElement);
    }

    // Test that focus doesn't get trapped inappropriately
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    const finalFocusedElement = await page.evaluate(() => document.activeElement);
    expect(finalFocusedElement).toBeTruthy();

    await page.screenshot({ 
      path: 'tests/test-results/accessibility-focus-management.png',
      fullPage: true 
    });
  });
});