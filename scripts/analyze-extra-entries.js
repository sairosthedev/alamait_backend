// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function analyzeExtraEntries() {
    try {
        console.log('🔍 ANALYZING EXTRA TRANSACTION ENTRIES');
        console.log('======================================');
        
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
        // GET PAYMENT DATA
        // ========================================
        console.log('📊 PAYMENT DATA');
        console.log('===============');
        
        const payments = await Payment.find({});
        let totalPaymentAmount = 0;
        payments.forEach(payment => {
            totalPaymentAmount += payment.totalAmount || payment.rentAmount || 0;
        });
        
        console.log(`Total Payments: ${payments.length}`);
        console.log(`Total Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        // ========================================
        // GET TRANSACTION DATA
        // ========================================
        console.log('\n\n📝 TRANSACTION DATA');
        console.log('===================');
        
        const transactions = await Transaction.find({ type: 'payment' });
        let totalTransactionAmount = 0;
        transactions.forEach(txn => {
            totalTransactionAmount += txn.amount || 0;
        });
        
        console.log(`Total Payment Transactions: ${transactions.length}`);
        console.log(`Total Transaction Amount: $${totalTransactionAmount.toFixed(2)}`);
        
        // ========================================
        // GET ALL TRANSACTION ENTRIES
        // ========================================
        console.log('\n\n📋 ALL TRANSACTION ENTRIES');
        console.log('==========================');
        
        const allEntries = await TransactionEntry.find({});
        console.log(`Total Transaction Entries: ${allEntries.length}`);
        
        let totalEntryAmount = 0;
        let entriesBySource = {};
        let entriesByAccount = {};
        
        allEntries.forEach(entry => {
            const amount = entry.totalCredit || 0;
            totalEntryAmount += amount;
            
            const source = entry.source || 'unknown';
            entriesBySource[source] = (entriesBySource[source] || 0) + amount;
            
            // Check account codes
            entry.entries.forEach(accEntry => {
                const accountCode = accEntry.accountCode;
                entriesByAccount[accountCode] = (entriesByAccount[accountCode] || 0) + (accEntry.credit || 0);
            });
        });
        
        console.log(`Total Entry Amount: $${totalEntryAmount.toFixed(2)}`);
        
        console.log('\n💰 Entries by Source:');
        Object.entries(entriesBySource)
            .sort(([,a], [,b]) => b - a)
            .forEach(([source, amount]) => {
                console.log(`  - ${source}: $${amount.toFixed(2)}`);
            });
        
        console.log('\n💰 Entries by Account:');
        Object.entries(entriesByAccount)
            .sort(([,a], [,b]) => b - a)
            .forEach(([account, amount]) => {
                console.log(`  - Account ${account}: $${amount.toFixed(2)}`);
            });
        
        // ========================================
        // GET PAYMENT ENTRIES SPECIFICALLY
        // ========================================
        console.log('\n\n💳 PAYMENT ENTRIES ONLY');
        console.log('=======================');
        
        const paymentEntries = await TransactionEntry.find({ source: 'payment' });
        console.log(`Payment Entries: ${paymentEntries.length}`);
        
        let totalPaymentEntryAmount = 0;
        paymentEntries.forEach(entry => {
            totalPaymentEntryAmount += entry.totalCredit || 0;
        });
        
        console.log(`Payment Entry Amount: $${totalPaymentEntryAmount.toFixed(2)}`);
        
        // ========================================
        // FIND EXTRA ENTRIES
        // ========================================
        console.log('\n\n🔍 EXTRA ENTRIES ANALYSIS');
        console.log('==========================');
        
        const extraAmount = totalEntryAmount - totalPaymentEntryAmount;
        console.log(`Extra Entry Amount: $${extraAmount.toFixed(2)}`);
        
        if (extraAmount > 0) {
            console.log('\n📋 Extra Entries Details:');
            
            const nonPaymentEntries = await TransactionEntry.find({ 
                source: { $ne: 'payment' } 
            });
            
            console.log(`Non-payment entries: ${nonPaymentEntries.length}`);
            
            nonPaymentEntries.forEach((entry, index) => {
                console.log(`\n${index + 1}. Entry ID: ${entry._id}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Amount: $${entry.totalCredit}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   Date: ${new Date(entry.date).toLocaleDateString()}`);
                console.log(`   Status: ${entry.status}`);
                
                if (entry.entries && entry.entries.length > 0) {
                    console.log(`   Account Entries:`);
                    entry.entries.forEach(accEntry => {
                        console.log(`     - ${accEntry.accountCode}: $${accEntry.credit}`);
                    });
                }
            });
        }
        
        // ========================================
        // SUMMARY
        // ========================================
        console.log('\n\n📊 SUMMARY');
        console.log('===========');
        
        console.log(`Payments: $${totalPaymentAmount.toFixed(2)}`);
        console.log(`Transactions: $${totalTransactionAmount.toFixed(2)}`);
        console.log(`Payment Entries: $${totalPaymentEntryAmount.toFixed(2)}`);
        console.log(`All Entries: $${totalEntryAmount.toFixed(2)}`);
        
        const paymentDiff = Math.abs(totalTransactionAmount - totalPaymentAmount);
        const entryDiff = Math.abs(totalPaymentEntryAmount - totalPaymentAmount);
        
        console.log(`\nPayment vs Transaction Difference: $${paymentDiff.toFixed(2)}`);
        console.log(`Payment vs Entry Difference: $${entryDiff.toFixed(2)}`);
        
        if (paymentDiff < 0.01 && entryDiff < 0.01) {
            console.log('✅ All payment amounts are balanced!');
        } else {
            console.log('⚠️ There are discrepancies.');
        }
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the analysis
analyzeExtraEntries(); 