require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');

async function checkAllDebtorDetails() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Checking All Debtor Details...');
        console.log('================================');

        const allDebtors = await Debtor.find({});
        console.log(`📊 Total debtors in collection: ${allDebtors.length}`);

        allDebtors.forEach((debtor, index) => {
            console.log(`\n📋 Debtor ${index + 1}: ${debtor.debtorCode}`);
            console.log('=' .repeat(50));
            console.log(`Debtor Code: ${debtor.debtorCode}`);
            console.log(`User ID: ${debtor.user}`);
            console.log(`Room Number: ${debtor.roomNumber || 'N/A'}`);
            console.log(`Room Price: $${debtor.roomPrice || 'N/A'}`);
            console.log(`Residence: ${debtor.residence || 'N/A'}`);
            
            if (debtor.applications && debtor.applications.length > 0) {
                console.log(`\n📝 Applications (${debtor.applications.length}):`);
                debtor.applications.forEach((app, appIndex) => {
                    console.log(`   Application ${appIndex + 1}:`);
                    console.log(`      Student Name: ${app.studentName || 'N/A'}`);
                    console.log(`      Email: ${app.email || 'N/A'}`);
                    console.log(`      Phone: ${app.phone || 'N/A'}`);
                    console.log(`      Room Number: ${app.roomNumber || 'N/A'}`);
                    console.log(`      Room Price: $${app.roomPrice || 'N/A'}`);
                    console.log(`      Room Type: ${app.roomType || 'N/A'}`);
                    console.log(`      Status: ${app.status || 'N/A'}`);
                });
            } else {
                console.log('\n📝 No applications found');
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
            
            console.log('\n' + '=' .repeat(50));
        });

        console.log('\n🎉 All Debtor Details Check Complete!');
        console.log('=====================================');
        console.log('💡 Look for the debtor with name "Kudzai" in the applications above');
        console.log('💡 If you find Kudzai, note their Debtor Code and Total Paid amount');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting All Debtor Details Check...');
checkAllDebtorDetails();
