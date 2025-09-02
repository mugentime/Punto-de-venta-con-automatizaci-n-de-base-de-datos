const express = require('express');
const Record = require('../models/Record');
const Product = require('../models/Product');
const { auth, canRegisterClients, canDeleteRecords } = require('../middleware/auth');

const router = express.Router();

// EMERGENCY ROUTE - DEPLOY TEST
router.get('/deploy-test', (req, res) => {
  res.json({ 
    message: 'DEPLOY WORKING',
    timestamp: new Date().toISOString(),
    version: '2024-09-02-EMERGENCY' 
  });
});

// Get records with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { date, startDate, endDate, service, payment, limit = 100 } = req.query;
    
    let query = { isDeleted: false };
    
    // Filter by specific date
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
      
      query.date = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    }
    
    // Filter by date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Filter by service type
    if (service) {
      query.service = service.toLowerCase();
    }
    
    // Filter by payment method
    if (payment) {
      query.payment = payment.toLowerCase();
    }

    const records = await Record.find(query)
      .populate('drinkProduct', 'name category')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

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
    const record = await Record.findOne({
      _id: req.params.id,
      isDeleted: false
    })
    .populate('drinkProduct', 'name category price cost')
    .populate('createdBy', 'name email');

    if (!record) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    res.json(record);

  } catch (error) {
    console.error('Record fetch error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid record ID'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch record'
    });
  }
});

