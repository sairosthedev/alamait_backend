const mongoose = require('mongoose');

const paymentDetailSchema = new mongoose.Schema({
  type: String,
  amount: Number,
  status: String
});

const paymentHistorySchema = new mongoose.Schema({
  date: Date,
  details: [paymentDetailSchema],
  totalAmount: Number,
  status: String
});

const rentalHistorySchema = new mongoose.Schema({
  room: String,
  startDate: Date,
  endDate: Date,
  status: String
});

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  program: String,
  room: String,
  status: String,
  phone: String,
  emergencyContact: String,
  paymentHistory: [paymentHistorySchema],
  rentalHistory: [rentalHistorySchema]
});

module.exports = mongoose.model('Student', studentSchema); 