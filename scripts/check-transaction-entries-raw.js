const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const TransactionEntry = require('../src/models/TransactionEntry');

async function checkTransactionEntriesRaw() {
  try {
    console.log('\n🔍 RAW TRANSACTION ENTRY ANALYSIS');
    console.log('==================================\n');
    
    // Get total count
    const totalCount = await TransactionEntry.countDocuments();
    console.log(`📊 Total TransactionEntry records: ${totalCount}\n`);
    
    if (totalCount > 0) {
      // Get a sample record to see the structure
      const sampleRecord = await TransactionEntry.findOne();
      console.log('📋 SAMPLE RECORD STRUCTURE:');
      console.log('─'.repeat(50));
      console.log(JSON.stringify(sampleRecord, null, 2));
      
      // Check what fields exist
      console.log('\n🔍 FIELD ANALYSIS:');
      console.log('─'.repeat(30));
      
      const fields = Object.keys(sampleRecord._doc);
      console.log(`📊 Total fields: ${fields.length}`);
      fields.forEach(field => {
        const value = sampleRecord[field];
        const type = typeof value;
        const isNull = value === null;
        const isUndefined = value === undefined;
        
        console.log(`   ${field.padEnd(25)} | Type: ${type.padEnd(10)} | Value: ${isNull ? 'NULL' : isUndefined ? 'UNDEFINED' : String(value).substring(0, 50)}`);
      });
      
      // Check for specific fields we're looking for
      console.log('\n🔍 SPECIFIC FIELD CHECK:');
      console.log('─'.repeat(30));
      
      const importantFields = ['accountCode', 'accountName', 'debit', 'credit', 'amount', 'source', 'description', 'date'];
      importantFields.forEach(field => {
        if (sampleRecord.hasOwnProperty(field)) {
          const value = sampleRecord[field];
          console.log(`   ${field.padEnd(15)}: ${value !== null && value !== undefined ? '✅ ' + String(value) : '❌ NULL/UNDEFINED'}`);
        } else {
          console.log(`   ${field.padEnd(15)}: ❌ FIELD NOT FOUND`);
        }
      });
      
      // Check if there are any records with accountCode
      console.log('\n🔍 ACCOUNT CODE SEARCH:');
      console.log('─'.repeat(30));
      
      const recordsWithAccountCode = await TransactionEntry.find({ accountCode: { $exists: true, $ne: null } });
      console.log(`📊 Records with accountCode field: ${recordsWithAccountCode.length}`);
      
      if (recordsWithAccountCode.length > 0) {
        console.log('\n📋 RECORDS WITH ACCOUNT CODE:');
        recordsWithAccountCode.slice(0, 5).forEach((record, index) => {
          console.log(`\n${index + 1}. Account Code: ${record.accountCode}`);
          console.log(`   Account Name: ${record.accountName || 'N/A'}`);
          console.log(`   Amount: $${record.amount || 'N/A'}`);
          console.log(`   Date: ${record.date || 'N/A'}`);
        });
      }
      
      // Check if there are any records with accountName
      console.log('\n🔍 ACCOUNT NAME SEARCH:');
      console.log('─'.repeat(30));
      
      const recordsWithAccountName = await TransactionEntry.find({ accountName: { $exists: true, $ne: null } });
      console.log(`📊 Records with accountName field: ${recordsWithAccountName.length}`);
      
      if (recordsWithAccountName.length > 0) {
        console.log('\n📋 RECORDS WITH ACCOUNT NAME:');
        recordsWithAccountName.slice(0, 5).forEach((record, index) => {
          console.log(`\n${index + 1}. Account Name: ${record.accountName}`);
          console.log(`   Account Code: ${record.accountCode || 'N/A'}`);
          console.log(`   Amount: $${record.amount || 'N/A'}`);
          console.log(`   Date: ${record.date || 'N/A'}`);
        });
      }
      
    } else {
      console.log('❌ No TransactionEntry records found');
    }
    
  } catch (error) {
    console.error('❌ Error checking transaction entries raw:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkTransactionEntriesRaw();
