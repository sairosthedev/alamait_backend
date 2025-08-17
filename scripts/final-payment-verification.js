// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function finalPaymentVerification() {
    try {
        console.log('🎯 FINAL PAYMENT VERIFICATION');
        console.log('=============================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const Payment = require('../src/models/Payment');
        const Transaction = require('../src/models/Transaction');
        const TransactionEntry = require('../src/models/TransactionEntry');
        
        // ========================================
        // PAYMENT DATA
        // ========================================
        console.log('📊 PAYMENT DATA');
        console.log('===============');
        
        const payments = await Payment.find({});
        console.log(`Total Payments: ${payments.length}`);
        
        let totalPaymentAmount = 0;
        payments.forEach((payment, index) => {
            const amount = payment.totalAmount || payment.rentAmount || 0;
            totalPaymentAmount += amount;
            
            console.log(`${index + 1}. ${payment.paymentId}`);
            console.log(`   Amount: $${amount}`);
            console.log(`   Method: ${payment.method}`);
            console.log(`   Date: ${new Date(payment.date).toLocaleDateString()}`);
            console.log(`   Status: ${payment.status}`);
            console.log('');
        });
        
        console.log(`Total Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        // ========================================
        // TRANSACTION DATA
        // ========================================
        console.log('\n\n📝 TRANSACTION DATA');
        console.log('===================');
        
        const transactions = await Transaction.find({ type: 'payment' });
        console.log(`Total Payment Transactions: ${transactions.length}`);
        
        let totalTransactionAmount = 0;
        transactions.forEach((txn, index) => {
            const amount = txn.amount || 0;
            totalTransactionAmount += amount;
            
            console.log(`${index + 1}. ${txn.transactionId}`);
            console.log(`   Amount: $${amount}`);
            console.log(`   Description: ${txn.description}`);
            console.log(`   Date: ${new Date(txn.date).toLocaleDateString()}`);
            console.log('');
        });
        
        console.log(`Total Transaction Amount: $${totalTransactionAmount.toFixed(2)}`);
        
        // ========================================
        // TRANSACTION ENTRY DATA
        // ========================================
        console.log('\n\n📋 TRANSACTION ENTRY DATA');
        console.log('==========================');
        
        const entries = await TransactionEntry.find({ source: 'payment' });
        console.log(`Total Payment Entries: ${entries.length}`);
        
        let totalEntryAmount = 0;
        entries.forEach((entry, index) => {
            const amount = entry.totalCredit || 0;
            totalEntryAmount += amount;
            
            console.log(`${index + 1}. ${entry.description}`);
            console.log(`   Amount: $${amount}`);
            console.log(`   Date: ${new Date(entry.date).toLocaleDateString()}`);
            console.log(`   Status: ${entry.status}`);
            console.log('');
        });
        
        console.log(`Total Entry Amount: $${totalEntryAmount.toFixed(2)}`);
        
        // ========================================
        // SUMMARY AND VERIFICATION
        // ========================================
        console.log('\n\n📊 SUMMARY AND VERIFICATION');
        console.log('=============================');
        
        console.log(`Payments: $${totalPaymentAmount.toFixed(2)}`);
        console.log(`Transactions: $${totalTransactionAmount.toFixed(2)}`);
        console.log(`Entries: $${totalEntryAmount.toFixed(2)}`);
        
        const transactionDiff = Math.abs(totalTransactionAmount - totalPaymentAmount);
        const entryDiff = Math.abs(totalEntryAmount - totalPaymentAmount);
        
        console.log(`\nTransaction Difference: $${transactionDiff.toFixed(2)}`);
        console.log(`Entry Difference: $${entryDiff.toFixed(2)}`);
        
        if (transactionDiff < 0.01 && entryDiff < 0.01) {
            console.log('✅ SUCCESS! All payment amounts are perfectly balanced!');
        } else {
            console.log('⚠️ There are still discrepancies that need attention.');
            
            if (transactionDiff > 0.01) {
                console.log(`❌ Transaction amount doesn't match payment amount`);
            }
            
            if (entryDiff > 0.01) {
                console.log(`❌ Entry amount doesn't match payment amount`);
            }
        }
        
        // ========================================
        // RECOMMENDATIONS
        // ========================================
        console.log('\n\n💡 RECOMMENDATIONS');
        console.log('==================');
        
        if (transactionDiff < 0.01 && entryDiff < 0.01) {
            console.log('✅ Your payment data is now correctly migrated!');
            console.log('✅ You can now fetch expenses in your frontend using the new API endpoints.');
            console.log('✅ The double-entry accounting system is working properly.');
        } else {
            console.log('🔧 You may need to:');
            console.log('   1. Check for any remaining duplicate entries');
            console.log('   2. Verify that all payment transactions were created correctly');
            console.log('   3. Ensure the migration script ran completely');
        }
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the verification
finalPaymentVerification(); 