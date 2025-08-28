const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function checkTransactionStatus() {
  try {
    console.log('🔍 Checking transaction status...\n');

    // Check all transactions
    const allTransactions = await TransactionEntry.find().lean();
    console.log(`📊 Total transactions: ${allTransactions.length}`);

    // Check status distribution
    const statusCounts = {};
    allTransactions.forEach(tx => {
      const status = tx.status || 'no-status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('📊 Status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} transactions`);
    });

    // Check transactions with 'posted' status
    const postedTransactions = await TransactionEntry.find({ status: 'posted' }).lean();
    console.log(`\n📊 Transactions with 'posted' status: ${postedTransactions.length}`);

    // Check transactions without status filter
    const allTransactionsNoFilter = await TransactionEntry.find({}).lean();
    console.log(`📊 All transactions (no status filter): ${allTransactionsNoFilter.length}`);

    // Check AR transactions specifically
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100' }
    }).lean();

    console.log(`\n📊 AR transactions: ${arTransactions.length}`);
    arTransactions.forEach((tx, index) => {
      console.log(`AR Transaction ${index + 1}:`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  Status: ${tx.status || 'no-status'}`);
      console.log(`  Date: ${tx.date}`);
      console.log(`  Source: ${tx.source}`);
    });

    // Test the exact query used by balance sheet
    const asOf = new Date('2025-12-31');
    const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    const balanceSheetQuery = {
      date: { 
        $gte: monthStart, 
        $lte: asOf 
      },
      status: 'posted'
    };

    console.log('\n🔍 Testing balance sheet query:');
    console.log('Query:', JSON.stringify(balanceSheetQuery, null, 2));
    
    const balanceSheetTransactions = await TransactionEntry.find(balanceSheetQuery).lean();
    console.log(`📊 Transactions matching balance sheet query: ${balanceSheetTransactions.length}`);

    // Test without status filter
    const balanceSheetQueryNoStatus = {
      date: { 
        $gte: monthStart, 
        $lte: asOf 
      }
    };

    const balanceSheetTransactionsNoStatus = await TransactionEntry.find(balanceSheetQueryNoStatus).lean();
    console.log(`📊 Transactions matching balance sheet query (no status filter): ${balanceSheetTransactionsNoStatus.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

checkTransactionStatus();
