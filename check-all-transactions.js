const mongoose = require('mongoose');

async function checkAllTransactions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Check all recent transactions
    console.log('\n=== All recent transactions ===');
    
    const allTxs = await TransactionEntry.find({})
      .sort({ date: -1 })
      .limit(20)
      .lean();
    
    console.log(`Found ${allTxs.length} recent transactions:`);
    allTxs.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]})`);
      console.log(`  ID: ${tx._id}`);
      console.log(`  Source: ${tx.source}`);
      console.log(`  monthSettled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`  Total: $${tx.totalDebit}`);
      console.log('');
    });
    
    // Check payment transactions specifically
    console.log('\n=== Payment transactions ===');
    const paymentTxs = await TransactionEntry.find({
      source: 'payment'
    }).sort({ date: -1 }).lean();
    
    console.log(`Found ${paymentTxs.length} payment transactions:`);
    paymentTxs.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]})`);
      console.log(`  ID: ${tx._id}`);
      console.log(`  monthSettled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`  Total: $${tx.totalDebit}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllTransactions();
