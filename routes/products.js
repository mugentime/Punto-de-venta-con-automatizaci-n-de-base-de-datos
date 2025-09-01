const express = require('express');
const Product = require('../models/Product');
const { auth, canManageInventory } = require('../middleware/auth');

const router = express.Router();

// Get all products
router.get('/', auth, async (req, res) => {
  try {
    const { category, active, lowStock } = req.query;
    
    let query = {
      // By default, only show active products unless explicitly requested otherwise
      isActive: active === 'false' ? false : true
    };
    
    // Filter by category
    if (category) {
      query.category = category.toLowerCase();
    }
    
    // Override active status if explicitly specified
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    // Filter by low stock
    if (lowStock === 'true') {
      query = { 
        ...query,
        $expr: { $lte: ['$quantity', '$lowStockAlert'] }
      };
    }

    const products = await Product.find(query)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ category: 1, name: 1 });

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
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(product);

  } catch (error) {
    console.error('Product fetch error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid product ID'
      });
    }

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

    if (!['cafeteria', 'refrigerador', 'alimentos'].includes(category.toLowerCase())) {
      return res.status(400).json({
        error: 'Category must be "cafeteria", "refrigerador", or "alimentos"'
      });
    }

    if (quantity < 0 || cost < 0 || price < 0) {
      return res.status(400).json({
        error: 'Quantity, cost, and price cannot be negative'
      });
    }

    // Check if barcode is unique (if provided)
    if (barcode) {
      const existingProduct = await Product.findOne({ barcode: barcode.trim() });
      if (existingProduct) {
        return res.status(409).json({
          error: 'Product with this barcode already exists'
        });
      }
    }

    const product = new Product({
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

    await product.save();

    // Populate creator info
    await product.populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('Product creation error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Product with this barcode already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: messages.join(', ')
      });
    }

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
    if (category && !['cafeteria', 'refrigerador', 'alimentos'].includes(category.toLowerCase())) {
      return res.status(400).json({
        error: 'Category must be "cafeteria", "refrigerador", or "alimentos"'
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
      const existingProduct = await Product.findOne({ 
        barcode: barcode.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        return res.status(409).json({
          error: 'Product with this barcode already exists'
        });
      }
    }

    const updateData = {
      lastModifiedBy: req.user.userId
    };

    if (name) updateData.name = name.trim();
    if (category) updateData.category = category.toLowerCase();
    if (quantity !== undefined) updateData.quantity = Number(quantity);
    if (cost !== undefined) updateData.cost = Number(cost);
    if (price !== undefined) updateData.price = Number(price);
    if (lowStockAlert !== undefined) updateData.lowStockAlert = Number(lowStockAlert);
    if (description !== undefined) updateData.description = description.trim();
    if (barcode !== undefined) updateData.barcode = barcode.trim();
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('lastModifiedBy', 'name email');

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });

  } catch (error) {
    console.error('Product update error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid product ID'
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Product with this barcode already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: messages.join(', ')
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

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Update stock using the model method
    await product.updateStock(Number(quantity), operation);
    
    // Update last modified info
    product.lastModifiedBy = req.user.userId;
    await product.save();

    // Populate and return updated product
    await product.populate('createdBy', 'name email');
    await product.populate('lastModifiedBy', 'name email');

    res.json({
      message: 'Stock updated successfully',
      product
    });

  } catch (error) {
    console.error('Stock update error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid product ID'
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
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { 
        isActive: false,
        lastModifiedBy: req.user.userId
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json({
      message: 'Product deactivated successfully'
    });

  } catch (error) {
    console.error('Product deletion error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid product ID'
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
    const lowStockProducts = await Product.findLowStock()
      .populate('createdBy', 'name email')
      .sort({ quantity: 1 });

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
    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      cafeteriaProducts,
      refrigeradorProducts,
      totalValue
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.findLowStock().countDocuments(),
      Product.countDocuments({ category: 'cafeteria', isActive: true }),
      Product.countDocuments({ category: 'refrigerador', isActive: true }),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { 
          _id: null, 
          totalCost: { $sum: { $multiply: ['$cost', '$quantity'] } },
          totalValue: { $sum: { $multiply: ['$price', '$quantity'] } }
        }}
      ])
    ]);

    const valueData = totalValue[0] || { totalCost: 0, totalValue: 0 };

    res.json({
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      lowStockProducts,
      cafeteriaProducts,
      refrigeradorProducts,
      inventory: {
        totalCostValue: Math.round(valueData.totalCost * 100) / 100,
        totalSellingValue: Math.round(valueData.totalValue * 100) / 100,
        potentialProfit: Math.round((valueData.totalValue - valueData.totalCost) * 100) / 100
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