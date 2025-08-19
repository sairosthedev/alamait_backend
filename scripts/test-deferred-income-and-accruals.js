const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Debtor = require('../src/models/Debtor');
const Account = require('../src/models/Account');

/**
 * COMPREHENSIVE TEST: DEFERRED INCOME AND RENT ACCRUALS
 * 
 * This script will verify that both systems are working correctly:
 * 1. Deferred Income for early payments
 * 2. Rent Accruals for monthly rental income
 */

async function testDeferredIncomeAndAccruals() {
  try {
    console.log('\n🧪 TESTING DEFERRED INCOME AND RENT ACCRUALS');
    console.log('==============================================\n');
    
    // ========================================
    // STEP 1: CHECK DEFERRED INCOME SYSTEM
    // ========================================
    console.log('📋 STEP 1: CHECKING DEFERRED INCOME SYSTEM');
    console.log('==========================================\n');
    
    // Check if Deferred Income account exists
    const deferredIncomeAccount = await Account.findOne({ code: '2030' });
    if (deferredIncomeAccount) {
      console.log(`✅ Deferred Income Account Found:`);
      console.log(`   Code: ${deferredIncomeAccount.code}`);
      console.log(`   Name: ${deferredIncomeAccount.name}`);
      console.log(`   Type: ${deferredIncomeAccount.type}`);
    } else {
      console.log('❌ Deferred Income Account 2030 NOT FOUND!');
      return;
    }
    
    // Check Deferred Income transactions
    const deferredIncomeTransactions = await TransactionEntry.find({
      'entries.accountCode': '2030',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n🔍 Deferred Income Transactions: ${deferredIncomeTransactions.length}`);
    
    if (deferredIncomeTransactions.length > 0) {
      console.log('\n💰 DEFERRED INCOME TRANSACTIONS:');
      deferredIncomeTransactions.forEach((transaction, index) => {
        console.log(`   ${index + 1}. ${transaction.description}`);
        console.log(`      Date: ${transaction.date.toLocaleDateString()}`);
        console.log(`      Source: ${transaction.source}`);
        console.log(`      Source Model: ${transaction.sourceModel}`);
        
        // Find the Deferred Income line item
        const deferredLine = transaction.entries.find(entry => entry.accountCode === '2030');
        if (deferredLine) {
          console.log(`      Deferred Income Amount: $${deferredLine.credit || deferredLine.debit}`);
        }
      });
    }
    
    // ========================================
    // STEP 2: CHECK RENT ACCRUAL SYSTEM
    // ========================================
    console.log('\n\n📋 STEP 2: CHECKING RENT ACCRUAL SYSTEM');
    console.log('==========================================\n');
    
    // Check if Rental Income accounts exist
    const rentalIncomeAccounts = await Account.find({
      code: { $in: ['4000', '4001', '4100'] }
    });
    
    console.log(`✅ Rental Income Accounts Found: ${rentalIncomeAccounts.length}`);
    rentalIncomeAccounts.forEach(account => {
      console.log(`   ${account.code}: ${account.name} (${account.type})`);
    });
    
    // Check Rent Accrual transactions
    const rentAccrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n🔍 Rent Accrual Transactions: ${rentAccrualTransactions.length}`);
    
    if (rentAccrualTransactions.length > 0) {
      console.log('\n🏠 RENT ACCRUAL TRANSACTIONS:');
      rentAccrualTransactions.forEach((transaction, index) => {
        console.log(`   ${index + 1}. ${transaction.description}`);
        console.log(`      Date: ${transaction.date.toLocaleDateString()}`);
        console.log(`      Source: ${transaction.source}`);
        console.log(`      Source Model: ${transaction.sourceModel}`);
        
        // Show the double-entry
        transaction.entries.forEach(entry => {
          if (entry.accountCode === '1100' || entry.accountCode === '4000' || entry.accountCode === '4001' || entry.accountCode === '4100') {
            console.log(`      ${entry.accountCode} (${entry.accountName}): ${entry.debit > 0 ? 'DR' : 'CR'} $${entry.debit || entry.credit}`);
          }
        });
      });
    }
    
    // ========================================
    // STEP 3: CHECK DEBTOR PAYMENTS AND BALANCES
    // ========================================
    console.log('\n\n📋 STEP 3: CHECKING DEBTOR PAYMENTS AND BALANCES');
    console.log('==================================================\n');
    
    const debtors = await Debtor.find();
    console.log(`✅ Total Debtors: ${debtors.length}`);
    
    debtors.forEach((debtor, index) => {
      console.log(`\n👤 Debtor ${index + 1}: ${debtor.debtorCode}`);
      console.log(`   Room: ${debtor.roomNumber} (${debtor.residence || 'Unknown'})`);
      console.log(`   Monthly Rent: $${debtor.roomPrice}`);
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Total Paid: $${debtor.totalPaid}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      console.log(`   Lease Period: ${debtor.startDate?.toLocaleDateString()} to ${debtor.endDate?.toLocaleDateString()}`);
    });
    
    // ========================================
    // STEP 4: VERIFY ACCOUNTING EQUATION
    // ========================================
    console.log('\n\n📋 STEP 4: VERIFYING ACCOUNTING EQUATION');
    console.log('==========================================\n');
    
    // Get all transaction entries for 2025
    const allEntries = await TransactionEntry.find({
      date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
      status: 'posted'
    });
    
    // Calculate account balances
    const accountBalances = {};
    
    allEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          const accountCode = lineItem.accountCode;
          if (!accountBalances[accountCode]) {
            accountBalances[accountCode] = {
              accountName: lineItem.accountName,
              accountType: lineItem.accountType,
              totalDebit: 0,
              totalCredit: 0,
              netAmount: 0
            };
          }
          
          accountBalances[accountCode].totalDebit += lineItem.debit || 0;
          accountBalances[accountCode].totalCredit += lineItem.credit || 0;
        });
      }
    });
    
    // Calculate net balances
    Object.values(accountBalances).forEach(account => {
      switch (account.accountType) {
        case 'Asset':
          account.netAmount = account.totalDebit - account.totalCredit;
          break;
        case 'Liability':
          account.netAmount = account.totalCredit - account.totalDebit;
          break;
        case 'Equity':
          account.netAmount = account.totalCredit - account.totalDebit;
          break;
        case 'Income':
          account.netAmount = account.totalCredit - account.totalDebit;
          break;
        case 'Expense':
          account.netAmount = account.totalDebit - account.totalCredit;
          break;
      }
    });
    
    // Calculate totals
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    Object.values(accountBalances).forEach(account => {
      if (account.accountType === 'Asset') {
        totalAssets += Math.max(0, account.netAmount);
      } else if (account.accountType === 'Liability') {
        totalLiabilities += Math.abs(account.netAmount);
      } else if (account.accountType === 'Equity') {
        totalEquity += account.netAmount;
      }
    });
    
    console.log('💰 ACCOUNTING EQUATION CHECK:');
    console.log(`   Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`   Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`   Total Equity: $${totalEquity.toFixed(2)}`);
    
    const balanceCheck = totalAssets - totalLiabilities - totalEquity;
    console.log(`   Balance Check: $${balanceCheck.toFixed(2)} (should be 0)`);
    
    if (Math.abs(balanceCheck) > 0.01) {
      console.log(`   ⚠️  ACCOUNTING EQUATION IS OFF BY $${Math.abs(balanceCheck).toFixed(2)}`);
    } else {
      console.log(`   ✅ ACCOUNTING EQUATION IS BALANCED!`);
    }
    
    // ========================================
    // STEP 5: SUMMARY AND RECOMMENDATIONS
    // ========================================
    console.log('\n\n📋 STEP 5: SUMMARY AND RECOMMENDATIONS');
    console.log('==========================================\n');
    
    console.log('🎯 SYSTEM STATUS SUMMARY:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  🔍 DEFERRED INCOME SYSTEM:                                                                 │');
    console.log(`│     • Account 2030 exists: ${deferredIncomeAccount ? '✅ YES' : '❌ NO'}                           │`);
    console.log(`│     • Transactions created: ${deferredIncomeTransactions.length}                              │`);
    console.log(`│     • Status: ${deferredIncomeTransactions.length > 0 ? '✅ WORKING' : '❌ NOT WORKING'}        │`);
    console.log('│                                                                                             │');
    console.log('│  🔍 RENT ACCRUAL SYSTEM:                                                                    │');
    console.log(`│     • Rental income accounts: ${rentalIncomeAccounts.length}                                 │`);
    console.log(`│     • Accrual transactions: ${rentAccrualTransactions.length}                                │`);
    console.log(`│     • Status: ${rentAccrualTransactions.length > 0 ? '✅ WORKING' : '❌ NOT WORKING'}          │`);
    console.log('│                                                                                             │');
    console.log('│  🔍 ACCOUNTING INTEGRITY:                                                                   │');
    console.log(`│     • Total debtors: ${debtors.length}                                                      │`);
    console.log(`│     • Accounting equation: ${Math.abs(balanceCheck) > 0.01 ? '❌ OFF' : '✅ BALANCED'}        │`);
    console.log(`│     • Balance difference: $${Math.abs(balanceCheck).toFixed(2)}                              │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // Specific recommendations
    if (deferredIncomeTransactions.length === 0) {
      console.log('⚠️  DEFERRED INCOME ISSUES:');
      console.log('   • No deferred income transactions found');
      console.log('   • Early payments may not be properly recorded');
      console.log('   • Check if deferred income logic was implemented');
    }
    
    if (rentAccrualTransactions.length === 0) {
      console.log('⚠️  RENT ACCRUAL ISSUES:');
      console.log('   • No rent accrual transactions found');
      console.log('   • Monthly rental income may not be properly accrued');
      console.log('   • Check if rental accrual service is running');
    }
    
    if (Math.abs(balanceCheck) > 0.01) {
      console.log('⚠️  ACCOUNTING EQUATION ISSUES:');
      console.log('   • Assets ≠ Liabilities + Equity');
      console.log('   • This indicates missing transactions or calculation errors');
      console.log('   • Review all transaction entries for completeness');
    }
    
  } catch (error) {
    console.error('❌ Error testing deferred income and accruals:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testDeferredIncomeAndAccruals();
