const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function findNegotiatedPayment() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Search for the negotiated payment transaction by different criteria
    console.log('🔍 Searching for negotiated payment transaction...');
    
    // Search by transactionId
    let tx = await TransactionEntry.findOne({ transactionId: 'NEG-1757465405612' });
    if (tx) {
      console.log('✅ Found by transactionId:', tx._id);
    } else {
      console.log('❌ Not found by transactionId');
    }
    
    // Search by description
    tx = await TransactionEntry.findOne({ description: { $regex: /student asked/i } });
    if (tx) {
      console.log('✅ Found by description:', tx._id, tx.transactionId);
    } else {
      console.log('❌ Not found by description');
    }
    
    // Search by source manual
    const manualTxs = await TransactionEntry.find({ source: 'manual' });
    console.log(`📋 Found ${manualTxs.length} manual transactions:`);
    manualTxs.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.transactionId} - ${tx.description} (${tx.date})`);
    });
    
    // Search for any transaction with the specific A/R account
    const arTxs = await TransactionEntry.find({ 
      'entries.accountCode': '1100-68c0a3ffad46285698184f3f' 
    });
    console.log(`\n📋 Found ${arTxs.length} transactions with A/R account 1100-68c0a3ffad46285698184f3f:`);
    arTxs.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.transactionId} - ${tx.description} (${tx.date})`);
      console.log(`   Source: ${tx.source}, Status: ${tx.status}`);
    });
    
    // Get total count of transactions
    const totalCount = await TransactionEntry.countDocuments();
    console.log(`\n📊 Total transactions in database: ${totalCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

findNegotiatedPayment();
