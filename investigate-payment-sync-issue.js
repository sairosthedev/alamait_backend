require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const Payment = require('./src/models/Payment');

async function investigatePaymentSyncIssue() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Investigating Payment Sync Issue for DR0003...');
        console.log('================================================');

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

        // Analyze each payment
        payments.forEach((payment, index) => {
            console.log(`\n🔍 Payment ${index + 1} Analysis:`);
            console.log(`   Payment ID: ${payment._id}`);
            console.log(`   Date: ${payment.date}`);
            console.log(`   Status: ${payment.status}`);
            console.log(`   Amount: $${payment.amount || 0}`);
            console.log(`   Rent: $${payment.rentAmount || 0}`);
            console.log(`   Admin Fee: $${payment.adminFee || 0}`);
            console.log(`   Deposit: $${payment.deposit || 0}`);
            
            // Check if this payment exists in debtor's paymentHistory
            const paymentInHistory = debtor.paymentHistory.find(ph => 
                ph.paymentId === payment._id.toString()
            );
            
            if (paymentInHistory) {
                console.log(`   ✅ Found in debtor paymentHistory`);
                console.log(`      Debtor Payment ID: ${paymentInHistory.paymentId}`);
                console.log(`      Debtor Amount: $${paymentInHistory.amount || 0}`);
                console.log(`      Debtor Status: ${paymentInHistory.status}`);
            } else {
                console.log(`   ❌ NOT found in debtor paymentHistory`);
            }
        });

        // Analyze debtor's paymentHistory
        console.log(`\n📊 Debtor Payment History: ${debtor.paymentHistory ? debtor.paymentHistory.length : 0}`);
        
        if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
            debtor.paymentHistory.forEach((ph, index) => {
                console.log(`\n🔍 Debtor Payment History ${index + 1}:`);
                console.log(`   Payment ID: ${ph.paymentId || 'N/A'}`);
                console.log(`   Amount: $${ph.amount || 0}`);
                console.log(`   Status: ${ph.status || 'N/A'}`);
                console.log(`   Date: ${ph.paymentDate || 'N/A'}`);
                
                // Check if this payment exists in payments collection
                const paymentInCollection = payments.find(p => 
                    p._id.toString() === ph.paymentId
                );
                
                if (paymentInCollection) {
                    console.log(`   ✅ Found in payments collection`);
                    console.log(`      Collection Amount: $${paymentInCollection.amount || 0}`);
                    console.log(`      Collection Status: ${paymentInCollection.status}`);
                } else {
                    console.log(`   ❌ NOT found in payments collection`);
                }
            });
        }

        // Check for orphaned payments (payments not in debtor history)
        console.log(`\n🔍 Orphaned Payments Analysis:`);
        const orphanedPayments = payments.filter(payment => {
            return !debtor.paymentHistory.some(ph => 
                ph.paymentId === payment._id.toString()
            );
        });

        console.log(`   Orphaned payments: ${orphanedPayments.length}`);
        orphanedPayments.forEach((payment, index) => {
            console.log(`   Orphaned Payment ${index + 1}:`);
            console.log(`      ID: ${payment._id}`);
            console.log(`      Date: ${payment.date}`);
            console.log(`      Amount: $${payment.amount || 0}`);
            console.log(`      Status: ${payment.status}`);
        });

        // Check for orphaned debtor history entries
        console.log(`\n🔍 Orphaned Debtor History Analysis:`);
        const orphanedHistory = debtor.paymentHistory.filter(ph => {
            return !payments.some(p => 
                p._id.toString() === ph.paymentId
            );
        });

        console.log(`   Orphaned history entries: ${orphanedHistory.length}`);
        orphanedHistory.forEach((ph, index) => {
            console.log(`   Orphaned History ${index + 1}:`);
            console.log(`      Payment ID: ${ph.paymentId}`);
            console.log(`      Amount: $${ph.amount || 0}`);
            console.log(`      Status: ${ph.status}`);
        });

        // Summary
        console.log(`\n📋 SUMMARY:`);
        console.log(`   Payments Collection: ${payments.length} payments`);
        console.log(`   Debtor History: ${debtor.paymentHistory ? debtor.paymentHistory.length : 0} entries`);
        console.log(`   Orphaned Payments: ${orphanedPayments.length}`);
        console.log(`   Orphaned History: ${orphanedHistory.length}`);

        if (orphanedPayments.length > 0) {
            console.log(`\n💡 RECOMMENDATION: Sync orphaned payments to debtor history`);
        }
        if (orphanedHistory.length > 0) {
            console.log(`\n💡 RECOMMENDATION: Clean up orphaned history entries`);
        }

        console.log('\n🎉 Investigation Complete!');
        console.log('==========================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Payment Sync Investigation...');
investigatePaymentSyncIssue();
