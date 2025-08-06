const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: String, 
    required: true 
  },
  collection: { 
    type: String, 
    required: true 
  },
  recordId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
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
  }
}, {
  timestamps: true,
  collection: 'auditlogs'
});

module.exports = mongoose.model('AuditLog', AuditLogSchema); 