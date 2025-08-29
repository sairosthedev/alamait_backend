const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function debugBalanceSheetMonthSettled() {
  try {
    console.log('🔍 Debugging balance sheet monthSettled reclassification...\n');

    // Test the exact queries used by balance sheet service
    const months = ['2025-05', '2025-06', '2025-08'];
    
    for (const monthKey of months) {
      console.log(`\n📅 Testing ${monthKey}:`);
      
      // Parse month key
      const [year, month] = monthKey.split('-');
      const asOfYear = parseInt(year);
      const asOfMonth = parseInt(month);
      
      // Get month start and end dates
      const monthStart = new Date(asOfYear, asOfMonth - 1, 1);
      const monthEnd = new Date(asOfYear, asOfMonth, 0, 23, 59, 59, 999);
      
      console.log(`   Month range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
      
      // Test accrual query (same as balance sheet service)
      const accrualTxs = await TransactionEntry.find({
        source: 'rental_accrual',
        date: { $gte: monthStart, $lte: monthEnd },
        'entries.accountCode': { $regex: '^1100-' }
      }).lean();
      
      console.log(`   Accrual transactions found: ${accrualTxs.length}`);
      accrualTxs.forEach((tx, index) => {
        console.log(`     Accrual ${index + 1}: ${tx.description} - ${tx.date}`);
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
            console.log(`       ${entry.accountCode}: Debit ${entry.debit || 0}, Credit ${entry.credit || 0}`);
          }
        });
      });
      
      // Test payment allocation query (same as balance sheet service)
      const paymentAllocTxs = await TransactionEntry.find({
        source: 'payment',
        'metadata.monthSettled': monthKey,
        'entries.accountCode': { $regex: '^1100-' }
      }).lean();
      
      console.log(`   Payment allocation transactions found: ${paymentAllocTxs.length}`);
      paymentAllocTxs.forEach((tx, index) => {
        console.log(`     Payment ${index + 1}: ${tx.description} - monthSettled: ${tx.metadata?.monthSettled}`);
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
            console.log(`       ${entry.accountCode}: Debit ${entry.debit || 0}, Credit ${entry.credit || 0}`);
          }
        });
      });
      
      // Calculate AR outstanding (same as balance sheet service)
      let arDebits = 0;
      accrualTxs.forEach(tx => {
        tx.entries.forEach(line => {
          if (line.accountCode && line.accountCode.startsWith('1100-')) {
            arDebits += Number(line.debit || 0);
          }
        });
      });
      
      let arCredits = 0;
      paymentAllocTxs.forEach(tx => {
        tx.entries.forEach(line => {
          if (line.accountCode && line.accountCode.startsWith('1100-')) {
            arCredits += Number(line.credit || 0);
          }
        });
      });
      
      const arByMonthOutstanding = arDebits - arCredits;
      console.log(`   AR calculation: Debits $${arDebits} - Credits $${arCredits} = Outstanding $${arByMonthOutstanding}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

debugBalanceSheetMonthSettled();
