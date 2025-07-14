const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // CREATE, UPDATE, DELETE, UPLOAD, etc.
  resourceType: { type: String, required: true }, // Student, Lease, Profile, etc.
  resourceId: { type: String, required: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema); 