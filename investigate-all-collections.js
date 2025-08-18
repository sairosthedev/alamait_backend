const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigateAllCollections() {
  try {
    console.log('🔍 Investigating All Collections for Balance Sheet Imbalance...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`  - ${col.name}`));

    console.log('\n🔍 INVESTIGATING TRANSACTIONENTRIES COLLECTION:');
    console.log('=====================================');

    // Check TransactionEntry collection structure
    const sampleTransaction = await TransactionEntry.findOne();
    if (sampleTransaction) {
      console.log('📋 Sample Transaction Structure:');
      console.log(`  - _id: ${sampleTransaction._id}`);
      console.log(`  - date: ${sampleTransaction.date}`);
      console.log(`  - source: ${sampleTransaction.source}`);
      console.log(`  - description: ${sampleTransaction.description}`);
      console.log(`  - entries count: ${sampleTransaction.entries?.length || 0}`);
      
      if (sampleTransaction.entries && sampleTransaction.entries.length > 0) {
        console.log('  - First entry structure:');
        const firstEntry = sampleTransaction.entries[0];
        console.log(`    * accountCode: ${firstEntry.accountCode}`);
        console.log(`    * accountName: ${firstEntry.accountName}`);
        console.log(`    * accountType: ${firstEntry.accountType}`);
        console.log(`    * debit: ${firstEntry.debit}`);
        console.log(`    * credit: ${firstEntry.credit}`);
      }
    }

    // Count total transactions
    const totalTransactions = await TransactionEntry.countDocuments();
    console.log(`\n📊 Total TransactionEntry documents: ${totalTransactions}`);

    // Check for transactions with missing or invalid data
    const invalidTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': { $exists: false } },
        { 'entries.accountName': { $exists: false } },
        { 'entries.accountType': { $exists: false } },
        { 'entries.debit': { $exists: false } },
        { 'entries.credit': { $exists: false } }
      ]
    });
    console.log(`⚠️ Transactions with missing data: ${invalidTransactions.length}`);

    // Check for transactions with zero amounts
    const zeroAmountTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.debit': 0 },
        { 'entries.credit': 0 }
      ]
    });
    console.log(`⚠️ Transactions with zero amounts: ${zeroAmountTransactions.length}`);

    // Check for transactions with negative amounts
    const negativeAmountTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.debit': { $lt: 0 } },
        { 'entries.credit': { $lt: 0 } }
      ]
    });
    console.log(`⚠️ Transactions with negative amounts: ${negativeAmountTransactions.length}`);

    console.log('\n🔍 CHECKING FOR UNBALANCED TRANSACTIONS:');
    console.log('=====================================');

    // Check for transactions where debits ≠ credits
    const unbalancedTransactions = [];
    const transactions = await TransactionEntry.find().sort({ date: 1 });
    
    transactions.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        let totalDebit = 0;
        let totalCredit = 0;
        
        tx.entries.forEach(entry => {
          totalDebit += entry.debit || 0;
          totalCredit += entry.credit || 0;
        });
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          unbalancedTransactions.push({
            _id: tx._id,
            date: tx.date,
            source: tx.source,
            description: tx.description,
            totalDebit,
            totalCredit,
            difference: totalDebit - totalCredit
          });
        }
      }
    });

    console.log(`📊 Found ${unbalancedTransactions.length} unbalanced transactions:`);
    if (unbalancedTransactions.length > 0) {
      unbalancedTransactions.slice(0, 10).forEach(tx => {
        console.log(`  - ${new Date(tx.date).toLocaleDateString()}: ${tx.description}`);
        console.log(`    Debit: $${tx.totalDebit}, Credit: $${tx.totalCredit}, Diff: $${tx.difference}`);
      });
      if (unbalancedTransactions.length > 10) {
        console.log(`  ... and ${unbalancedTransactions.length - 10} more`);
      }
    }

    console.log('\n🔍 CHECKING FOR MISSING ACCOUNT TYPES:');
    console.log('=====================================');

    // Check for entries with missing account types
    const missingAccountTypes = await TransactionEntry.find({
      'entries.accountType': { $exists: false }
    });
    console.log(`⚠️ Entries with missing accountType: ${missingAccountTypes.length}`);

    // Check for entries with invalid account types
    const validAccountTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
    const invalidAccountTypes = await TransactionEntry.find({
      'entries.accountType': { $nin: validAccountTypes }
    });
    console.log(`⚠️ Entries with invalid accountType: ${invalidAccountTypes.length}`);

    console.log('\n🔍 CHECKING FOR DUPLICATE OR INVALID ACCOUNT CODES:');
    console.log('=====================================');

    // Get all unique account codes
    const accountCodes = new Set();
    const accountNames = new Set();
    
    transactions.forEach(tx => {
      if (tx.entries) {
        tx.entries.forEach(entry => {
          if (entry.accountCode) accountCodes.add(entry.accountCode);
          if (entry.accountName) accountNames.add(entry.accountName);
        });
      }
    });

    console.log(`📊 Unique account codes: ${accountCodes.size}`);
    console.log(`📊 Unique account names: ${accountNames.size}`);

    // Check for account codes that might be causing issues
    const suspiciousAccounts = [];
    transactions.forEach(tx => {
      if (tx.entries) {
        tx.entries.forEach(entry => {
          if (entry.accountCode && (entry.accountCode.length < 2 || entry.accountCode.length > 10)) {
            suspiciousAccounts.push({
              code: entry.accountCode,
              name: entry.accountName,
              type: entry.accountType
            });
          }
        });
      }
    });

    if (suspiciousAccounts.length > 0) {
      console.log(`⚠️ Suspicious account codes found: ${suspiciousAccounts.length}`);
      suspiciousAccounts.slice(0, 5).forEach(acc => {
        console.log(`  - Code: "${acc.code}", Name: "${acc.name}", Type: "${acc.type}"`);
      });
    }

    console.log('\n🔍 CHECKING FOR TRANSACTIONS OUTSIDE 2025:');
    console.log('=====================================');

    // Check for transactions outside the expected date range
    const transactionsOutside2025 = await TransactionEntry.find({
      $or: [
        { date: { $lt: new Date('2025-01-01') } },
        { date: { $gt: new Date('2025-12-31') } }
      ]
    });
    console.log(`⚠️ Transactions outside 2025: ${transactionsOutside2025.length}`);

    if (transactionsOutside2025.length > 0) {
      transactionsOutside2025.slice(0, 5).forEach(tx => {
        console.log(`  - ${new Date(tx.date).toLocaleDateString()}: ${tx.description}`);
      });
    }

    console.log('\n🔍 CHECKING FOR MISSING RESIDENCE REFERENCES:');
    console.log('=====================================');

    // Check for transactions without residence
    const transactionsWithoutResidence = await TransactionEntry.find({
      residence: { $exists: false }
    });
    console.log(`⚠️ Transactions without residence: ${transactionsWithoutResidence.length}`);

    // Check for transactions with null residence
    const transactionsWithNullResidence = await TransactionEntry.find({
      residence: null
    });
    console.log(`⚠️ Transactions with null residence: ${transactionsWithNullResidence.length}`);

    console.log('\n🔍 SUMMARY OF POTENTIAL ISSUES:');
    console.log('=====================================');
    console.log(`1. Unbalanced transactions: ${unbalancedTransactions.length}`);
    console.log(`2. Missing account types: ${missingAccountTypes.length}`);
    console.log(`3. Invalid account types: ${invalidAccountTypes.length}`);
    console.log(`4. Transactions outside 2025: ${transactionsOutside2025.length}`);
    console.log(`5. Missing residence references: ${transactionsWithoutResidence.length}`);
    console.log(`6. Null residence references: ${transactionsWithNullResidence.length}`);

    if (unbalancedTransactions.length > 0) {
      console.log('\n🚨 CRITICAL: Unbalanced transactions will cause balance sheet imbalance!');
      console.log('These transactions must be fixed for the balance sheet to balance.');
    }

    // Check other collections for any relevant data
    console.log('\n🔍 CHECKING OTHER COLLECTIONS:');
    console.log('=====================================');

    for (const collection of collections) {
      if (collection.name !== 'transactionentries') {
        try {
          const count = await mongoose.connection.db.collection(collection.name).countDocuments();
          console.log(`📊 ${collection.name}: ${count} documents`);
          
          // Check if this collection might contain financial data
          if (count > 0 && count < 100) {
            const sample = await mongoose.connection.db.collection(collection.name).findOne();
            if (sample) {
              const keys = Object.keys(sample);
              if (keys.some(key => 
                key.toLowerCase().includes('amount') || 
                key.toLowerCase().includes('balance') || 
                key.toLowerCase().includes('debit') || 
                key.toLowerCase().includes('credit') ||
                key.toLowerCase().includes('account')
              )) {
                console.log(`  ⚠️ Potential financial data found in ${collection.name}`);
                console.log(`    Sample keys: ${keys.slice(0, 10).join(', ')}`);
              }
            }
          }
        } catch (error) {
          console.log(`❌ Error checking ${collection.name}: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error investigating collections:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

investigateAllCollections();
