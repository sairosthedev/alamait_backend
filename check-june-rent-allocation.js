const mongoose = require('mongoose');
require('dotenv').config();

async function checkJuneRentAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🔍 CHECKING JUNE RENT ALLOCATION');
    console.log('==================================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Get current outstanding balances
    console.log('\n📊 CURRENT OUTSTANDING BALANCES:');
    console.log('==================================');
    
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log('Outstanding Balances:', JSON.stringify(outstandingBalances, null, 2));
    
    // 2. Check June 2025 specifically
    console.log('\n📅 JUNE 2025 ANALYSIS:');
    console.log('=======================');
    
    const juneBalance = outstandingBalances.find(month => month.monthKey === '2025-06');
    
    if (juneBalance) {
      console.log(`June 2025 (${juneBalance.monthName}):`);
      console.log(`  Rent Owed: $${juneBalance.rent.owed.toFixed(2)}`);
      console.log(`  Rent Paid: $${juneBalance.rent.paid.toFixed(2)}`);
      console.log(`  Rent Outstanding: $${juneBalance.rent.outstanding.toFixed(2)}`);
      console.log(`  Admin Fee Outstanding: $${juneBalance.adminFee.outstanding.toFixed(2)}`);
      console.log(`  Deposit Outstanding: $${juneBalance.deposit.outstanding.toFixed(2)}`);
      console.log(`  Total Outstanding: $${juneBalance.totalOutstanding.toFixed(2)}`);
      console.log(`  Transaction ID: ${juneBalance.transactionId}`);
      console.log(`  Type: ${juneBalance.metadata?.type || 'Unknown'}`);
    }
    
    // 3. Check July 2025 specifically
    console.log('\n📅 JULY 2025 ANALYSIS:');
    console.log('=======================');
    
    const julyBalance = outstandingBalances.find(month => month.monthKey === '2025-07');
    
    if (julyBalance) {
      console.log(`July 2025 (${julyBalance.monthName}):`);
      console.log(`  Rent Owed: $${julyBalance.rent.owed.toFixed(2)}`);
      console.log(`  Rent Paid: $${julyBalance.rent.paid.toFixed(2)}`);
      console.log(`  Rent Outstanding: $${julyBalance.rent.outstanding.toFixed(2)}`);
      console.log(`  Admin Fee Outstanding: $${julyBalance.adminFee.outstanding.toFixed(2)}`);
      console.log(`  Deposit Outstanding: $${julyBalance.deposit.outstanding.toFixed(2)}`);
      console.log(`  Total Outstanding: $${julyBalance.totalOutstanding.toFixed(2)}`);
      console.log(`  Transaction ID: ${julyBalance.transactionId}`);
      console.log(`  Type: ${julyBalance.metadata?.type || 'Unknown'}`);
    }
    
    // 4. Check the original June accrual transaction
    console.log('\n🔍 JUNE ACCRUAL TRANSACTION:');
    console.log('=============================');
    
    const juneAccrual = await TransactionEntry.findById(juneBalance?.transactionId);
    
    if (juneAccrual) {
      console.log(`Transaction: ${juneAccrual.description}`);
      console.log(`Date: ${juneAccrual.date.toISOString().split('T')[0]}`);
      console.log(`Type: ${juneAccrual.metadata?.type || 'Unknown'}`);
      console.log(`Total: $${juneAccrual.totalDebit} / $${juneAccrual.totalCredit}`);
      
      console.log('\n📋 ENTRIES:');
      juneAccrual.entries.forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`     Description: ${entry.description}`);
      });
    }
    
    // 5. Check what payments have been applied to June
    console.log('\n💰 PAYMENTS APPLIED TO JUNE:');
    console.log('=============================');
    
    const junePayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-06',
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`Found ${junePayments.length} payments applied to June 2025`);
    
    junePayments.forEach((tx, index) => {
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
    
    // 6. Analysis
    console.log('\n🎯 ANALYSIS:');
    console.log('=============');
    
    if (juneBalance && juneBalance.rent.outstanding === 0) {
      console.log(`✅ June rent is fully paid (outstanding: $${juneBalance.rent.outstanding.toFixed(2)})`);
      console.log(`   This means the $36.67 rent for June has already been settled`);
    } else if (juneBalance) {
      console.log(`❌ June rent still has outstanding balance: $${juneBalance.rent.outstanding.toFixed(2)}`);
      console.log(`   This means the $36.67 rent for June should be allocated to June, not July`);
    }
    
    if (julyBalance && julyBalance.rent.outstanding === 36.67) {
      console.log(`❌ PROBLEM: July shows $36.67 outstanding rent`);
      console.log(`   This should be June's rent, not July's`);
      console.log(`   July should have $220 outstanding (full monthly rent)`);
    }
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('==================');
    console.log('The issue is that June rent ($36.67) is being allocated to July instead of June.');
    console.log('This suggests there might be an issue with the month identification logic.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkJuneRentAllocation();
