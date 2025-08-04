const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');

async function listTransactionEntries() {
  try {
    console.log('🔍 Listing all transaction entries...');
    
    const entries = await TransactionEntry.find({}).sort({ date: -1 });
    
    console.log(`📊 Found ${entries.length} transaction entries`);
    
    // Count entries with and without entries array
    const entriesWithData = entries.filter(entry => entry.entries && entry.entries.length > 0);
    const entriesWithoutData = entries.filter(entry => !entry.entries || entry.entries.length === 0);
    
    console.log(`📊 Entries with data: ${entriesWithData.length}`);
    console.log(`📊 Entries without data: ${entriesWithoutData.length}`);
    
    if (entriesWithData.length > 0) {
      console.log('\n📋 First few entries with data:');
      entriesWithData.slice(0, 3).forEach((entry, index) => {
        console.log(`\n${index + 1}. Entry ID: ${entry._id}`);
        console.log(`   Transaction ID: ${entry.transactionId}`);
        console.log(`   Date: ${entry.date}`);
        console.log(`   Description: ${entry.description}`);
        console.log(`   Source: ${entry.source}`);
        console.log(`   SourceModel: ${entry.sourceModel}`);
        console.log(`   Entries count: ${entry.entries?.length || 0}`);
        if (entry.entries && entry.entries.length > 0) {
          console.log(`   First entry: ${entry.entries[0].accountName} - Debit: ${entry.entries[0].debit}, Credit: ${entry.entries[0].credit}`);
        }
      });
    }
    
    if (entriesWithoutData.length > 0) {
      console.log('\n📋 Sample entries without data:');
      entriesWithoutData.slice(0, 3).forEach((entry, index) => {
        console.log(`\n${index + 1}. Entry ID: ${entry._id}`);
        console.log(`   Transaction ID: ${entry.transactionId}`);
        console.log(`   Date: ${entry.date}`);
        console.log(`   Description: ${entry.description}`);
        console.log(`   Source: ${entry.source}`);
        console.log(`   SourceModel: ${entry.sourceModel}`);
        console.log(`   Entries count: ${entry.entries?.length || 0}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

listTransactionEntries(); 