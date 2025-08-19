const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/finance/Expense');
const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');
const Debtor = require('../src/models/Debtor');

async function investigateExpense5099() {
  try {
    console.log('\n🔍 INVESTIGATING EXPENSE ACCOUNT 5099 ($901.12)');
    console.log('================================================\n');
    
    // ========================================
    // 1. CHECK EXPENSE COLLECTION
    // ========================================
    console.log('💰 CHECKING EXPENSE COLLECTION:');
    console.log('===============================');
    
    const expenses = await Expense.find({
      $or: [
        { category: 'Other' },
        { description: { $regex: /5099|Other Operating Expenses/i } }
      ]
    }).populate('residence', 'name');
    
    console.log(`Found ${expenses.length} expenses in Expense collection:`);
    expenses.forEach((exp, idx) => {
      console.log(`  ${idx + 1}. ${exp.description} - $${exp.amount} - Status: ${exp.paymentStatus} - Date: ${exp.expenseDate}`);
    });
    
    // ========================================
    // 2. CHECK TRANSACTION ENTRIES
    // ========================================
    console.log('\n📊 CHECKING TRANSACTION ENTRIES:');
    console.log('=================================');
    
    const transactionEntries = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': '5099' },
        { 'entries.accountName': { $regex: /Other Operating Expenses/i } }
      ]
    }).populate('entries.account');
    
    console.log(`Found ${transactionEntries.length} transaction entries with account 5099:`);
    transactionEntries.forEach((tx, idx) => {
      console.log(`  ${idx + 1}. Date: ${tx.date} - Description: ${tx.description}`);
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          if (entry.accountCode === '5099' || entry.accountName?.includes('Other Operating Expenses')) {
            console.log(`     Entry ${entryIdx + 1}: ${entry.accountCode} - ${entry.accountName} - Debit: $${entry.debit} - Credit: $${entry.credit}`);
          }
        });
      }
    });
    
    // ========================================
    // 3. CHECK TRANSACTIONS
    // ========================================
    console.log('\n🔄 CHECKING TRANSACTIONS:');
    console.log('==========================');
    
    const transactions = await Transaction.find({
      'entries.accountCode': '5099'
    }).populate('entries.account');
    
    console.log(`Found ${transactions.length} transactions with account 5099:`);
    transactions.forEach((tx, idx) => {
      console.log(`  ${idx + 1}. Date: ${tx.date} - Description: ${tx.description} - Status: ${tx.status}`);
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          if (entry.accountCode === '5099' || entry.accountName?.includes('Other Operating Expenses')) {
            console.log(`     Entry ${entryIdx + 1}: ${entry.accountCode} - ${entry.accountName} - Debit: $${entry.debit} - Credit: $${entry.credit}`);
          }
        });
      }
    });
    
    // ========================================
    // 4. SEARCH FOR SPECIFIC AMOUNT
    // ========================================
    console.log('\n🔍 SEARCHING FOR SPECIFIC AMOUNT $901.12:');
    console.log('==========================================');
    
    // Search in expenses
    const expenseWithAmount = await Expense.find({
      amount: 901.12
    });
    console.log(`Found ${expenseWithAmount.length} expenses with amount $901.12:`);
    expenseWithAmount.forEach((exp, idx) => {
      console.log(`  ${idx + 1}. ${exp.description} - Category: ${exp.category} - Status: ${exp.paymentStatus} - Date: ${exp.expenseDate}`);
    });
    
    // Search in transaction entries
    const entriesWithAmount = await TransactionEntry.find({
      $or: [
        { 'entries.debit': 901.12 },
        { 'entries.credit': 901.12 }
      ]
    });
    console.log(`Found ${entriesWithAmount.length} transaction entries with amount $901.12:`);
    entriesWithAmount.forEach((tx, idx) => {
      console.log(`  ${idx + 1}. Date: ${tx.date} - Description: ${tx.description}`);
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          if (entry.debit === 901.12 || entry.credit === 901.12) {
            console.log(`     Entry ${entryIdx + 1}: ${entry.accountCode} - ${entry.accountName} - Debit: $${entry.debit} - Credit: $${entry.credit}`);
          }
        });
      }
    });
    
    // ========================================
    // 5. CASH FLOW ANALYSIS ISSUE
    // ========================================
    console.log('\n⚠️  CASH FLOW ANALYSIS ISSUE:');
    console.log('==============================');
    
    console.log('The problem is likely one of these:');
    console.log('1. The $901.12 expense is recorded in TransactionEntry but not in Expense collection');
    console.log('2. The cash flow analysis is only looking at Expense collection with paymentStatus = "Paid"');
    console.log('3. The expense exists but has a different paymentStatus');
    console.log('4. The expense is recorded under a different account code');
    
    // ========================================
    // 6. RECOMMENDED FIX
    // ========================================
    console.log('\n🔧 RECOMMENDED FIX:');
    console.log('=====================');
    
    console.log('To include this expense in cash flow, you need to:');
    console.log('1. Check if the expense exists in Expense collection');
    console.log('2. If not, create a corresponding Expense record');
    console.log('3. Set paymentStatus to "Paid"');
    console.log('4. Ensure the amount matches $901.12');
    console.log('5. Link it to the correct TransactionEntry');
    
    console.log('\n✅ Investigation Complete!');
    
  } catch (error) {
    console.error('❌ Error investigating expense 5099:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the investigation
investigateExpense5099();
