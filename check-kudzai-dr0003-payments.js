require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const Payment = require('./src/models/Payment');

async function checkKudzaiDR0003Payments() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Checking Kudzai (DR0003) Payments in Both Collections...');
        console.log('==========================================================');

        // Check 1: Find debtor DR0003
        console.log('\n🔍 Check 1: Finding Debtor DR0003');
        console.log('==================================');
        
        const debtor = await Debtor.findOne({ debtorCode: 'DR0003' });
        
        if (!debtor) {
            console.log('❌ Debtor DR0003 not found in debtors collection');
            return;
        }

        console.log(`✅ Found debtor: ${debtor.debtorCode}`);
        console.log(`   User ID: ${debtor.user}`);
        
        if (debtor.applications && debtor.applications.length > 0) {
            debtor.applications.forEach((app, index) => {
                console.log(`\n   Application ${index + 1}:`);
                console.log(`      Student Name: ${app.studentName || 'N/A'}`);
                console.log(`      Email: ${app.email || 'N/A'}`);
                console.log(`      Room Number: ${app.roomNumber || 'N/A'}`);
                console.log(`      Room Price: $${app.roomPrice || 'N/A'}`);
            });
        }

        // Check 2: Check payments collection for DR0003
        console.log('\n🔍 Check 2: Searching Payments Collection for DR0003');
        console.log('=====================================================');
        
        // First, try to find payments by user ID
        const paymentsByUserId = await Payment.find({ user: debtor.user });
        console.log(`📊 Payments found by User ID (${debtor.user}): ${paymentsByUserId.length}`);
        
        // Also search by student ID if available
        let paymentsByStudentId = [];
        if (debtor.applications && debtor.applications.length > 0) {
            for (const app of debtor.applications) {
                if (app.student) {
                    const studentPayments = await Payment.find({ student: app.student });
                    paymentsByStudentId = paymentsByStudentId.concat(studentPayments);
                }
            }
        }
        console.log(`📊 Payments found by Student ID: ${paymentsByStudentId.length}`);
        
        // Combine and remove duplicates
        const allPayments = [...paymentsByUserId, ...paymentsByStudentId];
        const uniquePayments = allPayments.filter((payment, index, self) => 
            index === self.findIndex(p => p._id.toString() === payment._id.toString())
        );
        
        console.log(`📊 Total unique payments found: ${uniquePayments.length}`);

        if (uniquePayments.length > 0) {
            console.log('\n📋 Payment Details from Payments Collection:');
            let totalAmount = 0;
            
            uniquePayments.forEach((payment, index) => {
                const amount = payment.amount || 0;
                totalAmount += amount;
                
                console.log(`\n   Payment ${index + 1}:`);
                console.log(`      Payment ID: ${payment._id}`);
                console.log(`      Amount: $${amount}`);
                console.log(`      User ID: ${payment.user || 'N/A'}`);
                console.log(`      Student ID: ${payment.student || 'N/A'}`);
                console.log(`      Date: ${payment.date || 'N/A'}`);
                console.log(`      Status: ${payment.status || 'N/A'}`);
                console.log(`      Payment Month: ${payment.paymentMonth || 'N/A'}`);
                
                if (payment.rentAmount) console.log(`      Rent Amount: $${payment.rentAmount}`);
                if (payment.adminFee) console.log(`      Admin Fee: $${payment.adminFee}`);
                if (payment.deposit) console.log(`      Deposit: $${payment.deposit}`);
            });
            
            console.log(`\n💵 Total Amount from Payments Collection: $${totalAmount}`);
        }

        // Check 3: Check debtor's payment history
        console.log('\n🔍 Check 3: Debtor DR0003 Payment History');
        console.log('==========================================');
        
        if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
            console.log(`📊 Payment History Count: ${debtor.paymentHistory.length}`);
            let totalAmount = 0;
            
            debtor.paymentHistory.forEach((payment, index) => {
                const amount = payment.amount || 0;
                totalAmount += amount;
                
                console.log(`\n   Payment ${index + 1}:`);
                console.log(`      Payment ID: ${payment.paymentId || 'N/A'}`);
                console.log(`      Amount: $${amount}`);
                console.log(`      Allocated Month: ${payment.allocatedMonth || 'N/A'}`);
                console.log(`      Payment Month: ${payment.paymentMonth || 'N/A'}`);
                console.log(`      Payment Date: ${payment.paymentDate || 'N/A'}`);
                console.log(`      Payment Method: ${payment.paymentMethod || 'N/A'}`);
                console.log(`      Status: ${payment.status || 'N/A'}`);
                
                if (payment.components) {
                    console.log(`      Components:`);
                    if (payment.components.rent > 0) console.log(`         Rent: $${payment.components.rent}`);
                    if (payment.components.adminFee > 0) console.log(`         Admin Fee: $${payment.components.adminFee}`);
                    if (payment.components.deposit > 0) console.log(`         Deposit: $${payment.components.deposit}`);
                }
            });
            
            console.log(`\n💵 Total Amount from Debtor History: $${totalAmount}`);
        } else {
            console.log('📅 No payment history found in debtor record');
        }

        // Check 4: Enhanced summary from debtor
        console.log('\n🔍 Check 4: Enhanced Debtor Summary');
        console.log('====================================');
        
        try {
            const summary = debtor.getMonthAndPaymentMonthSummary();
            console.log(`📊 Enhanced Summary:`);
            console.log(`   Total Months: ${summary.totalMonths}`);
            console.log(`   Total Payments: ${summary.totalPayments}`);
            
            if (summary.monthlySummary.length > 0) {
                console.log(`\n📅 Monthly Breakdown:`);
                summary.monthlySummary.forEach((month, monthIndex) => {
                    console.log(`   ${monthIndex + 1}. ${month.monthDisplay} (${month.month}):`);
                    console.log(`      Expected: $${month.expectedAmount}`);
                    console.log(`      Paid: $${month.paidAmount}`);
                    console.log(`      Outstanding: $${month.outstandingAmount}`);
                    console.log(`      Status: ${month.status}`);
                    
                    if (month.paymentMonths.length > 0) {
                        month.paymentMonths.forEach((pm, pmIndex) => {
                            console.log(`      Payment ${pmIndex + 1}: ${pm.paymentMonthDisplay} - $${pm.amount}`);
                        });
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error getting enhanced summary:', error.message);
        }

        // Check 5: Financial summary
        console.log('\n🔍 Check 5: Financial Summary');
        console.log('=============================');
        
        console.log(`💰 Financial Summary for DR0003:`);
        console.log(`   Total Owed: $${debtor.totalOwed || 0}`);
        console.log(`   Total Paid: $${debtor.totalPaid || 0}`);
        console.log(`   Current Balance: $${debtor.currentBalance || 0}`);
        console.log(`   Credit Limit: $${debtor.creditLimit || 0}`);
        console.log(`   Overdue Amount: $${debtor.overdueAmount || 0}`);

        // Check 6: Monthly payments summary
        if (debtor.monthlyPayments && debtor.monthlyPayments.length > 0) {
            console.log(`\n📊 Monthly Payments Summary:`);
            console.log(`   Total Monthly Payments: ${debtor.monthlyPayments.length}`);
            
            debtor.monthlyPayments.forEach((monthly, monthIndex) => {
                console.log(`\n   Month ${monthIndex + 1}: ${monthly.month}`);
                console.log(`      Expected Amount: $${monthly.expectedAmount}`);
                console.log(`      Paid Amount: $${monthly.paidAmount}`);
                console.log(`      Outstanding Amount: $${monthly.outstandingAmount}`);
                console.log(`      Status: ${monthly.status}`);
                console.log(`      Payment Count: ${monthly.paymentCount}`);
            });
        }

        console.log('\n🎉 Kudzai (DR0003) Payment Analysis Complete!');
        console.log('==============================================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Kudzai (DR0003) Payment Analysis...');
checkKudzaiDR0003Payments();
