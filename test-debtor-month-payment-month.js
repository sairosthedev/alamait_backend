require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const PaymentService = require('./src/services/paymentService');

async function testDebtorMonthAndPaymentMonth() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🧪 Testing Enhanced Debtor Month and Payment Month Display...');
        console.log('==========================================================');

        // Test 1: Get a debtor and show their month and payment month summary
        console.log('\n🔍 Test 1: Getting Debtor Month and Payment Month Summary');
        console.log('==========================================================');
        
        const debtors = await Debtor.find({}).limit(3);
        
        if (debtors.length === 0) {
            console.log('❌ No debtors found in the database');
            return;
        }

        const testDebtor = debtors[0];
        console.log(`✅ Found debtor: ${testDebtor.debtorCode}`);
        console.log(`   User: ${testDebtor.user}`);
        console.log(`   Total Monthly Payments: ${testDebtor.monthlyPayments.length}`);
        console.log(`   Total Payment History: ${testDebtor.paymentHistory.length}`);

        // Show the enhanced month and payment month summary
        const monthSummary = testDebtor.getMonthAndPaymentMonthSummary();
        
        console.log('\n📊 Enhanced Month and Payment Month Summary:');
        console.log('===========================================');
        console.log(`Debtor Code: ${monthSummary.debtorCode}`);
        console.log(`Total Months: ${monthSummary.totalMonths}`);
        console.log(`Total Payments: ${monthSummary.totalPayments}`);
        
        if (monthSummary.monthlySummary.length > 0) {
            console.log('\n📅 Monthly Summary with Payment Month Details:');
            monthSummary.monthlySummary.forEach((month, index) => {
                console.log(`\n   ${index + 1}. Month: ${month.monthDisplay} (${month.month})`);
                console.log(`      Expected Amount: $${month.expectedAmount}`);
                console.log(`      Paid Amount: $${month.paidAmount}`);
                console.log(`      Outstanding Amount: $${month.outstandingAmount}`);
                console.log(`      Status: ${month.status}`);
                
                if (month.paymentMonths.length > 0) {
                    console.log(`      Payment Months: ${month.paymentMonths.length} payment(s)`);
                    month.paymentMonths.forEach((pm, pmIndex) => {
                        console.log(`         ${pmIndex + 1}. Payment Month: ${pm.paymentMonthDisplay} (${pm.paymentMonth})`);
                        console.log(`            Payment Date: ${pm.paymentDate}`);
                        console.log(`            Amount: $${pm.amount}`);
                        console.log(`            Payment ID: ${pm.paymentId}`);
                        console.log(`            Status: ${pm.status}`);
                    });
                } else {
                    console.log(`      Payment Months: No payments recorded`);
                }
                
                console.log(`      Payment Month Summary:`);
                console.log(`         Total Payment Months: ${month.paymentMonthSummary.totalPaymentMonths}`);
                console.log(`         First Payment Month: ${month.paymentMonthSummary.firstPaymentMonthDisplay}`);
                console.log(`         Last Payment Month: ${month.paymentMonthSummary.lastPaymentMonthDisplay}`);
                
                if (month.paymentMonthSummary.paymentMonthBreakdown.length > 0) {
                    console.log(`         Payment Month Breakdown:`);
                    month.paymentMonthSummary.paymentMonthBreakdown.forEach((mb, mbIndex) => {
                        console.log(`            ${mbIndex + 1}. ${mb.monthDisplay} (${mb.month}): $${mb.amount} (${mb.paymentCount} payment(s))`);
                    });
                }
            });
        } else {
            console.log('\n⚠️  No monthly payments recorded for this debtor');
        }

        // Test 2: Show payment history with month and payment month
        console.log('\n🔍 Test 2: Payment History with Month and Payment Month');
        console.log('=======================================================');
        
        if (monthSummary.paymentHistory.length > 0) {
            console.log(`\n💰 Payment History (${monthSummary.paymentHistory.length} payments):`);
            monthSummary.paymentHistory.forEach((payment, index) => {
                console.log(`\n   ${index + 1}. Payment ID: ${payment.paymentId}`);
                console.log(`      Amount: $${payment.amount}`);
                console.log(`      Allocated Month: ${payment.allocatedMonthDisplay} (${payment.allocatedMonth})`);
                console.log(`      Payment Month: ${payment.paymentMonthDisplay} (${payment.paymentMonth})`);
                console.log(`      Payment Date: ${payment.paymentDate}`);
                console.log(`      Method: ${payment.paymentMethod}`);
                console.log(`      Status: ${payment.status}`);
                
                if (payment.components) {
                    console.log(`      Components:`);
                    if (payment.components.rent > 0) console.log(`         Rent: $${payment.components.rent}`);
                    if (payment.components.adminFee > 0) console.log(`         Admin Fee: $${payment.components.adminFee}`);
                    if (payment.components.deposit > 0) console.log(`         Deposit: $${payment.components.deposit}`);
                }
            });
        } else {
            console.log('\n⚠️  No payment history recorded for this debtor');
        }

        // Test 3: Test specific month summary
        console.log('\n🔍 Test 3: Specific Month Summary');
        console.log('=================================');
        
        if (monthSummary.monthlySummary.length > 0) {
            const testMonth = monthSummary.monthlySummary[0].month;
            const specificMonthSummary = testDebtor.getMonthSummary(testMonth);
            
            console.log(`\n📅 Summary for ${specificMonthSummary.monthDisplay} (${testMonth}):`);
            console.log(`   Status: ${specificMonthSummary.status}`);
            console.log(`   Expected Amount: $${specificMonthSummary.expectedAmount}`);
            console.log(`   Paid Amount: $${specificMonthSummary.paidAmount}`);
            console.log(`   Outstanding Amount: $${specificMonthSummary.outstandingAmount}`);
            
            if (specificMonthSummary.paymentMonths.length > 0) {
                console.log(`   Payment Months: ${specificMonthSummary.paymentMonths.length} payment(s)`);
                specificMonthSummary.paymentMonths.forEach((pm, index) => {
                    console.log(`      ${index + 1}. ${pm.paymentMonthDisplay} (${pm.paymentMonth}): $${pm.amount}`);
                });
            }
            
            console.log(`   Components:`);
            console.log(`      Expected: Rent $${specificMonthSummary.components.expected.rent}, Admin $${specificMonthSummary.components.expected.admin}, Deposit $${specificMonthSummary.components.expected.deposit}`);
            console.log(`      Paid: Rent $${specificMonthSummary.components.paid.rent}, Admin $${specificMonthSummary.components.paid.admin}, Deposit $${specificMonthSummary.components.paid.deposit}`);
            console.log(`      Outstanding: Rent $${specificMonthSummary.components.outstanding.rent}, Admin $${specificMonthSummary.components.outstanding.admin}, Deposit $${specificMonthSummary.components.outstanding.deposit}`);
        }

        // Test 4: Show financial summary
        console.log('\n🔍 Test 4: Financial Summary');
        console.log('=============================');
        
        console.log(`\n💰 Financial Summary:`);
        console.log(`   Total Owed: $${monthSummary.financialSummary.totalOwed}`);
        console.log(`   Total Paid: $${monthSummary.financialSummary.totalPaid}`);
        console.log(`   Current Balance: $${monthSummary.financialSummary.currentBalance}`);
        console.log(`   Credit Limit: $${monthSummary.financialSummary.creditLimit}`);
        console.log(`   Overdue Amount: $${monthSummary.financialSummary.overdueAmount}`);

        console.log('\n🎉 Testing Complete!');
        console.log('===================');
        console.log('✅ Enhanced debtor model now shows both month and payment month information');
        console.log('✅ Month: Shows the billing month (when rent is due)');
        console.log('✅ Payment Month: Shows when payments were actually made');
        console.log('✅ Comprehensive breakdown of payment timing and allocation');

    } catch (error) {
        console.error('❌ Test Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🧪 Starting Enhanced Debtor Month and Payment Month Tests...');
testDebtorMonthAndPaymentMonth();
