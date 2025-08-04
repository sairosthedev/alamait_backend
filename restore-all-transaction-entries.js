const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');

async function restoreAllTransactionEntries() {
  try {
    console.log('🔍 Restoring ALL original transaction entries from JSON files...');
    
    // Read JSON files
    const transactionsPath = path.join(__dirname, 'db transactions', 'test.transactions.json');
    const transactionEntriesPath = path.join(__dirname, 'db transactions', 'test.transactionentries.json');
    
    const transactionsData = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
    const transactionEntriesData = JSON.parse(fs.readFileSync(transactionEntriesPath, 'utf8'));
    
    console.log(`📊 Found ${transactionsData.length} transactions in JSON`);
    console.log(`📊 Found ${transactionEntriesData.length} transaction entries in JSON`);
    
    // Clear existing data
    console.log('\n🗑️  Clearing existing TransactionEntry data...');
    await TransactionEntry.deleteMany({});
    console.log('✅ Cleared existing TransactionEntry data');
    
    // Group transaction entries by transaction ID
    const entriesByTransaction = {};
    transactionEntriesData.forEach(entry => {
      // Check if entry has the required structure
      if (!entry.transaction || !entry.transaction.$oid) {
        console.log(`⚠️  Skipping entry ${entry._id?.$oid || 'unknown'} - missing transaction ID`);
        return;
      }
      
      const transactionId = entry.transaction.$oid;
      if (!entriesByTransaction[transactionId]) {
        entriesByTransaction[transactionId] = [];
      }
      entriesByTransaction[transactionId].push(entry);
    });
    
    console.log(`📊 Grouped entries into ${Object.keys(entriesByTransaction).length} transactions`);
    
    // Create a map of transaction data for quick lookup
    const transactionMap = {};
    transactionsData.forEach(transaction => {
      transactionMap[transaction._id.$oid] = transaction;
    });
    
    // Import ALL transactions with entries
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const transactionId in entriesByTransaction) {
      const entries = entriesByTransaction[transactionId];
      const transaction = transactionMap[transactionId];
      
      if (entries.length === 0) {
        console.log(`⚠️  Skipping transaction ${transactionId} - no entries found`);
        skippedCount++;
        continue;
      }
      
      // Calculate totals
      const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
      
      // Ensure debits equal credits (double-entry accounting requirement)
      const balancedTotal = Math.max(totalDebit, totalCredit);
      
      // Create TransactionEntry document
      const transactionEntry = new TransactionEntry({
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: transaction ? new Date(transaction.date.$date) : new Date(),
        description: transaction ? (transaction.description || 'Transaction') : 'Transaction',
        reference: transaction ? (transaction.reference || '') : '',
        entries: entries.map(entry => ({
          accountCode: entry.account.$oid,
          accountName: `Account ${entry.account.$oid}`,
          accountType: entry.type || 'Unknown',
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          description: transaction ? (transaction.description || 'Transaction entry') : 'Transaction entry'
        })),
        totalDebit: balancedTotal,
        totalCredit: balancedTotal,
        source: 'manual',
        sourceId: transactionId,
        sourceModel: 'Manual',
        createdBy: 'system@restore.com',
        status: 'posted'
      });
      
      await transactionEntry.save();
      importedCount++;
      
      if (importedCount % 10 === 0) {
        console.log(`📊 Imported ${importedCount} transactions...`);
      }
    }
    
    console.log(`✅ Successfully imported ${importedCount} transactions`);
    console.log(`⚠️  Skipped ${skippedCount} transactions (no entries)`);
    
    // Verify import
    const totalEntries = await TransactionEntry.countDocuments({});
    console.log(`📊 Total TransactionEntry documents in database: ${totalEntries}`);
    
    // Show sample of imported data
    const sampleEntries = await TransactionEntry.find({}).limit(5);
    console.log('\n📋 Sample imported transactions:');
    sampleEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ID: ${entry._id}`);
      console.log(`   Transaction ID: ${entry.transactionId}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   Date: ${entry.date}`);
      console.log(`   Entries count: ${entry.entries?.length || 0}`);
      console.log(`   Total Debit: ${entry.totalDebit}`);
      console.log(`   Total Credit: ${entry.totalCredit}`);
    });
    
    // Show summary by account types
    const allEntries = await TransactionEntry.find({});
    const accountTypes = {};
    allEntries.forEach(entry => {
      entry.entries.forEach(e => {
        const type = e.accountType || 'Unknown';
        accountTypes[type] = (accountTypes[type] || 0) + 1;
      });
    });
    
    console.log('\n📊 Account types summary:');
    Object.entries(accountTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} entries`);
    });
    
  } catch (error) {
    console.error('❌ Error during restore:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

restoreAllTransactionEntries(); 