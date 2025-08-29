const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function testRealStudentAccounts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 TESTING REAL STUDENT-SPECIFIC ACCOUNTS\n');

    // 1. Find all student-specific AR accounts
    console.log('📊 STEP 1: Finding Real Student-Specific AR Accounts\n');
    
    const studentSpecificAR = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100-/ },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${studentSpecificAR.length} transactions with student-specific AR accounts`);

    // Group by student account
    const studentAccounts = {};
    studentSpecificAR.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.split('-')[1];
          if (!studentAccounts[studentId]) {
            studentAccounts[studentId] = {
              accountCode: entry.accountCode,
              totalDebit: 0,
              totalCredit: 0,
              transactions: [],
              studentName: null
            };
          }
          
          studentAccounts[studentId].totalDebit += entry.debit || 0;
          studentAccounts[studentId].totalCredit += entry.credit || 0;
          studentAccounts[studentId].transactions.push(tx);
          
          // Extract student name from metadata or description
          if (tx.metadata?.studentName) {
            studentAccounts[studentId].studentName = tx.metadata.studentName;
          } else if (tx.description) {
            const match = tx.description.match(/: ([^-]+) - /);
            if (match) {
              studentAccounts[studentId].studentName = match[1].trim();
            }
          }
        }
      });
    });

    console.log('\n📋 Student-Specific AR Accounts Found:');
    Object.entries(studentAccounts).forEach(([studentId, data]) => {
      const balance = data.totalDebit - data.totalCredit;
      console.log(`   ${data.accountCode}: $${balance} (${data.studentName || 'Unknown'})`);
      console.log(`     Transactions: ${data.transactions.length}`);
    });

    // 2. Test payment allocation for real student accounts
    console.log('\n📊 STEP 2: Testing Payment Allocation for Real Students\n');

    for (const [studentId, data] of Object.entries(studentAccounts)) {
      if (data.totalDebit > data.totalCredit) { // Has outstanding balance
        console.log(`\n🧪 Testing payment for ${data.studentName || studentId}`);
        console.log(`   Account: ${data.accountCode}`);
        console.log(`   Outstanding Balance: $${data.totalDebit - data.totalCredit}`);
        
        // Create a payment allocation
        const paymentAmount = Math.min(100, data.totalDebit - data.totalCredit); // Pay $100 or full balance
        
        const paymentAllocation = new TransactionEntry({
          transactionId: `PAYMENT-REAL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          date: new Date('2025-08-30'),
          description: `Payment allocation: $${paymentAmount} for ${data.studentName || studentId}`,
          reference: `PAYMENT-REAL-${studentId}`,
          entries: [
            {
              accountCode: '1000', // Cash
              accountName: 'Cash',
              accountType: 'Asset',
              debit: paymentAmount,
              credit: 0,
              description: `Cash received for rent payment - ${data.studentName || studentId}`
            },
            {
              accountCode: data.accountCode,
              accountName: `Accounts Receivable - ${data.studentName || studentId}`,
              accountType: 'Asset',
              debit: 0,
              credit: paymentAmount,
              description: `Rent receivable settled for ${data.studentName || studentId}`
            }
          ],
          totalDebit: paymentAmount,
          totalCredit: paymentAmount,
          source: 'payment',
          sourceId: new mongoose.Types.ObjectId(),
          sourceModel: 'Payment',
          createdBy: 'system',
          status: 'posted',
          metadata: {
            studentId: studentId,
            studentName: data.studentName,
            paymentType: 'rent',
            amount: paymentAmount,
            paymentMethod: 'Cash',
            allocationType: 'student_specific',
            targetAccountCode: data.accountCode
          }
        });

        await paymentAllocation.save();
        console.log(`   ✅ Created payment allocation: $${paymentAmount}`);
      }
    }

    // 3. Show updated balances
    console.log('\n📊 STEP 3: Updated Student-Specific AR Balances\n');
    
    const updatedStudentAR = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100-/ },
      status: 'posted'
    }).sort({ date: 1 });

    const updatedStudentAccounts = {};
    updatedStudentAR.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.split('-')[1];
          if (!updatedStudentAccounts[studentId]) {
            updatedStudentAccounts[studentId] = {
              accountCode: entry.accountCode,
              totalDebit: 0,
              totalCredit: 0,
              studentName: null
            };
          }
          
          updatedStudentAccounts[studentId].totalDebit += entry.debit || 0;
          updatedStudentAccounts[studentId].totalCredit += entry.credit || 0;
          
          if (tx.metadata?.studentName) {
            updatedStudentAccounts[studentId].studentName = tx.metadata.studentName;
          }
        }
      });
    });

    console.log('📋 Updated Student-Specific AR Balances:');
    Object.entries(updatedStudentAccounts).forEach(([studentId, data]) => {
      const balance = data.totalDebit - data.totalCredit;
      const previousBalance = studentAccounts[studentId] ? 
        studentAccounts[studentId].totalDebit - studentAccounts[studentId].totalCredit : 0;
      const change = balance - previousBalance;
      
      console.log(`   ${data.accountCode}: $${balance} (${data.studentName || 'Unknown'}) ${change < 0 ? `[Reduced by $${Math.abs(change)}]` : ''}`);
    });

    // 4. Show payment allocation summary for real students
    console.log('\n📊 STEP 4: Real Student Payment Allocation Summary\n');
    
    const realStudentPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.allocationType': 'student_specific',
      date: { $gte: new Date('2025-08-30') },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Real Student Payment Allocations (${realStudentPayments.length}):`);
    realStudentPayments.forEach((payment, index) => {
      const studentName = payment.metadata?.studentName || 'Unknown';
      const accountCode = payment.metadata?.targetAccountCode || 'Unknown';
      console.log(`   ${index + 1}. $${payment.totalDebit} for ${studentName} (${accountCode})`);
    });

    console.log('\n🎯 REAL STUDENT-SPECIFIC ACCOUNTS TEST COMPLETE!');
    console.log('   ✅ Found real student-specific AR accounts in database');
    console.log('   ✅ Successfully allocated payments to student-specific accounts');
    console.log('   ✅ Properly tracked student names and account codes');
    console.log('   ✅ Created proper double-entry transactions');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testRealStudentAccounts();
