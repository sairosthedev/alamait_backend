const mongoose = require('mongoose');
const Account = require('../models/Account');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

const accounts = [
  // Assets
  { code: '1000', name: 'Cash', type: 'Asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'Liability' },
  { code: '2100', name: 'Accrued Expenses', type: 'Liability' },
  // Equity
  { code: '3000', name: 'Owner Equity', type: 'Equity' },
  // Income
  { code: '4000', name: 'Rent Income', type: 'Income' },
  { code: '4100', name: 'Wifi Income', type: 'Income' },
  // Expenses
  { code: '5000', name: 'Electricity Expense', type: 'Expense' },
  { code: '5100', name: 'Maintenance Expense', type: 'Expense' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await Account.deleteMany({});
    await Account.insertMany(accounts);
    console.log('Seeded Chart of Accounts successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

seed(); 