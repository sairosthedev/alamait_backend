const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // user who made the change
  action: { type: String, required: true }, // e.g., 'create', 'update', 'delete'
  collection: { type: String, required: true }, // e.g., 'Payment', 'Expense', 'BalanceSheet'
  recordId: { type: mongoose.Schema.Types.ObjectId, required: true }, // affected record
  before: { type: Object }, // previous state (for update/delete)
  after: { type: Object },  // new state (for create/update)
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema); 