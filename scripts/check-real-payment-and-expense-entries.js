const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/finance/Expense');

async function checkRealPaymentAndExpenseEntries() {
  try {
    console.log('\n🔍 CHECKING REAL PAYMENT & EXPENSE ENTRIES');
    console.log('==========================================\n');
    
    const now = new Date();
    
    // ========================================
    // STEP 1: CHECK ALL PAYMENT TRANSACTIONS
    // ========================================
    console.log('🔍 STEP 1: Checking All Payment Transactions\n');
    
    const allPaymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }
    });
    
    console.log(`📊 Total Payment Transactions Found: ${allPaymentTransactions.length}`);
    
    let totalPaymentInflows = 0;
    let paymentDetails = [];
    
    allPaymentTransactions.forEach(tx => {
      const cashEntry = tx.entries.find(entry => 
        ['1001', '1002', '1011'].includes(entry.accountCode)
      );
      
      if (cashEntry) {
        const debit = cashEntry.debit || 0;
        const credit = cashEntry.credit || 0;
        
        if (debit > 0) {
          // DEBIT to cash = Money received (cash inflow)
          totalPaymentInflows += debit;
          paymentDetails.push({
            transactionId: tx.transactionId,
            amount: debit,
            accountCode: cashEntry.accountCode,
            accountName: cashEntry.accountName,
            date: tx.date,
            description: tx.description,
            sourceId: tx.sourceId
          });
          
          console.log(`  📥 PAYMENT INFLOW: $${debit.toFixed(2)} - ${cashEntry.accountName}`);
          console.log(`     Description: ${tx.description}`);
          console.log(`     Transaction ID: ${tx.transactionId}`);
        }
      }
    });
    
    console.log(`\n💰 TOTAL PAYMENT INFLOWS: $${totalPaymentInflows.toFixed(2)}`);
    
    // ========================================
    // STEP 2: CHECK EXPENSE PAYMENT ENTRIES
    // ========================================
    console.log('\n🔍 STEP 2: Checking Expense Payment Entries\n');
    
    const allExpenseTransactions = await TransactionEntry.find({
      source: { $in: ['expense_payment', 'vendor_payment', 'manual'] },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }
    });
    
    console.log(`📊 Total Expense Transactions Found: ${allExpenseTransactions.length}`);
    
    let totalExpenseOutflows = 0;
    let expenseDetails = [];
    
    allExpenseTransactions.forEach(tx => {
      const cashEntry = tx.entries.find(entry => 
        ['1001', '1002', '1011'].includes(entry.accountCode)
      );
      
      if (cashEntry) {
        const debit = cashEntry.debit || 0;
        const credit = cashEntry.credit || 0;
        
        if (credit > 0) {
          // CREDIT to cash = Money spent (cash outflow)
          totalExpenseOutflows += credit;
          expenseDetails.push({
            transactionId: tx.transactionId,
            amount: credit,
            accountCode: cashEntry.accountCode,
            accountName: cashEntry.accountName,
            date: tx.date,
            description: tx.description,
            sourceId: tx.sourceId
          });
          
          console.log(`  📤 EXPENSE OUTFLOW: $${credit.toFixed(2)} - ${cashEntry.accountName}`);
          console.log(`     Description: ${tx.description}`);
          console.log(`     Transaction ID: ${tx.transactionId}`);
        }
      }
    });
    
    console.log(`\n💰 TOTAL EXPENSE OUTFLOWS: $${totalExpenseOutflows.toFixed(2)}`);
    
    // ========================================
    // STEP 3: SPECIFICALLY CHECK $901.12 EXPENSE
    // ========================================
    console.log('\n🔍 STEP 3: Specifically Checking $901.12 Expense\n');
    
    // Look for the specific $901.12 expense
    const specificExpense = await Expense.findOne({
      amount: 901.12
    });
    
    if (specificExpense) {
      console.log(`📋 Found $901.12 Expense:`);
      console.log(`   ID: ${specificExpense.expenseId}`);
      console.log(`   Description: ${specificExpense.description}`);
      console.log(`   Date: ${specificExpense.expenseDate?.toDateString()}`);
      console.log(`   Status: ${specificExpense.paymentStatus}`);
      
      // Check if there's a TransactionEntry for this expense
      const expenseTransaction = await TransactionEntry.findOne({
        sourceId: specificExpense._id,
        source: { $in: ['expense_payment', 'vendor_payment', 'manual'] }
      });
      
      if (expenseTransaction) {
        console.log(`✅ FOUND TRANSACTION ENTRY for $901.12 expense!`);
        console.log(`   Transaction ID: ${expenseTransaction.transactionId}`);
        console.log(`   Description: ${expenseTransaction.description}`);
        console.log(`   Source: ${expenseTransaction.source}`);
        
        // Check the cash movement
        const cashEntry = expenseTransaction.entries.find(entry => 
          ['1001', '1002', '1011'].includes(entry.accountCode)
        );
        
        if (cashEntry) {
          console.log(`   Cash Account: ${cashEntry.accountCode} - ${cashEntry.accountName}`);
          console.log(`   Debit: $${cashEntry.debit || 0}`);
          console.log(`   Credit: $${cashEntry.credit || 0}`);
          
          if (cashEntry.credit > 0) {
            console.log(`   ✅ This expense WAS PAID (CREDIT to cash = money spent)`);
          } else {
            console.log(`   ❌ This expense was NOT paid (no CREDIT to cash)`);
          }
        }
      } else {
        console.log(`❌ NO TRANSACTION ENTRY found for $901.12 expense`);
        console.log(`   This means it was never actually paid`);
      }
    } else {
      console.log(`❌ No expense found with amount $901.12`);
    }
    
    // ========================================
    // STEP 4: FINAL CASH FLOW CALCULATION
    // ========================================
    console.log('\n💰 FINAL CASH FLOW CALCULATION');
    console.log('================================');
    
    const netCashFlow = totalPaymentInflows - totalExpenseOutflows;
    
    console.log(`📥 TOTAL CASH INFLOWS:  $${totalPaymentInflows.toFixed(2)}`);
    console.log(`📤 TOTAL CASH OUTFLOWS: $${totalExpenseOutflows.toFixed(2)}`);
    console.log(`💵 NET CASH FLOW:       $${netCashFlow.toFixed(2)}`);
    
    // ========================================
    // STEP 5: SUMMARY
    // ========================================
    console.log('\n📋 SUMMARY:');
    console.log('============');
    console.log('✅ PAYMENTS: If created through "add payment", they ARE cash inflows');
    console.log('   - TransactionEntry records prove money was received');
    console.log('   - Status doesn\'t matter - the double entry exists');
    
    console.log('\n✅ EXPENSES: Only count if they have TransactionEntry records');
    console.log('   - TransactionEntry proves money was actually spent');
    console.log('   - Expense status doesn\'t matter - the payment entry exists');
    
    console.log('\n🎯 KEY POINT:');
    console.log('   - TransactionEntry = Real cash movement');
    console.log('   - Payment/Expense status = Administrative tracking only');
    
  } catch (error) {
    console.error('❌ Error checking real payment and expense entries:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkRealPaymentAndExpenseEntries();
