const mongoose = require('mongoose');

async function updateGenericTransactions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Find payment transactions without monthSettled
    console.log('\n=== Finding payment transactions without monthSettled ===');
    const paymentTxs = await TransactionEntry.find({
      source: 'payment',
      $or: [
        { 'metadata.monthSettled': { $exists: false } },
        { 'metadata.monthSettled': null }
      ]
    }).lean();
    
    console.log(`Found ${paymentTxs.length} payment transactions without monthSettled`);
    
    let updatedCount = 0;
    for (const tx of paymentTxs) {
      // Extract month from the transaction date
      const txDate = new Date(tx.date);
      const monthSettled = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      
      console.log(`- ${tx.description} (${txDate.toISOString().split('T')[0]}) -> monthSettled: ${monthSettled}`);
      
      // Update the transaction
      await TransactionEntry.findByIdAndUpdate(tx._id, {
        $set: {
          'metadata.monthSettled': monthSettled
        }
      });
      updatedCount++;
    }
    
    console.log(`\n✅ Updated ${updatedCount} transactions with monthSettled metadata`);
    
    // Verify the updates
    console.log('\n=== Verifying updates ===');
    const updatedTxs = await TransactionEntry.find({
      'metadata.monthSettled': { $exists: true }
    }).sort({ date: -1 }).lean();
    
    console.log(`Found ${updatedTxs.length} transactions with monthSettled metadata`);
    updatedTxs.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]}) - monthSettled: ${tx.metadata?.monthSettled}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateGenericTransactions();
