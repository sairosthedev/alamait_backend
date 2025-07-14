const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String },
  reference: { type: String }
});

module.exports = mongoose.model('Transaction', TransactionSchema); 