const mongoose = require('mongoose');
require('dotenv').config();

async function debugStudentTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68adf1dc088169424e25c8a9'; // Cindy's ID
    
    // Get all transactions for this student
    const allTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    }).sort({ date: 1 });
    
    console.log(`\n🔍 All transactions for student ${studentId}:`);
    console.log(`Found ${allTransactions.length} total transactions`);
    
    allTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Total Debit: $${tx.totalDebit}`);
      console.log(`   Total Credit: $${tx.totalCredit}`);
      
      // Show AR entries
      const arEntries = tx.entries.filter(e => e.accountCode.startsWith('1100-'));
      if (arEntries.length > 0) {
        console.log(`   AR Entries:`);
        arEntries.forEach(entry => {
          if (entry.debit > 0) {
            console.log(`     - Debit: $${entry.debit} (${entry.description})`);
          }
          if (entry.credit > 0) {
            console.log(`     - Credit: $${entry.credit} (${entry.description})`);
          }
        });
      }
      
      if (tx.metadata) {
        console.log(`   Metadata:`, JSON.stringify(tx.metadata, null, 2));
      }
    });
    
    // Now let's see what the Smart FIFO system finds
    console.log('\n🔍 Testing Smart FIFO outstanding balances:');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log('\n📊 What Smart FIFO found:');
    console.log(`Found ${outstandingBalances.length} months with outstanding balances`);
    
    outstandingBalances.forEach(month => {
      console.log(`\n  ${month.monthKey} (${month.monthName}):`);
      console.log(`    Transaction ID: ${month.transactionId}`);
      console.log(`    Date: ${month.date}`);
      console.log(`    Rent: $${month.rent.outstanding.toFixed(2)}`);
      console.log(`    Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
      console.log(`    Deposit: $${month.deposit.outstanding.toFixed(2)}`);
      console.log(`    Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugStudentTransactions();
