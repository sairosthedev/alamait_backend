const mongoose = require('mongoose');
require('dotenv').config();

async function checkDebtorMonthlyPayments() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected successfully');
        
        const Debtor = require('./src/models/Debtor');
        const debtor = await Debtor.findOne({ debtorCode: 'DR0007' });
        
        if (!debtor) {
            console.log('❌ Debtor DR0007 not found');
            return;
        }
        
        console.log(`\n📊 Debtor: ${debtor.debtorCode}`);
        console.log(`   Name: ${debtor.contactInfo?.name || 'N/A'}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Total Paid: $${debtor.totalPaid}`);
        
        console.log('\n📅 Monthly Payments Structure:');
        if (debtor.monthlyPayments && debtor.monthlyPayments.length > 0) {
            debtor.monthlyPayments.forEach((monthly, index) => {
                console.log(`\n   ${index + 1}. Month: ${monthly.month}`);
                console.log(`      Expected Amount: $${monthly.expectedAmount}`);
                console.log(`      Paid Amount: $${monthly.paidAmount}`);
                console.log(`      Outstanding Amount: $${monthly.outstandingAmount}`);
                console.log(`      Status: ${monthly.status}`);
                console.log(`      Payment Count: ${monthly.paymentCount}`);
                
                // Check if expectedComponents exists
                if (monthly.expectedComponents) {
                    console.log(`      Expected Components:`, monthly.expectedComponents);
                } else {
                    console.log(`      ❌ Expected Components: NOT FOUND`);
                }
                
                // Check if paidComponents exists
                if (monthly.paidComponents) {
                    console.log(`      Paid Components:`, monthly.paidComponents);
                } else {
                    console.log(`      ❌ Paid Components: NOT FOUND`);
                }
                
                // Check if outstandingComponents exists
                if (monthly.outstandingComponents) {
                    console.log(`      Outstanding Components:`, monthly.outstandingComponents);
                } else {
                    console.log(`      ❌ Outstanding Components: NOT FOUND`);
                }
                
                // Show all available fields
                console.log(`      All Fields:`, Object.keys(monthly));
            });
        } else {
            console.log('   No monthly payments found');
        }
        
        console.log('\n📋 Payment History Structure:');
        if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
            debtor.paymentHistory.forEach((payment, index) => {
                console.log(`\n   ${index + 1}. Payment: ${payment.paymentId}`);
                console.log(`      Amount: $${payment.amount}`);
                console.log(`      Month: ${payment.allocatedMonth}`);
                console.log(`      Components:`, payment.components);
                console.log(`      Method: ${payment.paymentMethod}`);
                console.log(`      Status: ${payment.status}`);
            });
        } else {
            console.log('   No payment history found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

checkDebtorMonthlyPayments();
