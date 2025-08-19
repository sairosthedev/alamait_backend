const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Expense = require('../src/models/finance/Expense');
const Payment = require('../src/models/Payment');
const Transaction = require('../src/models/Transaction');

async function find90112Source() {
  try {
    console.log('\n🔍 SEARCHING FOR $901.12 ACROSS ALL COLLECTIONS');
    console.log('==================================================\n');
    
    // ========================================
    // STEP 1: SEARCH EXPENSE COLLECTION
    // ========================================
    console.log('🔍 STEP 1: Searching Expense Collection\n');
    
    // Search for exact amount
    const exactExpense = await Expense.findOne({ amount: 901.12 });
    if (exactExpense) {
      console.log(`✅ FOUND $901.12 in Expense Collection:`);
      console.log(`   ID: ${exactExpense._id}`);
      console.log(`   Description: ${exactExpense.description}`);
    } else {
      console.log(`❌ No expense found with amount $901.12`);
    }
    
    // Search for amounts around 901.12
    const aroundExpense = await Expense.find({
      amount: { $gte: 900, $lte: 902 }
    });
    if (aroundExpense.length > 0) {
      console.log(`\n🔍 Expenses around $901.12:`);
      aroundExpense.forEach(exp => {
        console.log(`   • $${exp.amount} - ${exp.description}`);
      });
    }
    
    // ========================================
    // STEP 2: SEARCH TRANSACTION ENTRIES
    // ========================================
    console.log('\n🔍 STEP 2: Searching Transaction Entries\n');
    
    // Search for exact amount in any entry
    const exactTx = await TransactionEntry.find({
      $or: [
        { 'entries.debit': 901.12 },
        { 'entries.credit': 901.12 },
        { totalDebit: 901.12 },
        { totalCredit: 901.12 }
      ]
    });
    
    if (exactTx.length > 0) {
      console.log(`✅ FOUND $901.12 in Transaction Entries:`);
      exactTx.forEach(tx => {
        console.log(`   Transaction ID: ${tx.transactionId}`);
        console.log(`   Description: ${tx.description}`);
        console.log(`   Source: ${tx.source}`);
      });
    } else {
      console.log(`❌ No TransactionEntry found with amount $901.12`);
    }
    
    // Search for amounts around 901.12
    const aroundTx = await TransactionEntry.find({
      $or: [
        { 'entries.debit': { $gte: 900, $lte: 902 } },
        { 'entries.credit': { $gte: 900, $lte: 902 } },
        { totalDebit: { $gte: 900, $lte: 902 } },
        { totalCredit: { $gte: 900, $lte: 902 } }
      ]
    });
    
    if (aroundTx.length > 0) {
      console.log(`\n🔍 Transaction Entries around $901.12:`);
      aroundTx.forEach(tx => {
        console.log(`   • Transaction ID: ${tx.transactionId}`);
        console.log(`   • Description: ${tx.description}`);
        console.log(`   • Total Debit: $${tx.totalDebit}`);
        console.log(`   • Total Credit: $${tx.totalCredit}`);
      });
    }
    
    // ========================================
    // STEP 3: SEARCH PAYMENT COLLECTION
    // ========================================
    console.log('\n🔍 STEP 3: Searching Payment Collection\n');
    
    const exactPayment = await Payment.findOne({ totalAmount: 901.12 });
    if (exactPayment) {
      console.log(`✅ FOUND $901.12 in Payment Collection:`);
      console.log(`   ID: ${exactPayment._id}`);
      console.log(`   Description: ${exactPayment.description}`);
    } else {
      console.log(`❌ No payment found with amount $901.12`);
    }
    
    // ========================================
    // STEP 4: SEARCH TRANSACTION COLLECTION
    // ========================================
    console.log('\n🔍 STEP 4: Searching Transaction Collection\n');
    
    const exactTransaction = await Transaction.findOne({
      $or: [
        { totalDebit: 901.12 },
        { totalCredit: 901.12 }
      ]
    });
    
    if (exactTransaction) {
      console.log(`✅ FOUND $901.12 in Transaction Collection:`);
      console.log(`   ID: ${exactTransaction._id}`);
      console.log(`   Type: ${exactTransaction.type}`);
      console.log(`   Description: ${exactTransaction.description}`);
    } else {
      console.log(`❌ No transaction found with amount $901.12`);
    }
    
    // ========================================
    // STEP 5: SEARCH FOR PARTIAL AMOUNTS
    // ========================================
    console.log('\n🔍 STEP 5: Searching for Partial Amounts\n');
    
    // Check if 901.12 is a sum of multiple transactions
    const allExpenses = await Expense.find({});
    const allPayments = await Payment.find({});
    
    console.log(`📊 Total Expenses: ${allExpenses.length}`);
    console.log(`📊 Total Payments: ${allPayments.length}`);
    
    // Look for expenses that might sum to 901.12
    const expenseAmounts = allExpenses.map(e => e.amount || 0);
    const paymentAmounts = allPayments.map(p => p.totalAmount || 0);
    
    console.log(`\n💰 Expense amounts: ${expenseAmounts.slice(0, 10).join(', ')}...`);
    console.log(`💰 Payment amounts: ${paymentAmounts.slice(0, 10).join(', ')}...`);
    
    // ========================================
    // STEP 6: CONCLUSION
    // ========================================
    console.log('\n📋 CONCLUSION');
    console.log('==============');
    console.log('If $901.12 appears in your "cash basis" income statement but:');
    console.log('❌ Is not in Expense collection');
    console.log('❌ Is not in TransactionEntry collection');
    console.log('❌ Is not in Payment collection');
    console.log('❌ Is not in Transaction collection');
    console.log('\n🚨 THEN:');
    console.log('1. Your income statement calculation is WRONG');
    console.log('2. Data is coming from a different source');
    console.log('3. There\'s a bug in your reporting logic');
    console.log('4. You need to check your dashboard/income statement code');
    
  } catch (error) {
    console.error('❌ Error searching for $901.12 source:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the search
find90112Source();
