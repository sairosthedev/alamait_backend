const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');

async function cleanupCorruptedTransactions() {
  try {
    console.log('🔍 Starting cleanup of corrupted transactions...');
    
    // Find all transaction entries
    const allEntries = await TransactionEntry.find({});
    console.log(`📊 Found ${allEntries.length} total transaction entries`);
    
    // Identify corrupted entries (those without proper data)
    const corruptedEntries = allEntries.filter(entry => 
      !entry.transactionId || 
      !entry.description || 
      !entry.source || 
      !entry.sourceModel ||
      !entry.entries ||
      entry.entries.length === 0
    );
    
    const validEntries = allEntries.filter(entry => 
      entry.transactionId && 
      entry.description && 
      entry.source && 
      entry.sourceModel &&
      entry.entries &&
      entry.entries.length > 0
    );
    
    console.log(`📊 Valid entries: ${validEntries.length}`);
    console.log(`📊 Corrupted entries: ${corruptedEntries.length}`);
    
    if (corruptedEntries.length === 0) {
      console.log('✅ No corrupted entries found. Database is clean!');
      return;
    }
    
    // Show sample of corrupted entries
    console.log('\n📋 Sample corrupted entries:');
    corruptedEntries.slice(0, 3).forEach((entry, index) => {
      console.log(`${index + 1}. ID: ${entry._id}`);
      console.log(`   Transaction ID: ${entry.transactionId}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   Source: ${entry.source}`);
      console.log(`   Entries count: ${entry.entries?.length || 0}`);
    });
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete corrupted transaction entries.');
    console.log(`   ${corruptedEntries.length} entries will be deleted.`);
    console.log('   This action cannot be undone!');
    
    // For safety, we'll just show what would be deleted instead of actually deleting
    console.log('\n🔍 SAFETY MODE: Showing what would be deleted (no actual deletion)');
    console.log('   To actually delete, uncomment the deletion code in the script');
    
    // Uncomment the following lines to actually perform the deletion:
    /*
    console.log('\n🗑️  Deleting corrupted entries...');
    const deleteResult = await TransactionEntry.deleteMany({
      $or: [
        { transactionId: { $exists: false } },
        { transactionId: null },
        { description: { $exists: false } },
        { description: null },
        { source: { $exists: false } },
        { source: null },
        { sourceModel: { $exists: false } },
        { sourceModel: null },
        { entries: { $exists: false } },
        { entries: { $size: 0 } }
      ]
    });
    
    console.log(`✅ Deleted ${deleteResult.deletedCount} corrupted entries`);
    */
    
    // Verify remaining entries
    const remainingEntries = await TransactionEntry.find({});
    console.log(`📊 Remaining entries after cleanup: ${remainingEntries.length}`);
    
    if (remainingEntries.length > 0) {
      console.log('\n📋 Remaining valid entries:');
      remainingEntries.forEach((entry, index) => {
        console.log(`${index + 1}. ID: ${entry._id}`);
        console.log(`   Transaction ID: ${entry.transactionId}`);
        console.log(`   Description: ${entry.description}`);
        console.log(`   Source: ${entry.source}`);
        console.log(`   Entries count: ${entry.entries?.length || 0}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

cleanupCorruptedTransactions(); 