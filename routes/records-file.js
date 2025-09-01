const express = require('express');
const databaseManager = require('../utils/databaseManager');
const { auth } = require('../middleware/auth-file');

const router = express.Router();

// Simple permission middleware
const canRegisterClients = (req, res, next) => {
  if (req.user.permissions?.canRegisterClients) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for client registration' });
  }
};

const canDeleteRecords = (req, res, next) => {
  if (req.user.permissions?.canDeleteRecords) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for record deletion' });
  }
};

// Get records with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { date, startDate, endDate, service, payment, limit = 100 } = req.query;
    
    let records = await databaseManager.getRecords();
    
    // Filter out deleted records
    records = records.filter(r => !r.isDeleted);
    
    // Filter by specific date
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
      
      records = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= startOfDay && recordDate < endOfDay;
      });
    }
    
    // Filter by date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      records = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= start && recordDate <= end;
      });
    }
    
    // Filter by service type
    if (service) {
      records = records.filter(r => r.service === service.toLowerCase());
    }
    
    // Filter by payment method
    if (payment) {
      records = records.filter(r => r.payment === payment.toLowerCase());
    }

    // Sort by creation date (newest first)
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit results
    records = records.slice(0, parseInt(limit));

    res.json(records);

  } catch (error) {
    console.error('Records fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch records'
    });
  }
});

// Get record by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const record = await databaseManager.getRecordById(req.params.id);

    if (!record || record.isDeleted) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    res.json(record);

  } catch (error) {
    console.error('Record fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch record'
    });
  }
});

