const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function testOutstandingBalances() {
  try {
    console.log('🔍 Testing getDetailedOutstandingBalances logic...\n');

    const studentId = '68aeaf7a8d70befd6ad29b18'; // Student 1
    console.log(`📊 Testing for student: ${studentId}\n`);

    // Get all transactions for this specific student (only student-specific accounts)
    const allStudentTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    }).sort({ date: 1 });

    console.log(`📊 Found ${allStudentTransactions.length} transactions for student ${studentId}:\n`);

    allStudentTransactions.forEach((tx, index) => {
      console.log(`Transaction ${index + 1}:`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  Date: ${tx.date}`);
      console.log(`  Source: ${tx.source}`);
      console.log(`  Entries:`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          console.log(`    Entry ${entryIndex + 1}: ${entry.accountCode} - Debit: ${entry.debit || 0}, Credit: ${entry.credit || 0}`);
        }
      });
      console.log('');
    });

    // Separate different types of transactions
    const accruals = allStudentTransactions.filter(tx => 
      tx.source === 'rental_accrual' || 
      (tx.source === 'lease_start' && tx.metadata?.proratedRent > 0) ||
      (tx.metadata?.type === 'lease_start' && tx.metadata?.proratedRent > 0)
    );

    const payments = allStudentTransactions.filter(tx => 
      tx.source === 'payment' || 
      (tx.metadata?.allocationType === 'payment_allocation')
    );

    console.log(`📊 Analysis:`);
    console.log(`   Accruals: ${accruals.length}`);
    console.log(`   Payments: ${payments.length}`);

    // Track outstanding balances by month and type
    const monthlyOutstanding = {};

    // Process accruals to build debt structure
    accruals.forEach(accrual => {
      const accrualDate = new Date(accrual.date);
      const monthKey = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyOutstanding[monthKey]) {
        monthlyOutstanding[monthKey] = {
          monthKey,
          year: accrualDate.getFullYear(),
          month: accrualDate.getMonth() + 1,
          monthName: accrualDate.toLocaleString('default', { month: 'long' }),
          date: accrualDate,
          rent: { owed: 0, paid: 0, outstanding: 0 },
          adminFee: { owed: 0, paid: 0, outstanding: 0 },
          deposit: { owed: 0, paid: 0, outstanding: 0 },
          totalOutstanding: 0,
          transactionId: accrual._id,
          source: accrual.source,
          metadata: accrual.metadata
        };
      }
      
      // Categorize the debt by type
      accrual.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
          const description = entry.description.toLowerCase();
          
          if (description.includes('admin fee') || description.includes('administrative')) {
            monthlyOutstanding[monthKey].adminFee.owed += entry.debit;
          } else if (description.includes('security deposit') || description.includes('deposit')) {
            monthlyOutstanding[monthKey].deposit.owed += entry.debit;
          } else {
            // Default to rent
            monthlyOutstanding[monthKey].rent.owed += entry.debit;
          }
        }
      });
    });

    console.log(`\n📊 Monthly outstanding structure:`);
    Object.values(monthlyOutstanding).forEach(month => {
      console.log(`   ${month.monthKey} (${month.monthName}):`);
      console.log(`     Rent: $${month.rent.owed} owed`);
      console.log(`     Admin: $${month.adminFee.owed} owed`);
      console.log(`     Deposit: $${month.deposit.owed} owed`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testOutstandingBalances();
