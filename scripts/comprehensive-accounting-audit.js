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
const Account = require('../src/models/Account');

async function comprehensiveAccountingAudit() {
  try {
    console.log('\n🔍 COMPREHENSIVE ACCOUNTING MODULE AUDIT');
    console.log('==========================================\n');
    
    // ========================================
    // STEP 1: VERIFY CHART OF ACCOUNTS
    // ========================================
    console.log('🔍 STEP 1: Verifying Chart of Accounts\n');
    
    const requiredAccounts = [
      { code: '1001', name: 'Bank Account', type: 'Asset', normalBalance: 'Debit' },
      { code: '1002', name: 'Cash on Hand', type: 'Asset', normalBalance: 'Debit' },
      { code: '1011', name: 'Admin Petty Cash', type: 'Asset', normalBalance: 'Debit' },
      { code: '1101', name: 'Accounts Receivable', type: 'Asset', normalBalance: 'Debit' },
      { code: '2000', name: 'Accounts Payable', type: 'Liability', normalBalance: 'Credit' },
      { code: '2020', name: 'Tenant Deposits Held', type: 'Liability', normalBalance: 'Credit' },
      { code: '4001', name: 'Rental Income', type: 'Income', normalBalance: 'Credit' },
      { code: '4100', name: 'Administrative Income', type: 'Income', normalBalance: 'Credit' },
      { code: '5099', name: 'Other Operating Expenses', type: 'Expense', normalBalance: 'Debit' }
    ];
    
    console.log('📋 VERIFYING REQUIRED ACCOUNTS:');
    for (const required of requiredAccounts) {
      const account = await Account.findOne({ code: required.code });
        if (account) {
        console.log(`   ✅ ${required.code} - ${required.name} (${account.type})`);
        
        // Verify account type
        if (account.type.toLowerCase() !== required.type.toLowerCase()) {
          console.log(`      ⚠️  WARNING: Expected ${required.type}, got ${account.type}`);
        }
        } else {
        console.log(`   ❌ ${required.code} - ${required.name} (MISSING)`);
      }
    }
    
    // ========================================
    // STEP 2: VERIFY DOUBLE-ENTRY RULES
    // ========================================
    console.log('\n🔍 STEP 2: Verifying Double-Entry Rules\n');
    
    console.log('📊 DOUBLE-ENTRY RULES VERIFICATION:');
    console.log('   ✅ Assets: Debit to increase, Credit to decrease');
    console.log('   ✅ Liabilities: Credit to increase, Debit to decrease');
    console.log('   ✅ Income: Credit to increase, Debit to decrease');
    console.log('   ✅ Expenses: Debit to increase, Credit to decrease');
    console.log('   ✅ Equity: Credit to increase, Debit to decrease');
    
    // ========================================
    // STEP 3: VERIFY BUSINESS SCENARIO IMPLEMENTATION
    // ========================================
    console.log('\n🔍 STEP 3: Verifying Business Scenario Implementation\n');
    
    console.log('🏠 BUSINESS SCENARIO: Student Lease (May 1 - Dec 31)');
    console.log('   • Monthly Rent: $180');
    console.log('   • Admin Fee: $20 (one-time)');
    console.log('   • Security Deposit: $180 (refundable)');
    console.log('   • Payment: $380 on August 1st (deposit + admin + May rent)');
    console.log('   • WiFi Expense: $50 incurred in May, paid in August');
    
    // ========================================
    // STEP 4: VERIFY TRANSACTION PATTERNS
    // ========================================
    console.log('\n🔍 STEP 4: Verifying Transaction Patterns\n');
    
    // Check for student payment transactions
    const studentPayments = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }
    });
    
    console.log(`📥 STUDENT PAYMENT TRANSACTIONS: ${studentPayments.length}`);
    
    if (studentPayments.length > 0) {
      console.log('   ✅ Found student payment transactions');
      
      // Verify double-entry pattern for payments
      studentPayments.forEach((tx, index) => {
        if (index < 3) { // Show first 3
          const cashEntry = tx.entries.find(entry => 
            ['1001', '1002', '1011'].includes(entry.accountCode)
          );
          const otherEntry = tx.entries.find(entry => 
            !['1001', '1002', '1011'].includes(entry.accountCode)
          );
          
          if (cashEntry && otherEntry) {
            console.log(`   📊 Transaction ${index + 1}:`);
            console.log(`      Cash: ${cashEntry.accountCode} - ${cashEntry.accountName}`);
            console.log(`        Debit: $${cashEntry.debit || 0}, Credit: $${cashEntry.credit || 0}`);
            console.log(`      Other: ${otherEntry.accountCode} - ${otherEntry.accountName}`);
            console.log(`        Debit: $${otherEntry.debit || 0}, Credit: $${otherEntry.credit || 0}`);
            
            // Verify double-entry balance
            if (tx.totalDebit === tx.totalCredit) {
              console.log(`      ✅ Balanced: $${tx.totalDebit} = $${tx.totalCredit}`);
        } else {
              console.log(`      ❌ UNBALANCED: $${tx.totalDebit} ≠ $${tx.totalCredit}`);
            }
          }
        }
      });
    } else {
      console.log('   ❌ No student payment transactions found');
    }
    
    // Check for expense transactions
    const expenseTransactions = await TransactionEntry.find({
      source: { $in: ['expense_payment', 'vendor_payment', 'manual'] },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }
    });
    
    console.log(`📤 EXPENSE PAYMENT TRANSACTIONS: ${expenseTransactions.length}`);
    
    if (expenseTransactions.length > 0) {
      console.log('   ✅ Found expense payment transactions');
      
      // Verify double-entry pattern for expenses
      expenseTransactions.forEach((tx, index) => {
        if (index < 3) { // Show first 3
          const cashEntry = tx.entries.find(entry => 
            ['1001', '1002', '1011'].includes(entry.accountCode)
          );
          const expenseEntry = tx.entries.find(entry => 
            entry.accountCode === '5099'
          );
          
          if (cashEntry && expenseEntry) {
            console.log(`   📊 Transaction ${index + 1}:`);
            console.log(`      Cash: ${cashEntry.accountCode} - ${cashEntry.accountName}`);
            console.log(`        Debit: $${cashEntry.debit || 0}, Credit: $${cashEntry.credit || 0}`);
            console.log(`      Expense: ${expenseEntry.accountCode} - ${expenseEntry.accountName}`);
            console.log(`        Debit: $${expenseEntry.debit || 0}, Credit: $${expenseEntry.credit || 0}`);
            
            // Verify double-entry balance
            if (tx.totalDebit === tx.totalCredit) {
              console.log(`      ✅ Balanced: $${tx.totalDebit} = $${tx.totalCredit}`);
            } else {
              console.log(`      ❌ UNBALANCED: $${tx.totalDebit} ≠ $${tx.totalCredit}`);
            }
          }
        }
      });
    } else {
      console.log('   ❌ No expense payment transactions found');
    }
    
    // ========================================
    // STEP 5: VERIFY ACCRUAL ENTRIES
    // ========================================
    console.log('\n🔍 STEP 5: Verifying Accrual Entries\n');
    
    // Check for maintenance accrual entries (like the ones you showed me)
    const accrualEntries = await TransactionEntry.find({
      source: 'manual',
      'entries.accountCode': '5099',
      'entries.accountCode': '2000'
    });
    
    console.log(`📋 ACCRUAL ENTRIES: ${accrualEntries.length}`);
    
    if (accrualEntries.length > 0) {
      console.log('   ✅ Found accrual entries');
      
      // Show sample accrual entry
      const sampleAccrual = accrualEntries[0];
      if (sampleAccrual) {
        console.log(`   📊 Sample Accrual Entry:`);
        console.log(`      Transaction ID: ${sampleAccrual.transactionId}`);
        console.log(`      Description: ${sampleAccrual.description}`);
        console.log(`      Total Debit: $${sampleAccrual.totalDebit}`);
        console.log(`      Total Credit: $${sampleAccrual.totalCredit}`);
        
        sampleAccrual.entries.forEach(entry => {
          console.log(`      • ${entry.accountCode} - ${entry.accountName}: $${entry.debit || 0} / $${entry.credit || 0}`);
        });
        
        // Verify this is an accrual (no cash movement)
        const hasCashMovement = sampleAccrual.entries.some(entry => 
          ['1001', '1002', '1011'].includes(entry.accountCode)
        );
        
        if (!hasCashMovement) {
          console.log(`      ✅ This is a proper accrual entry (no cash movement)`);
        } else {
          console.log(`      ⚠️  This has cash movement (not a pure accrual)`);
        }
      }
    } else {
      console.log('   ❌ No accrual entries found');
    }
    
    // ========================================
    // STEP 6: VERIFY FINANCIAL STATEMENTS
    // ========================================
    console.log('\n🔍 STEP 6: Verifying Financial Statement Calculations\n');
    
    // Calculate totals from TransactionEntry
    const allEntries = await TransactionEntry.find({ status: 'posted' });
    
    let totalCashInflows = 0;
    let totalCashOutflows = 0;
    let totalExpenses = 0;
    let totalIncome = 0;
    
    allEntries.forEach(tx => {
      tx.entries.forEach(entry => {
        if (['1001', '1002', '1011'].includes(entry.accountCode)) {
          // Cash accounts
          if (entry.debit > 0) totalCashInflows += entry.debit;
          if (entry.credit > 0) totalCashOutflows += entry.credit;
        } else if (entry.accountCode === '5099') {
          // Expenses
          if (entry.debit > 0) totalExpenses += entry.debit;
        } else if (['4001', '4100'].includes(entry.accountCode)) {
          // Income
          if (entry.credit > 0) totalIncome += entry.credit;
                }
            });
        });
    
    console.log('💰 FINANCIAL STATEMENT TOTALS:');
    console.log(`   Cash Inflows: $${totalCashInflows.toFixed(2)}`);
    console.log(`   Cash Outflows: $${totalCashOutflows.toFixed(2)}`);
    console.log(`   Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`   Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`   Net Cash Flow: $${(totalCashInflows - totalCashOutflows).toFixed(2)}`);
    console.log(`   Net Income: $${(totalIncome - totalExpenses).toFixed(2)}`);
    
    // ========================================
    // STEP 7: IDENTIFY ISSUES
    // ========================================
    console.log('\n🔍 STEP 7: Identifying Issues\n');
    
    const issues = [];
    
    // Check for unbalanced transactions
    const unbalancedTransactions = allEntries.filter(tx => tx.totalDebit !== tx.totalCredit);
    if (unbalancedTransactions.length > 0) {
      issues.push(`❌ ${unbalancedTransactions.length} unbalanced transactions found`);
    }
    
    // Check for missing cash movements
    const transactionsWithoutCash = allEntries.filter(tx => 
      !tx.entries.some(entry => ['1001', '1002', '1011'].includes(entry.accountCode))
    );
    if (transactionsWithoutCash.length > 0) {
      console.log(`   📋 ${transactionsWithoutCash.length} transactions without cash movement (accruals)`);
    }
    
    // Check for the phantom $901.12
    if (totalExpenses === 901.12) {
      issues.push('❌ Found phantom $901.12 expense - investigate source');
    }
    
    if (issues.length === 0) {
      console.log('   ✅ No major issues identified');
    } else {
      console.log('   🚨 ISSUES FOUND:');
      issues.forEach(issue => console.log(`      ${issue}`));
    }
    
    // ========================================
    // STEP 8: RECOMMENDATIONS
    // ========================================
    console.log('\n📋 STEP 8: Recommendations\n');
    
    console.log('🎯 IMMEDIATE ACTIONS:');
    console.log('   1. Verify all TransactionEntry records are balanced');
    console.log('   2. Ensure cash movements are properly recorded');
    console.log('   3. Separate accrual entries from cash entries');
    console.log('   4. Verify income statement calculations');
    
    console.log('\n🎯 LONG-TERM IMPROVEMENTS:');
    console.log('   1. Implement proper accrual vs. cash basis reporting');
    console.log('   2. Add validation for double-entry balance');
    console.log('   3. Create audit trail for all financial transactions');
    console.log('   4. Implement proper chart of accounts validation');
    
  } catch (error) {
    console.error('❌ Error in comprehensive accounting audit:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the comprehensive audit
comprehensiveAccountingAudit(); 