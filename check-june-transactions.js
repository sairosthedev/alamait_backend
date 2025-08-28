const mongoose = require('mongoose');
require('dotenv').config();

async function checkJuneTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Find June 2025 AR transactions for Cindy
    const juneTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' },
      date: { 
        $gte: new Date('2025-06-01'), 
        $lt: new Date('2025-07-01') 
      }
    });
    
    console.log('\n📅 June 2025 AR Transactions for Cindy:');
    console.log(`Found ${juneTransactions.length} transactions`);
    
    juneTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Source: ${tx.source}`);
      
      // Find AR entry (debit to AR account)
      const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0);
      if (arEntry) {
        console.log(`   AR Amount: $${arEntry.debit}`);
        console.log(`   Account: ${arEntry.accountCode} - ${arEntry.accountName}`);
      }
      
      // Show metadata if available
      if (tx.metadata) {
        console.log(`   Metadata:`, JSON.stringify(tx.metadata, null, 2));
      }
    });
    
    // Also check for any lease_start transactions that might have prorated rent
    const leaseStartTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' },
      source: 'lease_start',
      date: { 
        $gte: new Date('2025-06-01'), 
        $lt: new Date('2025-07-01') 
      }
    });
    
    if (leaseStartTransactions.length > 0) {
      console.log('\n🏠 Lease Start Transactions (might contain prorated rent):');
      leaseStartTransactions.forEach((tx, index) => {
        console.log(`\n${index + 1}. Lease Start Transaction: ${tx._id}`);
        console.log(`   Date: ${tx.date}`);
        console.log(`   Description: ${tx.description}`);
        
        const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0);
        if (arEntry) {
          console.log(`   AR Amount: $${arEntry.debit}`);
        }
        
        if (tx.metadata) {
          console.log(`   Metadata:`, JSON.stringify(tx.metadata, null, 2));
        }
      });
    }
    
    // Check what the system thinks is outstanding for June
    console.log('\n🔍 Checking what the Smart FIFO system sees for June:');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances('68adf1dc088169424e25c8ab');
    
    const juneBalance = outstandingBalances.find(b => b.monthKey === '2025-06');
    if (juneBalance) {
      console.log('\n📊 June 2025 Balance (as seen by Smart FIFO):');
      console.log(`   Month: ${juneBalance.monthKey} (${juneBalance.monthName})`);
      console.log(`   Rent Owed: $${juneBalance.rent.owed}`);
      console.log(`   Rent Paid: $${juneBalance.rent.paid}`);
      console.log(`   Rent Outstanding: $${juneBalance.rent.outstanding}`);
      console.log(`   Total Outstanding: $${juneBalance.totalOutstanding}`);
      console.log(`   Transaction ID: ${juneBalance.transactionId}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkJuneTransactions();
