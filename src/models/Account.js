const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'], required: true }
});

module.exports = mongoose.model('Account', AccountSchema); 