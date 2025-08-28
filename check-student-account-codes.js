const mongoose = require('mongoose');
require('dotenv').config();

async function checkStudentAccountCodes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🔍 CHECKING STUDENT ACCOUNT CODES');
    console.log('==================================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Get student info
    const student = await User.findById(studentId);
    console.log(`Student Name: ${student ? `${student.firstName} ${student.lastName}` : 'Not found'}`);
    
    // 2. Check all AR transactions for this student
    console.log('\n📊 ALL AR TRANSACTIONS FOR THIS STUDENT:');
    console.log('==========================================');
    
    const allARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-' }
    }).sort({ date: 1 });
    
    console.log(`Found ${allARTransactions.length} total AR transactions`);
    
    // Group by account code
    const accountCodes = {};
    
    allARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          const idInCode = entry.accountCode.replace('1100-', '');
          
          if (!accountCodes[idInCode]) {
            accountCodes[idInCode] = {
              id: idInCode,
              transactions: [],
              totalDebit: 0,
              totalCredit: 0
            };
          }
          
          accountCodes[idInCode].transactions.push({
            transactionId: tx._id,
            date: tx.date,
            description: tx.description,
            source: tx.source,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            monthSettled: tx.metadata?.monthSettled,
            paymentType: tx.metadata?.paymentType
          });
          
          accountCodes[idInCode].totalDebit += entry.debit || 0;
          accountCodes[idInCode].totalCredit += entry.credit || 0;
        }
      });
    });
    
    console.log('\n📋 ACCOUNT CODES FOUND:');
    console.log('=======================');
    
    for (const [idInCode, data] of Object.entries(accountCodes)) {
      console.log(`\n🔍 Account Code: 1100-${idInCode}`);
      console.log(`   Total Debit: $${data.totalDebit.toFixed(2)}`);
      console.log(`   Total Credit: $${data.totalCredit.toFixed(2)}`);
      console.log(`   Balance: $${(data.totalDebit - data.totalCredit).toFixed(2)}`);
      console.log(`   Transactions: ${data.transactions.length}`);
      
      // Check if this ID exists as a User
      const user = await User.findById(idInCode);
      if (user) {
        console.log(`   ✅ Found as User: ${user.firstName} ${user.lastName}`);
      } else {
        console.log(`   ❌ Not found as User`);
      }
      
      // Check if this ID exists as an Application
      const application = await Application.findById(idInCode);
      if (application) {
        console.log(`   ✅ Found as Application: ${application.firstName} ${application.lastName}`);
      } else {
        console.log(`   ❌ Not found as Application`);
      }
      
      // Show sample transactions
      console.log(`   📋 Sample Transactions:`);
      data.transactions.slice(0, 3).forEach((tx, index) => {
        console.log(`     ${index + 1}. ${tx.date.toISOString().split('T')[0]} - ${tx.description}`);
        console.log(`        Source: ${tx.source}, Amount: $${tx.debit || tx.credit}`);
        console.log(`        Month Settled: ${tx.monthSettled || 'N/A'}`);
      });
    }
    
    // 3. Check which account code should be used
    console.log('\n🎯 CORRECT ACCOUNT CODE ANALYSIS:');
    console.log('==================================');
    
    const correctAccountCode = `1100-${studentId}`;
    console.log(`Expected Account Code: ${correctAccountCode}`);
    
    if (accountCodes[studentId]) {
      console.log(`✅ Found transactions with correct student ID`);
      const balance = accountCodes[studentId].totalDebit - accountCodes[studentId].totalCredit;
      console.log(`   Balance: $${balance.toFixed(2)}`);
    } else {
      console.log(`❌ No transactions found with correct student ID`);
    }
    
    // 4. Find transactions that might belong to this student but use wrong ID
    console.log('\n🔍 POTENTIAL MISMATCHED TRANSACTIONS:');
    console.log('=======================================');
    
    const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown';
    
    for (const [idInCode, data] of Object.entries(accountCodes)) {
      if (idInCode !== studentId) {
        // Check if any transactions mention this student's name
        const matchingTransactions = data.transactions.filter(tx => 
          tx.description.toLowerCase().includes(student.firstName?.toLowerCase() || '') ||
          tx.description.toLowerCase().includes(student.lastName?.toLowerCase() || '') ||
          tx.description.toLowerCase().includes('macdonald') ||
          tx.description.toLowerCase().includes('sairos')
        );
        
        if (matchingTransactions.length > 0) {
          console.log(`\n⚠️  Found ${matchingTransactions.length} transactions for ${studentName} using wrong ID: ${idInCode}`);
          matchingTransactions.forEach((tx, index) => {
            console.log(`   ${index + 1}. ${tx.date.toISOString().split('T')[0]} - ${tx.description}`);
            console.log(`      Should use: ${correctAccountCode} instead of 1100-${idInCode}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkStudentAccountCodes();
