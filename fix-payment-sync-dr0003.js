require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const Payment = require('./src/models/Payment');

async function fixPaymentSyncDR0003() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔧 Fixing Payment Sync Issue for DR0003...');
        console.log('==========================================');

        // Find debtor DR0003
        const debtor = await Debtor.findOne({ debtorCode: 'DR0003' });
        if (!debtor) {
            console.log('❌ Debtor DR0003 not found');
            return;
        }

        console.log(`✅ Found debtor: ${debtor.debtorCode}`);
        console.log(`   User ID: ${debtor.user}`);

        // Get all payments for this debtor
        const payments = await Payment.find({ user: debtor.user });
        console.log(`\n📊 Payments in Payments Collection: ${payments.length}`);

        // Find orphaned payments (payments not in debtor history)
        const orphanedPayments = payments.filter(payment => {
            return !debtor.paymentHistory.some(ph => 
                ph.paymentId === payment._id.toString()
            );
        });

        console.log(`🔍 Found ${orphanedPayments.length} orphaned payments to sync`);

        if (orphanedPayments.length === 0) {
            console.log('✅ No orphaned payments found. Sync is already complete!');
            return;
        }

        // Sync each orphaned payment
        for (const payment of orphanedPayments) {
            console.log(`\n🔧 Syncing Payment: ${payment._id}`);
            console.log(`   Date: ${payment.date}`);
            console.log(`   Status: ${payment.status}`);
            console.log(`   Rent: $${payment.rentAmount || 0}`);
            console.log(`   Admin Fee: $${payment.adminFee || 0}`);
            console.log(`   Deposit: $${payment.deposit || 0}`);

            // Calculate total amount from components
            const totalAmount = (payment.rentAmount || 0) + (payment.adminFee || 0) + (payment.deposit || 0);
            console.log(`   Total Amount: $${totalAmount}`);

            // Get payment month from payment date
            const paymentMonth = payment.paymentMonth || 
                `${payment.date.getFullYear()}-${String(payment.date.getMonth() + 1).padStart(2, '0')}`;

            // Create payment history entry
            const paymentHistoryEntry = {
                paymentId: payment._id.toString(),
                amount: totalAmount,
                paymentDate: payment.date,
                paymentMethod: 'Bank Transfer', // Default method
                status: payment.status === 'Paid' ? 'Confirmed' : payment.status,
                allocatedMonth: paymentMonth, // Use payment month as allocated month
                paymentMonth: paymentMonth,
                components: {
                    rent: payment.rentAmount || 0,
                    adminFee: payment.adminFee || 0,
                    deposit: payment.deposit || 0
                }
            };

            // Add to debtor's payment history
            debtor.paymentHistory.push(paymentHistoryEntry);
            console.log(`   ✅ Added to payment history`);

            // Update debtor's financial totals
            debtor.totalPaid = (debtor.totalPaid || 0) + totalAmount;
            debtor.currentBalance = Math.max(0, (debtor.totalOwed || 0) - debtor.totalPaid);
            debtor.overdueAmount = Math.max(0, debtor.currentBalance - (debtor.creditLimit || 0));

            console.log(`   💰 Updated financial totals:`);
            console.log(`      Total Paid: $${debtor.totalPaid}`);
            console.log(`      Current Balance: $${debtor.currentBalance}`);
            console.log(`      Overdue Amount: $${debtor.overdueAmount}`);
        }

        // Save the updated debtor
        console.log(`\n💾 Saving updated debtor...`);
        await debtor.save();
        console.log(`✅ Debtor updated successfully!`);

        // Verify the fix
        console.log(`\n🔍 Verifying the fix...`);
        const updatedDebtor = await Debtor.findOne({ debtorCode: 'DR0003' });
        console.log(`📊 Updated Payment History Count: ${updatedDebtor.paymentHistory.length}`);
        console.log(`💰 Updated Total Paid: $${updatedDebtor.totalPaid}`);
        console.log(`💳 Updated Current Balance: $${updatedDebtor.currentBalance}`);

        // Show final payment history
        console.log(`\n📋 Final Payment History:`);
        updatedDebtor.paymentHistory.forEach((ph, index) => {
            console.log(`\n   Payment ${index + 1}:`);
            console.log(`      Payment ID: ${ph.paymentId}`);
            console.log(`      Amount: $${ph.amount}`);
            console.log(`      Date: ${ph.paymentDate}`);
            console.log(`      Status: ${ph.status}`);
            console.log(`      Allocated Month: ${ph.allocatedMonth}`);
            console.log(`      Payment Month: ${ph.paymentMonth}`);
            
            if (ph.components) {
                console.log(`      Components:`);
                if (ph.components.rent > 0) console.log(`         Rent: $${ph.components.rent}`);
                if (ph.components.adminFee > 0) console.log(`         Admin Fee: $${ph.components.adminFee}`);
                if (ph.components.deposit > 0) console.log(`         Deposit: $${ph.components.deposit}`);
            }
        });

        console.log('\n🎉 Payment Sync Fix Complete!');
        console.log('==============================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔧 Starting Payment Sync Fix for DR0003...');
fixPaymentSyncDR0003();
