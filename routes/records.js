const express = require('express');
const Record = require('../models/Record');
const Product = require('../models/Product');
const { auth, canRegisterClients, canDeleteRecords } = require('../middleware/auth');

const router = express.Router();

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
      drinkId, 
      hours = 1, 
      payment, 
      notes 
    } = req.body;

    // Validation
    if (!client || !service || !drinkId || !payment) {
      return res.status(400).json({
        error: 'Client, service, drink, and payment method are required'
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

    // Get the product (drink)
    const product = await Product.findOne({
      _id: drinkId,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found or inactive'
      });
    }

    // Check stock
    if (product.quantity <= 0) {
      return res.status(400).json({
        error: 'Product is out of stock'
      });
    }

    // Calculate total based on service type
    let total = 0;
    if (service.toLowerCase() === 'cafeteria') {
      // For cafeteria service, charge the drink price
      total = product.price;
    } else {
      // For coworking service, charge hourly rate (drink is included)
      const coworkingRate = 58; // $58 per hour
      total = coworkingRate * parseInt(hours);
    }

    // Create record
    const record = new Record({
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
    });

    await record.save();

    // Update product stock
    await product.updateStock(1, 'subtract');

    // Populate references
    await record.populate('drinkProduct', 'name category price cost');
    await record.populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Record created successfully',
      record
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

module.exports = router;