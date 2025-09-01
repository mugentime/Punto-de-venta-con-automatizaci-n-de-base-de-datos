const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot be longer than 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['cafeteria', 'refrigerador', 'alimentos'],
    lowercase: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required'],
    min: [0, 'Cost cannot be negative']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lowStockAlert: {
    type: Number,
    default: 5,
    min: [0, 'Low stock alert cannot be negative']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be longer than 500 characters'],
    trim: true
  },
  barcode: {
    type: String,
    trim: true,
    sparse: true // Allows multiple null values but unique non-null values
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ barcode: 1 }, { sparse: true });

// Virtual for profit margin
productSchema.virtual('profit').get(function() {
  return this.price - this.cost;
});

// Virtual for profit percentage
productSchema.virtual('profitPercentage').get(function() {
  if (this.cost === 0) return 0;
  return ((this.price - this.cost) / this.cost) * 100;
});

// Virtual for checking if stock is low
productSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.lowStockAlert;
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Pre-save middleware to track modifications
productSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy = this.modifiedBy || this.createdBy;
  }
  next();
});

// Static method to find active products
productSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find products by category
productSchema.statics.findByCategory = function(category) {
  return this.find({ category: category.toLowerCase(), isActive: true });
};

// Static method to find low stock products
productSchema.statics.findLowStock = function() {
  return this.find({
    isActive: true,
    $expr: { $lte: ['$quantity', '$lowStockAlert'] }
  });
};

// Instance method to update stock
productSchema.methods.updateStock = function(quantity, operation = 'subtract') {
  if (operation === 'subtract') {
    this.quantity = Math.max(0, this.quantity - quantity);
  } else if (operation === 'add') {
    this.quantity += quantity;
  } else if (operation === 'set') {
    this.quantity = Math.max(0, quantity);
  }
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);