const mongoose = require('mongoose');

async function testAtlasConnection() {
  try {
    // Use the same connection string as the server
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://****:****@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Check recent transactions
    console.log('\n=== Checking recent transactions ===');
    const recentTxs = await TransactionEntry.find({})
      .sort({ date: -1 })
      .limit(5)
      .lean();
    
    console.log(`Found ${recentTxs.length} recent transactions:`);
    recentTxs.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   ID: ${tx._id}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Account codes:`, tx.entries?.map(e => e.accountCode) || []);
      console.log(`   Has metadata: ${!!tx.metadata}`);
      console.log(`   Metadata:`, tx.metadata);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testAtlasConnection();
