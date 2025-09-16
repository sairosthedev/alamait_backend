/**
 * Check what sources are actually used in transaction entries for August
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function checkTransactionSources() {
  try {
    console.log('🔍 Checking transaction sources for August 2025...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all transaction entries for August 2025
    const allEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${allEntries.length} total transaction entries for August 2025`);
    
    // Group by source
    const sources = new Map();
    allEntries.forEach(entry => {
      const source = entry.source || 'unknown';
      if (!sources.has(source)) {
        sources.set(source, []);
      }
      sources.get(source).push(entry);
    });
    
    console.log(`\n📋 Transaction sources found:`);
    for (const [source, entries] of sources) {
      const totalAmount = entries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
      console.log(`   ${source}: ${entries.length} entries, total: $${totalAmount.toFixed(2)}`);
    }
    
    // Check what the cash flow query is looking for
    const cashFlowSources = [
      'rental_payment',
      'expense_payment', 
      'manual',
      'payment_collection',
      'bank_transfer',
      'payment'
    ];
    
    console.log(`\n🔍 Cash flow query sources: ${cashFlowSources.join(', ')}`);
    
    // Check which entries match the cash flow query
    const cashFlowEntries = allEntries.filter(entry => 
      cashFlowSources.includes(entry.source) && 
      entry.metadata?.isForfeiture !== true
    );
    
    console.log(`\n💳 Entries matching cash flow query: ${cashFlowEntries.length}`);
    const cashFlowTotal = cashFlowEntries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
    console.log(`   Total amount: $${cashFlowTotal.toFixed(2)}`);
    
    // Show entries that don't match the cash flow query
    const nonCashFlowEntries = allEntries.filter(entry => 
      !cashFlowSources.includes(entry.source) || 
      entry.metadata?.isForfeiture === true
    );
    
    if (nonCashFlowEntries.length > 0) {
      console.log(`\n❌ Entries NOT matching cash flow query: ${nonCashFlowEntries.length}`);
      const nonCashFlowTotal = nonCashFlowEntries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
      console.log(`   Total amount: $${nonCashFlowTotal.toFixed(2)}`);
      
      // Group non-matching entries by source
      const nonMatchingSources = new Map();
      nonCashFlowEntries.forEach(entry => {
        const source = entry.source || 'unknown';
        if (!nonMatchingSources.has(source)) {
          nonMatchingSources.set(source, []);
        }
        nonMatchingSources.get(source).push(entry);
      });
      
      console.log(`\n📋 Non-matching sources:`);
      for (const [source, entries] of nonMatchingSources) {
        const totalAmount = entries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
        console.log(`   ${source}: ${entries.length} entries, total: $${totalAmount.toFixed(2)}`);
        
        // Show first few entries for each source
        entries.slice(0, 3).forEach(entry => {
          console.log(`      - ${entry.transactionId}: $${entry.totalDebit || 0} - ${entry.description}`);
        });
        if (entries.length > 3) {
          console.log(`      ... and ${entries.length - 3} more`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking transaction sources:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
checkTransactionSources();

