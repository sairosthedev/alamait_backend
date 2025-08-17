const mongoose = require('mongoose');

async function checkDR0007Status() {
    try {
        // Connect to Atlas database
        const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        
        console.log('🔍 Connecting to Atlas database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to Atlas database');
        
        const Debtor = require('./src/models/Debtor');
        
        // Get DR0007 debtor
        const debtor = await Debtor.findOne({ debtorCode: 'DR0007' });
        if (!debtor) {
            console.log('❌ Debtor DR0007 not found');
            return;
        }
        
        console.log(`\n🎯 Current Status of DR0007:`);
        console.log(`   ID: ${debtor._id}`);
        console.log(`   Code: ${debtor.debtorCode}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Total Paid: $${debtor.totalPaid}`);
        console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
        console.log(`   Monthly Payments Count: ${debtor.monthlyPayments.length}`);
        
        // Check payment history details
        if (debtor.paymentHistory.length > 0) {
            console.log(`\n💰 Payment History Details:`);
            debtor.paymentHistory.forEach((payment, index) => {
                console.log(`   ${index + 1}. Payment ID: ${payment.paymentId}`);
                console.log(`      Amount: $${payment.amount}`);
                console.log(`      Month: ${payment.allocatedMonth}`);
                console.log(`      Status: ${payment.status}`);
                console.log(`      Date: ${payment.paymentDate}`);
                console.log(`      Notes: ${payment.notes}`);
            });
        } else {
            console.log(`\n❌ No payments in history`);
        }
        
        // Check monthly payments
        if (debtor.monthlyPayments.length > 0) {
            console.log(`\n📅 Monthly Payment Summaries:`);
            debtor.monthlyPayments.forEach((monthly, index) => {
                console.log(`   ${index + 1}. Month: ${monthly.month}`);
                console.log(`      Expected: $${monthly.expectedAmount}`);
                console.log(`      Paid: $${monthly.paidAmount}`);
                console.log(`      Outstanding: $${monthly.outstandingAmount}`);
                console.log(`      Status: ${monthly.status}`);
                console.log(`      Payment Count: ${monthly.paymentCount}`);
            });
        } else {
            console.log(`\n❌ No monthly payments tracked`);
        }
        
        // Check billing period
        console.log(`\n📅 Billing Period:`);
        console.log(`   Start Date: ${debtor.billingPeriod?.startDate}`);
        console.log(`   End Date: ${debtor.billingPeriod?.endDate}`);
        console.log(`   Monthly Amount: $${debtor.billingPeriod?.amount?.monthly}`);
        console.log(`   Total Amount: $${debtor.billingPeriod?.amount?.total}`);
        
    } catch (error) {
        console.error('❌ Error in script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

checkDR0007Status();

