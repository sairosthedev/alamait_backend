const mongoose = require('mongoose');
require('dotenv').config();

async function testEnhancedMonthsAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    const DebtorTransactionSyncService = require('./src/services/debtorTransactionSyncService');
    
    console.log('🔍 Testing Enhanced Months Tracking API...\n');
    
    // Get the debtor
    let debtor = await Debtor.findOne({});
    if (!debtor) {
      console.log('❌ No debtor found');
      return;
    }
    
    const studentId = debtor.user.toString();
    console.log(`🔍 Analyzing debtor: ${debtor.debtorCode}`);
    
    // First, update the months tracking data
    console.log('\n🔄 UPDATING MONTHS TRACKING DATA...');
    await DebtorTransactionSyncService.updateMonthsAccruedAndPaidSummary(debtor, studentId);
    
    // Refresh debtor data from database
    debtor = await Debtor.findById(debtor._id);
    console.log('✅ Refreshed debtor data from database');
    
    // Test the enhanced months tracking breakdown
    console.log('\n📊 ENHANCED MONTHS TRACKING DATA:');
    console.log('=====================================');
    
    // Get months accrued
    console.log('\n📅 MONTHS ACCRUED:');
    if (debtor.monthsAccrued && debtor.monthsAccrued.length > 0) {
      debtor.monthsAccrued.forEach((month, index) => {
        console.log(`   ${index + 1}. ${month.month}: $${month.amount} (${month.transactionCount} transactions)`);
        if (month.isLeaseStartMonth) {
          console.log(`       🏠 LEASE START MONTH (${month.isProrated ? 'PRORATED' : 'FULL'})`);
        }
        if (month.transactions && month.transactions.length > 0) {
          month.transactions.forEach(tx => {
            console.log(`       - ${tx.transactionId}: $${tx.amount} (${tx.type})`);
          });
        }
      });
    } else {
      console.log('   No months accrued data found');
    }
    
    // Get months paid
    console.log('\n💰 MONTHS PAID:');
    if (debtor.monthsPaid && debtor.monthsPaid.length > 0) {
      debtor.monthsPaid.forEach((month, index) => {
        console.log(`   ${index + 1}. ${month.month}: $${month.amount} (${month.paymentCount} payments)`);
        if (month.payments && month.payments.length > 0) {
          month.payments.forEach(payment => {
            console.log(`       - ${payment.paymentId}: $${payment.amount} (${payment.status})`);
          });
        }
      });
    } else {
      console.log('   No months paid data found');
    }
    
    // Get monthly payments breakdown
    console.log('\n📋 MONTHLY PAYMENTS BREAKDOWN:');
    if (debtor.monthlyPayments && debtor.monthlyPayments.length > 0) {
      debtor.monthlyPayments.forEach((monthPayment, index) => {
        console.log(`   ${index + 1}. Month: ${monthPayment.month}`);
        console.log(`       Expected: $${monthPayment.expectedAmount}`);
        console.log(`       Paid: $${monthPayment.paidAmount}`);
        console.log(`       Outstanding: $${monthPayment.outstandingAmount}`);
        console.log(`       Status: ${monthPayment.status}`);
        
        if (monthPayment.paymentMonths && monthPayment.paymentMonths.length > 0) {
          console.log(`       Payment Months: ${monthPayment.paymentMonths.length}`);
          monthPayment.paymentMonths.forEach(pm => {
            console.log(`         - ${pm.paymentMonth}: $${pm.amount} (${pm.status})`);
          });
        }
      });
    } else {
      console.log('   No monthly payments data found');
    }
    
    // Get allocation data
    console.log('\n🎯 ALLOCATION DATA:');
    if (debtor.allocation) {
      console.log(`   Summary: ${JSON.stringify(debtor.allocation.summary, null, 2)}`);
      if (debtor.allocation.monthlyBreakdown && debtor.allocation.monthlyBreakdown.length > 0) {
        console.log(`   Monthly Breakdown: ${debtor.allocation.monthlyBreakdown.length} entries`);
        debtor.allocation.monthlyBreakdown.forEach((entry, index) => {
          console.log(`     ${index + 1}. ${entry.month} (${entry.paymentType}): $${entry.amountAllocated}`);
        });
      }
    } else {
      console.log('   No allocation data found');
    }
    
    // Test the detailed months breakdown service
    console.log('\n🔧 TESTING DETAILED MONTHS BREAKDOWN SERVICE:');
    try {
      const breakdown = await DebtorTransactionSyncService.getDetailedMonthsBreakdown(studentId);
      if (breakdown.success) {
        console.log('✅ Detailed months breakdown service working');
        console.log(`   Months Accrued: ${breakdown.breakdown.monthsAccrued.length}`);
        console.log(`   Months Paid: ${breakdown.breakdown.monthsPaid.length}`);
        console.log(`   Total Expected: $${breakdown.breakdown.totalExpected}`);
        console.log(`   Total Paid: $${breakdown.breakdown.totalPaid}`);
      } else {
        console.log('❌ Detailed months breakdown service failed');
      }
    } catch (error) {
      console.log('❌ Error testing detailed months breakdown service:', error.message);
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('============');
    console.log(`   Total Owed: $${debtor.totalOwed}`);
    console.log(`   Total Paid: $${debtor.totalPaid}`);
    console.log(`   Current Balance: $${debtor.currentBalance}`);
    console.log(`   Status: ${debtor.status}`);
    console.log(`   Months Accrued Count: ${debtor.monthsAccrued ? debtor.monthsAccrued.length : 0}`);
    console.log(`   Months Paid Count: ${debtor.monthsPaid ? debtor.monthsPaid.length : 0}`);
    console.log(`   Monthly Payments Count: ${debtor.monthlyPayments ? debtor.monthlyPayments.length : 0}`);
    
    console.log('\n✅ Enhanced months tracking data verification completed!');
    
  } catch (error) {
    console.error('❌ Error testing enhanced months API:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testEnhancedMonthsAPI();
