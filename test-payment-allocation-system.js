/**
 * Payment Allocation System Test Script
 * 
 * This script demonstrates the FIFO-based payment allocation system
 * using the example scenario:
 * 
 * Student lease: 15 May - 29 Sept
 * Monthly rent: $180
 * Admin fee: $20 (first month only)
 * Deposit: $180
 * First month prorated
 * 
 * When student pays $380 ($180 rent + $20 admin + $180 deposit):
 * - May will be balanced but remains $81 (prorated amount)
 * - June reduces by the portion given
 * - Balance sheet should always balance
 */

const mongoose = require('mongoose');
const PaymentAllocationService = require('./src/services/paymentAllocationService');
const Payment = require('./src/models/Payment');
const TransactionEntry = require('./src/models/TransactionEntry');
const User = require('./src/models/User');
const Residence = require('./src/models/Residence');
const Debtor = require('./src/models/Debtor');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testPaymentAllocationSystem() {
    try {
        console.log('🚀 Testing Payment Allocation System');
        console.log('=====================================\n');

        // Step 1: Create test student
        console.log('1️⃣ Creating test student...');
        const testStudent = new User({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            phone: '+1234567890',
            role: 'student',
            status: 'active'
        });
        await testStudent.save();
        console.log(`✅ Test student created: ${testStudent.firstName} ${testStudent.lastName} (ID: ${testStudent._id})`);

        // Step 2: Create test residence
        console.log('\n2️⃣ Creating test residence...');
        const testResidence = new Residence({
            name: 'Test Residence',
            address: '123 Test Street',
            status: 'active'
        });
        await testResidence.save();
        console.log(`✅ Test residence created: ${testResidence.name} (ID: ${testResidence._id})`);

        // Step 3: Create lease accruals for the student
        console.log('\n3️⃣ Creating lease accruals...');
        
        // Calculate lease period: May 15 - Sept 29, 2024
        const leaseStartDate = new Date('2024-05-15');
        const leaseEndDate = new Date('2024-09-29');
        
        // Calculate first month proration (May 15-31 = 17 days)
        const daysInMay = new Date(2024, 5, 0).getDate(); // 31 days
        const daysFromMay15 = daysInMay - 15 + 1; // 17 days
        const mayProration = (180 * daysFromMay15) / daysInMay; // $98.71
        
        console.log(`   Lease period: ${leaseStartDate.toDateString()} to ${leaseEndDate.toDateString()}`);
        console.log(`   May proration: $${mayProration.toFixed(2)} (${daysFromMay15} days)`);

        // Create accruals for each month
        const months = [
            { month: '2024-05', amount: mayProration + 20, description: 'May rent (prorated) + Admin fee' },
            { month: '2024-06', amount: 180, description: 'June rent' },
            { month: '2024-07', amount: 180, description: 'July rent' },
            { month: '2024-08', amount: 180, description: 'August rent' },
            { month: '2024-09', amount: 180, description: 'September rent' }
        ];

        const accrualTransactions = [];
        
        for (const monthData of months) {
            const [year, month] = monthData.month.split('-');
            const transactionDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            
            const accrualTransaction = new TransactionEntry({
                transactionId: `ACCRUAL-${monthData.month}-${testStudent._id}`,
                date: transactionDate,
                description: `Rental Accrual - ${monthData.description}`,
                entries: [
                    // Debit AR account
                    {
                        accountCode: `1100-${year}-${month}-${testStudent._id}`,
                        accountName: `Accounts Receivable - ${new Date(transactionDate).toLocaleString('default', { month: 'long' })} ${year}`,
                        accountType: 'asset',
                        debit: monthData.amount,
                        credit: 0,
                        description: monthData.description
                    },
                    // Credit Revenue account
                    {
                        accountCode: '4000',
                        accountName: 'Rental Revenue',
                        accountType: 'revenue',
                        debit: 0,
                        credit: monthData.amount,
                        description: monthData.description
                    }
                ],
                totalDebit: monthData.amount,
                totalCredit: monthData.amount,
                source: 'rental_accrual',
                sourceModel: 'TransactionEntry',
                residence: testResidence._id,
                createdBy: 'system',
                metadata: {
                    studentId: testStudent._id.toString(),
                    monthKey: monthData.month,
                    year: parseInt(year),
                    month: parseInt(month),
                    monthName: new Date(transactionDate).toLocaleString('default', { month: 'long' }),
                    type: 'rental_accrual',
                    amount: monthData.amount,
                    description: monthData.description
                }
            });
            
            await accrualTransaction.save();
            accrualTransactions.push(accrualTransaction);
            console.log(`   ✅ Created accrual for ${monthData.month}: $${monthData.amount.toFixed(2)}`);
        }

        // Step 4: Create deposit accrual
        console.log('\n4️⃣ Creating deposit accrual...');
        const depositTransaction = new TransactionEntry({
            transactionId: `DEPOSIT-${testStudent._id}`,
            date: leaseStartDate,
            description: 'Security Deposit',
            entries: [
                // Debit AR account for deposit
                {
                    accountCode: `1100-DEPOSIT-${testStudent._id}`,
                    accountName: 'Security Deposit Receivable',
                    accountType: 'asset',
                    debit: 180,
                    credit: 0,
                    description: 'Security deposit'
                },
                // Credit Security Deposit liability
                {
                    accountCode: '2200',
                    accountName: 'Security Deposits',
                    accountType: 'liability',
                    debit: 0,
                    credit: 180,
                    description: 'Security deposit received'
                }
            ],
            totalDebit: 180,
            totalCredit: 180,
            source: 'lease_start',
            sourceModel: 'TransactionEntry',
            residence: testResidence._id,
            createdBy: 'system',
            metadata: {
                studentId: testStudent._id.toString(),
                type: 'security_deposit',
                amount: 180,
                description: 'Security deposit'
            }
        });
        
        await depositTransaction.save();
        console.log(`   ✅ Created deposit accrual: $180.00`);

        // Step 5: Check initial AR balances
        console.log('\n5️⃣ Checking initial AR balances...');
        const initialARBalances = await PaymentAllocationService.getStudentARBalances(testStudent._id.toString());
        
        console.log('   Initial AR Balances:');
        initialARBalances.forEach(balance => {
            console.log(`   - ${balance.monthKey}: $${balance.balance.toFixed(2)} (${balance.accountName})`);
        });

        const totalInitialAR = initialARBalances.reduce((sum, balance) => sum + balance.balance, 0);
        console.log(`   Total AR: $${totalInitialAR.toFixed(2)}`);

        // Step 6: Create a payment of $380
        console.log('\n6️⃣ Creating payment of $380...');
        const payment = new Payment({
            paymentId: `PAY-${Date.now()}`,
            student: testStudent._id,
            user: testStudent._id,
            residence: testResidence._id,
            room: 'A101',
            roomType: 'Single',
            rentAmount: 180,
            adminFee: 20,
            deposit: 180,
            amount: 380,
            payments: [
                { type: 'rent', amount: 180 },
                { type: 'admin', amount: 20 },
                { type: 'deposit', amount: 180 }
            ],
            totalAmount: 380,
            paymentMonth: '2024-05',
            date: new Date('2024-05-20'),
            method: 'Bank Transfer',
            status: 'Confirmed',
            description: 'Test payment for lease period'
        });
        
        await payment.save();
        console.log(`   ✅ Payment created: $${payment.totalAmount.toFixed(2)}`);

        // Step 7: Auto-allocate the payment
        console.log('\n7️⃣ Auto-allocating payment using FIFO...');
        const paymentData = {
            paymentId: payment._id.toString(),
            totalAmount: payment.totalAmount,
            studentId: payment.student.toString(),
            residenceId: payment.residence.toString(),
            paymentMonth: payment.paymentMonth,
            date: payment.date,
            method: payment.method,
            rentAmount: payment.rentAmount,
            adminFee: payment.adminFee,
            deposit: payment.deposit
        };

        const allocationResult = await PaymentAllocationService.autoAllocatePayment(paymentData);
        
        if (allocationResult.success) {
            console.log('   ✅ Payment allocated successfully!');
            console.log('   Allocation Summary:');
            console.log(`   - Months covered: ${allocationResult.allocation.summary.monthsCovered}`);
            console.log(`   - Total allocated: $${allocationResult.allocation.summary.totalAllocated.toFixed(2)}`);
            console.log(`   - Advance payment: $${allocationResult.allocation.summary.advancePaymentAmount.toFixed(2)}`);
            console.log(`   - Oldest month settled: ${allocationResult.allocation.summary.oldestMonthSettled}`);
            console.log(`   - Newest month settled: ${allocationResult.allocation.summary.newestMonthSettled}`);
            
            console.log('\n   Monthly Breakdown:');
            allocationResult.allocation.monthlyBreakdown.forEach(allocation => {
                console.log(`   - ${allocation.month}: $${allocation.amountAllocated.toFixed(2)} (${allocation.allocationType})`);
            });
        } else {
            console.log('   ❌ Payment allocation failed:');
            console.log(`   - Error: ${allocationResult.error}`);
            console.log(`   - Message: ${allocationResult.message}`);
        }

        // Step 8: Check final AR balances
        console.log('\n8️⃣ Checking final AR balances...');
        const finalARBalances = await PaymentAllocationService.getStudentARBalances(testStudent._id.toString());
        
        console.log('   Final AR Balances:');
        finalARBalances.forEach(balance => {
            console.log(`   - ${balance.monthKey}: $${balance.balance.toFixed(2)} (${balance.accountName})`);
        });

        const totalFinalAR = finalARBalances.reduce((sum, balance) => sum + balance.balance, 0);
        console.log(`   Total AR: $${totalFinalAR.toFixed(2)}`);

        // Step 9: Verify balance sheet balance
        console.log('\n9️⃣ Verifying balance sheet balance...');
        
        // Get all transactions for this student
        const allTransactions = await TransactionEntry.find({
            'entries.accountCode': { $regex: `^1100-${testStudent._id}` }
        }).sort({ date: 1 });

        let totalDebits = 0;
        let totalCredits = 0;

        allTransactions.forEach(transaction => {
            transaction.entries.forEach(entry => {
                if (entry.accountCode.startsWith('1100-')) {
                    totalDebits += entry.debit || 0;
                    totalCredits += entry.credit || 0;
                }
            });
        });

        const netAR = totalDebits - totalCredits;
        console.log(`   Total AR Debits: $${totalDebits.toFixed(2)}`);
        console.log(`   Total AR Credits: $${totalCredits.toFixed(2)}`);
        console.log(`   Net AR Balance: $${netAR.toFixed(2)}`);
        console.log(`   Expected AR Balance: $${totalFinalAR.toFixed(2)}`);
        
        if (Math.abs(netAR - totalFinalAR) < 0.01) {
            console.log('   ✅ Balance sheet is balanced!');
        } else {
            console.log('   ❌ Balance sheet imbalance detected!');
        }

        // Step 10: Show payment allocation history
        console.log('\n🔟 Payment allocation history...');
        const allocationHistory = await PaymentAllocationService.getStudentPaymentCoverage(testStudent._id.toString());
        
        console.log('   Payment Coverage Summary:');
        console.log(`   - Total AR: $${allocationHistory.summary.totalAR.toFixed(2)}`);
        console.log(`   - Total Paid: $${allocationHistory.summary.totalPaid.toFixed(2)}`);
        console.log(`   - Months with AR: ${allocationHistory.summary.monthsWithAR}`);
        console.log(`   - Months fully paid: ${allocationHistory.summary.monthsFullyPaid}`);
        console.log(`   - Months partially paid: ${allocationHistory.summary.monthsPartiallyPaid}`);
        console.log(`   - Months unpaid: ${allocationHistory.summary.monthsUnpaid}`);

        console.log('\n   Monthly Coverage:');
        Object.entries(allocationHistory.monthlyCoverage).forEach(([month, coverage]) => {
            console.log(`   - ${month}: $${coverage.arBalance.toFixed(2)} AR, Status: ${coverage.status}`);
        });

        console.log('\n✅ Payment Allocation System Test Completed Successfully!');
        console.log('\n📊 SUMMARY:');
        console.log('=====================================');
        console.log(`Student: ${testStudent.firstName} ${testStudent.lastName}`);
        console.log(`Lease Period: ${leaseStartDate.toDateString()} - ${leaseEndDate.toDateString()}`);
        console.log(`Payment Made: $${payment.totalAmount.toFixed(2)} on ${payment.date.toDateString()}`);
        console.log(`Initial AR: $${totalInitialAR.toFixed(2)}`);
        console.log(`Final AR: $${totalFinalAR.toFixed(2)}`);
        console.log(`Amount Settled: $${(totalInitialAR - totalFinalAR).toFixed(2)}`);
        console.log(`Balance Sheet Balanced: ${Math.abs(netAR - totalFinalAR) < 0.01 ? '✅ Yes' : '❌ No'}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        try {
            await User.findByIdAndDelete(testStudent._id);
            await Residence.findByIdAndDelete(testResidence._id);
            await Payment.findByIdAndDelete(payment._id);
            await TransactionEntry.deleteMany({
                'entries.accountCode': { $regex: `^1100-${testStudent._id}` }
            });
            console.log('✅ Test data cleaned up');
        } catch (cleanupError) {
            console.error('⚠️ Error during cleanup:', cleanupError.message);
        }
        
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
if (require.main === module) {
    testPaymentAllocationSystem();
}

module.exports = { testPaymentAllocationSystem };

