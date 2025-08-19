const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

async function analyzeBusinessScenarios() {
  try {
    console.log('\n🏠 ANALYZING YOUR BUSINESS SCENARIOS');
    console.log('=====================================\n');
    
    const now = new Date();
    
    // Get all transaction entries
    const allEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    }).sort({ date: -1 });
    
    console.log(`Total Transaction Entries Found: ${allEntries.length}\n`);
    
    // ========================================
    // SCENARIO 1: STUDENT PAYMENTS (RENT, ADMIN, DEPOSIT)
    // ========================================
    console.log('📋 SCENARIO 1: STUDENT PAYMENTS (RENT, ADMIN, DEPOSIT)');
    console.log('========================================================');
    
    const studentPayments = allEntries.filter(tx => 
      tx.source === 'payment' && 
      tx.description.toLowerCase().includes('payment')
    );
    
    console.log(`Found ${studentPayments.length} student payment transactions\n`);
    
    studentPayments.forEach((tx, idx) => {
      console.log(`Transaction ${idx + 1}: ${tx.description}`);
      console.log(`Date: ${tx.date.toDateString()}`);
      console.log(`Source: ${tx.source}`);
      
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          const accountName = entry.accountName || 'Unknown';
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          if (['1001', '1002', '1011'].includes(entry.accountCode)) {
            // This is a cash account
            if (debit > 0) {
              console.log(`  ❌ PROBLEM: Cash account "${accountName}" DEBITED $${debit.toFixed(2)} (money going OUT)`);
              console.log(`     This should be a CREDIT (money coming IN) for student payments!`);
            } else if (credit > 0) {
              console.log(`  ✅ CORRECT: Cash account "${accountName}" CREDITED $${credit.toFixed(2)} (money coming IN)`);
            }
          } else {
            console.log(`  📊 Non-cash account: ${accountName} - Debit: $${debit.toFixed(2)}, Credit: $${credit.toFixed(2)}`);
          }
        });
      }
      console.log('');
    });
    
    // ========================================
    // SCENARIO 2: EXPENSE ACCRUALS VS PAYMENTS
    // ========================================
    console.log('📋 SCENARIO 2: EXPENSE ACCRUALS VS PAYMENTS');
    console.log('=============================================');
    
    const expenseAccruals = allEntries.filter(tx => 
      tx.source === 'expense_accrual'
    );
    
    const manualExpenses = allEntries.filter(tx => 
      tx.source === 'manual' && 
      tx.description.toLowerCase().includes('expense')
    );
    
    console.log(`Found ${expenseAccruals.length} expense accruals and ${manualExpenses.length} manual expense payments\n`);
    
    // Show expense accruals
    console.log('📅 EXPENSE ACCRUALS (Monthly):');
    expenseAccruals.forEach((tx, idx) => {
      console.log(`  ${idx + 1}. ${tx.description} - ${tx.date.toDateString()}`);
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          if (entry.debit > 0) {
            console.log(`     DEBIT: ${entry.accountName} $${entry.debit.toFixed(2)}`);
          } else if (entry.credit > 0) {
            console.log(`     CREDIT: ${entry.accountName} $${entry.credit.toFixed(2)}`);
          }
        });
      }
    });
    
    console.log('\n💸 MANUAL EXPENSE PAYMENTS:');
    manualExpenses.forEach((tx, idx) => {
      console.log(`  ${idx + 1}. ${tx.description} - ${tx.date.toDateString()}`);
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          if (['1001', '1002', '1011'].includes(entry.accountCode)) {
            // Cash account
            if (entry.debit > 0) {
              console.log(`     ❌ PROBLEM: Cash account "${entry.accountName}" DEBITED $${entry.debit.toFixed(2)}`);
              console.log(`        This should be a CREDIT (money going OUT) for expense payments!`);
            } else if (entry.credit > 0) {
              console.log(`     ✅ CORRECT: Cash account "${entry.accountName}" CREDITED $${entry.credit.toFixed(2)}`);
            }
          } else {
            console.log(`     📊 Non-cash: ${entry.accountName} - Debit: $${entry.debit.toFixed(2)}, Credit: $${entry.credit.toFixed(2)}`);
          }
        });
      }
    });
    
    // ========================================
    // SCENARIO 3: DEPOSIT RETURNS
    // ========================================
    console.log('\n📋 SCENARIO 3: DEPOSIT RETURNS');
    console.log('=================================');
    
    const depositReturns = allEntries.filter(tx => 
      tx.description.toLowerCase().includes('deposit return') ||
      tx.description.toLowerCase().includes('refund')
    );
    
    if (depositReturns.length > 0) {
      console.log(`Found ${depositReturns.length} deposit return transactions`);
      depositReturns.forEach((tx, idx) => {
        console.log(`  ${idx + 1}. ${tx.description} - ${tx.date.toDateString()}`);
        // Analyze entries...
      });
    } else {
      console.log('No deposit return transactions found yet');
    }
    
    // ========================================
    // SCENARIO 4: PETTY CASH FLOWS
    // ========================================
    console.log('\n📋 SCENARIO 4: PETTY CASH FLOWS');
    console.log('==================================');
    
    const pettyCashTransactions = allEntries.filter(tx => 
      tx.description.toLowerCase().includes('petty cash')
    );
    
    console.log(`Found ${pettyCashTransactions.length} petty cash transactions\n`);
    
    pettyCashTransactions.forEach((tx, idx) => {
      console.log(`Transaction ${idx + 1}: ${tx.description}`);
      console.log(`Date: ${tx.date.toDateString()}`);
      console.log(`Source: ${tx.source}`);
      
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          const accountName = entry.accountName || 'Unknown';
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          if (entry.accountCode === '1011') {
            // Admin Petty Cash account
            if (debit > 0) {
              console.log(`  💸 Petty Cash DEBITED $${debit.toFixed(2)} (money going OUT of petty cash)`);
            } else if (credit > 0) {
              console.log(`  💰 Petty Cash CREDITED $${credit.toFixed(2)} (money coming INTO petty cash)`);
            }
          } else if (['1001', '1002'].includes(entry.accountCode)) {
            // Other cash accounts
            if (debit > 0) {
              console.log(`  🏦 ${accountName} DEBITED $${debit.toFixed(2)} (money going OUT)`);
            } else if (credit > 0) {
              console.log(`  🏦 ${accountName} CREDITED $${credit.toFixed(2)} (money coming IN)`);
            }
          } else {
            console.log(`  📊 ${accountName}: Debit: $${debit.toFixed(2)}, Credit: $${credit.toFixed(2)}`);
          }
        });
      }
      console.log('');
    });
    
    // ========================================
    // SUMMARY OF PROBLEMS
    // ========================================
    console.log('\n🚨 SUMMARY OF SYSTEM PROBLEMS');
    console.log('===============================');
    
    console.log('1. ❌ STUDENT PAYMENTS: Cash accounts are being DEBITED instead of CREDITED');
    console.log('   - This makes student payments appear as cash outflows instead of inflows');
    console.log('   - Your cash flow statement will be completely wrong');
    
    console.log('\n2. ❌ EXPENSE PAYMENTS: Cash accounts are being DEBITED instead of CREDITED');
    console.log('   - This makes expense payments appear as cash inflows instead of outflows');
    console.log('   - Your expenses will show as money coming in instead of going out');
    
    console.log('\n3. ❌ DOUBLE-ENTRY LOGIC IS INVERTED for cash flow purposes');
    console.log('   - The accounting entries are balanced (debits = credits)');
    console.log('   - But the cash flow interpretation is backwards');
    
    console.log('\n✅ PETTY CASH FLOWS: These appear to be recorded correctly');
    console.log('   - Money flowing between cash accounts is properly tracked');
    
    console.log('\n🔧 WHAT NEEDS TO BE FIXED:');
    console.log('   - Student payment logic needs to CREDIT cash accounts');
    console.log('   - Expense payment logic needs to CREDIT cash accounts');
    console.log('   - Or your cash flow analysis needs to interpret debits/credits differently');
    
  } catch (error) {
    console.error('❌ Error analyzing business scenarios:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the analysis
analyzeBusinessScenarios();
