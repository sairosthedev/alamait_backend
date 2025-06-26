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
    ref: 'Residence'
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

module.exports = mongoose.model('Lease', leaseSchema); 