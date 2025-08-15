const mongoose = require('mongoose');

async function fixDebtorPayment() {
    try {
        // Connect to Atlas database
        const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        
        console.log('🔍 Connecting to Atlas database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to Atlas database');
        
        const Payment = require('./src/models/Payment');
        const Debtor = require('./src/models/Debtor');
        
        // Get the specific payment that's missing from debtor
        const payment = await Payment.findOne({ paymentId: 'PAY-1755226825185' });
        if (!payment) {
            console.log('❌ Payment not found');
            return;
        }
        
        console.log(`\n🎯 Found payment:`);
        console.log(`   Payment ID: ${payment.paymentId}`);
        console.log(`   Student ID: ${payment.student}`);
        console.log(`   Amount: $${payment.totalAmount}`);
        console.log(`   Month: ${payment.paymentMonth}`);
        console.log(`   Date: ${payment.date}`);
        
        // Get the debtor for this student
        const debtor = await Debtor.findOne({ user: payment.student });
        if (!debtor) {
            console.log('❌ Debtor not found for this student');
            return;
        }
        
        console.log(`\n✅ Found debtor:`);
        console.log(`   ID: ${debtor._id}`);
        console.log(`   Code: ${debtor.debtorCode}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Total Paid: $${debtor.totalPaid}`);
        console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
        
        // Check if payment is already in history
        const paymentInHistory = debtor.paymentHistory.find(p => p.paymentId === payment.paymentId);
        if (paymentInHistory) {
            console.log(`✅ Payment already in debtor history`);
            return;
        }
        
        console.log(`\n💰 Adding payment to debtor...`);
        
        try {
            // Call addPayment method
            await debtor.addPayment({
                paymentId: payment.paymentId,
                amount: payment.totalAmount,
                allocatedMonth: payment.paymentMonth,
                components: {
                    rent: payment.rentAmount || 0,
                    admin: payment.adminFee || 0,
                    deposit: payment.deposit || 0
                },
                paymentMethod: payment.method,
                paymentDate: payment.date,
                status: 'Confirmed',
                notes: `Payment ${payment.paymentId} - ${payment.paymentMonth}`,
                createdBy: payment.createdBy
            });
            
            console.log(`✅ Payment added to debtor successfully!`);
            console.log(`   New Balance: $${debtor.currentBalance}`);
            console.log(`   New Total Paid: $${debtor.totalPaid}`);
            console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
            
            // Verify the payment was added
            const updatedDebtor = await Debtor.findById(debtor._id);
            const paymentInHistoryAfter = updatedDebtor.paymentHistory.find(p => p.paymentId === payment.paymentId);
            
            if (paymentInHistoryAfter) {
                console.log(`✅ Payment verified in debtor history:`);
                console.log(`   Amount: $${paymentInHistoryAfter.amount}`);
                console.log(`   Month: ${paymentInHistoryAfter.allocatedMonth}`);
                console.log(`   Status: ${paymentInHistoryAfter.status}`);
            } else {
                console.log(`❌ Payment still not found in debtor history after save`);
            }
            
        } catch (error) {
            console.error(`❌ Error adding payment to debtor:`, error);
            console.error(`   Error details:`, error.message);
            console.error(`   Stack trace:`, error.stack);
            
            // Try to get more details about the error
            if (error.name === 'ValidationError') {
                console.error(`   Validation errors:`, error.errors);
            }
        }
        
    } catch (error) {
        console.error('❌ Error in script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

fixDebtorPayment();
