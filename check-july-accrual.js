const mongoose = require('mongoose');
require('dotenv').config();

async function checkJulyAccrual() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🔍 CHECKING JULY ACCRUAL');
    console.log('==========================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Get July accrual transaction
    console.log('\n📅 JULY 2025 ACCRUAL TRANSACTION:');
    console.log('==================================');
    
    const julyAccrual = await TransactionEntry.findById('68af5d993dbf8f2c7c41e64d');
    
    if (julyAccrual) {
      console.log(`Transaction: ${julyAccrual.description}`);
      console.log(`Date: ${julyAccrual.date.toISOString().split('T')[0]}`);
      console.log(`Type: ${julyAccrual.metadata?.type || 'Unknown'}`);
      console.log(`Total: $${julyAccrual.totalDebit} / $${julyAccrual.totalCredit}`);
      console.log(`Rent Amount: $${julyAccrual.metadata?.rentAmount || 'Unknown'}`);
      
      console.log('\n📋 ENTRIES:');
      julyAccrual.entries.forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`     Description: ${entry.description}`);
      });
    }
    
    // 2. Check what payments have been applied to July
    console.log('\n💰 PAYMENTS APPLIED TO JULY:');
    console.log('=============================');
    
    const julyPayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-07',
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`Found ${julyPayments.length} payments applied to July 2025`);
    
    julyPayments.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      console.log(`   Total: $${tx.totalDebit} / $${tx.totalCredit}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`     Description: ${entry.description}`);
      });
    });
    
    // 3. Calculate what July should have
    console.log('\n🎯 ANALYSIS:');
    console.log('=============');
    
    if (julyAccrual) {
      const julyRentOwed = julyAccrual.metadata?.rentAmount || 220;
      const julyRentPaid = julyPayments.reduce((sum, tx) => {
        if (tx.metadata?.paymentType === 'rent') {
          const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-') && e.credit > 0);
          return sum + (arEntry?.credit || 0);
        }
        return sum;
      }, 0);
      
      const julyRentOutstanding = julyRentOwed - julyRentPaid;
      
      console.log(`July 2025 Rent Analysis:`);
      console.log(`  Rent Owed: $${julyRentOwed.toFixed(2)}`);
      console.log(`  Rent Paid: $${julyRentPaid.toFixed(2)}`);
      console.log(`  Rent Outstanding: $${julyRentOutstanding.toFixed(2)}`);
      
      if (julyRentOutstanding === 36.67) {
        console.log(`❌ PROBLEM: July shows $36.67 outstanding instead of $220`);
        console.log(`   This suggests that $183.33 was incorrectly applied to July`);
        console.log(`   when it should have been applied to June`);
      } else if (julyRentOutstanding === 220) {
        console.log(`✅ July correctly shows $220 outstanding (no payments applied)`);
      } else {
        console.log(`⚠️ July shows $${julyRentOutstanding.toFixed(2)} outstanding`);
        console.log(`   Expected: $220 (full monthly rent)`);
      }
    }
    
    // 4. Check if there are any payments that should be reallocated
    console.log('\n🔍 CHECKING FOR MISALLOCATED PAYMENTS:');
    console.log('=======================================');
    
    const allPayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`Found ${allPayments.length} total payments for this student`);
    
    allPayments.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'Unknown'}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      console.log(`   Total: $${tx.totalDebit} / $${tx.totalCredit}`);
    });
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('==================');
    console.log('The issue is that rent payments are being allocated to the wrong months.');
    console.log('June rent ($36.67) should be allocated to June, not July.');
    console.log('July should have $220 outstanding (full monthly rent).');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkJulyAccrual();
