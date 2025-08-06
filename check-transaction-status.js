// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function checkTransactionStatus() {
    try {
        console.log('🔍 CHECKING TRANSACTION STATUS');
        console.log('==============================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const Payment = require('./src/models/Payment');
        const Transaction = require('./src/models/Transaction');
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        // ========================================
        // CHECK PAYMENTS
        // ========================================
        console.log('📊 PAYMENT ANALYSIS');
        console.log('===================');
        
        const payments = await Payment.find({});
        console.log(`Total Payments: ${payments.length}`);
        
        let totalPaymentAmount = 0;
        payments.forEach(payment => {
            const amount = payment.totalAmount || payment.rentAmount || 0;
            totalPaymentAmount += amount;
        });
        
        console.log(`Total Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        // ========================================
        // CHECK TRANSACTIONS
        // ========================================
        console.log('\n\n📝 TRANSACTION ANALYSIS');
        console.log('=======================');
        
        const transactions = await Transaction.find({ type: 'payment' });
        console.log(`Total Payment Transactions: ${transactions.length}`);
        
        let totalTransactionAmount = 0;
        let transactionDetails = [];
        
        transactions.forEach(txn => {
            const amount = txn.amount || 0;
            totalTransactionAmount += amount;
            
            transactionDetails.push({
                id: txn._id,
                transactionId: txn.transactionId,
                amount: amount,
                date: txn.date,
                description: txn.description,
                residence: txn.residence,
                entries: txn.entries?.length || 0
            });
        });
        
        console.log(`Total Transaction Amount: $${totalTransactionAmount.toFixed(2)}`);
        
        // ========================================
        // CHECK TRANSACTION ENTRIES
        // ========================================
        console.log('\n\n📋 TRANSACTION ENTRY ANALYSIS');
        console.log('==============================');
        
        const entries = await TransactionEntry.find({ source: 'payment' });
        console.log(`Total Payment Entries: ${entries.length}`);
        
        let totalEntryAmount = 0;
        let entriesByAccount = {};
        
        entries.forEach(entry => {
            const amount = entry.totalCredit || 0;
            totalEntryAmount += amount;
            
            // Check account codes
            entry.entries.forEach(accEntry => {
                const accountCode = accEntry.accountCode;
                entriesByAccount[accountCode] = (entriesByAccount[accountCode] || 0) + (accEntry.credit || 0);
            });
        });
        
        console.log(`Total Entry Amount: $${totalEntryAmount.toFixed(2)}`);
        
        console.log('\n💰 Entries by Account:');
        Object.entries(entriesByAccount)
            .sort(([,a], [,b]) => b - a)
            .forEach(([account, amount]) => {
                console.log(`  - Account ${account}: $${amount.toFixed(2)}`);
            });
        
        // ========================================
        // IDENTIFY DUPLICATES
        // ========================================
        console.log('\n\n🔍 DUPLICATE ANALYSIS');
        console.log('=====================');
        
        // Group transactions by sourceId
        const transactionsBySource = {};
        transactions.forEach(txn => {
            if (txn.sourceId) {
                if (!transactionsBySource[txn.sourceId]) {
                    transactionsBySource[txn.sourceId] = [];
                }
                transactionsBySource[txn.sourceId].push(txn);
            }
        });
        
        const duplicates = Object.entries(transactionsBySource)
            .filter(([sourceId, txns]) => txns.length > 1);
        
        console.log(`Duplicate Transactions Found: ${duplicates.length}`);
        
        if (duplicates.length > 0) {
            console.log('\n📋 Duplicate Details:');
            duplicates.forEach(([sourceId, txns]) => {
                console.log(`Source ID: ${sourceId}`);
                txns.forEach((txn, index) => {
                    console.log(`  ${index + 1}. Transaction ID: ${txn.transactionId}`);
                    console.log(`     Amount: $${txn.amount}`);
                    console.log(`     Date: ${new Date(txn.date).toLocaleDateString()}`);
                });
                console.log('');
            });
        }
        
        // ========================================
        // SUMMARY
        // ========================================
        console.log('\n\n📊 SUMMARY');
        console.log('===========');
        
        console.log(`Payments: $${totalPaymentAmount.toFixed(2)}`);
        console.log(`Transactions: $${totalTransactionAmount.toFixed(2)}`);
        console.log(`Entries: $${totalEntryAmount.toFixed(2)}`);
        
        const paymentDiff = Math.abs(totalTransactionAmount - totalPaymentAmount);
        const entryDiff = Math.abs(totalEntryAmount - totalPaymentAmount);
        
        console.log(`\nPayment vs Transaction Difference: $${paymentDiff.toFixed(2)}`);
        console.log(`Payment vs Entry Difference: $${entryDiff.toFixed(2)}`);
        
        if (paymentDiff < 0.01 && entryDiff < 0.01) {
            console.log('✅ All amounts are balanced!');
        } else {
            console.log('⚠️ There are discrepancies that need attention.');
        }
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the check
checkTransactionStatus(); 