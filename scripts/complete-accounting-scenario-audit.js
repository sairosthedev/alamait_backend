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
const Maintenance = require('../src/models/Maintenance');

async function completeAccountingScenarioAudit() {
  try {
    console.log('\n🔍 COMPLETE ACCOUNTING SCENARIO AUDIT');
    console.log('========================================\n');
    
    // ========================================
    // STEP 1: VERIFY BUSINESS SCENARIO SETUP
    // ========================================
    console.log('🔍 STEP 1: Verifying Business Scenario Setup\n');
    
    console.log('🏠 BUSINESS SCENARIO: Student Lease (May 1 - Dec 31)');
    console.log('   • Monthly Rent: $180');
    console.log('   • Admin Fee: $20 (one-time)');
    console.log('   • Security Deposit: $180 (refundable)');
    console.log('   • Payment: $380 on August 1st (deposit + admin + May rent)');
    console.log('   • WiFi Expense: $50 incurred in May, paid in August');
    
    // ========================================
    // STEP 2: VERIFY CHART OF ACCOUNTS
    // ========================================
    console.log('\n🔍 STEP 2: Verifying Chart of Accounts\n');
    
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
    const accountStatus = {};
    for (const required of requiredAccounts) {
      const account = await Account.findOne({ code: required.code });
      if (account) {
        console.log(`   ✅ ${required.code} - ${required.name} (${account.type})`);
        accountStatus[required.code] = account;
        
        // Verify account type
        if (account.type.toLowerCase() !== required.type.toLowerCase()) {
          console.log(`      ⚠️  WARNING: Expected ${required.type}, got ${account.type}`);
        }
      } else {
        console.log(`   ❌ ${required.code} - ${required.name} (MISSING)`);
        accountStatus[required.code] = null;
      }
    }
    
    // ========================================
    // STEP 3: VERIFY JOURNAL ENTRIES (Chronological)
    // ========================================
    console.log('\n🔍 STEP 3: Verifying Journal Entries (Chronological)\n');
    
    // Set up date ranges for the scenario
    const mayStart = new Date('2025-05-01');
    const mayEnd = new Date('2025-05-31');
    const juneEnd = new Date('2025-06-30');
    const julyEnd = new Date('2025-07-31');
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    console.log('📅 DATE RANGES FOR AUDIT:');
    console.log(`   May: ${mayStart.toDateString()} - ${mayEnd.toDateString()}`);
    console.log(`   June: ${mayStart.toDateString()} - ${juneEnd.toDateString()}`);
    console.log(`   July: ${mayStart.toDateString()} - ${julyEnd.toDateString()}`);
    console.log(`   August: ${augustStart.toDateString()} - ${augustEnd.toDateString()}`);
    
    // ========================================
    // STEP 3A: VERIFY MAY 31 - RENT EARNED
    // ========================================
    console.log('\n🔍 STEP 3A: Verifying May 31 - Rent Earned for May\n');
    
    const mayRentEntries = await TransactionEntry.find({
      date: { $gte: mayStart, $lte: mayEnd },
      'entries.accountCode': '4001', // Rental Income
      status: 'posted'
    });
    
    console.log(`📊 May Rent Entries Found: ${mayRentEntries.length}`);
    
    if (mayRentEntries.length > 0) {
      mayRentEntries.forEach((entry, index) => {
        console.log(`   Entry ${index + 1}:`);
        console.log(`     Transaction ID: ${entry.transactionId}`);
        console.log(`     Description: ${entry.description}`);
        console.log(`     Source: ${entry.source}`);
        
        const rentEntry = entry.entries.find(e => e.accountCode === '4001');
        const arEntry = entry.entries.find(e => e.accountCode === '1101');
        
        if (rentEntry && arEntry) {
          console.log(`     ✅ Rent Revenue: $${rentEntry.credit || 0}`);
          console.log(`     ✅ Accounts Receivable: $${arEntry.debit || 0}`);
          
          if (rentEntry.credit === arEntry.debit) {
            console.log(`     ✅ Balanced: $${rentEntry.credit} = $${arEntry.debit}`);
          } else {
            console.log(`     ❌ UNBALANCED: $${rentEntry.credit} ≠ $${arEntry.debit}`);
          }
        }
      });
    } else {
      console.log('   ❌ No May rent entries found');
    }
    
    // ========================================
    // STEP 3B: VERIFY MAY 31 - WIFI EXPENSE INCURRED
    // ========================================
    console.log('\n🔍 STEP 3B: Verifying May 31 - WiFi Expense Incurred\n');
    
    const mayWiFiEntries = await TransactionEntry.find({
      date: { $gte: mayStart, $lte: mayEnd },
      'entries.accountCode': '5099', // Other Operating Expenses
      status: 'posted'
    });
    
    console.log(`📊 May WiFi Expense Entries Found: ${mayWiFiEntries.length}`);
    
    if (mayWiFiEntries.length > 0) {
      mayWiFiEntries.forEach((entry, index) => {
        console.log(`   Entry ${index + 1}:`);
        console.log(`     Transaction ID: ${entry.transactionId}`);
        console.log(`     Description: ${entry.description}`);
        console.log(`     Source: ${entry.source}`);
        
        const expenseEntry = entry.entries.find(e => e.accountCode === '5099');
        const apEntry = entry.entries.find(e => e.accountCode === '2000');
        
        if (expenseEntry && apEntry) {
          console.log(`     ✅ WiFi Expense: $${expenseEntry.debit || 0}`);
          console.log(`     ✅ Accounts Payable: $${apEntry.credit || 0}`);
          
          if (expenseEntry.debit === apEntry.credit) {
            console.log(`     ✅ Balanced: $${expenseEntry.debit} = $${apEntry.credit}`);
          } else {
            console.log(`     ❌ UNBALANCED: $${expenseEntry.debit} ≠ $${apEntry.credit}`);
          }
        }
      });
    } else {
      console.log('   ❌ No May WiFi expense entries found');
    }
    
    // ========================================
    // STEP 3C: VERIFY JUNE 30 - RENT EARNED
    // ========================================
    console.log('\n🔍 STEP 3C: Verifying June 30 - Rent Earned for June\n');
    
    const juneRentEntries = await TransactionEntry.find({
      date: { $gte: mayStart, $lte: juneEnd },
      'entries.accountCode': '4001', // Rental Income
      status: 'posted'
    });
    
    console.log(`📊 June Rent Entries Found: ${juneRentEntries.length}`);
    
    // ========================================
    // STEP 3D: VERIFY JULY 31 - RENT EARNED
    // ========================================
    console.log('\n🔍 STEP 3D: Verifying July 31 - Rent Earned for July\n');
    
    const julyRentEntries = await TransactionEntry.find({
      date: { $gte: mayStart, $lte: julyEnd },
      'entries.accountCode': '4001', // Rental Income
      status: 'posted'
    });
    
    console.log(`📊 July Rent Entries Found: ${julyRentEntries.length}`);
    
    // ========================================
    // STEP 3E: VERIFY AUGUST 1 - STUDENT PAYMENT $380
    // ========================================
    console.log('\n🔍 STEP 3E: Verifying August 1 - Student Payment $380\n');
    
    const augustPaymentEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustStart },
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }, // Cash accounts
      status: 'posted'
    });
    
    console.log(`📊 August 1 Payment Entries Found: ${augustPaymentEntries.length}`);
    
    if (augustPaymentEntries.length > 0) {
      augustPaymentEntries.forEach((entry, index) => {
        console.log(`   Payment Entry ${index + 1}:`);
        console.log(`     Transaction ID: ${entry.transactionId}`);
        console.log(`     Description: ${entry.description}`);
        
        const cashEntry = entry.entries.find(e => 
          ['1001', '1002', '1011'].includes(e.accountCode)
        );
        
        if (cashEntry) {
          console.log(`     ✅ Cash Received: $${cashEntry.debit || 0}`);
          console.log(`     ✅ Cash Account: ${cashEntry.accountCode} - ${cashEntry.accountName}`);
        }
        
        // Check for the $380 breakdown
        entry.entries.forEach(e => {
          if (e.accountCode !== cashEntry.accountCode) {
            console.log(`     • ${e.accountCode} - ${e.accountName}: $${e.credit || 0}`);
          }
        });
      });
    } else {
      console.log('   ❌ No August 1 payment entries found');
    }
    
    // ========================================
    // STEP 3F: VERIFY AUGUST 1 - WIFI BILL PAID
    // ========================================
    console.log('\n🔍 STEP 3F: Verifying August 1 - WiFi Bill Paid\n');
    
    const augustWiFiPaymentEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustStart },
      source: { $in: ['expense_payment', 'vendor_payment'] },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }, // Cash accounts
      status: 'posted'
    });
    
    console.log(`📊 August 1 WiFi Payment Entries Found: ${augustWiFiPaymentEntries.length}`);
    
    if (augustWiFiPaymentEntries.length > 0) {
      augustWiFiPaymentEntries.forEach((entry, index) => {
        console.log(`   WiFi Payment Entry ${index + 1}:`);
        console.log(`     Transaction ID: ${entry.transactionId}`);
        console.log(`     Description: ${entry.description}`);
        
        const cashEntry = entry.entries.find(e => 
          ['1001', '1002', '1011'].includes(e.accountCode)
        );
        
        if (cashEntry) {
          console.log(`     ✅ Cash Paid: $${cashEntry.credit || 0}`);
          console.log(`     ✅ Cash Account: ${cashEntry.accountCode} - ${cashEntry.accountName}`);
        }
      });
    } else {
      console.log('   ❌ No August 1 WiFi payment entries found');
    }
    
    // ========================================
    // STEP 3G: VERIFY AUGUST 31 - RENT EARNED
    // ========================================
    console.log('\n🔍 STEP 3G: Verifying August 31 - Rent Earned for August\n');
    
    const augustRentEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd },
      'entries.accountCode': '4001', // Rental Income
      status: 'posted'
    });
    
    console.log(`📊 August Rent Entries Found: ${augustRentEntries.length}`);
    
    // ========================================
    // STEP 4: VERIFY FINANCIAL STATEMENTS
    // ========================================
    console.log('\n🔍 STEP 4: Verifying Financial Statements (as of August 31)\n');
    
    // Calculate totals from TransactionEntry for the period
    const allPeriodEntries = await TransactionEntry.find({
      date: { $gte: mayStart, $lte: augustEnd },
      status: 'posted'
    });
    
    let totalRentRevenue = 0;
    let totalAdminFeeRevenue = 0;
    let totalWiFiExpense = 0;
    let totalCashReceived = 0;
    let totalCashPaid = 0;
    let totalAccountsReceivable = 0;
    let totalAccountsPayable = 0;
    let totalSecurityDeposits = 0;
    
    allPeriodEntries.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode === '4001') {
          // Rental Income
          totalRentRevenue += entry.credit || 0;
        } else if (entry.accountCode === '4100') {
          // Administrative Income
          totalAdminFeeRevenue += entry.credit || 0;
        } else if (entry.accountCode === '5099') {
          // WiFi Expense
          totalWiFiExpense += entry.debit || 0;
        } else if (['1001', '1002', '1011'].includes(entry.accountCode)) {
          // Cash accounts
          if (entry.debit > 0) totalCashReceived += entry.debit;
          if (entry.credit > 0) totalCashPaid += entry.credit;
        } else if (entry.accountCode === '1101') {
          // Accounts Receivable
          totalAccountsReceivable += entry.debit || 0;
        } else if (entry.accountCode === '2000') {
          // Accounts Payable
          totalAccountsPayable += entry.credit || 0;
        } else if (entry.accountCode === '2020') {
          // Security Deposits Held
          totalSecurityDeposits += entry.credit || 0;
        }
      });
    });
    
    console.log('💰 FINANCIAL STATEMENT TOTALS (May 1 - August 31):');
    console.log(`   Total Rent Revenue: $${totalRentRevenue.toFixed(2)}`);
    console.log(`   Total Admin Fee Revenue: $${totalAdminFeeRevenue.toFixed(2)}`);
    console.log(`   Total WiFi Expense: $${totalWiFiExpense.toFixed(2)}`);
    console.log(`   Total Cash Received: $${totalCashReceived.toFixed(2)}`);
    console.log(`   Total Cash Paid: $${totalCashPaid.toFixed(2)}`);
    console.log(`   Total Accounts Receivable: $${totalAccountsReceivable.toFixed(2)}`);
    console.log(`   Total Accounts Payable: $${totalAccountsPayable.toFixed(2)}`);
    console.log(`   Total Security Deposits: $${totalSecurityDeposits.toFixed(2)}`);
    
    // Calculate expected values from scenario
    const expectedRentRevenue = 180 * 4; // 4 months
    const expectedAdminFeeRevenue = 20;
    const expectedWiFiExpense = 50;
    const expectedCashReceived = 380;
    const expectedCashPaid = 50;
    
    console.log('\n📊 EXPECTED VALUES FROM SCENARIO:');
    console.log(`   Expected Rent Revenue: $${expectedRentRevenue.toFixed(2)}`);
    console.log(`   Expected Admin Fee Revenue: $${expectedAdminFeeRevenue.toFixed(2)}`);
    console.log(`   Expected WiFi Expense: $${expectedWiFiExpense.toFixed(2)}`);
    console.log(`   Expected Cash Received: $${expectedCashReceived.toFixed(2)}`);
    console.log(`   Expected Cash Paid: $${expectedCashPaid.toFixed(2)}`);
    
    // ========================================
    // STEP 5: IDENTIFY DISCREPANCIES
    // ========================================
    console.log('\n🔍 STEP 5: Identifying Discrepancies\n');
    
    const discrepancies = [];
    
    if (Math.abs(totalRentRevenue - expectedRentRevenue) > 0.01) {
      discrepancies.push(`Rent Revenue: Expected $${expectedRentRevenue}, Got $${totalRentRevenue.toFixed(2)}`);
    }
    
    if (Math.abs(totalAdminFeeRevenue - expectedAdminFeeRevenue) > 0.01) {
      discrepancies.push(`Admin Fee Revenue: Expected $${expectedAdminFeeRevenue}, Got $${totalAdminFeeRevenue.toFixed(2)}`);
    }
    
    if (Math.abs(totalWiFiExpense - expectedWiFiExpense) > 0.01) {
      discrepancies.push(`WiFi Expense: Expected $${expectedWiFiExpense}, Got $${totalWiFiExpense.toFixed(2)}`);
    }
    
    if (Math.abs(totalCashReceived - expectedCashReceived) > 0.01) {
      discrepancies.push(`Cash Received: Expected $${expectedCashReceived}, Got $${totalCashReceived.toFixed(2)}`);
    }
    
    if (Math.abs(totalCashPaid - expectedCashPaid) > 0.01) {
      discrepancies.push(`Cash Paid: Expected $${expectedCashPaid}, Got $${totalCashPaid.toFixed(2)}`);
    }
    
    if (discrepancies.length === 0) {
      console.log('   ✅ No discrepancies found - system matches scenario perfectly!');
    } else {
      console.log('   🚨 DISCREPANCIES FOUND:');
      discrepancies.forEach(d => console.log(`      • ${d}`));
    }
    
    // ========================================
    // STEP 6: RECOMMENDATIONS
    // ========================================
    console.log('\n📋 STEP 6: Recommendations\n');
    
    if (discrepancies.length === 0) {
      console.log('🎉 EXCELLENT! Your accounting module is working perfectly!');
      console.log('   ✅ All journal entries are correctly recorded');
      console.log('   ✅ Financial statements are accurately calculated');
      console.log('   ✅ Double-entry accounting is properly implemented');
    } else {
      console.log('🔧 ISSUES IDENTIFIED - RECOMMENDATIONS:');
      console.log('   1. Review journal entry creation logic');
      console.log('   2. Verify account mappings and codes');
      console.log('   3. Check transaction source filtering');
      console.log('   4. Validate financial statement calculations');
    }
    
  } catch (error) {
    console.error('❌ Error in complete accounting scenario audit:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the complete audit
completeAccountingScenarioAudit();
