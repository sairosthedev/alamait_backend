const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function debugStudentAccounts() {
  try {
    console.log('🔍 Debugging student account mismatch...\n');

    // Get all AR transactions (both accruals and payments)
    const allARTxs = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-' }
    }).lean();

    console.log(`Found ${allARTxs.length} transactions with student-specific AR accounts:\n`);

    // Group by student account
    const studentAccounts = {};
    
    allARTxs.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.replace('1100-', '');
          
          if (!studentAccounts[studentId]) {
            studentAccounts[studentId] = {
              studentId,
              accruals: [],
              payments: [],
              totalAccruals: 0,
              totalPayments: 0
            };
          }
          
          if (tx.source === 'rental_accrual' || tx.source === 'lease_start') {
            studentAccounts[studentId].accruals.push({
              description: tx.description,
              date: tx.date,
              amount: entry.debit || 0,
              month: `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
            });
            studentAccounts[studentId].totalAccruals += entry.debit || 0;
          } else if (tx.source === 'payment') {
            studentAccounts[studentId].payments.push({
              description: tx.description,
              date: tx.date,
              amount: entry.credit || 0,
              monthSettled: tx.metadata?.monthSettled
            });
            studentAccounts[studentId].totalPayments += entry.credit || 0;
          }
        }
      });
    });

    // Display results
    Object.values(studentAccounts).forEach(account => {
      console.log(`📊 Student Account: ${account.studentId}`);
      console.log(`   Total Accruals: $${account.totalAccruals}`);
      console.log(`   Total Payments: $${account.totalPayments}`);
      console.log(`   Net Outstanding: $${account.totalAccruals - account.totalPayments}`);
      
      console.log(`   Accruals:`);
      account.accruals.forEach(accrual => {
        console.log(`     ${accrual.month}: $${accrual.amount} - ${accrual.description}`);
      });
      
      console.log(`   Payments:`);
      account.payments.forEach(payment => {
        console.log(`     ${payment.monthSettled || 'N/A'}: $${payment.amount} - ${payment.description}`);
      });
      console.log('');
    });

    // Check for specific student IDs mentioned in the data
    console.log('🔍 Checking specific student IDs from your data:');
    const studentIds = ['68aeaf7a8d70befd6ad29b18', '68aeaf7b8d70befd6ad29b1a'];
    
    studentIds.forEach(studentId => {
      const account = studentAccounts[studentId];
      if (account) {
        console.log(`✅ Student ${studentId} found in database`);
        console.log(`   Accruals: ${account.accruals.length}`);
        console.log(`   Payments: ${account.payments.length}`);
      } else {
        console.log(`❌ Student ${studentId} NOT found in database`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugStudentAccounts();
