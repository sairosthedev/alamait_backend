const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkTransactionStructure() {
  try {
    console.log('🔍 Checking transaction entry structure...');
    
    const transactionEntries = await TransactionEntry.find({}).limit(5);
    
    console.log(`📊 Found ${transactionEntries.length} sample entries:`);
    
    transactionEntries.forEach((entry, index) => {
      console.log(`\n--- Entry ${index + 1} ---`);
      console.log(`ID: ${entry._id}`);
      console.log(`Description: ${entry.description}`);
      console.log(`Source: ${entry.source} (type: ${typeof entry.source})`);
      console.log(`Source Model: ${entry.sourceModel}`);
      console.log(`Date: ${entry.date}`);
      console.log(`Transaction ID: ${entry.transactionId}`);
      console.log(`Created At: ${entry.createdAt}`);
      console.log(`Updated At: ${entry.updatedAt}`);
      
      // Check if source is a valid ObjectId
      if (typeof entry.source === 'string') {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(entry.source);
        console.log(`Is source a valid ObjectId? ${isValidObjectId}`);
      }
    });
    
    // Check unique source values
    const uniqueSources = await TransactionEntry.distinct('source');
    console.log(`\n📋 Unique source values:`, uniqueSources);
    
    // Check unique source models
    const uniqueSourceModels = await TransactionEntry.distinct('sourceModel');
    console.log(`📋 Unique source models:`, uniqueSourceModels);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

checkTransactionStructure(); 