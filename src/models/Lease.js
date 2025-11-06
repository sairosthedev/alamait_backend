const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: String,
  email: String,
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: true
  },
  residenceName: String,
  startDate: Date,
  endDate: Date,
  filename: String,
  originalname: String,
  path: String,
  mimetype: String,
  size: Number,
  uploadedAt: Date
}, {
  timestamps: true,
  collection: 'leases'
});

// Performance indexes for Lease
// Index on studentId for finding student's leases
leaseSchema.index({ studentId: 1 });

// Index on residence for filtering by residence
leaseSchema.index({ residence: 1 });

// Index on email for finding leases by email
leaseSchema.index({ email: 1 });

// Index on dates for date range queries
leaseSchema.index({ startDate: 1, endDate: 1 });

// Compound indexes for common query patterns
// StudentId + dates (get student's leases in date range)
leaseSchema.index({ studentId: 1, startDate: -1 });

// Residence + dates (get residence leases in date range)
leaseSchema.index({ residence: 1, startDate: -1 });

// Email + dates (find leases by email)
leaseSchema.index({ email: 1, uploadedAt: -1 });

// Compound index for active leases (date range queries)
leaseSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Lease', leaseSchema); 