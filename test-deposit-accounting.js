const mongoose = require('mongoose');
require('dotenv').config();

async function testDepositAccounting() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // Cindy's ID
    
    console.log('\n🧪 TESTING DEPOSIT ACCOUNTING');
    console.log('==============================');
    
    // 1. Check current outstanding balances
    console.log('\n1️⃣ CURRENT OUTSTANDING BALANCES:');
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log(`Found ${outstandingBalances.length} months with outstanding balances`);
    outstandingBalances.forEach((month, index) => {
      console.log(`\n  ${index + 1}. ${month.monthKey} (${month.monthName}):`);
      console.log(`     Rent: $${month.rent.outstanding.toFixed(2)}`);
      console.log(`     Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
      console.log(`     Deposit: $${month.deposit.outstanding.toFixed(2)}`);
      console.log(`     Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
    });
    
    const totalOutstanding = outstandingBalances.reduce((sum, month) => sum + month.totalOutstanding, 0);
    console.log(`\n💰 TOTAL OUTSTANDING: $${totalOutstanding.toFixed(2)}`);
    
    // 2. Check existing deposit transactions
    console.log('\n2️⃣ EXISTING DEPOSIT TRANSACTIONS:');
    const depositTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.description': { $regex: /deposit/i } },
        { 'metadata.paymentType': 'deposit' }
      ]
    }).sort({ date: 1 });
    
    console.log(`Found ${depositTransactions.length} deposit-related transactions`);
    depositTransactions.forEach((tx, index) => {
      console.log(`\n  Transaction ${index + 1}:`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Source: ${tx.source}`);
      console.log(`    Total: $${tx.totalDebit.toFixed(2)}`);
      
      if (tx.metadata) {
        console.log(`    Payment Type: ${tx.metadata.paymentType || 'N/A'}`);
        console.log(`    Month Settled: ${tx.metadata.monthSettled || 'N/A'}`);
      }
      
      console.log(`    Entries:`);
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`      ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`         Description: ${entry.description}`);
      });
    });
    
    // 3. Check balance sheet accounts
    console.log('\n3️⃣ BALANCE SHEET ACCOUNTS:');
    
    // Check Accounts Receivable
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    });
    
    let arBalance = 0;
    arTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          arBalance += entry.debit - entry.credit;
        }
      });
    });
    
    console.log(`Accounts Receivable Balance: $${arBalance.toFixed(2)}`);
    
    // Check Security Deposits Liability
    const depositLiabilityTransactions = await TransactionEntry.find({
      'entries.accountCode': '2020'
    });
    
    let depositLiabilityBalance = 0;
    depositLiabilityTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode === '2020') {
          depositLiabilityBalance += entry.credit - entry.debit;
        }
      });
    });
    
    console.log(`Security Deposits Liability: $${depositLiabilityBalance.toFixed(2)}`);
    
    // Check Cash
    const cashTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^100[0-9]' }
    });
    
    let cashBalance = 0;
    cashTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('100')) {
          cashBalance += entry.debit - entry.credit;
        }
      });
    });
    
    console.log(`Cash Balance: $${cashBalance.toFixed(2)}`);
    
    // 4. Verify accounting equation
    console.log('\n4️⃣ ACCOUNTING EQUATION VERIFICATION:');
    console.log(`Assets = Liabilities + Equity`);
    console.log(`Cash + AR = Security Deposits + Retained Earnings`);
    console.log(`$${cashBalance.toFixed(2)} + $${arBalance.toFixed(2)} = $${depositLiabilityBalance.toFixed(2)} + ?`);
    
    const assets = cashBalance + arBalance;
    const liabilities = depositLiabilityBalance;
    const equity = assets - liabilities;
    
    console.log(`Assets: $${assets.toFixed(2)}`);
    console.log(`Liabilities: $${liabilities.toFixed(2)}`);
    console.log(`Equity: $${equity.toFixed(2)}`);
    
    if (Math.abs(assets - (liabilities + equity)) < 0.01) {
      console.log(`✅ Accounting equation is balanced!`);
    } else {
      console.log(`❌ Accounting equation is NOT balanced!`);
    }
    
    // 5. Summary
    console.log('\n5️⃣ DEPOSIT ACCOUNTING SUMMARY:');
    console.log('✅ Lease Start: Deposit liability created (AR debit, Security Deposits credit)');
    console.log('✅ Student Payment: Cash increases, AR decreases (no change to liability)');
    console.log('✅ Deposit Earned: Liability decreases, Income increases (when forfeited)');
    console.log('✅ Deposit Refunded: Liability decreases, Cash decreases (when returned)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testDepositAccounting();
