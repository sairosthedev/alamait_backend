const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

/**
 * CHECK EXPENSES PAID
 * 
 * This script will identify expenses that were actually paid by looking for:
 * 1. Transactions where expense accounts were debited
 * 2. Cash accounts were credited (money actually left)
 * 3. Distinguish between accrued vs paid expenses
 */

async function checkExpensesPaid() {
  try {
    console.log('\n🔍 CHECKING EXPENSES THAT WERE ACTUALLY PAID');
    console.log('================================================\n');
    
    // Set date range for full year 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 REPORTING PERIOD: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);
    
    // ========================================
    // STEP 1: FIND ALL EXPENSE DEBITS
    // ========================================
    console.log('📋 STEP 1: FINDING ALL EXPENSE DEBITS');
    console.log('======================================\n');
    
    // Get all transactions where expense accounts were debited
    const expenseDebits = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'posted'
    });
    
    let totalExpenseDebits = 0;
    const expenseDetails = [];
    
    expenseDebits.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        let hasExpenseDebit = false;
        let hasCashCredit = false;
        let expenseAmount = 0;
        let cashAmount = 0;
        let expenseAccount = '';
        let cashAccount = '';
        
        entry.entries.forEach(lineItem => {
          // Check for expense account debits
          if (['5099', '5003', '5030', '5050'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            hasExpenseDebit = true;
            expenseAmount = lineItem.debit;
            expenseAccount = lineItem.accountCode;
          }
          
          // Check for cash account credits (money leaving)
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.credit > 0) {
            hasCashCredit = true;
            cashAmount = lineItem.credit;
            cashAccount = lineItem.accountCode;
          }
        });
        
        if (hasExpenseDebit) {
          totalExpenseDebits += expenseAmount;
          
          expenseDetails.push({
            id: entry._id,
            date: entry.date,
            description: entry.description,
            source: entry.source,
            sourceModel: entry.sourceModel,
            expenseAmount: expenseAmount,
            cashAmount: cashAmount,
            expenseAccount: expenseAccount,
            cashAccount: cashAccount,
            hasCashCredit: hasCashCredit,
            isPaid: hasCashCredit
          });
        }
      }
    });
    
    console.log(`💰 TOTAL EXPENSE DEBITS: $${totalExpenseDebits.toFixed(2)}\n`);
    
    // ========================================
    // STEP 2: CATEGORIZE EXPENSES
    // ========================================
    console.log('📋 STEP 2: CATEGORIZING EXPENSES');
    console.log('==================================\n');
    
    const paidExpenses = expenseDetails.filter(exp => exp.isPaid);
    const accruedExpenses = expenseDetails.filter(exp => !exp.isPaid);
    
    console.log('🔍 EXPENSE CATEGORIES:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log(`│  💰 PAID EXPENSES (Cash Actually Left): ${paidExpenses.length} transactions                    │`);
    console.log(`│     • Total Amount: $${paidExpenses.reduce((sum, exp) => sum + exp.expenseAmount, 0).toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log(`│  📊 ACCRUED EXPENSES (No Cash Left): ${accruedExpenses.length} transactions                    │`);
    console.log(`│     • Total Amount: $${accruedExpenses.reduce((sum, exp) => sum + exp.expenseAmount, 0).toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 3: DETAILED PAID EXPENSES
    // ========================================
    console.log('📋 STEP 3: DETAILED PAID EXPENSES');
    console.log('==================================\n');
    
    if (paidExpenses.length > 0) {
      console.log('💰 EXPENSES THAT WERE ACTUALLY PAID:');
      console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Date        │ Description │ Source      │ Expense     │ Cash        │ Expense     │ Cash        │');
      console.log('│             │             │             │ Amount      │ Amount      │ Account     │ Account     │');
      console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      paidExpenses.forEach(expense => {
        const date = expense.date.toLocaleDateString().padEnd(12);
        const desc = (expense.description || 'N/A').substring(0, 11).padEnd(12);
        const source = (expense.source || 'N/A').padEnd(12);
        const expAmount = `$${expense.expenseAmount.toFixed(2)}`.padStart(12);
        const cashAmount = `$${expense.cashAmount.toFixed(2)}`.padStart(12);
        const expAccount = expense.expenseAccount.padEnd(12);
        const cashAccount = expense.cashAccount.padEnd(12);
        
        console.log(`│ ${date} │ ${desc} │ ${source} │ ${expAmount} │ ${cashAmount} │ ${expAccount} │ ${cashAccount} │`);
      });
      
      console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    } else {
      console.log('❌ NO PAID EXPENSES FOUND - All expenses are accrued only!\n');
    }
    
    // ========================================
    // STEP 4: DETAILED ACCRUED EXPENSES
    // ========================================
    console.log('📋 STEP 4: DETAILED ACCRUED EXPENSES');
    console.log('=====================================\n');
    
    if (accruedExpenses.length > 0) {
      console.log('📊 EXPENSES THAT ARE ACCRUED (NOT PAID):');
      console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Date        │ Description │ Source      │ Expense     │ Cash        │ Expense     │ Status      │');
      console.log('│             │             │             │ Amount      │ Amount      │ Account     │             │');
      console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      accruedExpenses.forEach(expense => {
        const date = expense.date.toLocaleDateString().padEnd(12);
        const desc = (expense.description || 'N/A').substring(0, 11).padEnd(12);
        const source = (expense.source || 'N/A').padEnd(12);
        const expAmount = `$${expense.expenseAmount.toFixed(2)}`.padStart(12);
        const cashAmount = expense.cashAmount > 0 ? `$${expense.cashAmount.toFixed(2)}`.padStart(12) : '$0.00'.padStart(12);
        const expAccount = expense.expenseAccount.padEnd(12);
        const status = '📊 ACCRUED'.padEnd(12);
        
        console.log(`│ ${date} │ ${desc} │ ${source} │ ${expAmount} │ ${cashAmount} │ ${expAccount} │ ${status} │`);
      });
      
      console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    }
    
    // ========================================
    // STEP 5: EXPENSE ACCOUNT BREAKDOWN
    // ========================================
    console.log('📋 STEP 5: EXPENSE ACCOUNT BREAKDOWN');
    console.log('=====================================\n');
    
    const expenseByAccount = {};
    
    expenseDetails.forEach(expense => {
      const accountCode = expense.expenseAccount;
      if (!expenseByAccount[accountCode]) {
        expenseByAccount[accountCode] = { total: 0, paid: 0, accrued: 0 };
      }
      
      expenseByAccount[accountCode].total += expense.expenseAmount;
      if (expense.isPaid) {
        expenseByAccount[accountCode].paid += expense.expenseAmount;
      } else {
        expenseByAccount[accountCode].accrued += expense.expenseAmount;
      }
    });
    
    console.log('📊 EXPENSE BREAKDOWN BY ACCOUNT:');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Account     │ Total       │ Paid        │ Accrued     │ Status      │');
    console.log('│ Code        │ Amount      │ Amount      │ Amount      │             │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    Object.keys(expenseByAccount).forEach(accountCode => {
      const data = expenseByAccount[accountCode];
      const accountPadded = accountCode.padEnd(12);
      const totalPadded = `$${data.total.toFixed(2)}`.padStart(12);
      const paidPadded = `$${data.paid.toFixed(2)}`.padStart(12);
      const accruedPadded = `$${data.accrued.toFixed(2)}`.padStart(12);
      
      let status = 'Unknown';
      if (data.paid > 0 && data.accrued === 0) {
        status = '✅ FULLY PAID'.padEnd(12);
      } else if (data.paid > 0 && data.accrued > 0) {
        status = '⚠️  PARTIALLY PAID'.padEnd(12);
      } else {
        status = '📊 ACCRUED ONLY'.padEnd(12);
      }
      
      console.log(`│ ${accountPadded} │ ${totalPadded} │ ${paidPadded} │ ${accruedPadded} │ ${status} │`);
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalTotal = expenseDetails.reduce((sum, exp) => sum + exp.expenseAmount, 0);
    const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.expenseAmount, 0);
    const totalAccrued = accruedExpenses.reduce((sum, exp) => sum + exp.expenseAmount, 0);
    
    const totalTotalPadded = `$${totalTotal.toFixed(2)}`.padStart(12);
    const totalPaidPadded = `$${totalPaid.toFixed(2)}`.padStart(12);
    const totalAccruedPadded = `$${totalAccrued.toFixed(2)}`.padStart(12);
    
    console.log(`│ TOTAL       │ ${totalTotalPadded} │ ${totalPaidPadded} │ ${totalAccruedPadded} │             │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // STEP 6: FINAL SUMMARY
    // ========================================
    console.log('📋 STEP 6: FINAL SUMMARY');
    console.log('=========================\n');
    
    console.log('🎯 EXPENSE PAYMENT STATUS SUMMARY:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 EXPENSE ACCOUNTING STATUS:                                                              │');
    console.log(`│     • Total Expenses Debited: $${totalExpenseDebits.toFixed(2)}                                        │`);
    console.log(`│     • Actually Paid in Cash: $${totalPaid.toFixed(2)}                                        │`);
    console.log(`│     • Still Accrued (Unpaid): $${totalAccrued.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💡 WHAT THIS MEANS:                                                                         │');
    console.log('│     • Your accrual basis shows $' + totalAccrued.toFixed(2) + ' in expenses (what you owe) │');
    console.log('│     • Your cash basis shows $' + totalPaid.toFixed(2) + ' in expenses (what you paid)      │');
    console.log('│     • The difference ($' + (totalAccrued).toFixed(2) + ') is your accounts payable          │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error checking expenses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the expense check
checkExpensesPaid();
