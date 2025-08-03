const mongoose = require('mongoose');

const StudentAccountSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  accountCode: {
    type: String,
    required: true,
    unique: true
  },
  accountName: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  totalDebits: {
    type: Number,
    default: 0
  },
  totalCredits: {
    type: Number,
    default: 0
  },
  lastTransactionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  notes: String,
  createdBy: {
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
});

// Pre-save middleware to generate account code
StudentAccountSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate unique account code: STU + 6 digits
    const count = await mongoose.model('StudentAccount').countDocuments();
    this.accountCode = `STU${String(count + 1).padStart(6, '0')}`;
    this.accountName = `Student Account - ${this.accountCode}`;
  }
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
StudentAccountSchema.index({ student: 1 });
StudentAccountSchema.index({ accountCode: 1 });
StudentAccountSchema.index({ status: 1 });

module.exports = mongoose.model('StudentAccount', StudentAccountSchema); 