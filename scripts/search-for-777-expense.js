const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Expense = require('../src/models/finance/Expense');

async function searchFor777Expense() {
  try {
    console.log('\n🔍 SEARCHING FOR $777 EXPENSE');
    console.log('===============================\n');
    
    // ========================================
    // STEP 1: SEARCH EXPENSE COLLECTION
    // ========================================
    console.log('🔍 STEP 1: Searching Expense Collection\n');
    
    // Search for exact $777
    const exact777 = await Expense.findOne({ amount: 777 });
    if (exact777) {
      console.log(`✅ FOUND EXACT $777 EXPENSE:`);
      console.log(`   ID: ${exact777.expenseId}`);
      console.log(`   Description: ${exact777.description}`);
      console.log(`   Date: ${exact777.expenseDate?.toDateString()}`);
      console.log(`   Status: ${exact777.paymentStatus}`);
    } else {
      console.log(`❌ No expense found with exact amount $777`);
    }
    
    // Search for expenses around $777
    const around777 = await Expense.find({
      amount: { $gte: 770, $lte: 785 }
    });
    
    if (around777.length > 0) {
      console.log(`\n🔍 EXPENSES AROUND $777:`);
      around777.forEach(exp => {
        console.log(`   • $${exp.amount?.toFixed(2) || '0.00'} - ${exp.description || 'No description'}`);
      });
    } else {
      console.log(`\n❌ No expenses found around $777`);
    }
    
    // ========================================
    // STEP 2: SEARCH TRANSACTION ENTRIES
    // ========================================
    console.log('\n🔍 STEP 2: Searching Transaction Entries\n');
    
    // Search for $777 in TransactionEntry
    const tx777 = await TransactionEntry.find({
      'entries.amount': 777
    });
    
    if (tx777.length > 0) {
      console.log(`✅ FOUND $777 IN TRANSACTION ENTRIES:`);
      tx777.forEach(tx => {
        console.log(`   Transaction ID: ${tx.transactionId}`);
        console.log(`   Description: ${tx.description}`);
        console.log(`   Source: ${tx.source}`);
        console.log(`   Date: ${tx.date?.toDateString()}`);
      });
    } else {
      console.log(`❌ No TransactionEntry found with amount $777`);
    }
    
    // Search for expenses around $777 in TransactionEntry
    const txAround777 = await TransactionEntry.find({
      'entries.debit': { $gte: 770, $lte: 785 }
    });
    
    if (txAround777.length > 0) {
      console.log(`\n🔍 TRANSACTION ENTRIES AROUND $777:`);
      txAround777.forEach(tx => {
        const expenseEntry = tx.entries.find(entry => entry.debit > 0);
        if (expenseEntry) {
          console.log(`   • $${expenseEntry.debit?.toFixed(2) || '0.00'} - ${tx.description}`);
          console.log(`     Transaction ID: ${tx.transactionId}`);
        }
      });
    } else {
      console.log(`\n❌ No TransactionEntry found around $777`);
    }
    
    // ========================================
    // STEP 3: SEARCH ALL EXPENSES BY AMOUNT
    // ========================================
    console.log('\n🔍 STEP 3: All Expenses by Amount (Sorted)\n');
    
    const allExpenses = await Expense.find({}).sort({ amount: 1 });
    
    console.log(`📊 Total Expenses Found: ${allExpenses.length}`);
    console.log('\n💰 EXPENSES BY AMOUNT (First 20):');
    
    allExpenses.slice(0, 20).forEach(exp => {
      console.log(`   $${exp.amount?.toFixed(2) || '0.00'} - ${exp.description || 'No description'}`);
    });
    
    if (allExpenses.length > 20) {
      console.log(`   ... and ${allExpenses.length - 20} more`);
    }
    
    // ========================================
    // STEP 4: SUMMARY
    // ========================================
    console.log('\n📋 SUMMARY:');
    console.log('============');
    console.log('If you\'re looking for a $777 expense, it might be:');
    console.log('1. Recorded with a different amount');
    console.log('2. Recorded under a different description');
    console.log('3. Not yet recorded in the system');
    console.log('4. Part of a larger transaction');
    
  } catch (error) {
    console.error('❌ Error searching for $777 expense:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the search
searchFor777Expense();
