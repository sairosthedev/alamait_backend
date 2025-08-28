
/**
 * Test Payment Month Extraction Fix
 */

const mongoose = require('mongoose');
const PaymentAllocationService = require('./src/services/paymentAllocationService');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testPaymentMonthExtraction() {
    try {
        console.log('🧪 Testing Payment Month Extraction Fix');
        console.log('=======================================\n');

        // Find a recent payment transaction
        const paymentTransaction = await TransactionEntry.findOne({
            source: 'payment'
        }).sort({ createdAt: -1 });

        if (!paymentTransaction) {
            console.log('❌ No payment transaction found for testing');
            return;
        }

        console.log(`✅ Found payment transaction: ${paymentTransaction.transactionId}`);
        console.log(`   Description: ${paymentTransaction.description}`);
        console.log(`   Date: ${paymentTransaction.date}`);
        console.log(`   Amount: ${paymentTransaction.totalDebit || paymentTransaction.totalCredit}`);

        // Extract student ID
        const arEntry = paymentTransaction.entries.find(e => e.accountCode.startsWith('1100-'));
        if (!arEntry) {
            console.log('❌ No AR entry found in payment transaction');
            return;
        }

        const studentId = arEntry.accountCode.split('-').pop();
        console.log(`✅ Student ID: ${studentId}`);

        // Test the new extraction method
        const paymentData = {
            paymentId: paymentTransaction._id.toString(),
            totalAmount: paymentTransaction.totalDebit || paymentTransaction.totalCredit || 0,
            studentId: studentId,
            residenceId: paymentTransaction.residence || '67d723cf20f89c4ae69804f3',
            date: paymentTransaction.date,
            method: 'Cash',
            rentAmount: 220,
            adminFee: 20,
            deposit: 220
        };

        // Get AR balances
        const arBalances = await PaymentAllocationService.getStudentARBalances(studentId);
        console.log(`📊 Found ${arBalances.length} AR balances`);

        // Test extraction
        const extractedMonth = PaymentAllocationService.extractPaymentMonthFromTransaction(paymentData, arBalances);
        console.log(`🎯 Extracted Payment Month: ${extractedMonth}`);

        // Test auto-allocation
        console.log('\n🚀 Testing auto-allocation with extracted month...');
        const allocationResult = await PaymentAllocationService.autoAllocatePayment(paymentData);
        
        if (allocationResult.success) {
            console.log('✅ Auto-allocation successful!');
            console.log(`   Effective Payment Month: ${allocationResult.allocation.summary.effectivePaymentMonth}`);
            console.log(`   Months covered: ${allocationResult.allocation.summary.monthsCovered}`);
        } else {
            console.log('❌ Auto-allocation failed:', allocationResult.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
if (require.main === module) {
    testPaymentMonthExtraction();
}