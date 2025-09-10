const express = require('express');
const databaseManager = require('../utils/databaseManager');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Simple middleware to check inventory permissions
const canManageInventory = (req, res, next) => {
  if (req.user.permissions?.canManageInventory) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for inventory management' });
  }
};

// Get all products
router.get('/', auth, async (req, res) => {
  try {
    const { category, active, lowStock } = req.query;
    
    let products = await databaseManager.getProducts();
    
    // Filter by category
    if (category) {
      products = products.filter(p => p.category === category.toLowerCase());
    }
    
    // Filter by active status
    if (active !== undefined) {
      products = products.filter(p => p.isActive === (active === 'true'));
    }
    
    // Filter by low stock
    if (lowStock === 'true') {
      products = products.filter(p => p.quantity <= p.lowStockAlert);
    }

    // Sort by category, then name
    products.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    res.json(products);

  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch products'
    });
  }
});

// Get product by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await databaseManager.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(product);

  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch product'
    });
  }
});

// Create new product
router.post('/', auth, canManageInventory, async (req, res) => {
  try {
    const { name, category, quantity, cost, price, lowStockAlert, description, barcode } = req.body;

    // Validation
    if (!name || !category || quantity === undefined || cost === undefined || price === undefined) {
      return res.status(400).json({
        error: 'Name, category, quantity, cost, and price are required'
      });
    }

    if (!['cafeteria', 'refrigerador'].includes(category.toLowerCase())) {
      return res.status(400).json({
        error: 'Category must be either "cafeteria" or "refrigerador"'
      });
    }

    if (quantity < 0 || cost < 0 || price < 0) {
      return res.status(400).json({
        error: 'Quantity, cost, and price cannot be negative'
      });
    }

    // Check if barcode is unique (if provided)
    if (barcode) {
      const products = await databaseManager.getProducts();
      const existingProduct = products.find(p => p.barcode === barcode.trim() && p.isActive);
      if (existingProduct) {
        return res.status(409).json({
          error: 'Product with this barcode already exists'
        });
      }
    }

    const product = await databaseManager.createProduct({
      name: name.trim(),
      category: category.toLowerCase(),
      quantity: Number(quantity),
      cost: Number(cost),
      price: Number(price),
      lowStockAlert: lowStockAlert ? Number(lowStockAlert) : 5,
      description: description?.trim(),
      barcode: barcode?.trim(),
      createdBy: req.user.userId
    });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({
      error: 'Product creation failed'
    });
  }
});

// Update product
router.put('/:id', auth, canManageInventory, async (req, res) => {
  try {
    const { name, category, quantity, cost, price, lowStockAlert, description, barcode, isActive } = req.body;

    // Validation
    if (category && !['cafeteria', 'refrigerador'].includes(category.toLowerCase())) {
      return res.status(400).json({
        error: 'Category must be either "cafeteria" or "refrigerador"'
      });
    }

    if ((quantity !== undefined && quantity < 0) || 
        (cost !== undefined && cost < 0) || 
        (price !== undefined && price < 0)) {
      return res.status(400).json({
        error: 'Quantity, cost, and price cannot be negative'
      });
    }

    // Check if barcode is unique (if provided and changed)
    if (barcode) {
      const products = await databaseManager.getProducts();
      const existingProduct = products.find(p => 
        p.barcode === barcode.trim() && 
        p._id !== req.params.id && 
        p.isActive
      );
      if (existingProduct) {
        return res.status(409).json({
          error: 'Product with this barcode already exists'
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (category) updateData.category = category.toLowerCase();
    if (quantity !== undefined) updateData.quantity = Number(quantity);
    if (cost !== undefined) updateData.cost = Number(cost);
    if (price !== undefined) updateData.price = Number(price);
    if (lowStockAlert !== undefined) updateData.lowStockAlert = Number(lowStockAlert);
    if (description !== undefined) updateData.description = description.trim();
    if (barcode !== undefined) updateData.barcode = barcode.trim();
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const product = await databaseManager.updateProduct(req.params.id, updateData);

    res.json({
      message: 'Product updated successfully',
      product
    });

  } catch (error) {
    console.error('Product update error:', error);
    
    if (error.message === 'Product not found') {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.status(500).json({
      error: 'Product update failed'
    });
  }
});

// Update product stock
router.patch('/:id/stock', auth, canManageInventory, async (req, res) => {
  try {
    const { quantity, operation = 'set' } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        error: 'Valid quantity is required'
      });
    }

    if (!['set', 'add', 'subtract'].includes(operation)) {
      return res.status(400).json({
        error: 'Operation must be "set", "add", or "subtract"'
      });
    }

    const product = await databaseManager.updateProductStock(req.params.id, Number(quantity), operation);

    res.json({
      message: 'Stock updated successfully',
      product
    });

  } catch (error) {
    console.error('Stock update error:', error);

    if (error.message === 'Product not found') {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.status(500).json({
      error: 'Stock update failed'
    });
  }
});

// Delete product (soft delete by deactivating)
router.delete('/:id', auth, canManageInventory, async (req, res) => {
  try {
    await databaseManager.deleteProduct(req.params.id);

    res.json({
      message: 'Product deactivated successfully'
    });

  } catch (error) {
    console.error('Product deletion error:', error);

    if (error.message === 'Product not found') {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.status(500).json({
      error: 'Product deletion failed'
    });
  }
});

// Get low stock products
router.get('/alerts/low-stock', auth, async (req, res) => {
  try {
    const products = await databaseManager.getProducts();
    const lowStockProducts = products.filter(p => 
      p.isActive && p.quantity <= p.lowStockAlert
    ).sort((a, b) => a.quantity - b.quantity);

    res.json({
      products: lowStockProducts,
      count: lowStockProducts.length
    });

  } catch (error) {
    console.error('Low stock fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch low stock products'
    });
  }
});

// Get product statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const products = await databaseManager.getProducts();
    
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.isActive).length;
    const lowStockProducts = products.filter(p => p.isActive && p.quantity <= p.lowStockAlert).length;
    const cafeteriaProducts = products.filter(p => p.category === 'cafeteria' && p.isActive).length;
    const refrigeradorProducts = products.filter(p => p.category === 'refrigerador' && p.isActive).length;
    
    // Calculate inventory value
    let totalCostValue = 0;
    let totalSellingValue = 0;
    
    products.forEach(product => {
      if (product.isActive) {
        totalCostValue += (product.cost * product.quantity);
        totalSellingValue += (product.price * product.quantity);
      }
    });

    res.json({
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      lowStockProducts,
      cafeteriaProducts,
      refrigeradorProducts,
      inventory: {
        totalCostValue: Math.round(totalCostValue * 100) / 100,
        totalSellingValue: Math.round(totalSellingValue * 100) / 100,
        potentialProfit: Math.round((totalSellingValue - totalCostValue) * 100) / 100
      }
    });

  } catch (error) {
    console.error('Product stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch product statistics'
    });
  }
});

module.exports = router;