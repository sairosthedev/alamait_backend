/**
 * Test Payment Month Extraction - Working Version
 * 
 * This script tests the payment allocation system with real payment data
 * and correctly extracts the payment month from transaction data.
 */

const mongoose = require('mongoose');
const PaymentAllocationService = require('./src/services/paymentAllocationService');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testPaymentMonthExtractionWorking() {
    try {
        console.log('🧪 Testing Payment Month Extraction - Working Version');
        console.log('====================================================\n');

        // Step 1: Find a real payment transaction
        console.log('1️⃣ Finding a real payment transaction...');
        const paymentTransaction = await TransactionEntry.findOne({
            source: 'payment'
        }).sort({ createdAt: -1 });
        
        if (!paymentTransaction) {
            console.log('❌ No payment transaction found');
            return;
        }

        console.log(`✅ Found payment transaction: ${paymentTransaction.transactionId}`);
        console.log(`   Description: ${paymentTransaction.description}`);
        console.log(`   Amount: $${paymentTransaction.totalDebit || paymentTransaction.totalCredit || 0}`);
        console.log(`   Total Debit: $${paymentTransaction.totalDebit}`);
        console.log(`   Total Credit: $${paymentTransaction.totalCredit}`);
        console.log(`   Source: ${paymentTransaction.source}`);
        console.log(`   Date: ${paymentTransaction.date}`);

        // Step 2: Find the student ID from the transaction
        console.log('\n2️⃣ Finding student ID...');
        const arEntry = paymentTransaction.entries.find(e => e.accountCode.startsWith('1100-'));
        if (!arEntry) {
            console.log('❌ No AR entry found in payment transaction');
            return;
        }

        const studentId = arEntry.accountCode.split('-').pop();
        console.log(`✅ Student ID: ${studentId}`);

        // Step 3: Test getStudentARBalances
        console.log('\n3️⃣ Testing getStudentARBalances...');
        
        let arBalances = [];
        try {
            arBalances = await PaymentAllocationService.getStudentARBalances(studentId);
            console.log(`✅ AR balances found: ${arBalances.length}`);
            
            if (arBalances.length > 0) {
                console.log('   AR Balances:');
                arBalances.forEach((balance, index) => {
                    console.log(`   ${index + 1}. ${balance.monthKey}: $${balance.balance.toFixed(2)}`);
                    console.log(`      Original Debt: $${balance.originalDebt.toFixed(2)}`);
                    console.log(`      Paid Amount: $${balance.paidAmount.toFixed(2)}`);
                    console.log(`      Transaction ID: ${balance.transactionId}`);
                });
            } else {
                console.log('   ❌ No AR balances found');
            }
        } catch (error) {
            console.log(`❌ Error getting AR balances: ${error.message}`);
        }

        // Step 4: Test payment month extraction
        console.log('\n4️⃣ Testing payment month extraction...');
        
        const paymentData = {
            paymentId: paymentTransaction._id.toString(),
            totalAmount: paymentTransaction.totalDebit || paymentTransaction.totalCredit || 0,
            studentId: studentId,
            residenceId: paymentTransaction.residence || '67d723cf20f89c4ae69804f3',
            // 🆕 REMOVED: paymentMonth: '2025-08', // Let the system extract it from transaction data
            date: paymentTransaction.date,
            method: 'Cash',
            rentAmount: 220,
            adminFee: 20,
            deposit: 220
        };
        
        console.log('   Payment Data:', JSON.stringify(paymentData, null, 2));
        
        // Test the extraction method directly
        const extractedMonth = PaymentAllocationService.extractPaymentMonthFromTransaction(paymentData, arBalances);
        console.log(`   🎯 Extracted Payment Month: ${extractedMonth}`);
        console.log(`   📅 Transaction Date: ${paymentTransaction.date}`);
        console.log(`   📅 Expected Month: ${new Date(paymentTransaction.date).getFullYear()}-${String(new Date(paymentTransaction.date).getMonth() + 1).padStart(2, '0')}`);

        // Step 5: Test auto-allocation with extracted month
        console.log('\n5️⃣ Testing auto-allocation with extracted month...');
        
        try {
            console.log('   🚀 Running auto-allocation...');
            const allocationResult = await PaymentAllocationService.autoAllocatePayment(paymentData);
            
            if (allocationResult.success) {
                console.log('   ✅ Auto-allocation successful!');
                console.log(`   Effective Payment Month: ${allocationResult.allocation.summary.effectivePaymentMonth}`);
                console.log(`   Months covered: ${allocationResult.allocation.summary.monthsCovered}`);
                console.log(`   Total allocated: $${allocationResult.allocation.summary.totalAllocated.toFixed(2)}`);
                console.log(`   Advance payment: $${allocationResult.allocation.summary.advancePaymentAmount.toFixed(2)}`);
                
                console.log('\n   Monthly Breakdown:');
                allocationResult.allocation.monthlyBreakdown.forEach(allocation => {
                    console.log(`   - ${allocation.month}: $${allocation.amountAllocated.toFixed(2)} (${allocation.allocationType})`);
                });
            } else {
                console.log('   ❌ Auto-allocation failed:');
                console.log(`   Error: ${allocationResult.error}`);
                console.log(`   Message: ${allocationResult.message}`);
            }
        } catch (error) {
            console.log(`❌ Error in auto-allocation: ${error.message}`);
            console.log(`   Stack: ${error.stack}`);
        }

        console.log('\n✅ Payment Month Extraction Test Complete!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
if (require.main === module) {
    testPaymentMonthExtractionWorking();
}

module.exports = { testPaymentMonthExtractionWorking };

