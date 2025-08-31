const mongoose = require('mongoose');
require('dotenv').config();

async function testLeaseStartMonthsSimple() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const DebtorTransactionSyncService = require('./src/services/debtorTransactionSyncService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Debtor = require('./src/models/Debtor');
    const Application = require('./src/models/Application');
    
    console.log('🧪 Testing Lease Start Month Inclusion (Simple Test)...\n');
    
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
        
        // Check if start date is not on the 1st of the month (prorated)
        const isProrated = startDate.getDate() > 1;
        console.log(`   Is Prorated Start: ${isProrated ? 'Yes' : 'No'}`);
      }
    });
    
    // Test 2: Check current debtors
    console.log('\n📊 STEP 2: Checking current debtors...');
    const debtors = await Debtor.find({});
    console.log(`📊 Found ${debtors.length} debtors`);
    
    // Test 3: Test lease start month inclusion for each debtor
    console.log('\n📊 STEP 3: Testing lease start month inclusion...');
    
    for (const debtor of debtors) {
      const studentId = debtor.user.toString();
      console.log(`\n🔍 Analyzing debtor: ${debtor.debtorCode}`);
      
      // Find application for this student
      const application = applications.find(app => app.student && app.student.toString() === studentId);
      
      if (application && application.startDate) {
        const startDate = new Date(application.startDate);
        const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        const isProrated = startDate.getDate() > 1;
        
        console.log(`   Student: ${application.firstName} ${application.lastName}`);
        console.log(`   Lease Start Date: ${startDate.toLocaleDateString()}`);
        console.log(`   Lease Start Month: ${startMonthKey}`);
        console.log(`   Is Prorated: ${isProrated ? 'Yes' : 'No'}`);
        
        // Test the updateMonthsAccruedAndPaidSummary method directly
        try {
          await DebtorTransactionSyncService.updateMonthsAccruedAndPaidSummary(debtor, studentId);
          await debtor.save();
          
          console.log(`   ✅ Months summary updated successfully`);
          
          if (debtor.monthsAccrued && debtor.monthsAccrued.length > 0) {
            console.log(`   📊 Months Accrued Summary:`);
            console.log(`      Total Months: ${debtor.monthsAccruedSummary.totalMonths}`);
            console.log(`      Total Amount: $${debtor.monthsAccruedSummary.totalAmount}`);
            console.log(`      Lease Start Month: ${debtor.monthsAccruedSummary.leaseStartMonth}`);
            console.log(`      Lease End Month: ${debtor.monthsAccruedSummary.leaseEndMonth}`);
            console.log(`      Expected Months from Lease: ${debtor.monthsAccruedSummary.expectedMonthsFromLease}`);
            
            // Check if lease start month is included
            const hasLeaseStartMonth = debtor.monthsAccrued.some(month => 
              month.month === startMonthKey
            );
            
            console.log(`   🏠 Lease Start Month Included: ${hasLeaseStartMonth ? '✅' : '❌'}`);
            
            if (hasLeaseStartMonth) {
              const leaseStartMonth = debtor.monthsAccrued.find(month => 
                month.month === startMonthKey
              );
              console.log(`      Lease Start Month Amount: $${leaseStartMonth.amount}`);
              console.log(`      Is Prorated Flag: ${leaseStartMonth.isProrated ? 'Yes' : 'No'}`);
              console.log(`      Transaction Count: ${leaseStartMonth.transactionCount}`);
            }
            
            // Display all months accrued
            console.log(`   📅 All Months Accrued:`);
            debtor.monthsAccrued.forEach(month => {
              const leaseStartIndicator = month.isLeaseStartMonth ? ' 🏠 LEASE START' : '';
              const proratedIndicator = month.isProrated ? ' (PRORATED)' : '';
              const transactionIndicator = month.transactionCount > 0 ? ` (${month.transactionCount} transactions)` : ' (NO TRANSACTIONS)';
              
              console.log(`      ${month.month}: $${month.amount}${transactionIndicator}${leaseStartIndicator}${proratedIndicator}`);
            });
          }
          
        } catch (error) {
          console.error(`   ❌ Error updating months summary:`, error.message);
        }
      } else {
        console.log(`   ⚠️ No application found for this student`);
      }
    }
    
    console.log('\n✅ Lease Start Month Simple Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing lease start months:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testLeaseStartMonthsSimple();
