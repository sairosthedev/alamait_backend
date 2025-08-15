const mongoose = require('mongoose');

const transactionEntrySchema = new mongoose.Schema({
  // Transaction Info
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  reference: String,
  
  // Double-Entry Details
  entries: [{
    accountCode: {
      type: String,
      required: true,
      ref: 'Account'
    },
    accountName: String,
    accountType: String,
    debit: {
      type: Number,
      default: 0
    },
    credit: {
      type: Number,
      default: 0
    },
    description: String
  }],
  
  // Total amounts
  totalDebit: {
    type: Number,
    required: true
  },
  totalCredit: {
    type: Number,
    required: true
  },
  
  // Source
  source: {
    type: String,
    enum: ['payment', 'invoice', 'manual', 'adjustment', 'vendor_payment', 'expense_payment', 'rental_accrual', 'rental_accrual_reversal'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel'
  },
  sourceModel: {
    type: String,
    enum: ['Payment', 'Invoice', 'Request', 'Vendor', 'Expense', 'Lease', 'TransactionEntry'],
    required: true
  },
  
  // Residence (for filtering and reporting)
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: false // Optional for backward compatibility
  },
  
  // Audit Trail
  createdBy: {
    type: String, // User email
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: String, // User email
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'posted', 'reversed'],
    default: 'posted'
  },

  // Metadata for additional info
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Ensure debits equal credits
transactionEntrySchema.pre('save', function(next) {
  if (this.totalDebit !== this.totalCredit) {
    return next(new Error('Total debits must equal total credits'));
  }
  next();
});

// Generate transaction ID if not provided
transactionEntrySchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('TransactionEntry', transactionEntrySchema); 