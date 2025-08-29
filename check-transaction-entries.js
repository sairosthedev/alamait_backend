require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkTransactionEntries() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 CHECKING TRANSACTION ENTRIES COLLECTION\n');

    // 1. Get all transactions
    console.log('📊 STEP 1: All Transactions in Database\n');
    
    const allTransactions = await TransactionEntry.find({
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Total transactions in database: ${allTransactions.length}`);

    // 2. Group by source type
    console.log('\n📊 STEP 2: Transactions by Source Type\n');
    
    const transactionsBySource = {};
    allTransactions.forEach(tx => {
      const source = tx.source || 'unknown';
      if (!transactionsBySource[source]) {
        transactionsBySource[source] = [];
      }
      transactionsBySource[source].push(tx);
    });

    Object.entries(transactionsBySource).forEach(([source, transactions]) => {
      console.log(`\n📋 ${source.toUpperCase()} (${transactions.length} transactions):`);
      transactions.forEach((tx, index) => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        console.log(`   ${index + 1}. ${tx.description} (${date}) - $${tx.totalDebit}`);
      });
    });

    // 3. Check for Cindy Gwekwerere transactions specifically
    console.log('\n📊 STEP 3: Cindy Gwekwerere Transactions\n');
    
    const cindyTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentName': 'Cindy Gwekwerere' },
        { description: { $regex: /Cindy Gwekwerere/i } }
      ],
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Cindy Gwekwerere transactions found: ${cindyTransactions.length}`);
    
    if (cindyTransactions.length > 0) {
      cindyTransactions.forEach((tx, index) => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        console.log(`   ${index + 1}. ${tx.description} (${date})`);
        console.log(`      Source: ${tx.source}, Amount: $${tx.totalDebit}`);
        console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'Not set'}`);
      });
    } else {
      console.log('   ❌ No Cindy Gwekwerere transactions found!');
    }

    // 4. Check AR transactions specifically
    console.log('\n📊 STEP 4: AR Transactions (1100 accounts)\n');
    
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 AR transactions found: ${arTransactions.length}`);
    
    if (arTransactions.length > 0) {
      arTransactions.forEach((tx, index) => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        console.log(`   ${index + 1}. ${tx.description} (${date})`);
        console.log(`      Source: ${tx.source}, Amount: $${tx.totalDebit}`);
        
        // Show AR entries
        tx.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100')) {
            console.log(`      AR Entry: ${entry.accountCode} - Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
          }
        });
      });
    } else {
      console.log('   ❌ No AR transactions found!');
    }

    // 5. Check payment transactions
    console.log('\n📊 STEP 5: Payment Transactions\n');
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Payment transactions found: ${paymentTransactions.length}`);
    
    if (paymentTransactions.length > 0) {
      paymentTransactions.forEach((tx, index) => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        console.log(`   ${index + 1}. ${tx.description} (${date})`);
        console.log(`      Amount: $${tx.totalDebit}, Month Settled: ${tx.metadata?.monthSettled || 'Not set'}`);
        console.log(`      Student: ${tx.metadata?.studentName || 'Unknown'}`);
      });
    } else {
      console.log('   ❌ No payment transactions found!');
    }

    // 6. Check rental accrual transactions
    console.log('\n📊 STEP 6: Rental Accrual Transactions\n');
    
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Rental accrual transactions found: ${accrualTransactions.length}`);
    
    if (accrualTransactions.length > 0) {
      accrualTransactions.forEach((tx, index) => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        console.log(`   ${index + 1}. ${tx.description} (${date})`);
        console.log(`      Amount: $${tx.totalDebit}, Student: ${tx.metadata?.studentName || 'Unknown'}`);
      });
    } else {
      console.log('   ❌ No rental accrual transactions found!');
    }

    // 7. Summary
    console.log('\n📊 STEP 7: Summary\n');
    
    console.log(`📋 Database Summary:`);
    console.log(`   Total Transactions: ${allTransactions.length}`);
    console.log(`   Cindy Gwekwerere Transactions: ${cindyTransactions.length}`);
    console.log(`   AR Transactions: ${arTransactions.length}`);
    console.log(`   Payment Transactions: ${paymentTransactions.length}`);
    console.log(`   Rental Accrual Transactions: ${accrualTransactions.length}`);

    if (cindyTransactions.length === 0) {
      console.log('\n⚠️ WARNING: No Cindy Gwekwerere transactions found!');
      console.log('   This suggests the real data may have been accidentally removed.');
      console.log('   You may need to restore the original data from your JSON file.');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkTransactionEntries();










