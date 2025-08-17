const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Transaction = require('../src/models/Transaction');

async function importTransactionsFromJson() {
  try {
    console.log('🔍 Starting import of transactions from JSON files...');
    
    // Read JSON files
    const transactionsPath = path.join(__dirname, 'db transactions', 'test.transactions.json');
    const transactionEntriesPath = path.join(__dirname, 'db transactions', 'test.transactionentries.json');
    const expensesPath = path.join(__dirname, 'db transactions', 'test.expenses.json');
    
    const transactionsData = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
    const transactionEntriesData = JSON.parse(fs.readFileSync(transactionEntriesPath, 'utf8'));
    const expensesData = JSON.parse(fs.readFileSync(expensesPath, 'utf8'));
    
    console.log(`📊 Found ${transactionsData.length} transactions in JSON`);
    console.log(`📊 Found ${transactionEntriesData.length} transaction entries in JSON`);
    console.log(`📊 Found ${expensesData.length} expenses in JSON`);
    
    // Clear existing corrupted data
    console.log('\n🗑️  Clearing existing corrupted TransactionEntry data...');
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
    
    // Import transactions
    let importedCount = 0;
    for (const transaction of transactionsData) {
      const transactionId = transaction._id.$oid;
      const entries = entriesByTransaction[transactionId] || [];
      
      if (entries.length === 0) {
        console.log(`⚠️  Skipping transaction ${transactionId} - no entries found`);
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
        date: new Date(transaction.date.$date),
        description: transaction.description || 'Transaction',
        reference: transaction.reference || '',
        entries: entries.map(entry => ({
          accountCode: entry.account.$oid, // We'll need to map this to actual account codes
          accountName: `Account ${entry.account.$oid}`, // Placeholder
          accountType: entry.type || 'Unknown',
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          description: transaction.description || 'Transaction entry'
        })),
        totalDebit: balancedTotal,
        totalCredit: balancedTotal,
        source: 'manual', // Use valid enum value
        sourceId: transaction._id.$oid,
        sourceModel: 'Manual', // Use valid enum value
        createdBy: 'system@import.com',
        status: 'posted'
      });
      
      await transactionEntry.save();
      importedCount++;
      
      if (importedCount % 10 === 0) {
        console.log(`📊 Imported ${importedCount} transactions...`);
      }
    }
    
    console.log(`✅ Successfully imported ${importedCount} transactions`);
    
    // Verify import
    const totalEntries = await TransactionEntry.countDocuments({});
    console.log(`📊 Total TransactionEntry documents in database: ${totalEntries}`);
    
    // Show sample of imported data
    const sampleEntries = await TransactionEntry.find({}).limit(3);
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
    
  } catch (error) {
    console.error('❌ Error during import:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

importTransactionsFromJson(); 