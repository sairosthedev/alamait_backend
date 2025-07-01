const mongoose = require('mongoose');

const expiredStudentSchema = new mongoose.Schema({
  student: Object,         // All fields from the User document
  application: Object,     // All fields from the Application document
  previousApplicationCode: String, // Reference to the old application code
  archivedAt: { type: Date, default: Date.now },
  reason: String,          // Why the student was archived
  paymentHistory: Array,   // Array of payment records
  leases: Array            // Array of lease records
}, {
  collection: 'expiredstudents'
});

module.exports = mongoose.model('ExpiredStudent', expiredStudentSchema);