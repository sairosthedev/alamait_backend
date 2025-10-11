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
      'system_operation', 'api_call', 'unknown'
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