// Create new record
router.post('/', auth, canRegisterClients, async (req, res) => {
  try {
    const { 
      client, 
      service, 
      products,
      drinkId, 
      hours = 1, 
      payment, 
      notes,
      drinksCost = 0,
      tip = 0,
      date,
      historicalDate
    } = req.body;

    // Validation (common)
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

    // Support both new multi-product and legacy single-product formats
    let recordProducts = [];
    let totalCost = 0;
    let total = 0;
    let record;
    
    if (products && Array.isArray(products) && products.length > 0) {
      // NEW: Multi-product system
      for (const orderProduct of products) {
        const product = await Product.findOne({
          _id: orderProduct.productId,
          isActive: true
        });

        if (!product) {
          return res.status(404).json({
            error: `Product ${orderProduct.productId} not found or inactive`
          });
        }

        if (product.quantity < orderProduct.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${product.name}`
          });
        }

        recordProducts.push({
          productId: product._id,
          name: product.name,
          category: product.category,
          quantity: orderProduct.quantity,
          cost: product.cost,
          price: product.price
        });

        // Update stock
        await product.updateStock(orderProduct.quantity, 'subtract');
      }

      // Calculate totals for multi-product
      if (service.toLowerCase() === 'cafeteria') {
        // Cafeteria: charge full price for all products
        total = recordProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
        totalCost = recordProducts.reduce((sum, p) => sum + (p.quantity * p.cost), 0);
      } else {
        // Coworking: charge hourly rate + only refrigerador products
        const coworkingRate = 58;
        total = coworkingRate * parseInt(hours);
        
        // Add refrigerador product prices to total
        const refrigeradorTotal = recordProducts
          .filter(p => p.category === 'refrigerador')
          .reduce((sum, p) => sum + (p.quantity * p.price), 0);
        total += refrigeradorTotal;
        
        // Cost includes ALL products (cafeteria items reduce profit even though they're free)
        totalCost = recordProducts.reduce((sum, p) => sum + (p.quantity * p.cost), 0);
      }

      total += tip; // Add tip to total

      // Create multi-product record
      const recordData = {
        client: client.trim(),
        service: service.toLowerCase(),
        products: recordProducts,
        hours: parseInt(hours),
        total: Number(total),
        payment: payment.toLowerCase(),
        cost: totalCost,
        tip: Number(tip),
        notes: notes?.trim(),
        createdBy: req.user.userId
      };
      
      // Add custom date if provided
      if (date || historicalDate) {
        recordData.date = new Date(date || historicalDate);
      }
      
      record = new Record(recordData);

      await record.save();

    } else {
      // LEGACY: Single product system (backward compatibility)
      if (!drinkId) {
        return res.status(400).json({
          error: 'Drink product is required for legacy format'
        });
      }

      const product = await Product.findOne({
        _id: drinkId,
        isActive: true
      });

      if (!product) {
        return res.status(404).json({
          error: 'Product not found or inactive'
        });
      }

      if (product.quantity <= 0) {
        return res.status(400).json({
          error: 'Product is out of stock'
        });
      }

      if (service.toLowerCase() === 'cafeteria') {
        total = product.price;
      } else {
        const coworkingRate = 58;
        total = coworkingRate * parseInt(hours);
      }

      const recordData = {
        client: client.trim(),
        service: service.toLowerCase(),
        drink: product.name,
        drinkProduct: product._id,
        hours: parseInt(hours),
        total: Number(total),
        payment: payment.toLowerCase(),
        cost: product.cost,
        notes: notes?.trim(),
        createdBy: req.user.userId
      };
      
      // Add custom date if provided
      if (date || historicalDate) {
        recordData.date = new Date(date || historicalDate);
      }
      
      record = new Record(recordData);

      await record.save();
      await product.updateStock(1, 'subtract');
    }

    // Get the created record (using the variable from whichever path was taken)
    let savedRecord;
    if (products && Array.isArray(products) && products.length > 0) {
      savedRecord = await Record.findById(record._id).populate('createdBy', 'name email');
    } else {
      savedRecord = await Record.findById(record._id)
        .populate('drinkProduct', 'name category price cost')
        .populate('createdBy', 'name email');
    }

    res.status(201).json({
      message: 'Record created successfully',
      record: savedRecord
    });

  } catch (error) {
    console.error('Record creation error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: messages.join(', ')
      });
    }

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
    const record = await Record.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate('drinkProduct');

    if (!record) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (client) updateData.client = client.trim();
    if (service && ['cafeteria', 'coworking'].includes(service.toLowerCase())) {
      updateData.service = service.toLowerCase();
      
      // Recalculate total if service type changed
      if (service.toLowerCase() !== record.service) {
        if (service.toLowerCase() === 'cafeteria') {
          updateData.total = record.drinkProduct.price;
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

    // Update the record
    const updatedRecord = await Record.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('drinkProduct', 'name category price cost')
    .populate('createdBy', 'name email');

    res.json({
      message: 'Record updated successfully',
      record: updatedRecord
    });

  } catch (error) {
    console.error('Record update error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid record ID'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: messages.join(', ')
      });
    }

    res.status(500).json({
      error: 'Record update failed'
    });
  }
});

// Delete record (soft delete)
router.delete('/:id', auth, canDeleteRecords, async (req, res) => {
  try {
    const record = await Record.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate('drinkProduct');

    if (!record) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }

    // Soft delete the record
    await record.softDelete(req.user.userId);

    // Return stock to product
    if (record.drinkProduct) {
      await record.drinkProduct.updateStock(1, 'add');
    }

    res.json({
      message: 'Record deleted successfully'
    });

  } catch (error) {
    console.error('Record deletion error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid record ID'
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
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const records = await Record.find({
      isDeleted: false,
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })
    .populate('drinkProduct', 'name category')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

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

    res.json({
      date: startOfDay.toISOString().split('T')[0],
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

    const stats = await Record.getStatsByDateRange(startDate, endDate);

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

    // Aggregate daily statistics
    const dailyStats = await Record.aggregate([
      {
        $match: {
          isDeleted: false,
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          totalRecords: { $sum: 1 },
          totalIncome: { $sum: '$total' },
          totalCost: { $sum: '$cost' },
          totalProfit: { $sum: '$profit' },
          averageTicket: { $avg: '$total' },
          services: { $push: '$service' },
          payments: { $push: '$payment' }
        }
      },
      {
        $project: {
          date: '$_id',
          totalRecords: 1,
          totalIncome: { $round: ['$totalIncome', 2] },
          totalCost: { $round: ['$totalCost', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          averageTicket: { $round: ['$averageTicket', 2] },
          serviceBreakdown: {
            cafeteria: {
              $size: {
                $filter: {
                  input: '$services',
                  cond: { $eq: ['$$this', 'cafeteria'] }
                }
              }
            },
            coworking: {
              $size: {
                $filter: {
                  input: '$services',
                  cond: { $eq: ['$$this', 'coworking'] }
                }
              }
            }
          }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

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

// Test endpoint to verify route is working
router.get('/test-historical', (req, res) => {
  res.json({ message: 'Historical endpoint route is working', timestamp: new Date().toISOString() });
});

// New endpoint for creating historical records (SIMPLIFIED FOR DEBUGGING)
router.post('/historical', async (req, res) => {
  console.log('🔥 HISTORICAL ENDPOINT HIT!', req.body);
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

    let record;
    
    if (products && Array.isArray(products) && products.length > 0) {
      // Multi-product system
      let recordProducts = [];
      let totalCost = 0;
      let total = 0;
      
      for (const orderProduct of products) {
        const product = await Product.findOne({
          _id: orderProduct.productId,
          isActive: true
        });

        if (!product) {
          return res.status(404).json({
            error: `Product ${orderProduct.productId} not found or inactive`
          });
        }

        recordProducts.push({
          productId: product._id,
          name: product.name,
          category: product.category,
          quantity: orderProduct.quantity,
          cost: product.cost,
          price: product.price
        });
      }

      // Calculate totals
      if (service.toLowerCase() === 'cafeteria') {
        total = recordProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
        totalCost = recordProducts.reduce((sum, p) => sum + (p.quantity * p.cost), 0);
      } else {
        const coworkingRate = 58;
        total = coworkingRate * parseInt(hours);
        
        const refrigeradorTotal = recordProducts
          .filter(p => p.category === 'refrigerador')
          .reduce((sum, p) => sum + (p.quantity * p.price), 0);
        total += refrigeradorTotal;
        
        totalCost = recordProducts.reduce((sum, p) => sum + (p.quantity * p.cost), 0);
      }

      total += tip;

      record = new Record({
        client: client.trim(),
        service: service.toLowerCase(),
        products: recordProducts,
        hours: parseInt(hours),
        total: Number(total),
        payment: payment.toLowerCase(),
        cost: totalCost,
        tip: Number(tip),
        notes: notes?.trim(),
        createdBy: req.user.userId,
        date: targetDate
      });

    } else {
      // Legacy single product
      if (!drinkId) {
        return res.status(400).json({
          error: 'Product is required'
        });
      }

      const product = await Product.findOne({
        _id: drinkId,
        isActive: true
      });

      if (!product) {
        return res.status(404).json({
          error: 'Product not found or inactive'
        });
      }

      let total = 0;
      if (service.toLowerCase() === 'cafeteria') {
        total = product.price;
      } else {
        const coworkingRate = 58;
        total = coworkingRate * parseInt(hours);
      }

      record = new Record({
        client: client.trim(),
        service: service.toLowerCase(),
        drink: product.name,
        drinkProduct: product._id,
        hours: parseInt(hours),
        total: Number(total),
        payment: payment.toLowerCase(),
        cost: product.cost,
        notes: notes?.trim(),
        createdBy: req.user.userId,
        date: targetDate
      });
    }

    await record.save();

    // Populate the saved record
    let savedRecord;
    if (products && Array.isArray(products) && products.length > 0) {
      savedRecord = await Record.findById(record._id).populate('createdBy', 'name email');
    } else {
      savedRecord = await Record.findById(record._id)
        .populate('drinkProduct', 'name category price cost')
        .populate('createdBy', 'name email');
    }

    res.status(201).json({
      message: 'Historical record created successfully',
      record: savedRecord
    });

  } catch (error) {
    console.error('🔥 HISTORICAL RECORD ERROR:', error);
    
    // Return more detailed error info for debugging
    res.status(500).json({
      error: 'Historical record creation failed',
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

module.exports = router;