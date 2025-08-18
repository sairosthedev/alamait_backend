const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigateImbalanceSource() {
  try {
    console.log('🔍 Investigating Source of $3,004.50 Imbalance...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🔍 CHECKING TRANSACTIONS OUTSIDE 2025:');
    console.log('=====================================');
    
    const transactionsOutside2025 = await TransactionEntry.find({
      $or: [
        { date: { $lt: new Date('2025-01-01') } },
        { date: { $gt: new Date('2025-12-31') } }
      ]
    }).sort({ date: 1 });

    console.log(`📊 Found ${transactionsOutside2025.length} transactions outside 2025:`);
    
    transactionsOutside2025.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${new Date(tx.date).toLocaleDateString()}: ${tx.description}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Residence: ${tx.residence || 'NULL'}`);
      console.log(`   Entries:`);
      
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIndex) => {
          console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName} (${entry.accountType})`);
          console.log(`        Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
        });
      }
    });

    console.log('\n🔍 CHECKING TRANSACTIONS WITH MISSING RESIDENCE:');
    console.log('=====================================');
    
    const transactionsWithoutResidence = await TransactionEntry.find({
      $or: [
        { residence: { $exists: false } },
        { residence: null }
      ]
    }).sort({ date: 1 });

    console.log(`📊 Found ${transactionsWithoutResidence.length} transactions without residence:`);
    
    transactionsWithoutResidence.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${new Date(tx.date).toLocaleDateString()}: ${tx.description}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Residence: ${tx.residence || 'NULL'}`);
      console.log(`   Entries:`);
      
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIndex) => {
          console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName} (${entry.accountType})`);
          console.log(`        Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
        });
      }
    });

    console.log('\n🔍 CHECKING OTHER FINANCIAL COLLECTIONS:');
    console.log('=====================================');

    // Check expenses collection
    console.log('\n📊 EXPENSES COLLECTION:');
    const expensesCollection = mongoose.connection.db.collection('expenses');
    const expensesCount = await expensesCollection.countDocuments();
    console.log(`Total expenses: ${expensesCount}`);
    
    if (expensesCount > 0) {
      const sampleExpenses = await expensesCollection.find().limit(3).toArray();
      sampleExpenses.forEach((expense, index) => {
        console.log(`\nExpense ${index + 1}:`);
        console.log(`  ID: ${expense._id}`);
        console.log(`  Amount: $${expense.amount}`);
        console.log(`  Category: ${expense.category}`);
        console.log(`  Description: ${expense.description}`);
        console.log(`  Date: ${expense.expenseDate}`);
        console.log(`  Residence: ${expense.residence}`);
      });
    }

    // Check liabilities collection
    console.log('\n📊 LIABILITIES COLLECTION:');
    const liabilitiesCollection = mongoose.connection.db.collection('liabilities');
    const liabilitiesCount = await liabilitiesCollection.countDocuments();
    console.log(`Total liabilities: ${liabilitiesCount}`);
    
    if (liabilitiesCount > 0) {
      const sampleLiabilities = await liabilitiesCollection.find().limit(3).toArray();
      sampleLiabilities.forEach((liability, index) => {
        console.log(`\nLiability ${index + 1}:`);
        console.log(`  ID: ${liability._id}`);
        console.log(`  Amount: $${liability.amount}`);
        console.log(`  Type: ${liability.type}`);
        console.log(`  Category: ${liability.category}`);
        console.log(`  Entity: ${liability.entity}`);
      });
    }

    // Check equity collection
    console.log('\n📊 EQUITY COLLECTION:');
    const equityCollection = mongoose.connection.db.collection('equity');
    const equityCount = await equityCollection.countDocuments();
    console.log(`Total equity entries: ${equityCount}`);
    
    if (equityCount > 0) {
      const sampleEquity = await equityCollection.find().limit(3).toArray();
      sampleEquity.forEach((equity, index) => {
        console.log(`\nEquity ${index + 1}:`);
        console.log(`  ID: ${equity._id}`);
        console.log(`  Amount: $${equity.amount}`);
        console.log(`  Type: ${equity.type}`);
        console.log(`  Category: ${equity.category}`);
        console.log(`  Entity: ${equity.entity}`);
      });
    }

    // Check assets collection
    console.log('\n📊 ASSETS COLLECTION:');
    const assetsCollection = mongoose.connection.db.collection('assets');
    const assetsCount = await assetsCollection.countDocuments();
    console.log(`Total assets: ${assetsCount}`);
    
    if (assetsCount > 0) {
      const sampleAssets = await assetsCollection.find().limit(3).toArray();
      sampleAssets.forEach((asset, index) => {
        console.log(`\nAsset ${index + 1}:`);
        console.log(`  ID: ${asset._id}`);
        console.log(`  Amount: $${asset.amount}`);
        console.log(`  Type: ${asset.type}`);
        console.log(`  Category: ${asset.category}`);
        console.log(`  Entity: ${asset.entity}`);
      });
    }

    // Check transactions collection
    console.log('\n📊 TRANSACTIONS COLLECTION:');
    const transactionsCollection = mongoose.connection.db.collection('transactions');
    const transactionsCount = await transactionsCollection.countDocuments();
    console.log(`Total transactions: ${transactionsCount}`);
    
    if (transactionsCount > 0) {
      const sampleTransactions = await transactionsCollection.find().limit(3).toArray();
      sampleTransactions.forEach((transaction, index) => {
        console.log(`\nTransaction ${index + 1}:`);
        console.log(`  ID: ${transaction._id}`);
        console.log(`  Amount: $${transaction.amount}`);
        console.log(`  Type: ${transaction.type}`);
        console.log(`  Date: ${transaction.date}`);
        console.log(`  Residence: ${transaction.residence}`);
        console.log(`  Entries count: ${transaction.entries?.length || 0}`);
      });
    }

    console.log('\n🔍 CALCULATING IMPACT OF OUT-OF-SCOPE DATA:');
    console.log('=====================================');

    // Calculate total impact of transactions outside 2025
    let outOfScopeImpact = 0;
    transactionsOutside2025.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          if (entry.accountType === 'Asset') {
            outOfScopeImpact += (entry.debit || 0) - (entry.credit || 0);
          } else if (entry.accountType === 'Liability') {
            outOfScopeImpact -= (entry.credit || 0) - (entry.debit || 0);
          } else if (entry.accountType === 'Income') {
            outOfScopeImpact -= (entry.credit || 0) - (entry.debit || 0);
          } else if (entry.accountType === 'Expense') {
            outOfScopeImpact += (entry.debit || 0) - (entry.credit || 0);
          }
        });
      }
    });

    console.log(`📊 Impact of transactions outside 2025: $${outOfScopeImpact.toFixed(2)}`);

    // Calculate total impact of transactions without residence
    let noResidenceImpact = 0;
    transactionsWithoutResidence.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          if (entry.accountType === 'Asset') {
            noResidenceImpact += (entry.debit || 0) - (entry.credit || 0);
          } else if (entry.accountType === 'Liability') {
            noResidenceImpact -= (entry.credit || 0) - (entry.debit || 0);
          } else if (entry.accountType === 'Income') {
            noResidenceImpact -= (entry.credit || 0) - (entry.debit || 0);
          } else if (entry.accountType === 'Expense') {
            noResidenceImpact += (entry.debit || 0) - (entry.credit || 0);
          }
        });
      }
    });

    console.log(`📊 Impact of transactions without residence: $${noResidenceImpact.toFixed(2)}`);

    console.log('\n🔍 SUMMARY:');
    console.log('=====================================');
    console.log(`Total imbalance to investigate: $3,004.50`);
    console.log(`Out-of-scope transactions impact: $${outOfScopeImpact.toFixed(2)}`);
    console.log(`No-residence transactions impact: $${noResidenceImpact.toFixed(2)}`);
    console.log(`Combined impact: $${(outOfScopeImpact + noResidenceImpact).toFixed(2)}`);
    
    if (Math.abs(outOfScopeImpact + noResidenceImpact - 3004.50) < 1) {
      console.log('✅ MATCH FOUND! The imbalance is caused by out-of-scope and no-residence transactions.');
    } else {
      console.log('⚠️ Additional investigation needed. Check other financial collections.');
    }

  } catch (error) {
    console.error('❌ Error investigating imbalance source:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

investigateImbalanceSource();
