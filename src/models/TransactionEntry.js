const mongoose = require('mongoose');

const TransactionEntrySchema = new mongoose.Schema({
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 }
});

module.exports = mongoose.model('TransactionEntry', TransactionEntrySchema); 