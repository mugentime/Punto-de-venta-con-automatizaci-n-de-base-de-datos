const mongoose = require('mongoose');

const cashCutSchema = new mongoose.Schema({
  cutDate: {
    type: Date,
    required: [true, 'Cut date is required'],
    index: true
  },
  cutTime: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  cutType: {
    type: String,
    enum: ['automatic', 'manual'],
    required: true,
    default: 'automatic'
  },
  totalRecords: {
    type: Number,
    required: true,
    default: 0
  },
  totalIncome: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Total income cannot be negative']
  },
  totalCost: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Total cost cannot be negative']
  },
  totalProfit: {
    type: Number,
    required: true,
    default: 0
  },
  averageTicket: {
    type: Number,
    default: 0,
    min: [0, 'Average ticket cannot be negative']
  },
  paymentBreakdown: {
    efectivo: {
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    tarjeta: {
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    transferencia: {
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    }
  },
  serviceBreakdown: {
    cafeteria: {
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    coworking: {
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    }
  },
  topProducts: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    quantity: Number,
    revenue: Number
  }],
  hourlyBreakdown: [{
    hour: String,
    count: Number,
    revenue: Number
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be longer than 1000 characters'],
    trim: true
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
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
cashCutSchema.index({ cutDate: -1, createdBy: 1 });
cashCutSchema.index({ cutType: 1, cutDate: -1 });
cashCutSchema.index({ isDeleted: 1, cutDate: -1 });
cashCutSchema.index({ startDate: 1, endDate: 1 });

// Calculate profit before saving
cashCutSchema.pre('save', function(next) {
  this.totalProfit = this.totalIncome - this.totalCost;
  
  // Set cut time if not provided
  if (!this.cutTime) {
    this.cutTime = new Date().toLocaleTimeString('es-MX', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  next();
});

// Static method to find active cash cuts
cashCutSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

// Static method to find cash cuts by date range
cashCutSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    isDeleted: false,
    cutDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });
};

// Static method to get today's cuts
cashCutSchema.statics.findToday = function() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  return this.find({
    isDeleted: false,
    cutDate: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });
};

// Static method to get the last cash cut
cashCutSchema.statics.getLastCut = function() {
  return this.findOne({ isDeleted: false })
    .sort({ cutDate: -1 });
};

// Static method to check if a cut already exists for a time period
cashCutSchema.statics.existsForPeriod = function(startDate, endDate) {
  return this.findOne({
    isDeleted: false,
    startDate: { $lte: startDate },
    endDate: { $gte: endDate }
  });
};

// Instance method for soft delete
cashCutSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

module.exports = mongoose.model('CashCut', cashCutSchema);