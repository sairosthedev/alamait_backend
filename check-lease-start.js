const mongoose = require('mongoose');
require('dotenv').config();

async function checkLeaseStart() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Find lease_start transaction for Cindy
    const leaseStartTx = await TransactionEntry.findOne({
      'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' },
      source: 'lease_start'
    });
    
    if (leaseStartTx) {
      console.log('\n🏠 Lease Start Transaction Found:');
      console.log('ID:', leaseStartTx._id);
      console.log('Date:', leaseStartTx.date);
      console.log('Description:', leaseStartTx.description);
      console.log('Source:', leaseStartTx.source);
      
      if (leaseStartTx.metadata) {
        console.log('\n📋 Metadata:');
        console.log(JSON.stringify(leaseStartTx.metadata, null, 2));
      }
      
      console.log('\n💰 AR Entries:');
      leaseStartTx.entries.forEach((entry, index) => {
        if (entry.accountCode.startsWith('1100-')) {
          console.log(`  ${index + 1}. Account: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`     Type: ${entry.accountType}`);
          console.log(`     Debit: $${entry.debit}`);
          console.log(`     Credit: $${entry.credit}`);
          console.log(`     Description: ${entry.description}`);
        }
      });
      
      // Check if this transaction date falls in June
      const txDate = new Date(leaseStartTx.date);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      console.log(`\n📅 Transaction Month: ${monthKey}`);
      
    } else {
      console.log('\n❌ No lease_start transaction found for Cindy');
      
      // Check what sources exist for Cindy's AR
      const sources = await TransactionEntry.distinct('source', {
        'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' }
      });
      
      console.log('\n📊 Available sources for Cindy\'s AR:');
      sources.forEach(source => {
        console.log(`  - ${source}`);
      });
    }
    
    // Also check if there are any transactions with prorated rent in metadata
    const proratedTx = await TransactionEntry.findOne({
      'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' },
      'metadata.proratedRent': { $exists: true, $gt: 0 }
    });
    
    if (proratedTx) {
      console.log('\n🎯 Found transaction with prorated rent:');
      console.log('ID:', proratedTx._id);
      console.log('Date:', proratedTx.date);
      console.log('Description:', proratedTx.description);
      console.log('Prorated Rent:', proratedTx.metadata.proratedRent);
    } else {
      console.log('\n❌ No prorated rent transactions found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkLeaseStart();
