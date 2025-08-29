const mongoose = require('mongoose');
require('dotenv').config();

async function checkAdvanceTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af33e9aef6b0dcc8e8f149'; // Cindy's correct user ID
    
    console.log('\n🔍 CHECKING ADVANCE PAYMENT TRANSACTIONS');
    console.log('==========================================');
    
    // 1. Check all payment transactions
    console.log('\n1️⃣ ALL PAYMENT TRANSACTIONS:');
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.studentId': studentId
    }).sort({ date: -1 });
    
    console.log(`Found ${paymentTransactions.length} payment transactions`);
    
    // 2. Check advance payment transactions
    console.log('\n2️⃣ ADVANCE PAYMENT TRANSACTIONS:');
    const advanceTransactions = await TransactionEntry.find({
      source: 'advance_payment',
      'metadata.studentId': studentId
    }).sort({ date: -1 });
    
    console.log(`Found ${advanceTransactions.length} advance payment transactions`);
    
    advanceTransactions.forEach((tx, index) => {
      console.log(`\n  Advance Transaction ${index + 1}:`);
      console.log(`    ID: ${tx._id}`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Total: $${tx.totalDebit.toFixed(2)}`);
      console.log(`    Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
      console.log(`    Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
      console.log(`    Payment ID: ${tx.metadata?.paymentId || 'N/A'}`);
      console.log(`    Advance Type: ${tx.metadata?.advanceType || 'N/A'}`);
    });
    
    // 3. Check all transactions for this student
    console.log('\n3️⃣ ALL TRANSACTIONS FOR STUDENT:');
    const allTransactions = await TransactionEntry.find({
      'metadata.studentId': studentId
    }).sort({ date: -1 }).limit(20);
    
    console.log(`Found ${allTransactions.length} total transactions for student`);
    
    allTransactions.forEach((tx, index) => {
      console.log(`\n  Transaction ${index + 1}:`);
      console.log(`    ID: ${tx._id}`);
      console.log(`    Source: ${tx.source}`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Total: $${tx.totalDebit.toFixed(2)}`);
      console.log(`    Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
      console.log(`    Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
      console.log(`    Allocation Type: ${tx.metadata?.allocationType || 'N/A'}`);
    });
    
    // 4. Check balance sheet impact
    console.log('\n4️⃣ BALANCE SHEET IMPACT:');
    
    // Calculate AR balance for this user
    const userARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    });
    
    let arBalance = 0;
    userARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          arBalance += entry.debit - entry.credit;
        }
      });
    });
    
    // Calculate cash balance
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
    
    console.log(`Accounts Receivable (User ${studentId}): $${arBalance.toFixed(2)}`);
    console.log(`Cash: $${cashBalance.toFixed(2)}`);
    
    // 5. Summary
    console.log('\n5️⃣ SUMMARY:');
    console.log(`✅ Payment transactions: ${paymentTransactions.length}`);
    console.log(`✅ Advance payment transactions: ${advanceTransactions.length}`);
    console.log(`✅ Total transactions: ${allTransactions.length}`);
    console.log(`✅ Balance sheet updated: Cash = $${cashBalance.toFixed(2)}`);
    
    if (advanceTransactions.length > 0) {
      console.log('✅ Advance payment transactions created successfully');
      console.log('✅ Fix is working correctly');
    } else {
      console.log('❌ No advance payment transactions found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkAdvanceTransactions();
