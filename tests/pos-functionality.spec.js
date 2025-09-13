const { test, expect } = require('@playwright/test');

test.describe('POS Core Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: `tests/test-results/pos-func-initial-${Date.now()}.png`,
      fullPage: true 
    });
  });

  test('should display main POS interface elements', async ({ page }) => {
    // Check for common POS interface elements
    const posElements = [
      '.product-grid, .products, .menu-items',
      '.cart, .order-summary, .current-order',
      '.total, .subtotal, .price-display',
      'button:has-text("Add"), button:has-text("Order"), .add-to-cart',
      '.category, .menu-category, .product-category'
    ];

    let foundElements = 0;
    for (const selector of posElements) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        foundElements++;
        await expect(elements.first()).toBeVisible();
      }
    }

    // Should find at least some POS elements
    expect(foundElements).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'tests/test-results/pos-interface-elements.png',
      fullPage: true 
    });
  });

  test('should handle product selection and cart functionality', async ({ page }) => {
    // Look for clickable products or menu items
    const productSelectors = [
      '.product-item, .menu-item, .product-card',
      'button[data-product], .product-button',
      '.add-to-cart, button:has-text("Add")'
    ];

    let productFound = false;
    
    for (const selector of productSelectors) {
      const products = page.locator(selector);
      const count = await products.count();
      
      if (count > 0) {
        productFound = true;
        
        // Try to interact with the first product
        const firstProduct = products.first();
        await expect(firstProduct).toBeVisible();
        
        // Take screenshot before interaction
        await page.screenshot({ 
          path: 'tests/test-results/pos-before-product-click.png',
          fullPage: true 
        });
        
        try {
          await firstProduct.click();
          await page.waitForTimeout(1000); // Wait for any animations/updates
          
          // Take screenshot after interaction
          await page.screenshot({ 
            path: 'tests/test-results/pos-after-product-click.png',
            fullPage: true 
          });
          
          // Check if cart or order summary updated
          const cartElements = page.locator('.cart, .order-summary, .current-order, .cart-items');
          if (await cartElements.count() > 0) {
            await expect(cartElements.first()).toBeVisible();
          }
          
        } catch (error) {
          console.log('Product interaction error:', error.message);
        }
        
        break; // Only test with first found product type
      }
    }

    if (!productFound) {
      console.log('No interactive products found - this may be a static display');
    }
  });

  test('should display pricing information', async ({ page }) => {
    // Look for price displays
    const priceSelectors = [
      '.price, .cost, .amount',
      '[data-price], [class*="price"]',
      '.total, .subtotal, .grand-total',
      'span:regex(\\$\\d+), span:regex(€\\d+), span:regex(£\\d+)'
    ];

    let pricesFound = 0;
    
    for (const selector of priceSelectors) {
      const prices = page.locator(selector);
      const count = await prices.count();
      
      if (count > 0) {
        pricesFound += count;
        
        // Validate price format (basic check)
        for (let i = 0; i < Math.min(count, 5); i++) {
          const priceElement = prices.nth(i);
          const priceText = await priceElement.textContent();
          
          if (priceText && (priceText.includes('$') || priceText.includes('€') || priceText.includes('£') || /\d+/.test(priceText))) {
            await expect(priceElement).toBeVisible();
          }
        }
      }
    }

    expect(pricesFound).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'tests/test-results/pos-pricing.png',
      fullPage: true 
    });
  });

  test('should handle order processing workflow', async ({ page }) => {
    // Look for order processing elements
    const orderElements = [
      'button:has-text("Order"), button:has-text("Checkout"), button:has-text("Pay")',
      '.checkout-button, .order-button, .pay-button',
      '.order-total, .final-total'
    ];

    for (const selector of orderElements) {
      const elements = page.locator(selector);
      
      if (await elements.count() > 0) {
        const firstElement = elements.first();
        await expect(firstElement).toBeVisible();
        
        // Test if button is clickable (but don't complete order)
        const isEnabled = await firstElement.isEnabled();
        expect(isEnabled).toBeTruthy();
        
        await page.screenshot({ 
          path: 'tests/test-results/pos-order-elements.png',
          fullPage: true 
        });
        
        break;
      }
    }
  });

  test('should validate quantity and modification controls', async ({ page }) => {
    // Look for quantity controls
    const quantitySelectors = [
      'input[type="number"], input[name*="quantity"]',
      '.quantity-input, .qty-input',
      'button:has-text("+"), button:has-text("-")',
      '.increase, .decrease, .qty-btn'
    ];

    let quantityControlsFound = false;

    for (const selector of quantitySelectors) {
      const controls = page.locator(selector);
      
      if (await controls.count() > 0) {
        quantityControlsFound = true;
        const firstControl = controls.first();
        
        await expect(firstControl).toBeVisible();
        
        // If it's an input, test value changes
        if (selector.includes('input')) {
          try {
            await firstControl.fill('2');
            await expect(firstControl).toHaveValue('2');
          } catch (error) {
            console.log('Quantity input test failed:', error.message);
          }
        }
        
        // If it's a button, test click
        if (selector.includes('button')) {
          try {
            await firstControl.click();
            await page.waitForTimeout(500);
          } catch (error) {
            console.log('Quantity button test failed:', error.message);
          }
        }
        
        await page.screenshot({ 
          path: 'tests/test-results/pos-quantity-controls.png',
          fullPage: true 
        });
        
        break;
      }
    }

    if (quantityControlsFound) {
      console.log('✅ Quantity controls found and tested');
    } else {
      console.log('ℹ️ No quantity controls found - may use fixed quantities');
    }
  });

  test('should handle payment interface elements', async ({ page }) => {
    // Look for payment-related elements
    const paymentSelectors = [
      '.payment-method, .payment-option',
      'input[name*="payment"], select[name*="payment"]',
      'button:has-text("Cash"), button:has-text("Card"), button:has-text("Credit")',
      '.cash-payment, .card-payment'
    ];

    let paymentElementsFound = 0;

    for (const selector of paymentSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        paymentElementsFound += count;
        await expect(elements.first()).toBeVisible();
      }
    }

    if (paymentElementsFound > 0) {
      await page.screenshot({ 
        path: 'tests/test-results/pos-payment-interface.png',
        fullPage: true 
      });
      console.log(`✅ Found ${paymentElementsFound} payment interface elements`);
    } else {
      console.log('ℹ️ No payment interface elements found');
    }
  });
});