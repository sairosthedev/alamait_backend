const mongoose = require('mongoose');

async function checkSpecificTransactions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Check the specific transactions mentioned by the user
    console.log('\n=== Checking specific transactions ===');
    
    // Find transactions with descriptions containing "2025-05" or "2025-06"
    const specificTxs = await TransactionEntry.find({
      description: { $regex: /2025-0[56]/ }
    }).sort({ date: -1 }).lean();
    
    console.log(`Found ${specificTxs.length} transactions with month references:`);
    specificTxs.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]})`);
      console.log(`  ID: ${tx._id}`);
      console.log(`  monthSettled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`  Source: ${tx.source}`);
      console.log('');
    });
    
    // Also check for transactions with "Payment allocation" in description
    const allocationTxs = await TransactionEntry.find({
      description: { $regex: /Payment allocation/ }
    }).sort({ date: -1 }).lean();
    
    console.log(`\n=== Payment allocation transactions ===`);
    console.log(`Found ${allocationTxs.length} payment allocation transactions:`);
    allocationTxs.forEach(tx => {
      const date = new Date(tx.date);
      console.log(`- ${tx.description} (${date.toISOString().split('T')[0]})`);
      console.log(`  ID: ${tx._id}`);
      console.log(`  monthSettled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`  Source: ${tx.source}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSpecificTransactions();
