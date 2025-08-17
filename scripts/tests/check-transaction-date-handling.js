const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Payment = require('./src/models/Payment');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkTransactionDateHandling() {
  try {
    console.log('🔍 Checking Transaction Date Handling...\n');
    
    // Get all transaction entries
    const entries = await TransactionEntry.find({}).sort({ date: 1 });
    console.log(`📊 Total Transaction Entries found: ${entries.length}\n`);
    
    if (entries.length === 0) {
      console.log('❌ No transaction entries found!');
      return;
    }
    
    // Check date patterns
    console.log('📅 DATE ANALYSIS:');
    console.log('==================');
    
    const dateAnalysis = {};
    let hasDateIssues = false;
    
    entries.forEach((entry, index) => {
      const date = new Date(entry.date);
      const now = new Date();
      const timeDiff = now.getTime() - date.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      // Check if date is very recent (likely created with new Date())
      if (daysDiff <= 1) {
        hasDateIssues = true;
        console.log(`⚠️  Entry ${index + 1}: Very recent date (${date.toDateString()}) - likely using current date instead of payment date`);
        console.log(`   Description: ${entry.description}`);
        console.log(`   Source: ${entry.source}`);
        console.log(`   Days ago: ${daysDiff}`);
        console.log('');
      }
      
      // Group by year and month
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (!dateAnalysis[key]) {
        dateAnalysis[key] = {
          count: 0,
          entries: [],
          year,
          month
        };
      }
      
      dateAnalysis[key].count++;
      dateAnalysis[key].entries.push({
        id: entry._id,
        date: date,
        description: entry.description,
        source: entry.source
      });
    });
    
    // Show monthly distribution
    console.log('📊 MONTHLY DISTRIBUTION:');
    console.log('========================');
    Object.keys(dateAnalysis).sort().forEach(key => {
      const data = dateAnalysis[key];
      const monthName = new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' });
      console.log(`${monthName} ${data.year}: ${data.count} entries`);
    });
    
    // Check for payment dates vs transaction dates
    console.log('\n🔍 PAYMENT DATE vs TRANSACTION DATE COMPARISON:');
    console.log('===============================================');
    
    const payments = await Payment.find({}).limit(10);
    console.log(`Found ${payments.length} payments to compare`);
    
    for (const payment of payments) {
      // Find corresponding transaction entry
      const transactionEntry = await TransactionEntry.findOne({
        source: 'payment',
        sourceId: payment._id
      });
      
      if (transactionEntry) {
        const paymentDate = new Date(payment.date);
        const transactionDate = new Date(transactionEntry.date);
        const dateDiff = Math.abs(paymentDate.getTime() - transactionDate.getTime());
        const daysDiff = Math.floor(dateDiff / (1000 * 60 * 60 * 24));
        
        console.log(`Payment ID: ${payment.paymentId}`);
        console.log(`  Payment Date: ${paymentDate.toDateString()}`);
        console.log(`  Transaction Date: ${transactionDate.toDateString()}`);
        console.log(`  Date Difference: ${daysDiff} days`);
        
        if (daysDiff > 1) {
          console.log(`  ⚠️  WARNING: Significant date difference!`);
        }
        console.log('');
      }
    }
    
    // Summary
    console.log('📋 SUMMARY:');
    console.log('===========');
    
    if (hasDateIssues) {
      console.log('❌ ISSUES FOUND:');
      console.log('  - Some transactions are using current date instead of payment date');
      console.log('  - This will affect monthly reporting accuracy');
      console.log('  - Need to fix transaction creation to use payment.date');
    } else {
      console.log('✅ NO DATE ISSUES FOUND:');
      console.log('  - All transactions have appropriate dates');
      console.log('  - Monthly reporting should work correctly');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');
    console.log('1. Ensure transaction creation uses payment.date instead of new Date()');
    console.log('2. Check DoubleEntryAccountingService.recordStudentRentPayment()');
    console.log('3. Verify payment controller uses payment.date for transaction creation');
    console.log('4. Test monthly reports after fixing date handling');
    
  } catch (error) {
    console.error('❌ Error checking transaction date handling:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkTransactionDateHandling(); 