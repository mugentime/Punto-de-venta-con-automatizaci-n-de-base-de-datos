const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  clientName: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [100, 'Client name cannot be longer than 100 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone cannot be longer than 20 characters']
  },
  membershipType: {
    type: String,
    required: [true, 'Membership type is required'],
    enum: ['daily', 'weekly', 'monthly'],
    lowercase: true
  },
  plan: {
    type: String,
    required: [true, 'Plan is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'active'
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia'],
    required: [true, 'Payment method is required']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be longer than 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastPayment: {
    date: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true
    },
    method: {
      type: String,
      enum: ['efectivo', 'tarjeta', 'transferencia'],
      required: true
    }
  },
  paymentHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true
    },
    method: {
      type: String,
      enum: ['efectivo', 'tarjeta', 'transferencia'],
      required: true
    },
    notes: String
  }],
  services: {
    coworking: {
      type: Boolean,
      default: false
    },
    cafeteria: {
      type: Boolean,
      default: false
    },
    printing: {
      type: Boolean,
      default: false
    },
    meeting_room: {
      type: Boolean,
      default: false
    }
  },
  usage: {
    totalHours: {
      type: Number,
      default: 0
    },
    currentMonthHours: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para calcular días restantes
membershipSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'expired' || this.status === 'cancelled') {
    return 0;
  }
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual para verificar si está por vencer (3 días antes)
membershipSchema.virtual('isExpiring').get(function() {
  return this.daysRemaining <= 3 && this.daysRemaining > 0;
});

// Middleware para actualizar el estado antes de guardar
membershipSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.endDate < now && this.status === 'active') {
    this.status = 'expired';
  }
  
  next();
});

// Método para renovar membresía
membershipSchema.methods.renew = function(paymentMethod, amount, notes) {
  const duration = this.membershipType === 'daily' ? 1 : 
                  this.membershipType === 'weekly' ? 7 : 30;
  
  const newStartDate = new Date();
  const newEndDate = new Date();
  newEndDate.setDate(newEndDate.getDate() + duration);
  
  this.startDate = newStartDate;
  this.endDate = newEndDate;
  this.status = 'active';
  this.lastPayment = {
    date: new Date(),
    amount: amount,
    method: paymentMethod
  };
  
  this.paymentHistory.push({
    date: new Date(),
    amount: amount,
    method: paymentMethod,
    notes: notes || 'Renovación de membresía'
  });
  
  return this.save();
};

// Método para cancelar membresía
membershipSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = this.notes ? `${this.notes}\nCancelada: ${reason}` : `Cancelada: ${reason}`;
  return this.save();
};

// Índices para optimizar consultas
membershipSchema.index({ clientName: 1 });
membershipSchema.index({ email: 1 });
membershipSchema.index({ membershipType: 1, status: 1 });
membershipSchema.index({ endDate: 1, status: 1 });
membershipSchema.index({ createdBy: 1 });
membershipSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Membership', membershipSchema);