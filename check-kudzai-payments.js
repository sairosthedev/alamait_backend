require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');

async function checkKudzaiPayments() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Searching for Kudzai in Debtors Collection...');
        console.log('==============================================');

        // Search for Kudzai by name, email, or debtor code
        const kudzaiDebtors = await Debtor.find({
            $or: [
                { 'applications.studentName': { $regex: /kudzai/i } },
                { 'applications.email': { $regex: /kudzai/i } },
                { debtorCode: { $regex: /kudzai/i } },
                { notes: { $regex: /kudzai/i } }
            ]
        });

        if (kudzaiDebtors.length === 0) {
            console.log('❌ No debtors found with name "Kudzai"');
            console.log('\n🔍 Let me search more broadly...');
            
            // Search for any debtors that might be Kudzai
            const allDebtors = await Debtor.find({});
            console.log(`📊 Total debtors in collection: ${allDebtors.length}`);
            
            // Show all debtor codes and names for reference
            console.log('\n📋 All Debtors in Collection:');
            allDebtors.forEach((debtor, index) => {
                console.log(`   ${index + 1}. Debtor Code: ${debtor.debtorCode}`);
                console.log(`      User ID: ${debtor.user}`);
                if (debtor.applications && debtor.applications.length > 0) {
                    debtor.applications.forEach((app, appIndex) => {
                        console.log(`      Application ${appIndex + 1}:`);
                        console.log(`         Student Name: ${app.studentName || 'N/A'}`);
                        console.log(`         Email: ${app.email || 'N/A'}`);
                    });
                }
                console.log(`      Total Paid: $${debtor.totalPaid || 0}`);
                console.log(`      Payment History Count: ${debtor.paymentHistory ? debtor.paymentHistory.length : 0}`);
                console.log('');
            });
            
            return;
        }

        console.log(`✅ Found ${kudzaiDebtors.length} debtor(s) for Kudzai`);

        kudzaiDebtors.forEach((debtor, index) => {
            console.log(`\n📋 Kudzai Debtor ${index + 1}:`);
            console.log('================================');
            console.log(`Debtor Code: ${debtor.debtorCode}`);
            console.log(`User ID: ${debtor.user}`);
            
            if (debtor.applications && debtor.applications.length > 0) {
                debtor.applications.forEach((app, appIndex) => {
                    console.log(`\nApplication ${appIndex + 1}:`);
                    console.log(`   Student Name: ${app.studentName || 'N/A'}`);
                    console.log(`   Email: ${app.email || 'N/A'}`);
                    console.log(`   Room Number: ${app.roomNumber || 'N/A'}`);
                    console.log(`   Room Price: $${app.roomPrice || 'N/A'}`);
                });
            }
            
            console.log(`\n💰 Financial Summary:`);
            console.log(`   Total Owed: $${debtor.totalOwed || 0}`);
            console.log(`   Total Paid: $${debtor.totalPaid || 0}`);
            console.log(`   Current Balance: $${debtor.currentBalance || 0}`);
            console.log(`   Credit Limit: $${debtor.creditLimit || 0}`);
            console.log(`   Overdue Amount: $${debtor.overdueAmount || 0}`);
            
            if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
                console.log(`\n📅 Payment History (${debtor.paymentHistory.length} payments):`);
                let totalAmount = 0;
                
                debtor.paymentHistory.forEach((payment, payIndex) => {
                    const amount = payment.amount || 0;
                    totalAmount += amount;
                    
                    console.log(`\n   Payment ${payIndex + 1}:`);
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
                
                console.log(`\n💵 Total Amount Paid: $${totalAmount}`);
                
                // Verify with enhanced methods
                try {
                    const summary = debtor.getMonthAndPaymentMonthSummary();
                    console.log(`\n📊 Enhanced Summary:`);
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
                
            } else {
                console.log('\n📅 No payment history found');
            }
            
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
        });

        console.log('\n🎉 Kudzai Payment Analysis Complete!');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Kudzai Payment Analysis...');
checkKudzaiPayments();
