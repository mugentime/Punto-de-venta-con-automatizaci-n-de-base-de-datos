const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  client: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [100, 'Client name cannot be longer than 100 characters']
  },
  service: {
    type: String,
    required: [true, 'Service type is required'],
    enum: ['cafeteria', 'coworking'],
    lowercase: true
  },
  drink: {
    type: String,
    required: [true, 'Drink selection is required'],
    trim: true
  },
  drinkProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  hours: {
    type: Number,
    default: 1,
    min: [1, 'Hours must be at least 1'],
    max: [24, 'Hours cannot exceed 24']
  },
  total: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total cannot be negative']
  },
  payment: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['efectivo', 'tarjeta', 'transferencia'],
    lowercase: true
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required'],
    min: [0, 'Cost cannot be negative']
  },
  profit: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  time: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be longer than 500 characters'],
    trim: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
recordSchema.index({ date: 1, createdBy: 1 });
recordSchema.index({ service: 1, date: 1 });
recordSchema.index({ isDeleted: 1, date: 1 });
recordSchema.index({ createdBy: 1, createdAt: -1 });

// Calculate profit before saving
recordSchema.pre('save', function(next) {
  if (this.service === 'cafeteria') {
    // For cafeteria service, profit is drink price minus drink cost
    this.profit = this.total - this.cost;
  } else {
    // For coworking service, the drink is included, so profit is total minus drink cost
    this.profit = this.total - this.cost;
  }
  
  // Set time if not provided
  if (!this.time) {
    this.time = new Date().toLocaleTimeString('es-MX', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  next();
});

// Static method to find active records
recordSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

// Static method to find records by date range
recordSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    isDeleted: false,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });
};

// Static method to find today's records
recordSchema.statics.findToday = function() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  return this.find({
    isDeleted: false,
    date: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });
};

// Static method for sales statistics
recordSchema.statics.getStatsByDateRange = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        isDeleted: false,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        totalIncome: { $sum: '$total' },
        totalCost: { $sum: '$cost' },
        totalProfit: { $sum: '$profit' },
        averageTicket: { $avg: '$total' },
        paymentMethods: {
          $push: '$payment'
        },
        services: {
          $push: '$service'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalRecords: 1,
        totalIncome: { $round: ['$totalIncome', 2] },
        totalCost: { $round: ['$totalCost', 2] },
        totalProfit: { $round: ['$totalProfit', 2] },
        averageTicket: { $round: ['$averageTicket', 2] },
        paymentBreakdown: {
          $arrayToObject: [
            {
              $map: {
                input: ['efectivo', 'tarjeta', 'transferencia'],
                as: 'method',
                in: {
                  k: '$$method',
                  v: {
                    $size: {
                      $filter: {
                        input: '$paymentMethods',
                        cond: { $eq: ['$$this', '$$method'] }
                      }
                    }
                  }
                }
              }
            }
          ]
        },
        serviceBreakdown: {
          $arrayToObject: [
            {
              $map: {
                input: ['cafeteria', 'coworking'],
                as: 'service',
                in: {
                  k: '$$service',
                  v: {
                    $size: {
                      $filter: {
                        input: '$services',
                        cond: { $eq: ['$$this', '$$service'] }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalRecords: 0,
    totalIncome: 0,
    totalCost: 0,
    totalProfit: 0,
    averageTicket: 0,
    paymentBreakdown: { efectivo: 0, tarjeta: 0, transferencia: 0 },
    serviceBreakdown: { cafeteria: 0, coworking: 0 }
  };
};

// Instance method for soft delete
recordSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

module.exports = mongoose.model('Record', recordSchema);