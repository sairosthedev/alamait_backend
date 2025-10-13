const mongoose = require('mongoose');
const Account = require('../models/Account');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

const accounts = [
  // Assets
  { code: '1000', name: 'Bank - Main Account', type: 'Asset' },
  { code: '1001', name: 'Cash/Bank', type: 'Asset' },
  { code: '1005', name: 'Bank - Rent Deposits Account', type: 'Asset' },
  { code: '1010', name: 'General Petty Cash', type: 'Asset' },
  { code: '1011', name: 'Admin Petty Cash', type: 'Asset' },
  { code: '1012', name: 'Finance Petty Cash', type: 'Asset' },
  { code: '1013', name: 'Property Manager Petty Cash', type: 'Asset' },
  { code: '1014', name: 'Maintenance Petty Cash', type: 'Asset' },
  { code: '1015', name: 'Cash', type: 'Asset' },
  { code: '1100', name: 'Accounts Receivable - Tenants', type: 'Asset' },
  { code: '1105', name: 'Prepaid Expenses', type: 'Asset' },
  { code: '1110', name: 'Tenant Advance Payments', type: 'Asset' },
  { code: '1115', name: 'Rent Receivable - Late Payments', type: 'Asset' },
  { code: '1200', name: 'Residential Property - Newlands', type: 'Asset' },
  { code: '1201', name: 'Commercial - Glendale', type: 'Asset' },
  { code: '1202', name: 'Residential Property - Breach', type: 'Asset' },
  { code: '1203', name: 'Land - Christon Bank', type: 'Asset' },
  { code: '1204', name: 'Land - Greystone Park', type: 'Asset' },
  { code: '1206', name: 'Residential Property - Glendale', type: 'Asset' },
  { code: '1210', name: 'School Accommodation - St Kilda', type: 'Asset' },
  { code: '1211', name: 'School Accommodation - Belvedere', type: 'Asset' },
  { code: '1220', name: 'Office Property - Greendale', type: 'Asset' },
  { code: '1221', name: 'Office Property - Newlands', type: 'Asset' },
  { code: '1231', name: 'Land - Nyanga', type: 'Asset' },
  { code: '1232', name: 'Bnb - Nyanga', type: 'Asset' },
  { code: '1233', name: 'Land - Glendale', type: 'Asset' },
  { code: '1234', name: 'Furniture and fittings', type: 'Asset' },
  { code: '1235', name: 'Solar', type: 'Asset' },
  { code: '1236', name: 'Motor Vehicles', type: 'Asset' },
  { code: '1237', name: 'Land - Arlington Estate', type: 'Asset' },
  
  // Accumulated Depreciation Accounts (Contra-Assets)
  { code: '1400', name: 'Accumulated Depreciation - Furniture & Fittings', type: 'Asset' },
  { code: '1401', name: 'Accumulated Depreciation - Motor Vehicles', type: 'Asset' },
  { code: '1402', name: 'Accumulated Depreciation - Solar Equipment', type: 'Asset' },
  { code: '1403', name: 'Accumulated Depreciation - Buildings', type: 'Asset' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'Liability' },
  { code: '2010', name: 'Staff Advances Payable', type: 'Liability' },
  { code: '2020', name: 'Tenant Deposits Held', type: 'Liability' },
  { code: '2030', name: 'Deferred Income - Tenant Advances', type: 'Liability' },
  // Equity
  { code: '3000', name: "Owner's Capital", type: 'Equity' },
  { code: '3001', name: 'Owner Equity - Opening Balance', type: 'Equity' },
  { code: '3100', name: 'Retained Earnings', type: 'Equity' },
  // Revenue (Income)
  { code: '4000', name: 'Rental Income - Residential', type: 'Income' },
  { code: '4001', name: 'Rental Income - School Accommodation', type: 'Income' },
  { code: '4002', name: 'Rental Income - Offices', type: 'Income' },
  { code: '4003', name: 'Rental Income - BnB', type: 'Income' },
  { code: '4004', name: 'Land Lease Income', type: 'Income' },
  { code: '4010', name: 'Management Fees Received', type: 'Income' },
  { code: '4020', name: 'Other Income', type: 'Income' },
  // Expenses
  { code: '5000', name: 'Repairs and Maintenance', type: 'Expense' },
  { code: '5001', name: 'Utilities - Water', type: 'Expense' },
  { code: '5002', name: 'Utilities - Electricity', type: 'Expense' },
  { code: '5004', name: 'Bulk water', type: 'Expense' },
  { code: '5005', name: 'Car running', type: 'Expense' },
  { code: '5006', name: 'Car maintance and repair', type: 'Expense' },
  { code: '5007', name: 'Gas filling', type: 'Expense' },
  { code: '5008', name: 'Communication cost', type: 'Expense' },
  { code: '5009', name: 'Sanitary', type: 'Expense' },
  { code: '5010', name: 'House keeping', type: 'Expense' },
  { code: '5011', name: 'Security Costs', type: 'Expense' },
  { code: '5012', name: 'Property Management Salaries', type: 'Expense' },
  { code: '5013', name: 'Administrative Expenses', type: 'Expense' },
  { code: '5014', name: 'Marketing Expenses', type: 'Expense' },
  { code: '5015', name: 'Depreciation Expense', type: 'Expense' },
  { code: '5015', name: 'Staff Salaries & Wages', type: 'Expense' },
  { code: '5016', name: 'Staff Welfare', type: 'Expense' },
  { code: '5017', name: 'Depreciation - Buildings', type: 'Expense' },
  { code: '5018', name: 'Professional Fees (Legal, Audit)', type: 'Expense' },
  { code: '5019', name: 'Waste management', type: 'Expense' },
  { code: '5020', name: 'Medical aid', type: 'Expense' },
  { code: '5021', name: 'Advertising', type: 'Expense' },
  { code: '5022', name: 'Family expenses', type: 'Expense' },
  { code: '5023', name: 'House association fees', type: 'Expense' },
  { code: '5024', name: 'Licenses', type: 'Expense' },
  { code: '5025', name: 'Depreciation - Motor Vehicles', type: 'Expense' },
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