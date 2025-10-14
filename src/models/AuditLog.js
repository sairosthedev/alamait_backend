const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'create', 'read', 'update', 'delete',
      'approve', 'reject', 'submit', 'convert',
      'mark_paid', 'login', 'logout', 'register',
      'upload', 'download', 'export', 'import',
      'bulk_create', 'bulk_update', 'bulk_delete',
      'system_operation', 'api_call', 'unknown',
      // Expense payment actions
      'expense_payment_cash', 'expense_payment_bank_transfer', 'expense_payment_online_payment',
      'expense_payment_ecocash', 'expense_payment_innbucks', 'expense_payment_petty_cash',
      // Admin expense actions
      'admin_expense_paid_cash', 'admin_expense_paid_bank_transfer', 'admin_expense_paid_online_payment',
      'admin_expense_paid_ecocash', 'admin_expense_paid_innbucks', 'admin_expense_paid_petty_cash',
      'admin_expense_approved_paid_cash', 'admin_expense_approved_paid_bank_transfer', 'admin_expense_approved_paid_online_payment',
      'admin_expense_approved_paid_ecocash', 'admin_expense_approved_paid_innbucks', 'admin_expense_approved_paid_petty_cash',
      'admin_expense_created_ap_liability',
      // Payment actions
      'payment_create', 'payment_update', 'payment_delete', 'payment_confirm',
      'invoice_payment', 'creditor_payment', 'debtor_payment'
    ]
  },
  collection: { 
    type: String, 
    required: true 
  },
  recordId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: false, // Allow null for API calls without specific records
    default: null
  },
  before: { 
    type: Object, 
    default: null 
  },
  after: { 
    type: Object, 
    default: null 
  },
  details: { 
    type: String, 
    default: '' 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  requestId: {
    type: String,
    default: null
  },
  duration: {
    type: Number, // Duration in milliseconds
    default: null
  },
  statusCode: {
    type: Number,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'auditlogs'
});

module.exports = mongoose.model('AuditLog', AuditLogSchema); 