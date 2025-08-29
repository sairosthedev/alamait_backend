const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAllStudents() {
  try {
    console.log('🔍 Checking all students and their AR transactions...\n');

    // Get all AR transactions
    const allARTxs = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-' }
    }).lean();

    console.log(`📊 Found ${allARTxs.length} transactions with student-specific AR accounts\n`);

    // Group by student account
    const studentAccounts = {};
    
    allARTxs.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.replace('1100-', '');
          
          if (!studentAccounts[studentId]) {
            studentAccounts[studentId] = {
              studentId,
              transactions: [],
              totalDebits: 0,
              totalCredits: 0,
              outstanding: 0
            };
          }
          
          studentAccounts[studentId].transactions.push({
            id: tx._id,
            description: tx.description,
            date: tx.date,
            source: tx.source,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            monthSettled: tx.metadata?.monthSettled
          });
          
          studentAccounts[studentId].totalDebits += entry.debit || 0;
          studentAccounts[studentId].totalCredits += entry.credit || 0;
        }
      });
    });

    // Calculate outstanding for each student
    Object.values(studentAccounts).forEach(student => {
      student.outstanding = student.totalDebits - student.totalCredits;
    });

    // Display results
    console.log('📋 STUDENT ACCOUNT SUMMARY:\n');
    
    Object.values(studentAccounts).forEach(student => {
      console.log(`👤 Student ID: ${student.studentId}`);
      console.log(`   Total Debits: $${student.totalDebits.toFixed(2)}`);
      console.log(`   Total Credits: $${student.totalCredits.toFixed(2)}`);
      console.log(`   Outstanding: $${student.outstanding.toFixed(2)}`);
      console.log(`   Transactions: ${student.transactions.length}`);
      
      // Group transactions by month
      const transactionsByMonth = {};
      student.transactions.forEach(tx => {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!transactionsByMonth[monthKey]) {
          transactionsByMonth[monthKey] = [];
        }
        transactionsByMonth[monthKey].push(tx);
      });
      
      console.log('   📅 Transactions by month:');
      Object.entries(transactionsByMonth).forEach(([month, txs]) => {
        console.log(`      ${month}: ${txs.length} transactions`);
        txs.forEach(tx => {
          const type = tx.source === 'rental_accrual' ? 'ACCRUAL' : 'PAYMENT';
          const monthSettled = tx.monthSettled ? ` (settled: ${tx.monthSettled})` : '';
          console.log(`        - ${type}: $${tx.debit || tx.credit} - ${tx.description}${monthSettled}`);
        });
      });
      console.log('');
    });

    // Check for student account mismatches
    console.log('🔍 CHECKING FOR STUDENT ACCOUNT MISMATCHES:\n');
    
    Object.values(studentAccounts).forEach(student => {
      const payments = student.transactions.filter(tx => tx.source === 'payment');
      const accruals = student.transactions.filter(tx => tx.source === 'rental_accrual');
      
      payments.forEach(payment => {
        const monthSettled = payment.monthSettled;
        if (monthSettled) {
          const monthAccruals = accruals.filter(accrual => {
            const accrualDate = new Date(accrual.date);
            const accrualMonth = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
            return accrualMonth === monthSettled;
          });
          
          if (monthAccruals.length === 0) {
            console.log(`⚠️  MISMATCH: Payment for ${student.studentId} in ${monthSettled} but no accrual found for that month`);
          }
        }
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

checkAllStudents();
