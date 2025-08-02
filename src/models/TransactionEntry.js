const mongoose = require('mongoose');

const TransactionEntrySchema = new mongoose.Schema({
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  type: {
    type: String,
    enum: [
      'income', 'expense', 'other income', 'other expense',
      'operating', 'investing', 'financing',
      'asset', 'liability', 'equity'
    ],
    required: true
  },
  // Additional tracking fields
  description: {
    type: String,
    trim: true
  },
  reference: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Timestamps
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
TransactionEntrySchema.index({ transaction: 1 });
TransactionEntrySchema.index({ account: 1 });
TransactionEntrySchema.index({ type: 1 });
TransactionEntrySchema.index({ reference: 1 });
TransactionEntrySchema.index({ createdAt: -1 });

// Virtual for balance
TransactionEntrySchema.virtual('balance').get(function() {
  return this.debit - this.credit;
});

// Method to get formatted amount
TransactionEntrySchema.methods.getFormattedAmount = function() {
  if (this.debit > 0) {
    return `Dr ${this.debit.toFixed(2)}`;
  } else if (this.credit > 0) {
    return `Cr ${this.credit.toFixed(2)}`;
  }
  return '0.00';
};

module.exports = mongoose.model('TransactionEntry', TransactionEntrySchema); 