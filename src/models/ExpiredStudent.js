const mongoose = require('mongoose');

const expiredStudentSchema = new mongoose.Schema({
  student: Object,         // All fields from the User document
  application: Object,     // All fields from the Application document
  previousApplicationCode: String, // Reference to the old application code
  archivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExpiredStudent', expiredStudentSchema);