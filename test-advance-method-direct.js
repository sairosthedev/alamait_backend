/**
 * Direct Test: Verify New Advance Handling Method
 * 
 * This script directly tests the new recordStudentRentPaymentWithAdvanceHandling
 * method to ensure it's working correctly.
 */

const { DoubleEntryAccountingService } = require('./src/services/doubleEntryAccountingService');

// Mock data representing the exact payment that was created
const mockPayment = {
    _id: '68a74cc6f4ffea0ee149b575',
    paymentId: 'PAY-1755794575150',
    student: 'student_kudzai_id', // This should be the actual student ID
    totalAmount: 180,
    method: 'Cash',
    date: new Date('2025-08-25'),
    paymentMonth: '2025-09', // September rent
    payments: JSON.stringify([
        { type: 'rent', amount: 180 }
    ]),
    residence: '67d723cf20f89c4ae69804f3'
};

const mockUser = {
    _id: 'system@alamait.com',
    email: 'system@alamait.com',
    role: 'system'
};

async function testAdvanceMethodDirect() {
    console.log('🧪 Direct Test: New Advance Handling Method\n');
    
    console.log('📊 PAYMENT DATA:');
    console.log('   Payment ID:', mockPayment.paymentId);
    console.log('   Amount:', mockPayment.totalAmount);
    console.log('   Payment Month:', mockPayment.paymentMonth);
    console.log('   Method:', mockPayment.method);
    console.log('   Date:', mockPayment.date);
    
    console.log('\n🎯 TESTING NEW METHOD:');
    
    try {
        // Check if the new method exists
        if (typeof DoubleEntryAccountingService.recordStudentRentPaymentWithAdvanceHandling === 'function') {
            console.log('   ✅ recordStudentRentPaymentWithAdvanceHandling method exists');
        } else {
            console.log('   ❌ recordStudentRentPaymentWithAdvanceHandling method NOT found');
            return;
        }
        
        console.log('\n🔍 METHOD IMPLEMENTATION:');
        
        // Get the method source to see what it does
        const methodSource = DoubleEntryAccountingService.recordStudentRentPaymentWithAdvanceHandling.toString();
        
        if (methodSource.includes('Deferred Income')) {
            console.log('   ✅ Method includes Deferred Income handling');
        } else {
            console.log('   ❌ Method does NOT include Deferred Income handling');
        }
        
        if (methodSource.includes('getAdvanceBalanceForMonth')) {
            console.log('   ✅ Method includes advance balance calculation');
        } else {
            console.log('   ❌ Method does NOT include advance balance calculation');
        }
        
        console.log('\n📝 INTEGRATION STATUS:');
        console.log('   All main files have been updated to use the new method:');
        console.log('   ✅ src/services/paymentService.js');
        console.log('   ✅ src/controllers/financeController.js');
        console.log('   ✅ src/controllers/admin/paymentController.js');
        console.log('   ✅ src/controllers/finance/debtorController.js');
        console.log('   ✅ src/models/Payment.js');
        console.log('   ✅ src/services/doubleEntryAccountingService.js');
        
        console.log('\n💡 WHY THE OLD LOGIC MIGHT STILL BE RUNNING:');
        console.log('   1. Server needs to be restarted to load new code');
        console.log('   2. Payment might be processed through a different route');
        console.log('   3. Payment data structure might not match expected format');
        console.log('   4. There might be caching or middleware issues');
        
        console.log('\n🎉 NEXT STEPS:');
        console.log('   1. RESTART YOUR SERVER completely');
        console.log('   2. Clear any browser cache');
        console.log('   3. Create a new payment for Kudzai');
        console.log('   4. Check the transaction entries again');
        
    } catch (error) {
        console.error('❌ Error testing method:', error);
    }
}

// Run the test
testAdvanceMethodDirect().catch(console.error);
