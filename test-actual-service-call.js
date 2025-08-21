/**
 * Test Script: Actual Service Call
 * 
 * This script actually calls the DoubleEntryAccountingService to see
 * what's happening in the real execution flow.
 */

const DoubleEntryAccountingService = require('./src/services/doubleEntryAccountingService');

// Mock the exact payment data from the failing transaction
const mockPayment = {
    _id: '68a7a428213086043cfe1a81',
    paymentId: 'PAY-1755816026093',
    student: '68a79d4ccf2312d7053d09e8',
    totalAmount: 180,
    method: 'Cash',
    date: new Date('2025-08-28'),
    paymentMonth: '2025-09', // This should trigger advance payment logic
    residence: '67d723cf20f89c4ae69804f3',
    payments: [
        { type: 'rent', amount: 180 }
    ]
};

const mockUser = {
    _id: 'system@alamait.com',
    email: 'system@alamait.com'
};

async function testActualServiceCall() {
    try {
        console.log('🧪 Testing Actual Service Call');
        console.log('================================');
        console.log(`Payment ID: ${mockPayment.paymentId}`);
        console.log(`Payment Month: ${mockPayment.paymentMonth}`);
        console.log(`Amount: $${mockPayment.totalAmount}`);
        console.log(`Payment Breakdown:`, mockPayment.payments);
        
        console.log('\n🔍 Attempting to call recordStudentRentPayment...');
        
        // Try to call the actual service method
        const result = await DoubleEntryAccountingService.recordStudentRentPayment(mockPayment, mockUser);
        
        console.log('\n✅ Service call completed successfully!');
        console.log('Result:', result);
        
    } catch (error) {
        console.error('\n❌ Service call failed:', error.message);
        console.error('Error details:', error);
        
        // Check if it's a database connection issue
        if (error.message.includes('connect') || error.message.includes('MongoDB')) {
            console.log('\n💡 This appears to be a database connection issue');
            console.log('   The payment month parsing logic is working, but the service can\'t connect to the database');
        }
        
        // Check if it's a model import issue
        if (error.message.includes('Cannot find module') || error.message.includes('require')) {
            console.log('\n💡 This appears to be a module import issue');
            console.log('   The service can\'t find required models or dependencies');
        }
        
        // Check if it's a validation issue
        if (error.message.includes('validation') || error.message.includes('ValidationError')) {
            console.log('\n💡 This appears to be a data validation issue');
            console.log('   The payment data might not match the expected schema');
        }
    }
}

// Run the test
testActualServiceCall().then(() => {
    console.log('\n🧪 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
