const mongoose = require('mongoose');
require('dotenv').config();

// Import the sync service
const PaymentHistorySyncService = require('./src/services/paymentHistorySyncService');

// MongoDB connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Main function to sync DR0007 payment history
async function syncDR0007PaymentHistory() {
    try {
        console.log('🚀 Starting payment history sync for DR0007...');
        console.log('==============================================');
        
        // Connect to database
        await connectDB();
        
        // Find debtor DR0007
        const Debtor = require('./src/models/Debtor');
        const debtor = await Debtor.findOne({ debtorCode: 'DR0007' });
        
        if (!debtor) {
            console.log('❌ Debtor DR0007 not found');
            return;
        }
        
        console.log(`✅ Found debtor: ${debtor.debtorCode}`);
        console.log(`   Name: ${debtor.contactInfo?.name || 'N/A'}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Total Paid: $${debtor.totalPaid}`);
        console.log(`   Payment History Entries: ${debtor.paymentHistory?.length || 0}`);
        
        // Validate current payment history
        console.log('\n🔍 Validating current payment history...');
        const validation = await PaymentHistorySyncService.validatePaymentHistory(debtor._id);
        
        console.log('Validation Results:');
        console.log(`   Payment Collection Count: ${validation.paymentCollectionCount}`);
        console.log(`   Debtor History Count: ${validation.debtorHistoryCount}`);
        console.log(`   Is Consistent: ${validation.isConsistent ? '✅ Yes' : '❌ No'}`);
        console.log(`   Collection Total: $${validation.totalAmountFromCollection}`);
        console.log(`   History Total: $${validation.totalAmountFromHistory}`);
        
        if (validation.discrepancies.length > 0) {
            console.log('\n⚠️  Discrepancies Found:');
            validation.discrepancies.forEach((disc, index) => {
                console.log(`   ${index + 1}. ${disc.type}: ${disc.message}`);
            });
        }
        
        // Sync payment history
        console.log('\n🔄 Syncing payment history...');
        const syncResult = await PaymentHistorySyncService.syncDebtorPaymentHistory(debtor._id, true);
        
        if (syncResult.success) {
            console.log('\n✅ Sync completed successfully!');
            console.log(`   Payments synced: ${syncResult.paymentCount}`);
            console.log(`   Total amount: $${syncResult.totalPaid}`);
            console.log(`   New balance: $${syncResult.currentBalance}`);
        } else {
            console.log('\n❌ Sync failed:', syncResult.message);
        }
        
        // Validate again after sync
        console.log('\n🔍 Validating payment history after sync...');
        const postValidation = await PaymentHistorySyncService.validatePaymentHistory(debtor._id);
        
        console.log('Post-Sync Validation Results:');
        console.log(`   Payment Collection Count: ${postValidation.paymentCollectionCount}`);
        console.log(`   Debtor History Count: ${postValidation.debtorHistoryCount}`);
        console.log(`   Is Consistent: ${postValidation.isConsistent ? '✅ Yes' : '❌ No'}`);
        console.log(`   Collection Total: $${postValidation.totalAmountFromCollection}`);
        console.log(`   History Total: $${postValidation.totalAmountFromHistory}`);
        
        if (postValidation.isConsistent) {
            console.log('\n🎉 Payment history is now consistent!');
        } else {
            console.log('\n⚠️  Still have discrepancies after sync:');
            postValidation.discrepancies.forEach((disc, index) => {
                console.log(`   ${index + 1}. ${disc.type}: ${disc.message}`);
            });
        }
        
        // Show final debtor state
        console.log('\n📊 Final Debtor State:');
        const updatedDebtor = await Debtor.findById(debtor._id);
        console.log(`   Current Balance: $${updatedDebtor.currentBalance}`);
        console.log(`   Total Owed: $${updatedDebtor.totalOwed}`);
        console.log(`   Total Paid: $${updatedDebtor.totalPaid}`);
        console.log(`   Payment History Entries: ${updatedDebtor.paymentHistory?.length || 0}`);
        console.log(`   Monthly Payments: ${updatedDebtor.monthlyPayments?.length || 0}`);
        
        if (updatedDebtor.paymentHistory && updatedDebtor.paymentHistory.length > 0) {
            console.log('\n📋 Payment History Details:');
            updatedDebtor.paymentHistory.forEach((payment, index) => {
                console.log(`   ${index + 1}. ${payment.paymentId} - $${payment.amount} (${payment.allocatedMonth})`);
                console.log(`      Method: ${payment.paymentMethod}`);
                console.log(`      Components: Rent: $${payment.components.rent}, Admin: $${payment.components.adminFee}, Deposit: $${payment.components.deposit}`);
                console.log(`      Status: ${payment.status}`);
            });
        }
        
        if (updatedDebtor.monthlyPayments && updatedDebtor.monthlyPayments.length > 0) {
            console.log('\n📅 Monthly Payment Summary:');
            updatedDebtor.monthlyPayments.forEach((monthly, index) => {
                console.log(`   ${index + 1}. ${monthly.month}: $${monthly.paidAmount}/${monthly.expectedAmount} (${monthly.status})`);
                console.log(`      Outstanding: $${monthly.outstandingAmount}, Payments: ${monthly.paymentCount}`);
                
                // Show component breakdown
                if (monthly.expectedComponents) {
                    console.log(`      Expected: Rent: $${monthly.expectedComponents.rent}, Admin: $${monthly.expectedComponents.admin}, Deposit: $${monthly.expectedComponents.deposit}`);
                    console.log(`      Paid: Rent: $${monthly.paidComponents.rent}, Admin: $${monthly.paidComponents.admin}, Deposit: $${monthly.paidComponents.deposit}`);
                    console.log(`      Outstanding: Rent: $${monthly.outstandingComponents.rent}, Admin: $${monthly.outstandingComponents.admin}, Deposit: $${monthly.outstandingComponents.deposit}`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error in sync process:', error);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the sync
if (require.main === module) {
    syncDR0007PaymentHistory()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { syncDR0007PaymentHistory };
