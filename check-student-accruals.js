const mongoose = require('mongoose');
require('dotenv').config();

async function checkStudentAccruals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    console.log(`\n🔍 CHECKING RENTAL ACCRUALS FOR STUDENT: ${studentId}`);
    console.log('================================================');
    
    // Get student details
    const student = await User.findById(studentId);
    console.log(`Student: ${student.firstName} ${student.lastName}`);
    console.log(`Email: ${student.email}`);
    
    // Check all rental accrual transactions for this student
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      'metadata.studentId': studentId
    }).sort({ date: 1 });
    
    console.log(`\n📊 Found ${accrualTransactions.length} rental accrual transactions:`);
    
    if (accrualTransactions.length === 0) {
      console.log('❌ No rental accrual transactions found!');
      return;
    }
    
    accrualTransactions.forEach((transaction, index) => {
      const arEntry = transaction.entries.find(e => e.accountCode.startsWith('1100-'));
      const incomeEntry = transaction.entries.find(e => e.accountCode.startsWith('400'));
      
      console.log(`\n${index + 1}. Transaction ID: ${transaction._id}`);
      console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
      console.log(`   Month Key: ${transaction.metadata?.monthKey || 'N/A'}`);
      console.log(`   Type: ${transaction.metadata?.type || 'N/A'}`);
      console.log(`   AR Amount: $${arEntry?.debit || 0}`);
      console.log(`   Income Amount: $${incomeEntry?.credit || 0}`);
      console.log(`   Total Debit: $${transaction.totalDebit}`);
      console.log(`   Total Credit: $${transaction.totalCredit}`);
      console.log(`   Status: ${transaction.status}`);
      
      if (transaction.metadata?.type === 'lease_start') {
        console.log(`   Lease Start Details:`);
        console.log(`     Prorated Rent: $${transaction.metadata.proratedRent}`);
        console.log(`     Admin Fee: $${transaction.metadata.adminFee}`);
        console.log(`     Security Deposit: $${transaction.metadata.securityDeposit}`);
      }
    });
    
    // Check what months should have accruals
    console.log('\n📅 EXPECTED MONTHLY ACCRUALS:');
    console.log('==============================');
    
    const leaseStartDate = new Date('2025-06-26');
    const currentDate = new Date();
    
    let currentMonth = new Date(leaseStartDate.getFullYear(), leaseStartDate.getMonth(), 1);
    const months = [];
    
    while (currentMonth <= currentDate) {
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    console.log('Expected months with accruals:');
    months.forEach(month => {
      const hasAccrual = accrualTransactions.some(t => t.metadata?.monthKey === month);
      const status = hasAccrual ? '✅' : '❌';
      console.log(`  ${status} ${month}`);
    });
    
    // Check if monthly accruals need to be created
    console.log('\n🔧 MISSING MONTHLY ACCRUALS:');
    console.log('=============================');
    
    const missingMonths = months.filter(month => 
      !accrualTransactions.some(t => t.metadata?.monthKey === month)
    );
    
    if (missingMonths.length > 0) {
      console.log('Missing accruals for months:');
      missingMonths.forEach(month => {
        console.log(`  ❌ ${month}`);
      });
      
      console.log('\n💡 SOLUTION:');
      console.log('============');
      console.log('You need to create monthly rental accruals for the missing months.');
      console.log('This can be done by:');
      console.log('1. Running the rental accrual service for each missing month');
      console.log('2. Or using the bulk accrual creation endpoint');
    } else {
      console.log('✅ All expected monthly accruals are present!');
    }
    
    // Check outstanding balances calculation
    console.log('\n💰 OUTSTANDING BALANCES ANALYSIS:');
    console.log('==================================');
    
    const outstandingQuery = {
      'entries.accountCode': { $regex: `^1100-${studentId}` },
      'entries.accountType': 'asset',
      'entries.debit': { $gt: 0 }
    };
    
    const outstandingTransactions = await TransactionEntry.find(outstandingQuery);
    
    console.log(`Found ${outstandingTransactions.length} transactions with outstanding balances:`);
    
    outstandingTransactions.forEach((transaction, index) => {
      const arEntry = transaction.entries.find(e => 
        e.accountCode.startsWith('1100-') && e.debit > 0
      );
      
      if (arEntry) {
        console.log(`\n${index + 1}. Transaction: ${transaction._id}`);
        console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
        console.log(`   Account: ${arEntry.accountCode}`);
        console.log(`   Outstanding Balance: $${arEntry.debit}`);
        console.log(`   Month Key: ${transaction.metadata?.monthKey || 'N/A'}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkStudentAccruals();
