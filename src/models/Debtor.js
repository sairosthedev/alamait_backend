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
  
  // Enhanced Billing Period Object
  billingPeriod: {
    // Period Information
    type: {
      type: String,
      enum: ['monthly', 'quarterly', 'semester', 'annual', 'custom'],
      default: 'monthly'
    },
    
    // Duration
    duration: {
      value: {
        type: Number,
        required: true,
        min: 1
      },
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months', 'quarters', 'years'],
        default: 'months'
      }
    },
    
    // Date Range
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    
    // Billing Cycle
    billingCycle: {
      frequency: {
        type: String,
        enum: ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'annual'],
        default: 'monthly'
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
        default: 1
      },
      gracePeriod: {
        type: Number,
        default: 5, // days
        min: 0
      }
    },
    
    // Amount Information
    amount: {
      monthly: {
        type: Number,
        required: true,
        min: 0
      },
      total: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        default: 'USD'
      }
    },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'suspended'],
      default: 'active'
    },
    
    // Additional Information
    description: String,
    notes: String,
    
    // Auto-renewal settings
    autoRenewal: {
      enabled: {
        type: Boolean,
        default: false
      },
      renewalType: {
        type: String,
        enum: ['same_period', 'custom_period'],
        default: 'same_period'
      },
      customRenewalPeriod: {
        value: Number,
        unit: String
      }
    }
  },
  
  // Legacy field for backward compatibility (deprecated)
  billingPeriodLegacy: {
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
  
  // ENHANCED: Comprehensive Payment Tracking with Month Allocation
  paymentHistory: [{
    // Payment Reference
    paymentId: {
      type: String,
      required: true
    },
    
    // Payment Details
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Month Allocation (YYYY-MM format)
    allocatedMonth: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\d{4}-\d{2}$/.test(v);
        },
        message: 'allocatedMonth must be in YYYY-MM format'
      }
    },
    
    // Payment Components
    components: {
      rent: {
        type: Number,
        default: 0,
        min: 0
      },
      adminFee: {
        type: Number,
        default: 0,
        min: 0
      },
      deposit: {
        type: Number,
        default: 0,
        min: 0
      },
      utilities: {
        type: Number,
        default: 0,
        min: 0
      },
      other: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    
    // Payment Method
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'],
      required: true
    },
    
    // Payment Date
    paymentDate: {
      type: Date,
      required: true
    },
    
    // Status
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected', 'Clarification Requested'],
      default: 'Pending'
    },
    
    // Reference to original Payment document
    originalPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    
    // Notes
    notes: String,
    
    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ENHANCED: Monthly Payment Summary
  monthlyPayments: [{
    // Month (YYYY-MM format)
    month: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\d{4}-\d{2}$/.test(v);
        },
        message: 'month must be in YYYY-MM format'
      }
    },
    
    // Expected Amount
    expectedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Paid Amount
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Outstanding Amount
    outstandingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Payment Status
    status: {
      type: String,
      enum: ['paid', 'partial', 'unpaid', 'overdue'],
      default: 'unpaid'
    },
    
    // Due Date
    dueDate: {
      type: Date
    },
    
    // Last Payment Date
    lastPaymentDate: {
      type: Date
    },
    
    // Payment Count
    paymentCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Payment IDs for this month
    paymentIds: [{
      type: String
    }],
    
    // Notes
    notes: String,
    
    // Audit
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ENHANCED: Transaction Entries (Double-Entry Accounting)
  transactionEntries: [{
    // Transaction Reference
    transactionId: {
      type: String,
      required: true
    },
    
    // Transaction Date
    date: {
      type: Date,
      required: true
    },
    
    // Transaction Description
    description: {
      type: String,
      required: true
    },
    
    // Reference
    reference: String,
    
    // Double-Entry Details
    entries: [{
      accountCode: {
        type: String,
        required: true
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
      enum: ['payment', 'invoice', 'manual', 'adjustment', 'vendor_payment', 'expense_payment'],
      required: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    sourceModel: {
      type: String,
      enum: ['Payment', 'Invoice', 'Request', 'Vendor', 'Expense']
    },
    
    // Status
    status: {
      type: String,
      enum: ['draft', 'posted', 'reversed'],
      default: 'posted'
    },
    
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // Audit
    createdBy: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ENHANCED: Invoice Tracking
  invoices: [{
    // Invoice Reference
    invoiceId: {
      type: String,
      required: true
    },
    
    // Invoice Details
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Month (YYYY-MM format)
    month: {
      type: String,
      required: true
    },
    
    // Invoice Date
    invoiceDate: {
      type: Date,
      required: true
    },
    
    // Due Date
    dueDate: {
      type: Date,
      required: true
    },
    
    // Status
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft'
    },
    
    // Components
    components: {
      rent: {
        type: Number,
        default: 0
      },
      utilities: {
        type: Number,
        default: 0
      },
      adminFee: {
        type: Number,
        default: 0
      },
      other: {
        type: Number,
        default: 0
      }
    },
    
    // Reference to original Invoice document
    originalInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    
    // Notes
    notes: String,
    
    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ENHANCED: Financial Summary
  financialSummary: {
    // Current Period
    currentPeriod: {
      month: String, // YYYY-MM
      expectedAmount: {
        type: Number,
        default: 0
      },
      paidAmount: {
        type: Number,
        default: 0
      },
      outstandingAmount: {
        type: Number,
        default: 0
      },
      status: {
        type: String,
        enum: ['paid', 'partial', 'unpaid', 'overdue'],
        default: 'unpaid'
      }
    },
    
    // Year to Date
    yearToDate: {
      year: Number,
      totalExpected: {
        type: Number,
        default: 0
      },
      totalPaid: {
        type: Number,
        default: 0
      },
      totalOutstanding: {
        type: Number,
        default: 0
      },
      paymentCount: {
        type: Number,
        default: 0
      }
    },
    
    // Historical
    historical: {
      totalPayments: {
        type: Number,
        default: 0
      },
      totalInvoiced: {
        type: Number,
        default: 0
      },
      averagePaymentAmount: {
        type: Number,
        default: 0
      },
      lastPaymentDate: Date,
      lastInvoiceDate: Date
    }
  },
  
  // Payment Information (for syncing) - Legacy
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
debtorSchema.index({ 'paymentHistory.allocatedMonth': 1 });
debtorSchema.index({ 'monthlyPayments.month': 1 });
debtorSchema.index({ 'transactionEntries.date': 1 });

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
    const match = highestDebtor.accountCode.match(/AR(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  const code = `AR${String(nextNumber).padStart(4, '0')}`;
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

// Instance method to add payment with month allocation
debtorSchema.methods.addPayment = async function(paymentData) {
  const {
    paymentId,
    amount,
    allocatedMonth,
    components = {},
    paymentMethod,
    paymentDate,
    status = 'Confirmed',
    originalPayment,
    notes,
    createdBy
  } = paymentData;
  
  // Add to payment history
  this.paymentHistory.push({
    paymentId,
    amount,
    allocatedMonth,
    components,
    paymentMethod,
    paymentDate,
    status,
    originalPayment,
    notes,
    createdBy
  });
  
  // Update or create monthly payment summary
  let monthlyPayment = this.monthlyPayments.find(mp => mp.month === allocatedMonth);
  if (!monthlyPayment) {
    monthlyPayment = {
      month: allocatedMonth,
      expectedAmount: this.billingPeriod?.amount?.monthly || 0,
      paidAmount: 0,
      outstandingAmount: this.billingPeriod?.amount?.monthly || 0,
      status: 'unpaid',
      paymentCount: 0,
      paymentIds: []
    };
    this.monthlyPayments.push(monthlyPayment);
  }
  
  // Update monthly payment summary
  monthlyPayment.paidAmount += amount;
  monthlyPayment.outstandingAmount = Math.max(0, monthlyPayment.expectedAmount - monthlyPayment.paidAmount);
  monthlyPayment.paymentCount += 1;
  monthlyPayment.paymentIds.push(paymentId);
  monthlyPayment.lastPaymentDate = paymentDate;
  monthlyPayment.updatedAt = new Date();
  
  // Update status based on payment
  if (monthlyPayment.paidAmount >= monthlyPayment.expectedAmount) {
    monthlyPayment.status = 'paid';
  } else if (monthlyPayment.paidAmount > 0) {
    monthlyPayment.status = 'partial';
  }
  
  // Update financial summary
  this.totalPaid += amount;
  this.currentBalance = Math.max(0, this.totalOwed - this.totalPaid);
  this.lastPaymentDate = paymentDate;
  this.lastPaymentAmount = amount;
  
  // Update current period if this is the current month
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (allocatedMonth === currentMonth) {
    this.financialSummary.currentPeriod = {
      month: currentMonth,
      expectedAmount: monthlyPayment.expectedAmount,
      paidAmount: monthlyPayment.paidAmount,
      outstandingAmount: monthlyPayment.outstandingAmount,
      status: monthlyPayment.status
    };
  }
  
  // Update year to date
  const currentYear = new Date().getFullYear();
  const yearMonth = allocatedMonth.split('-');
  if (parseInt(yearMonth[0]) === currentYear) {
    this.financialSummary.yearToDate.year = currentYear;
    this.financialSummary.yearToDate.totalPaid += amount;
    this.financialSummary.yearToDate.paymentCount += 1;
  }
  
  // Update historical data
  this.financialSummary.historical.totalPayments += 1;
  this.financialSummary.historical.lastPaymentDate = paymentDate;
  this.financialSummary.historical.averagePaymentAmount = 
    this.financialSummary.historical.totalPayments > 0 
      ? this.totalPaid / this.financialSummary.historical.totalPayments 
      : 0;
  
  await this.save();
  return this;
};

// Instance method to add transaction entry
debtorSchema.methods.addTransactionEntry = async function(transactionData) {
  this.transactionEntries.push(transactionData);
  await this.save();
  return this;
};

// Instance method to add invoice
debtorSchema.methods.addInvoice = async function(invoiceData) {
  this.invoices.push(invoiceData);
  
  // Update financial summary
  this.financialSummary.historical.totalInvoiced += invoiceData.amount;
  this.financialSummary.historical.lastInvoiceDate = invoiceData.invoiceDate;
  
  await this.save();
  return this;
};

// Instance method to get payment summary for a specific month
debtorSchema.methods.getMonthlyPaymentSummary = function(month) {
  return this.monthlyPayments.find(mp => mp.month === month) || {
    month,
    expectedAmount: this.billingPeriod?.amount?.monthly || 0,
    paidAmount: 0,
    outstandingAmount: this.billingPeriod?.amount?.monthly || 0,
    status: 'unpaid',
    paymentCount: 0,
    paymentIds: []
  };
};

// Instance method to get outstanding balance for a specific month
debtorSchema.methods.getOutstandingBalance = function(month) {
  const monthlyPayment = this.getMonthlyPaymentSummary(month);
  return monthlyPayment.outstandingAmount;
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