const mongoose = require('mongoose');

const advancePaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMonth: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}$/.test(v);
      },
      message: 'Payment month must be in YYYY-MM format'
    }
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'allocated', 'released', 'cancelled'],
    default: 'pending'
  },
  allocationType: {
    type: String,
    enum: ['rent', 'admin_fee', 'deposit', 'other'],
    default: 'rent'
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    originalPaymentId: String,
    allocationMethod: String,
    releaseDate: Date,
    notes: String
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

// Indexes for efficient querying
advancePaymentSchema.index({ studentId: 1, paymentMonth: 1 });
advancePaymentSchema.index({ status: 1, paymentMonth: 1 });
advancePaymentSchema.index({ createdAt: -1 });

// Pre-save middleware to update the updatedAt field
advancePaymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get total advance payments for a student and month
advancePaymentSchema.statics.getTotalForMonth = async function(studentId, paymentMonth) {
  const result = await this.aggregate([
    {
      $match: {
        studentId: studentId,
        paymentMonth: paymentMonth,
        status: { $in: ['pending', 'allocated'] }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].totalAmount : 0;
};

// Static method to get all advance payments for a student
advancePaymentSchema.statics.getByStudent = async function(studentId, status = null) {
  const query = { studentId: studentId };
  if (status) {
    query.status = status;
  }
  
  return await this.find(query).sort({ paymentMonth: 1, createdAt: 1 });
};

// Instance method to release advance payment
advancePaymentSchema.methods.release = async function() {
  this.status = 'released';
  this.metadata.releaseDate = new Date();
  return await this.save();
};

// Instance method to cancel advance payment
advancePaymentSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  return await this.save();
};

const AdvancePayment = mongoose.model('AdvancePayment', advancePaymentSchema);

module.exports = AdvancePayment;
