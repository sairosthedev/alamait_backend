const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const TransactionEntry = require('../src/models/TransactionEntry');

async function checkTransactionEntriesStructure() {
  try {
    console.log('\n🔍 TRANSACTION ENTRY STRUCTURE ANALYSIS');
    console.log('========================================\n');
    
    // Get total count
    const totalCount = await TransactionEntry.countDocuments();
    console.log(`📊 Total TransactionEntry records: ${totalCount}\n`);
    
    if (totalCount > 0) {
      // Get a few sample records to see different structures
      const sampleRecords = await TransactionEntry.find({}).limit(5);
      
      console.log('📋 SAMPLE RECORDS ANALYSIS:');
      console.log('─'.repeat(80));
      
      sampleRecords.forEach((record, index) => {
        console.log(`\n${index + 1}. RECORD ${index + 1}:`);
        console.log(`   📝 Description: ${record.description}`);
        console.log(`   🔗 Source: ${record.source} (${record.sourceModel})`);
        console.log(`   📅 Date: ${record.date.toDateString()}`);
        console.log(`   💰 Total Debit: $${record.totalDebit}, Total Credit: $${record.totalCredit}`);
        console.log(`   📊 Status: ${record.status}`);
        
        if (record.entries && Array.isArray(record.entries)) {
          console.log(`   📋 Entries (${record.entries.length}):`);
          record.entries.forEach((entry, entryIndex) => {
            console.log(`      ${entryIndex + 1}. Account: ${entry.accountCode} (${entry.accountName})`);
            console.log(`         Type: ${entry.accountType}`);
            console.log(`         Debit: $${entry.debit}, Credit: $${entry.credit}`);
            console.log(`         Description: ${entry.description}`);
          });
        } else {
          console.log(`   ❌ No entries array found`);
        }
      });
      
      // Check for deferred income related transactions
      console.log('\n🔍 LOOKING FOR DEFERRED INCOME TRANSACTIONS:');
      console.log('─'.repeat(50));
      
      const deferredIncomeTransactions = await TransactionEntry.find({
        $or: [
          { description: { $regex: /deferred|unearned|advance/i } },
          { 'entries.accountName': { $regex: /deferred|unearned|advance/i } }
        ]
      });
      
      console.log(`📊 Total deferred income related transactions: ${deferredIncomeTransactions.length}\n`);
      
      if (deferredIncomeTransactions.length > 0) {
        console.log('📋 DEFERRED INCOME TRANSACTIONS:');
        console.log('─'.repeat(80));
        
        deferredIncomeTransactions.forEach((transaction, index) => {
          console.log(`\n${index + 1}. ${transaction.date.toDateString()} - ${transaction.description}`);
          console.log(`   🔗 Source: ${transaction.source} (${transaction.sourceModel})`);
          
          if (transaction.entries && Array.isArray(transaction.entries)) {
            transaction.entries.forEach((entry, entryIndex) => {
              console.log(`   📋 Entry ${entryIndex + 1}: ${entry.accountCode} (${entry.accountName})`);
              console.log(`      💰 Debit: $${entry.debit}, Credit: $${entry.credit}`);
            });
          }
        });
      }
      
      // Check for payment transactions
      console.log('\n🔍 PAYMENT TRANSACTIONS:');
      console.log('─'.repeat(30));
      
      const paymentTransactions = await TransactionEntry.find({ source: 'payment' }).limit(5);
      console.log(`📊 Sample payment transactions (showing first 5):`);
      
      if (paymentTransactions.length > 0) {
        paymentTransactions.forEach((transaction, index) => {
          console.log(`\n${index + 1}. ${transaction.date.toDateString()} - ${transaction.description}`);
          console.log(`   💰 Total Debit: $${transaction.totalDebit}, Total Credit: $${transaction.totalCredit}`);
          
          if (transaction.entries && Array.isArray(transaction.entries)) {
            transaction.entries.forEach((entry, entryIndex) => {
              console.log(`   📋 Entry ${entryIndex + 1}: ${entry.accountCode} (${entry.accountName})`);
              console.log(`      💰 Debit: $${entry.debit}, Credit: $${entry.credit}`);
            });
          }
        });
      }
      
      // Check for rental accrual transactions
      console.log('\n🔍 RENTAL ACCRUAL TRANSACTIONS:');
      console.log('─'.repeat(40));
      
      const rentalAccrualTransactions = await TransactionEntry.find({ source: 'rental_accrual' }).limit(5);
      console.log(`📊 Sample rental accrual transactions (showing first 5):`);
      
      if (rentalAccrualTransactions.length > 0) {
        rentalAccrualTransactions.forEach((transaction, index) => {
          console.log(`\n${index + 1}. ${transaction.date.toDateString()} - ${transaction.description}`);
          console.log(`   💰 Total Debit: $${transaction.totalDebit}, Total Credit: $${transaction.totalCredit}`);
          
          if (transaction.entries && Array.isArray(transaction.entries)) {
            transaction.entries.forEach((entry, entryIndex) => {
              console.log(`   📋 Entry ${entryIndex + 1}: ${entry.accountCode} (${entry.accountName})`);
              console.log(`      💰 Debit: $${entry.debit}, Credit: $${entry.credit}`);
            });
          }
        });
      }
      
    } else {
      console.log('❌ No TransactionEntry records found');
    }
    
  } catch (error) {
    console.error('❌ Error checking transaction entries structure:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkTransactionEntriesStructure();
