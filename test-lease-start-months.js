const mongoose = require('mongoose');
require('dotenv').config();

async function testLeaseStartMonths() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const DebtorTransactionSyncService = require('./src/services/debtorTransactionSyncService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Debtor = require('./src/models/Debtor');
    const Application = require('./src/models/Application');
    
    console.log('🧪 Testing Lease Start Month Inclusion in Months Accrued...\n');
    
    // Test 1: Check current application data
    console.log('📊 STEP 1: Analyzing current application data...');
    
    const applications = await Application.find({
      status: { $in: ['approved', 'waitlisted'] }
    }).sort({ applicationDate: -1 });
    
    console.log(`📊 Found ${applications.length} approved/waitlisted applications`);
    
    applications.forEach((app, index) => {
      console.log(`\n${index + 1}. Application: ${app.applicationCode}`);
      console.log(`   Student: ${app.firstName} ${app.lastName}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Start Date: ${app.startDate}`);
      console.log(`   End Date: ${app.endDate}`);
      
      if (app.startDate && app.endDate) {
        const startDate = new Date(app.startDate);
        const endDate = new Date(app.endDate);
        const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        const endMonthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
        
        console.log(`   Lease Start Month: ${startMonthKey}`);
        console.log(`   Lease End Month: ${endMonthKey}`);
        console.log(`   Expected Months: ${(endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1}`);
      }
    });
    
    // Test 2: Sync transactions to debtors with lease start month inclusion
    console.log('\n📊 STEP 2: Syncing transactions to debtors with lease start month inclusion...');
    const syncResult = await DebtorTransactionSyncService.syncAllTransactionsToDebtors();
    
    if (syncResult.success) {
      console.log('✅ Sync completed successfully!');
    } else {
      console.error('❌ Sync failed:', syncResult.error);
      return;
    }
    
    // Test 3: Get detailed months breakdown for each debtor
    console.log('\n📊 STEP 3: Getting detailed months breakdown with lease start month...');
    const debtors = await Debtor.find({});
    
    for (const debtor of debtors) {
      const studentId = debtor.user.toString();
      console.log(`\n🔍 Analyzing debtor: ${debtor.debtorCode}`);
      
      const breakdown = await DebtorTransactionSyncService.getDetailedMonthsBreakdown(studentId);
      
      if (breakdown.success) {
        console.log(`\n📊 LEASE INFORMATION:`);
        console.log(`   Lease Start Month: ${breakdown.breakdown.monthsAccrued.summary.leaseStartMonth || 'Not found'}`);
        console.log(`   Lease End Month: ${breakdown.breakdown.monthsAccrued.summary.leaseEndMonth || 'Not found'}`);
        console.log(`   Expected Months from Lease: ${breakdown.breakdown.monthsAccrued.summary.expectedMonthsFromLease || 0}`);
        
        console.log(`\n📊 MONTHS ACCRUED SUMMARY:`);
        console.log(`   Total Months: ${breakdown.breakdown.monthsAccrued.summary.totalMonths}`);
        console.log(`   Total Amount: $${breakdown.breakdown.monthsAccrued.summary.totalAmount}`);
        console.log(`   First Month: ${breakdown.breakdown.monthsAccrued.summary.firstMonth}`);
        console.log(`   Last Month: ${breakdown.breakdown.monthsAccrued.summary.lastMonth}`);
        console.log(`   Average Amount: $${breakdown.breakdown.monthsAccrued.summary.averageAmount.toFixed(2)}`);
        
        console.log(`\n📊 MONTHS PAID SUMMARY:`);
        console.log(`   Total Months: ${breakdown.breakdown.monthsPaid.summary.totalMonths}`);
        console.log(`   Total Amount: $${breakdown.breakdown.monthsPaid.summary.totalAmount}`);
        console.log(`   First Month: ${breakdown.breakdown.monthsPaid.summary.firstMonth}`);
        console.log(`   Last Month: ${breakdown.breakdown.monthsPaid.summary.lastMonth}`);
        console.log(`   Average Amount: $${breakdown.breakdown.monthsPaid.summary.averageAmount.toFixed(2)}`);
        
        console.log(`\n📊 OVERALL SUMMARY:`);
        console.log(`   Total Owed: $${breakdown.breakdown.summary.totalOwed}`);
        console.log(`   Total Paid: $${breakdown.breakdown.summary.totalPaid}`);
        console.log(`   Current Balance: $${breakdown.breakdown.summary.currentBalance}`);
        console.log(`   Status: ${breakdown.breakdown.summary.status}`);
        
        // Display detailed months accrued with lease start month indicators
        if (breakdown.breakdown.monthsAccrued.details.length > 0) {
          console.log(`\n📅 MONTHS ACCRUED DETAILS (including lease start month):`);
          breakdown.breakdown.monthsAccrued.details.forEach(month => {
            const leaseStartIndicator = month.isLeaseStartMonth ? ' 🏠 LEASE START' : '';
            const proratedIndicator = month.isProrated ? ' (PRORATED)' : '';
            const transactionIndicator = month.transactionCount > 0 ? ` (${month.transactionCount} transactions)` : ' (NO TRANSACTIONS)';
            
            console.log(`   ${month.month}: $${month.amount}${transactionIndicator}${leaseStartIndicator}${proratedIndicator}`);
            
            month.transactions.forEach(tx => {
              console.log(`     - ${tx.transactionId}: $${tx.amount} on ${new Date(tx.date).toLocaleDateString()}`);
            });
          });
        }
        
        // Display detailed months paid
        if (breakdown.breakdown.monthsPaid.details.length > 0) {
          console.log(`\n💰 MONTHS PAID DETAILS:`);
          breakdown.breakdown.monthsPaid.details.forEach(month => {
            console.log(`   ${month.month}: $${month.amount} (${month.transactionCount} transactions)`);
            month.transactions.forEach(tx => {
              console.log(`     - ${tx.transactionId}: $${tx.amount} (${tx.paymentType}) on ${new Date(tx.date).toLocaleDateString()}`);
            });
          });
        }
        
        // Display monthly payments summary
        if (breakdown.breakdown.monthlyPayments.length > 0) {
          console.log(`\n📋 MONTHLY PAYMENTS SUMMARY:`);
          breakdown.breakdown.monthlyPayments.forEach(mp => {
            console.log(`   ${mp.month}: Expected $${mp.expectedAmount}, Paid $${mp.paidAmount}, Outstanding $${mp.outstandingAmount} (${mp.status})`);
          });
        }
        
      } else {
        console.error('❌ Failed to get breakdown:', breakdown.error);
      }
    }
    
    // Test 4: Verify lease start month is included
    console.log('\n📊 STEP 4: Verifying lease start month inclusion...');
    
    for (const debtor of debtors) {
      const studentId = debtor.user.toString();
      const application = applications.find(app => app.student && app.student.toString() === studentId);
      
      if (application && application.startDate) {
        const startDate = new Date(application.startDate);
        const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        
        console.log(`\nStudent: ${application.firstName} ${application.lastName}`);
        console.log(`   Lease Start Month: ${startMonthKey}`);
        
        const breakdown = await DebtorTransactionSyncService.getDetailedMonthsBreakdown(studentId);
        if (breakdown.success) {
          const hasLeaseStartMonth = breakdown.breakdown.monthsAccrued.details.some(month => 
            month.month === startMonthKey
          );
          
          console.log(`   Lease Start Month Included in Accrued: ${hasLeaseStartMonth ? '✅' : '❌'}`);
          
          if (hasLeaseStartMonth) {
            const leaseStartMonth = breakdown.breakdown.monthsAccrued.details.find(month => 
              month.month === startMonthKey
            );
            console.log(`   Lease Start Month Amount: $${leaseStartMonth.amount}`);
            console.log(`   Is Prorated: ${leaseStartMonth.isProrated ? 'Yes' : 'No'}`);
          }
        }
      }
    }
    
    console.log('\n✅ Lease Start Month Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing lease start months:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testLeaseStartMonths();
