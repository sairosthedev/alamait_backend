const mongoose = require('mongoose');

async function checkAlamaitDatabase() {
    try {
        // Connect to the alamait database
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to alamait database');
        
        const Payment = require('./src/models/Payment');
        const Debtor = require('./src/models/Debtor');
        const Transaction = require('./src/models/Transaction');
        const TransactionEntry = require('./src/models/TransactionEntry');
        const User = require('./src/models/User');
        
        // Check total counts
        const paymentCount = await Payment.countDocuments();
        const debtorCount = await Debtor.countDocuments();
        const transactionCount = await Transaction.countDocuments();
        const transactionEntryCount = await TransactionEntry.countDocuments();
        const userCount = await User.countDocuments();
        
        console.log('\n📊 Database Overview:');
        console.log(`   Users: ${userCount}`);
        console.log(`   Payments: ${paymentCount}`);
        console.log(`   Debtors: ${debtorCount}`);
        console.log(`   Transactions: ${transactionCount}`);
        console.log(`   Transaction Entries: ${transactionEntryCount}`);
        
        if (paymentCount > 0) {
            console.log('\n🔍 Recent Payments:');
            const recentPayments = await Payment.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .select('paymentId student totalAmount status createdAt');
            
            recentPayments.forEach((payment, index) => {
                console.log(`   ${index + 1}. ${payment.paymentId} - Student: ${payment.student} - $${payment.totalAmount} - ${payment.status} - ${payment.createdAt}`);
            });
            
            // Look for the specific payment
            const specificPayment = await Payment.findOne({ paymentId: 'PAY-1755226825185' });
            if (specificPayment) {
                console.log('\n🎯 Found the specific payment!');
                console.log(`   ID: ${specificPayment._id}`);
                console.log(`   Student: ${specificPayment.student}`);
                console.log(`   Amount: $${specificPayment.totalAmount}`);
                console.log(`   Status: ${specificPayment.status}`);
                console.log(`   Created: ${specificPayment.createdAt}`);
                
                // Check if debtor exists for this student
                const debtor = await Debtor.findOne({ user: specificPayment.student });
                if (debtor) {
                    console.log('✅ Debtor found:');
                    console.log(`   ID: ${debtor._id}`);
                    console.log(`   Code: ${debtor.debtorCode}`);
                    console.log(`   Current Balance: $${debtor.currentBalance}`);
                    console.log(`   Total Paid: $${debtor.totalPaid}`);
                    console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
                } else {
                    console.log('❌ No debtor found for this student');
                }
                
                // Check transactions
                const transactions = await Transaction.find({ reference: specificPayment._id.toString() });
                console.log(`   Transactions found: ${transactions.length}`);
                
                const transactionEntries = await TransactionEntry.find({ sourceId: specificPayment._id });
                console.log(`   Transaction entries found: ${transactionEntries.length}`);
            }
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
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

checkAlamaitDatabase();
