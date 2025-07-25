const mongoose = require('mongoose');

const pettyCashSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  allocatedAmount: {
    type: Number,
    required: true,
    default: 0
  },
  usedAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'closed'],
    default: 'active'
  },
  allocatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  allocatedDate: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Calculate remaining amount before saving
pettyCashSchema.pre('save', function(next) {
  this.remainingAmount = this.allocatedAmount - this.usedAmount;
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('PettyCash', pettyCashSchema); 