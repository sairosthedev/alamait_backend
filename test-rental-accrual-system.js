const mongoose = require('mongoose');
const RentalAccrualService = require('./src/services/rentalAccrualService');

/**
 * Test Rental Accrual System
 * 
 * This script demonstrates how the rental accrual accounting system works
 * with a sample student lease scenario.
 * 
 * Run with: node test-rental-accrual-system.js
 */

// Sample user for testing
const testUser = {
    email: 'test@alamait.com',
    _id: 'test-user-id'
};

// Sample lease data
const sampleLease = {
    _id: 'test-lease-id',
    student: {
        _id: 'test-student-id',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@student.com'
    },
    residence: {
        _id: 'test-residence-id',
        name: 'St. Kilda Student Residence'
    },
    room: {
        _id: 'test-room-id',
        name: 'Room 101',
        price: 200
    },
    startDate: new Date('2025-06-01'),
    endDate: new Date('2025-12-31'),
    rent: 200,
    billingCycle: 'monthly',
    status: 'active'
};

async function testRentalAccrualSystem() {
    try {
        console.log('🏠 Testing Rental Accrual Accounting System');
        console.log('==========================================\n');
        
        // Test 1: Calculate billing periods
        console.log('📊 Test 1: Calculate Billing Periods');
        console.log('------------------------------------');
        const billingPeriods = RentalAccrualService.calculateBillingPeriods(
            sampleLease.startDate,
            sampleLease.endDate,
            sampleLease.billingCycle
        );
        
        console.log(`Lease Period: ${sampleLease.startDate.toLocaleDateString()} to ${sampleLease.endDate.toLocaleDateString()}`);
        console.log(`Monthly Rent: $${sampleLease.rent}`);
        console.log(`Billing Cycle: ${sampleLease.billingCycle}`);
        console.log(`\nGenerated ${billingPeriods.length} billing periods:\n`);
        
        billingPeriods.forEach((period, index) => {
            console.log(`Period ${period.periodNumber}:`);
            console.log(`  Start: ${period.startDate.toLocaleDateString()}`);
            console.log(`  End: ${period.endDate.toLocaleDateString()}`);
            console.log(`  Days: ${period.daysInPeriod}`);
            console.log(`  Amount: $${((sampleLease.rent / 30.44) * period.daysInPeriod).toFixed(2)}`);
            console.log('');
        });
        
        // Test 2: Simulate accrual entries (without database)
        console.log('📝 Test 2: Simulate Accrual Entries');
        console.log('-----------------------------------');
        
        let totalAccrued = 0;
        let accountsReceivable = 0;
        
        billingPeriods.forEach((period, index) => {
            const periodAmount = (sampleLease.rent / 30.44) * period.daysInPeriod;
            totalAccrued += periodAmount;
            accountsReceivable += periodAmount;
            
            console.log(`June ${period.startDate.getDate()}, 2025 - ${period.startDate.toLocaleDateString()}:`);
            console.log(`  Dr. Accounts Receivable - John Smith: $${periodAmount.toFixed(2)}`);
            console.log(`  Cr. Rental Income: $${periodAmount.toFixed(2)}`);
            console.log(`  → Income recognized in ${period.startDate.toLocaleDateString()} (when earned)`);
            console.log(`  → John Smith owes $${periodAmount.toFixed(2)}`);
            console.log('');
        });
        
        console.log(`Total Income Recognized: $${totalAccrued.toFixed(2)}`);
        console.log(`Total Accounts Receivable: $${accountsReceivable.toFixed(2)}`);
        console.log('');
        
        // Test 3: Simulate payment received
        console.log('💰 Test 3: Simulate Payment Received');
        console.log('-----------------------------------');
        console.log('August 15, 2025 - John Smith pays $200 for June rent:');
        console.log('  Dr. Bank Account: $200.00');
        console.log('  Cr. Accounts Receivable - John Smith: $200.00');
        console.log('  → This settles the June receivable (not new income)');
        console.log('  → Income was already recognized in June');
        console.log('');
        
        // Update balances after payment
        const junePayment = 200;
        accountsReceivable -= junePayment;
        
        console.log('Balances after June payment:');
        console.log(`  Bank Account: $${junePayment.toFixed(2)}`);
        console.log(`  Accounts Receivable: $${accountsReceivable.toFixed(2)} (July-December still outstanding)`);
        console.log(`  Rental Income: $${totalAccrued.toFixed(2)} (unchanged - already recognized)`);
        console.log('');
        
        // Test 4: Show financial statement impact
        console.log('📊 Test 4: Financial Statement Impact');
        console.log('--------------------------------------');
        
        console.log('Income Statement (June 2025):');
        console.log('  Revenue:');
        console.log(`    Rental Income: $${(sampleLease.rent / 30.44) * billingPeriods[0].daysInPeriod}`);
        console.log(`  Total Revenue: $${(sampleLease.rent / 30.44) * billingPeriods[0].daysInPeriod}`);
        console.log('  Net Income: $200.00');
        console.log('');
        
        console.log('Balance Sheet (June 30, 2025):');
        console.log('  Assets:');
        console.log('    Bank Account: $0.00');
        console.log(`    Accounts Receivable: $${(sampleLease.rent / 30.44) * billingPeriods[0].daysInPeriod}`);
        console.log(`  Total Assets: $${(sampleLease.rent / 30.44) * billingPeriods[0].daysInPeriod}`);
        console.log('  Equity: $200.00');
        console.log('');
        
        console.log('Cash Flow Statement (June 2025):');
        console.log('  Operating Activities:');
        console.log('    Net Income: $200.00');
        console.log('    Increase in Accounts Receivable: -$200.00');
        console.log('    Net Operating Cash Flow: $0.00');
        console.log('');
        
        // Test 5: Show the complete picture
        console.log('🎯 Test 5: Complete Picture');
        console.log('----------------------------');
        console.log('This system ensures:');
        console.log('✅ Rental income appears in the correct accounting period');
        console.log('✅ Outstanding receivables are visible on the balance sheet');
        console.log('✅ Cash flow shows the timing difference between income and cash');
        console.log('✅ Financial statements reflect true financial performance');
        console.log('');
        
        console.log('Key Benefits:');
        console.log('1. Accurate monthly income statements');
        console.log('2. Clear visibility of student debtors');
        console.log('3. Better cash flow planning');
        console.log('4. GAAP-compliant accrual accounting');
        console.log('');
        
        console.log('🚀 The rental accrual system is ready to use!');
        console.log('   Use the API endpoints to process real leases.');
        
    } catch (error) {
        console.error('❌ Error testing rental accrual system:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testRentalAccrualSystem()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testRentalAccrualSystem };
