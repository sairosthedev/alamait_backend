const mongoose = require('mongoose');

// Charge item schema
const chargeItemSchema = new mongoose.Schema({
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['rent', 'utilities', 'maintenance', 'late_fee', 'deposit', 'other'],
    default: 'other'
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  notes: String
}, { _id: true });

// Payment record schema
const paymentRecordSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'Credit Card'],
    required: true
  },
  reference: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'refunded'],
    default: 'pending'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, { _id: true });

// Reminder schema
const reminderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['due_date', 'overdue', 'payment_received'],
    required: true
  },
  sentDate: {
    type: Date,
    required: true
  },
  sentVia: {
    type: String,
    enum: ['email', 'sms', 'whatsapp'],
    required: true
  },
  recipient: String,
  status: {
    type: String,
    enum: ['sent', 'delivered', 'failed'],
    default: 'sent'
  },
  message: String
}, { _id: true });

// Audit log schema
const auditLogSchema = new mongoose.Schema({
  action: { 
    type: String, 
    required: true,
    enum: ['created', 'updated', 'sent', 'paid', 'overdue', 'cancelled', 'reminder_sent', 'payment_received']
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  details: String,
  previousValues: mongoose.Schema.Types.Mixed,
  newValues: mongoose.Schema.Types.Mixed
}, { _id: true });

// Main invoice schema
const invoiceSchema = new mongoose.Schema({
  // Basic Information
  invoiceNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: true
  },
  room: { 
    type: String, 
    required: true 
  },
  roomType: {
    type: String,
    default: 'Standard'
  },
  
  // Billing Information
  billingPeriod: { 
    type: String, 
    required: true 
  },
  billingStartDate: {
    type: Date,
    required: true
  },
  billingEndDate: {
    type: Date,
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  
  // Financial Information
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceDue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Charges and Payments
  charges: [chargeItemSchema],
  payments: [paymentRecordSchema],
  
  // Status and Tracking
  status: { 
    type: String, 
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid'], 
    default: 'draft' 
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'overdue'],
    default: 'unpaid'
  },
  
  // Recurring Billing
  isRecurring: { 
    type: Boolean, 
    default: false 
  },
  recurrenceRule: { 
    type: String 
  },
  nextBillingDate: {
    type: Date
  },
  
  // Reminders and Notifications
  reminders: [reminderSchema],
  lastReminderSent: {
    type: Date
  },
  reminderCount: {
    type: Number,
    default: 0
  },
  
  // Additional Information
  notes: String,
  terms: String,
  lateFeeRate: {
    type: Number,
    default: 0,
    min: 0
  },
  gracePeriod: {
    type: Number,
    default: 0, // days
    min: 0
  },
  
  // Audit and Tracking
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  auditLog: [auditLogSchema],
  
  // Integration
  externalReference: String,
  paymentGateway: {
    type: String,
    enum: ['paynow', 'ecocash', 'innbucks', 'bank_transfer', 'manual'],
    default: 'manual'
  }
}, { 
  timestamps: true,
  collection: 'invoices'
});

// Indexes for performance
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ student: 1 });
invoiceSchema.index({ residence: 1 });
invoiceSchema.index({ room: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ billingPeriod: 1 });
invoiceSchema.index({ 'payments.paymentId': 1 });

// Pre-save middleware to calculate totals
invoiceSchema.pre('save', function(next) {
  // Calculate subtotal from charges
  this.subtotal = this.charges.reduce((sum, charge) => {
    return sum + (charge.amount * charge.quantity);
  }, 0);
  
  // Calculate tax amount
  this.taxAmount = this.charges.reduce((sum, charge) => {
    return sum + ((charge.amount * charge.quantity) * (charge.taxRate / 100));
  }, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;
  
  // Calculate balance due
  this.balanceDue = this.totalAmount - this.amountPaid;
  
  // Update payment status
  if (this.balanceDue <= 0) {
    this.paymentStatus = 'paid';
    this.status = 'paid';
  } else if (this.amountPaid > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'unpaid';
  }
  
  // Check if overdue
  if (this.balanceDue > 0 && new Date() > this.dueDate) {
    this.status = 'overdue';
    this.paymentStatus = 'overdue';
  }
  
  next();
});

// Virtual for formatted invoice number
invoiceSchema.virtual('formattedInvoiceNumber').get(function() {
  return `INV-${this.invoiceNumber}`;
});

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.balanceDue > 0 && new Date() > this.dueDate) {
    return Math.floor((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for late fee amount
invoiceSchema.virtual('lateFeeAmount').get(function() {
  if (this.daysOverdue > this.gracePeriod && this.lateFeeRate > 0) {
    return (this.balanceDue * this.lateFeeRate / 100) * (this.daysOverdue - this.gracePeriod);
  }
  return 0;
});

// Method to add payment
invoiceSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.amountPaid += paymentData.amount;
  this.auditLog.push({
    action: 'payment_received',
    user: paymentData.processedBy,
    details: `Payment of ${paymentData.amount} received via ${paymentData.paymentMethod}`,
    newValues: paymentData
  });
};

// Method to send reminder
invoiceSchema.methods.sendReminder = function(reminderData) {
  this.reminders.push(reminderData);
  this.lastReminderSent = new Date();
  this.reminderCount += 1;
  this.auditLog.push({
    action: 'reminder_sent',
    user: reminderData.sentBy,
    details: `Reminder sent via ${reminderData.sentVia}`,
    newValues: reminderData
  });
};

// Static method to generate invoice number
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const year = new Date().getFullYear().toString().substr(-2);
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(new Date().getFullYear(), 0, 1),
      $lt: new Date(new Date().getFullYear() + 1, 0, 1)
    }
  });
  return `${year}${(count + 1).toString().padStart(4, '0')}`;
};

// Static method to find overdue invoices
invoiceSchema.statics.findOverdue = function() {
  return this.find({
    balanceDue: { $gt: 0 },
    dueDate: { $lt: new Date() },
    status: { $nin: ['paid', 'cancelled'] }
  });
};

// Static method to find invoices by student
invoiceSchema.statics.findByStudent = function(studentId) {
  return this.find({ student: studentId }).sort({ dueDate: -1 });
};

module.exports = mongoose.model('Invoice', invoiceSchema); 