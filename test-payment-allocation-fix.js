/**
 * Test Payment Allocation Fix
 * 
 * This script tests the fixed payment allocation system
 */

const mongoose = require('mongoose');
const PaymentAllocationService = require('./src/services/paymentAllocationService');
const TransactionEntry = require('./src/models/TransactionEntry');
const Payment = require('./src/models/Payment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testPaymentAllocationFix() {
    try {
        console.log('🧪 Testing Payment Allocation Fix');
        console.log('==================================\n');

        // Step 1: Find the payment that was created
        console.log('1️⃣ Finding the recent payment...');
        const payment = await Payment.findOne().sort({ createdAt: -1 });
        
        if (!payment) {
            console.log('❌ No payment found');
            return;
        }

        console.log(`✅ Found payment: ${payment.paymentId} - $${payment.totalAmount}`);
        console.log(`   Student: ${payment.student}`);
        console.log(`   Date: ${payment.date}`);
        console.log(`   Status: ${payment.status}`);

        // Step 2: Test getStudentARBalances
        console.log('\n2️⃣ Testing getStudentARBalances...');
        const studentId = payment.student.toString();
        
        try {
            const arBalances = await PaymentAllocationService.getStudentARBalances(studentId);
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

        // Step 3: Test auto-allocation
        console.log('\n3️⃣ Testing auto-allocation...');
        
        const paymentData = {
            paymentId: payment._id.toString(),
            totalAmount: payment.totalAmount,
            studentId: payment.student.toString(),
            residenceId: payment.residence.toString(),
            paymentMonth: payment.paymentMonth,
            date: payment.date,
            method: payment.method,
            rentAmount: payment.rentAmount || 0,
            adminFee: payment.adminFee || 0,
            deposit: payment.deposit || 0
        };
        
        try {
            console.log('   🚀 Running auto-allocation...');
            const allocationResult = await PaymentAllocationService.autoAllocatePayment(paymentData);
            
            if (allocationResult.success) {
                console.log('   ✅ Auto-allocation successful!');
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

        // Step 4: Check the created transactions
        console.log('\n4️⃣ Checking created transactions...');
        
        const recentTransactions = await TransactionEntry.find({
            'metadata.paymentAllocation.paymentId': payment._id.toString()
        }).sort({ createdAt: -1 });

        console.log(`✅ Found ${recentTransactions.length} allocation transactions`);
        
        recentTransactions.forEach((tx, index) => {
            console.log(`   ${index + 1}. ${tx.transactionId} - ${tx.description}`);
            console.log(`      Amount: $${tx.amount || tx.totalDebit || 0}`);
            console.log(`      Total Debit: $${tx.totalDebit}`);
            console.log(`      Total Credit: $${tx.totalCredit}`);
            console.log(`      Source: ${tx.source}`);
            console.log(`      Type: ${tx.type}`);
            
            tx.entries.forEach(entry => {
                console.log(`        ${entry.accountCode}: Debit $${entry.debit}, Credit $${entry.credit}`);
            });
        });

        console.log('\n✅ Payment Allocation Fix Test Complete!');

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
    testPaymentAllocationFix();
}

module.exports = { testPaymentAllocationFix };

