const mongoose = require('mongoose');

async function checkAugustAR() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Check for transactions with monthSettled metadata
    console.log('\n=== Transactions with monthSettled metadata ===');
    const monthSettledTxs = await TransactionEntry.find({
      'metadata.monthSettled': { $exists: true }
    }).sort({ date: -1 }).lean();
    
    console.log(`Found ${monthSettledTxs.length} transactions with monthSettled metadata`);
    monthSettledTxs.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]}) - monthSettled: ${tx.metadata?.monthSettled}`);
      if (tx.entries) {
        tx.entries.forEach(e => {
          if (e.accountCode && e.accountCode.startsWith('1100')) {
            console.log(`  ${e.accountCode}: Dr ${e.debit || 0}, Cr ${e.credit || 0}`);
          }
        });
      }
    });
    
    // Check for recent payment transactions (last 7 days)
    console.log('\n=== Recent Payment Transactions (last 7 days) ===');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPayments = await TransactionEntry.find({
      source: 'payment',
      date: { $gte: sevenDaysAgo }
    }).sort({ date: -1 }).lean();
    
    console.log(`Found ${recentPayments.length} recent payment transactions`);
    recentPayments.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]})`);
      console.log(`  metadata:`, tx.metadata);
      if (tx.entries) {
        tx.entries.forEach(e => {
          if (e.accountCode && e.accountCode.startsWith('1100')) {
            console.log(`  ${e.accountCode}: Dr ${e.debit || 0}, Cr ${e.credit || 0}`);
          }
        });
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAugustAR();
