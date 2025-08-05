const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  // Basic Information
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, // user who made the change
  
  action: { 
    type: String, 
    required: true,
    enum: [
      // CRUD Operations
      'CREATE', 'READ', 'UPDATE', 'DELETE',
      // Authentication
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
      // System Events
      'SYSTEM_START', 'SYSTEM_SHUTDOWN', 'BACKUP', 'RESTORE',
      // Financial Events
      'PAYMENT_RECEIVED', 'PAYMENT_REFUNDED', 'INVOICE_CREATED', 'INVOICE_PAID',
      // Student Events
      'STUDENT_REGISTERED', 'STUDENT_APPROVED', 'STUDENT_REJECTED', 'ROOM_ASSIGNED',
      // File Operations
      'FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED',
      // Permission Events
      'ROLE_CHANGED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED',
      // Data Operations
      'DATA_EXPORTED', 'DATA_IMPORTED', 'BULK_UPDATE', 'BULK_DELETE',
      // API Events
      'API_ACCESS', 'API_ERROR', 'RATE_LIMIT_EXCEEDED',
      // Error Events
      'ERROR', 'VALIDATION_ERROR', 'AUTHORIZATION_ERROR',
      // Custom Events
      'CUSTOM'
    ]
  }, // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
  
  collection: { 
    type: String, 
    required: true 
  }, // e.g., 'User', 'Student', 'Payment', 'Expense', etc.
  
  recordId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  }, // affected record ID
  
  // State Information
  before: { 
    type: Object, 
    default: null 
  }, // previous state (for update/delete)
  
  after: { 
    type: Object, 
    default: null 
  }, // new state (for create/update)
  
  // Additional Details
  details: { 
    type: String, 
    default: '' 
  }, // human-readable description
  
  // Request Information
  ipAddress: { 
    type: String, 
    default: null 
  }, // IP address of the user
  
  userAgent: { 
    type: String, 
    default: null 
  }, // User agent string
  
  endpoint: { 
    type: String, 
    default: null 
  }, // API endpoint that was called
  
  requestBody: { 
    type: Object, 
    default: null 
  }, // Request body data (sanitized)
  
  queryParams: { 
    type: Object, 
    default: null 
  }, // Query parameters
  
  // Response Information
  statusCode: { 
    type: Number, 
    default: null 
  }, // HTTP status code
  
  responseTime: { 
    type: Number, 
    default: null 
  }, // Response time in milliseconds
  
  // Error Information
  errorMessage: { 
    type: String, 
    default: null 
  }, // Error message if action failed
  
  errorStack: { 
    type: String, 
    default: null 
  }, // Error stack trace
  
  // Metadata
  sessionId: { 
    type: String, 
    default: null 
  }, // Session ID for tracking user sessions
  
  correlationId: { 
    type: String, 
    default: null 
  }, // Correlation ID for tracking related events
  
  // Timestamps
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
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
  timestamps: true,
  collection: 'audit_logs'
});

// Indexes for efficient querying
AuditLogSchema.index({ user: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ collection: 1, timestamp: -1 });
AuditLogSchema.index({ recordId: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ endpoint: 1, timestamp: -1 });
AuditLogSchema.index({ statusCode: 1, timestamp: -1 });

// Compound indexes for common queries
AuditLogSchema.index({ user: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ collection: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ user: 1, collection: 1, timestamp: -1 });

// Pre-save middleware to update timestamps
AuditLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for formatted timestamp
AuditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Virtual for action category
AuditLogSchema.virtual('actionCategory').get(function() {
  const categories = {
    'CREATE': 'CRUD',
    'READ': 'CRUD', 
    'UPDATE': 'CRUD',
    'DELETE': 'CRUD',
    'LOGIN': 'AUTH',
    'LOGOUT': 'AUTH',
    'LOGIN_FAILED': 'AUTH',
    'PASSWORD_CHANGE': 'AUTH',
    'PASSWORD_RESET': 'AUTH',
    'PAYMENT_RECEIVED': 'FINANCIAL',
    'PAYMENT_REFUNDED': 'FINANCIAL',
    'INVOICE_CREATED': 'FINANCIAL',
    'INVOICE_PAID': 'FINANCIAL',
    'STUDENT_REGISTERED': 'STUDENT',
    'STUDENT_APPROVED': 'STUDENT',
    'STUDENT_REJECTED': 'STUDENT',
    'ROOM_ASSIGNED': 'STUDENT',
    'FILE_UPLOADED': 'FILE',
    'FILE_DOWNLOADED': 'FILE',
    'FILE_DELETED': 'FILE',
    'ROLE_CHANGED': 'PERMISSION',
    'PERMISSION_GRANTED': 'PERMISSION',
    'PERMISSION_REVOKED': 'PERMISSION',
    'DATA_EXPORTED': 'DATA',
    'DATA_IMPORTED': 'DATA',
    'BULK_UPDATE': 'DATA',
    'BULK_DELETE': 'DATA',
    'API_ACCESS': 'API',
    'API_ERROR': 'API',
    'RATE_LIMIT_EXCEEDED': 'API',
    'ERROR': 'ERROR',
    'VALIDATION_ERROR': 'ERROR',
    'AUTHORIZATION_ERROR': 'ERROR',
    'SYSTEM_START': 'SYSTEM',
    'SYSTEM_SHUTDOWN': 'SYSTEM',
    'BACKUP': 'SYSTEM',
    'RESTORE': 'SYSTEM'
  };
  
  return categories[this.action] || 'OTHER';
});

// Static method to get audit logs with advanced filtering
AuditLogSchema.statics.getAuditLogs = async function(filters = {}, options = {}) {
  const {
    user,
    action,
    collection,
    recordId,
    startDate,
    endDate,
    ipAddress,
    endpoint,
    statusCode,
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = filters;

  const query = {};

  // Build filter object
  if (user) query.user = user;
  if (action) query.action = action;
  if (collection) query.collection = collection;
  if (recordId) query.recordId = recordId;
  if (ipAddress) query.ipAddress = ipAddress;
  if (endpoint) query.endpoint = endpoint;
  if (statusCode) query.statusCode = statusCode;

  // Date range filter
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  // Sorting
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Pagination
  const skip = (page - 1) * limit;

  const logs = await this.find(query)
    .populate('user', 'firstName lastName email role')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await this.countDocuments(query);

  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

// Static method to get audit statistics
AuditLogSchema.statics.getAuditStats = async function(startDate, endDate) {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.timestamp = {};
    if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
    if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          action: '$action',
          collection: '$collection'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        collections: {
          $push: {
            collection: '$_id.collection',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    { $sort: { totalCount: -1 } }
  ]);

  return stats;
};

module.exports = mongoose.model('AuditLog', AuditLogSchema); 