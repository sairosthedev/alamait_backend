const mongoose = require('mongoose');

async function checkRecentPayments() {
    try {
        // Connect to the alamait_backend database (most likely where payments are)
        await mongoose.connect('mongodb://localhost:27017/alamait_backend', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to alamait_backend database');
        
        const Payment = require('./src/models/Payment');
        const Debtor = require('./src/models/Debtor');
        const Transaction = require('./src/models/Transaction');
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        // Check total counts
        const paymentCount = await Payment.countDocuments();
        const debtorCount = await Debtor.countDocuments();
        const transactionCount = await Transaction.countDocuments();
        const transactionEntryCount = await TransactionEntry.countDocuments();
        
        console.log('\n📊 Database Overview:');
        console.log(`   Payments: ${paymentCount}`);
        console.log(`   Debtors: ${debtorCount}`);
        console.log(`   Transactions: ${transactionCount}`);
        console.log(`   Transaction Entries: ${transactionEntryCount}`);
        
        if (paymentCount > 0) {
            console.log('\n🔍 Recent Payments:');
            const recentPayments = await Payment.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('paymentId student totalAmount status createdAt');
            
            recentPayments.forEach((payment, index) => {
                console.log(`   ${index + 1}. ${payment.paymentId} - Student: ${payment.student} - $${payment.totalAmount} - ${payment.status} - ${payment.createdAt}`);
            });
        }
        
        if (debtorCount > 0) {
            console.log('\n🔍 Recent Debtors:');
            const recentDebtors = await Debtor.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('debtorCode user currentBalance totalPaid createdAt');
            
            recentDebtors.forEach((debtor, index) => {
                console.log(`   ${index + 1}. ${debtor.debtorCode} - User: ${debtor.user} - Balance: $${debtor.currentBalance} - Paid: $${debtor.totalPaid} - ${debtor.createdAt}`);
            });
        }
        
        if (transactionCount > 0) {
            console.log('\n🔍 Recent Transactions:');
            const recentTransactions = await Transaction.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('transactionId type description amount createdAt');
            
            recentTransactions.forEach((transaction, index) => {
                console.log(`   ${index + 1}. ${transaction.transactionId} - ${transaction.type} - ${transaction.description} - $${transaction.amount} - ${transaction.createdAt}`);
            });
        }
        
        if (transactionEntryCount > 0) {
            console.log('\n🔍 Recent Transaction Entries:');
            const recentEntries = await TransactionEntry.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('transactionId totalDebit totalCredit source sourceId createdAt');
            
            recentEntries.forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry.transactionId} - Debit: $${entry.totalDebit} - Credit: $${entry.totalCredit} - Source: ${entry.source} - ${entry.createdAt}`);
            });
        }
        
        // Check for any validation errors
        console.log('\n🔍 Checking for validation issues...');
        
        const invalidTransactions = await Transaction.find({
            $or: [
                { createdBy: { $exists: false } },
                { transactionId: { $exists: false } }
            ]
        });
        
        if (invalidTransactions.length > 0) {
            console.log(`   Found ${invalidTransactions.length} invalid transactions`);
            invalidTransactions.forEach((invalid, index) => {
                console.log(`     ${index + 1}. ID: ${invalid._id} - CreatedBy: ${invalid.createdBy} - TransactionId: ${invalid.transactionId}`);
            });
        } else {
            console.log('   ✅ All transactions appear valid');
        }
        
        // Check for any payments without debtors
        if (paymentCount > 0) {
            console.log('\n🔍 Checking payments without debtors...');
            const payments = await Payment.find().select('student');
            const studentIds = [...new Set(payments.map(p => p.student.toString()))];
            
            for (const studentId of studentIds) {
                const debtor = await Debtor.findOne({ user: studentId });
                if (!debtor) {
                    console.log(`   ❌ Student ${studentId} has payments but no debtor account`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

checkRecentPayments();