// Create new record with multiple products
router.post('/', auth, canRegisterClients, async (req, res) => {
  try {
    const { 
      client, 
      service, 
      products, // New: array of products
      hours = 1, 
      payment, 
      notes,
      drinksCost = 0, // Costo de bebidas para coworking
      tip = 0, // Propina
      // Legacy support for single product
      drinkId
    } = req.body;

    // Validation
    if (!client || !service || !payment) {
      return res.status(400).json({
        error: 'Client, service, and payment method are required'
      });
    }

    // Validate products array or legacy drinkId
    if (!products && !drinkId) {
      return res.status(400).json({
        error: 'At least one product is required'
      });
    }

    if (!['cafeteria', 'coworking'].includes(service.toLowerCase())) {
      return res.status(400).json({
        error: 'Service must be either "cafeteria" or "coworking"'
      });
    }

    if (!['efectivo', 'tarjeta', 'transferencia'].includes(payment.toLowerCase())) {
      return res.status(400).json({
        error: 'Payment method must be "efectivo", "tarjeta", or "transferencia"'
      });
    }

    let productsArray = [];

    // Handle new multi-product format
    if (products && Array.isArray(products)) {
      // Validate and prepare products
      for (const item of products) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            error: 'Each product must have a valid productId and quantity > 0'
          });
        }

        const product = await databaseManager.getProductById(item.productId);
        if (!product || !product.isActive) {
          return res.status(404).json({
            error: `Product ${item.productId} not found or inactive`
          });
        }

        // Check stock
        if (product.quantity < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`
          });
        }

        productsArray.push({
          productId: product._id,
          name: product.name,
          quantity: parseInt(item.quantity),
          price: product.price,
          cost: product.cost,
          category: product.category
        });
      }
    } else if (drinkId) {
      // Legacy single-product format
      const product = await databaseManager.getProductById(drinkId);

      if (!product || !product.isActive) {
        return res.status(404).json({
          error: 'Product not found or inactive'
        });
      }

      if (product.quantity <= 0) {
        return res.status(400).json({
          error: 'Product is out of stock'
        });
      }

      productsArray = [{
        productId: product._id,
        name: product.name,
        quantity: 1,
        price: product.price,
        cost: product.cost,
        category: product.category
      }];
    }

    // Create record
    const record = await databaseManager.createRecord({
      client: client.trim(),
      service: service.toLowerCase(),
      products: productsArray,
      hours: parseInt(hours),
      payment: payment.toLowerCase(),
      notes: notes?.trim(),
      drinksCost: parseFloat(drinksCost),
      tip: parseFloat(tip),
      createdBy: req.user.userId
    });

    res.status(201).json({
      message: 'Record created successfully',
      record
    });

  } catch (error) {
    console.error('Record creation error:', error);
    res.status(500).json({
      error: 'Record creation failed'
    });
  }
});

// Update record
router.put('/:id', auth, canRegisterClients, async (req, res) => {
  try {
    const { client, service, hours, payment, notes } = req.body;

    // Find the record
    const record = await databaseManager.getRecordById(req.params.id);

    if (!record || record.isDeleted) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    // Get the drink product info
    const product = await databaseManager.getProductById(record.drinkProduct);

    // Prepare update data
    const updateData = {};
    if (client) updateData.client = client.trim();
    if (service && ['cafeteria', 'coworking'].includes(service.toLowerCase())) {
      updateData.service = service.toLowerCase();
      
      // Recalculate total if service type changed
      if (service.toLowerCase() !== record.service) {
        if (service.toLowerCase() === 'cafeteria') {
          updateData.total = product.price;
        } else {
          const coworkingRate = 58;
          updateData.total = coworkingRate * (hours || record.hours);
        }
      }
    }
    if (hours && record.service === 'coworking') {
      updateData.hours = parseInt(hours);
      // Recalculate total for coworking
      const coworkingRate = 58;
      updateData.total = coworkingRate * parseInt(hours);
    }
    if (payment && ['efectivo', 'tarjeta', 'transferencia'].includes(payment.toLowerCase())) {
      updateData.payment = payment.toLowerCase();
    }
    if (notes !== undefined) updateData.notes = notes?.trim();

    // Update the record manually since we don't have a direct update method in fileDatabase
    const records = await databaseManager.getRecords();
    const recordIndex = records.findIndex(r => r._id === req.params.id);
    
    if (recordIndex === -1) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    // Apply updates
    records[recordIndex] = {
      ...records[recordIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    // Save updated records
    const fs = require('fs').promises;
    await fs.writeFile(databaseManager.recordsFile, JSON.stringify(records, null, 2));

    res.json({
      message: 'Record updated successfully',
      record: records[recordIndex]
    });

  } catch (error) {
    console.error('Record update error:', error);
    res.status(500).json({
      error: 'Record update failed'
    });
  }
});

// Delete record (soft delete)
router.delete('/:id', auth, canDeleteRecords, async (req, res) => {
  try {
    await databaseManager.deleteRecord(req.params.id, req.user.userId);

    res.json({
      message: 'Record deleted successfully'
    });

  } catch (error) {
    console.error('Record deletion error:', error);

    if (error.message === 'Record not found') {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    res.status(500).json({
      error: 'Record deletion failed'
    });
  }
});

// Get today's records
router.get('/today/summary', auth, async (req, res) => {
  try {
    const records = await databaseManager.getTodayRecords();

    // Calculate summary statistics
    const totalRecords = records.length;
    const totalIncome = records.reduce((sum, record) => sum + record.total, 0);
    const totalCost = records.reduce((sum, record) => sum + record.cost, 0);
    const totalProfit = totalIncome - totalCost;

    // Group by service type
    const serviceBreakdown = records.reduce((acc, record) => {
      acc[record.service] = (acc[record.service] || 0) + 1;
      return acc;
    }, {});

    // Group by payment method
    const paymentBreakdown = records.reduce((acc, record) => {
      acc[record.payment] = (acc[record.payment] || 0) + 1;
      return acc;
    }, {});

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    res.json({
      date: todayString,
      summary: {
        totalRecords,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        averageTicket: totalRecords > 0 ? Math.round((totalIncome / totalRecords) * 100) / 100 : 0
      },
      breakdown: {
        services: serviceBreakdown,
        payments: paymentBreakdown
      },
      records
    });

  } catch (error) {
    console.error('Today summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch today\'s summary'
    });
  }
});

// Get statistics for date range
router.get('/stats/range', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Start date and end date are required'
      });
    }

    const stats = await databaseManager.getStatsByDateRange(startDate, endDate);

    res.json({
      dateRange: {
        from: startDate,
        to: endDate
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Range stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics'
    });
  }
});

// Get daily statistics for the last N days
router.get('/stats/daily/:days', auth, async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 7;
    
    if (days > 365) {
      return res.status(400).json({
        error: 'Maximum 365 days allowed'
      });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get records for the period
    const records = await databaseManager.getRecordsByDateRange(startDate, endDate);
    
    // Group by date and calculate statistics
    const dailyStatsMap = {};
    
    records.forEach(record => {
      const dateKey = new Date(record.date).toISOString().split('T')[0];
      
      if (!dailyStatsMap[dateKey]) {
        dailyStatsMap[dateKey] = {
          date: dateKey,
          totalRecords: 0,
          totalIncome: 0,
          totalCost: 0,
          totalProfit: 0,
          services: [],
          payments: []
        };
      }
      
      const dayStats = dailyStatsMap[dateKey];
      dayStats.totalRecords++;
      dayStats.totalIncome += record.total;
      dayStats.totalCost += record.cost;
      dayStats.totalProfit += record.profit;
      dayStats.services.push(record.service);
      dayStats.payments.push(record.payment);
    });
    
    // Convert to array and add calculated fields
    const dailyStats = Object.values(dailyStatsMap).map(day => ({
      date: day.date,
      totalRecords: day.totalRecords,
      totalIncome: Math.round(day.totalIncome * 100) / 100,
      totalCost: Math.round(day.totalCost * 100) / 100,
      totalProfit: Math.round(day.totalProfit * 100) / 100,
      averageTicket: day.totalRecords > 0 ? Math.round((day.totalIncome / day.totalRecords) * 100) / 100 : 0,
      serviceBreakdown: {
        cafeteria: day.services.filter(s => s === 'cafeteria').length,
        coworking: day.services.filter(s => s === 'coworking').length
      }
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      period: `${days} days`,
      dailyStatistics: dailyStats
    });

  } catch (error) {
    console.error('Daily stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch daily statistics'
    });
  }
});

// Get specific record by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const record = await databaseManager.getRecordById(req.params.id);
    
    if (!record || record.isDeleted) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// Update products in a specific record
router.patch('/:id/products', auth, async (req, res) => {
  try {
    // Check permissions
    if (!req.user.permissions?.canManageInventory) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const recordId = req.params.id;
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array is required' });
    }
    
    // Get current record
    const currentRecord = await databaseManager.getRecordById(recordId);
    if (!currentRecord || currentRecord.isDeleted) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    // Update only refrigerador products, keep others unchanged
    const updatedProducts = currentRecord.products.map(currentProduct => {
      const updatedProduct = products.find(p => p._id === currentProduct._id && p.category === 'refrigerador');
      return updatedProduct || currentProduct;
    });
    
    // Recalculate totals
    let subtotal = 0;
    let totalCost = 0;
    
    updatedProducts.forEach(product => {
      const productTotal = product.price * product.quantity;
      const productCost = (product.cost || 0) * product.quantity;
      
      if (currentRecord.service === 'coworking' && product.category === 'cafeteria') {
        // Cafeteria items are free in coworking, don't add to subtotal
        totalCost += productCost;
      } else {
        subtotal += productTotal;
        totalCost += productCost;
      }
    });
    
    const serviceCharge = currentRecord.serviceCharge || 0;
    const tip = currentRecord.tip || 0;
    const total = subtotal + serviceCharge + tip;
    
    // Update record
    const updateData = {
      products: updatedProducts,
      subtotal: subtotal,
      total: total,
      cost: totalCost,
      profit: total - totalCost,
      updatedAt: new Date()
    };
    
    await databaseManager.updateRecord(recordId, updateData);
    
    res.json({ 
      message: 'Products updated successfully',
      record: await databaseManager.getRecordById(recordId)
    });
    
  } catch (error) {
    console.error('Update products error:', error);
    res.status(500).json({ error: 'Failed to update products' });
  }
});

// New endpoint for creating historical records
router.post('/historical', auth, canRegisterClients, async (req, res) => {
  try {
    const { 
      client, 
      service, 
      products,
      drinkId, 
      hours = 1, 
      payment, 
      notes,
      tip = 0,
      historicalDate // Required for this endpoint
    } = req.body;

    // Validation
    if (!historicalDate) {
      return res.status(400).json({
        error: 'Historical date is required for this endpoint'
      });
    }

    // Validate historical date is not in the future
    const targetDate = new Date(historicalDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (targetDate > today) {
      return res.status(400).json({
        error: 'Historical date cannot be in the future'
      });
    }

    // Common validation
    if (!client || !service || !payment) {
      return res.status(400).json({
        error: 'Client, service, and payment method are required'
      });
    }

    if (!['cafeteria', 'coworking'].includes(service.toLowerCase())) {
      return res.status(400).json({
        error: 'Service must be either "cafeteria" or "coworking"'
      });
    }

    if (!['efectivo', 'tarjeta', 'transferencia'].includes(payment.toLowerCase())) {
      return res.status(400).json({
        error: 'Payment method must be "efectivo", "tarjeta", or "transferencia"'
      });
    }

    let productsArray = [];

    // Handle multi-product format
    if (products && Array.isArray(products) && products.length > 0) {
      // Validate and prepare products
      for (const item of products) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            error: 'Each product must have a valid productId and quantity > 0'
          });
        }

        const product = await databaseManager.getProductById(item.productId);
        if (!product || !product.isActive) {
          return res.status(404).json({
            error: `Product ${item.productId} not found or inactive`
          });
        }

        productsArray.push({
          productId: product._id,
          name: product.name,
          quantity: parseInt(item.quantity),
          price: product.price,
          cost: product.cost,
          category: product.category
        });
      }
    } else if (drinkId) {
      // Legacy single-product format
      const product = await databaseManager.getProductById(drinkId);

      if (!product || !product.isActive) {
        return res.status(404).json({
          error: 'Product not found or inactive'
        });
      }

      productsArray = [{
        productId: product._id,
        name: product.name,
        quantity: 1,
        price: product.price,
        cost: product.cost,
        category: product.category
      }];
    } else {
      return res.status(400).json({
        error: 'At least one product is required'
      });
    }

    // Create historical record with specific date
    const record = await databaseManager.createRecord({
      client: client.trim(),
      service: service.toLowerCase(),
      products: productsArray,
      hours: parseInt(hours),
      payment: payment.toLowerCase(),
      notes: notes?.trim(),
      tip: parseFloat(tip),
      createdBy: req.user.userId,
      historicalDate: targetDate // Pass the historical date
    });

    res.status(201).json({
      message: 'Historical record created successfully',
      record
    });

  } catch (error) {
    console.error('Historical record creation error:', error);
    res.status(500).json({
      error: 'Historical record creation failed'
    });
  }
});

module.exports = router;