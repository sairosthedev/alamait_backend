const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  date: { type: Date, required: true },
  description: { type: String },
  reference: { type: String },
  residence: { type: mongoose.Schema.Types.ObjectId, ref: 'Residence', required: true },
  residenceName: { type: String },
  // Link to expense
  expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  },
  // Transaction type
  type: {
    type: String,
    enum: ['approval', 'payment', 'adjustment', 'accrual', 'other'],
    default: 'other'
  },
  // Amount (calculated from entries)
  amount: {
    type: Number,
    default: 0
  },
  receipt: {
    fileUrl: String,
    fileName: String,
    uploadDate: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TransactionEntry' }],
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
TransactionSchema.index({ transactionId: 1 });
TransactionSchema.index({ date: -1 });
TransactionSchema.index({ residence: 1 });
TransactionSchema.index({ expenseId: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ reference: 1 });

// Virtual for total debit
TransactionSchema.virtual('totalDebit').get(function() {
  if (!this.entries || this.entries.length === 0) return 0;
  return this.entries.reduce((total, entry) => total + (entry.debit || 0), 0);
});

// Virtual for total credit
TransactionSchema.virtual('totalCredit').get(function() {
  if (!this.entries || this.entries.length === 0) return 0;
  return this.entries.reduce((total, entry) => total + (entry.credit || 0), 0);
});

// Method to check if transaction is balanced
TransactionSchema.methods.isBalanced = function() {
  return this.totalDebit === this.totalCredit;
};

// Method to get formatted amount
TransactionSchema.methods.getFormattedAmount = function() {
  return this.amount.toFixed(2);
};

module.exports = mongoose.model('Transaction', TransactionSchema); 