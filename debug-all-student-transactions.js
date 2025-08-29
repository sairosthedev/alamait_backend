const mongoose = require('mongoose');
require('dotenv').config();

async function debugAllStudentTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68adf1dc088169424e25c8a9'; // Cindy's ID
    
    // Find ALL transactions for this student
    const allTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    }).sort({ date: 1 });
    
    console.log(`\n🔍 Found ${allTransactions.length} total transactions for student ${studentId}:`);
    
    allTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Total Debit: $${tx.totalDebit}`);
      console.log(`   Total Credit: $${tx.totalCredit}`);
      
      if (tx.metadata) {
        console.log(`   Metadata Type: ${tx.metadata.type || 'NOT SET'}`);
        console.log(`   Has Prorated Rent: ${tx.metadata.proratedRent ? 'YES' : 'NO'}`);
        console.log(`   Has Admin Fee: ${tx.metadata.adminFee ? 'YES' : 'NO'}`);
        console.log(`   Has Security Deposit: ${tx.metadata.securityDeposit ? 'YES' : 'NO'}`);
      }
      
      console.log(`   Entries:`);
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode.startsWith('1100-')) {
          console.log(`     Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.description}`);
          console.log(`       Debit: $${entry.debit}, Credit: $${entry.credit}`);
        }
      });
    });
    
    // Check what sources we have
    const sources = [...new Set(allTransactions.map(tx => tx.source))];
    console.log(`\n📊 Transaction Sources: ${sources.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugAllStudentTransactions();
