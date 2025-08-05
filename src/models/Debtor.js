const mongoose = require('mongoose');

const debtorSchema = new mongoose.Schema({
  // Basic Information
  debtorCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Link to User (Student/Tenant)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Account Information
  accountCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Current Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'overdue', 'defaulted', 'paid'],
    default: 'active'
  },
  
  // Financial Information
  currentBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalOwed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Credit Terms
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  
  paymentTerms: {
    type: String,
    enum: ['immediate', '7_days', '15_days', '30_days', 'monthly'],
    default: 'monthly'
  },
  
  // Overdue Tracking
  overdueAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  daysOverdue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastPaymentDate: {
    type: Date
  },
  
  lastPaymentAmount: {
    type: Number,
    default: 0
  },
  
  // Residence Information
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence'
  },
  
  roomNumber: {
    type: String,
    trim: true
  },
  
  // Application Information (for syncing)
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  
  billingPeriod: {
    type: String,
    trim: true
  },
  
  startDate: {
    type: Date
  },
  
  endDate: {
    type: Date
  },
  
  roomPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Payment Information (for syncing)
  payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],
  
  // Contact Information (cached for quick access)
  contactInfo: {
    name: String,
    email: String,
    phone: String
  },
  
  // Notes and History
  notes: {
    type: String,
    trim: true
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
debtorSchema.index({ debtorCode: 1 });
debtorSchema.index({ accountCode: 1 });
debtorSchema.index({ user: 1 });
debtorSchema.index({ status: 1 });
debtorSchema.index({ currentBalance: 1 });
debtorSchema.index({ residence: 1 });

// Pre-save middleware to update timestamps
debtorSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to generate debtor code
debtorSchema.statics.generateDebtorCode = async function() {
  // Get the highest existing debtor code to avoid duplicates
  const highestDebtor = await this.findOne().sort({ debtorCode: -1 });
  let nextNumber = 1;
  
  if (highestDebtor && highestDebtor.debtorCode) {
    const match = highestDebtor.debtorCode.match(/DR(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  const code = `DR${String(nextNumber).padStart(4, '0')}`;
  return code;
};

// Static method to generate account code
debtorSchema.statics.generateAccountCode = async function() {
  // Get the highest existing account code to avoid duplicates
  const highestDebtor = await this.findOne().sort({ accountCode: -1 });
  let nextNumber = 1;
  
  if (highestDebtor && highestDebtor.accountCode) {
    const match = highestDebtor.accountCode.match(/110(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  const code = `110${String(nextNumber).padStart(3, '0')}`; // 1100 series for Accounts Receivable
  return code;
};

// Instance method to calculate balance
debtorSchema.methods.calculateBalance = function() {
  this.currentBalance = this.totalOwed - this.totalPaid;
  this.overdueAmount = this.currentBalance > 0 ? this.currentBalance : 0;
  return this.currentBalance;
};

// Instance method to add charge (invoice)
debtorSchema.methods.addCharge = function(amount, description = '') {
  this.totalOwed += amount;
  this.calculateBalance();
  return this.save();
};

// Instance method to add payment
debtorSchema.methods.addPayment = function(amount, description = '') {
  this.totalPaid += amount;
  this.lastPaymentDate = new Date();
  this.lastPaymentAmount = amount;
  this.calculateBalance();
  return this.save();
};

// Virtual for full name
debtorSchema.virtual('fullName').get(function() {
  return this.contactInfo?.name || `${this.contactInfo?.firstName || ''} ${this.contactInfo?.lastName || ''}`.trim();
});

// Virtual for overdue status
debtorSchema.virtual('isOverdue').get(function() {
  return this.currentBalance > 0 && this.daysOverdue > 0;
});

// Virtual for credit available
debtorSchema.virtual('creditAvailable').get(function() {
  return Math.max(0, this.creditLimit - this.currentBalance);
});

module.exports = mongoose.model('Debtor', debtorSchema); 