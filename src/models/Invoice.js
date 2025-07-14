const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const penaltySchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unit: { type: String, required: true },
  billingPeriod: { type: String, required: true },
  charges: [chargeSchema],
  penalties: [penaltySchema],
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRecurring: { type: Boolean, default: false },
  recurrenceRule: { type: String },
  auditLog: [auditLogSchema]
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema); 