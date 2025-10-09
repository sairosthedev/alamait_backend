const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugAccountsPayable() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find the specific transaction
        const transactionId = 'TXN1758054462488VVZAI';
        const transaction = await TransactionEntry.findOne({ transactionId });
        
        if (!transaction) {
            console.log('❌ Transaction not found');
            return;
        }

        console.log('🔍 Transaction found:');
        console.log('Transaction ID:', transaction.transactionId);
        console.log('Date:', transaction.date);
        console.log('Source:', transaction.source);
        console.log('Description:', transaction.description);
        console.log('Reference:', transaction.reference);
        console.log('Status:', transaction.status);
        console.log('Entries:', JSON.stringify(transaction.entries, null, 2));

        // Check if this transaction affects accounts payable (account 2000)
        const hasAPEntry = transaction.entries.some(entry => entry.accountCode === '2000');
        console.log('Has AP entry (2000):', hasAPEntry);

        if (hasAPEntry) {
            const apEntry = transaction.entries.find(entry => entry.accountCode === '2000');
            console.log('AP Entry:', JSON.stringify(apEntry, null, 2));
        }

        // Check what the balance sheet query would find for July 2025
        const julyEndDate = new Date('2025-07-31T23:59:59.999Z');
        console.log('\n🔍 Checking what balance sheet query finds for July 2025...');

        // Query that balance sheet uses for expense payments
        const paymentQuery = {
            source: { $in: ['payment', 'vendor_payment', 'expense_payment'] },
            date: { $lte: julyEndDate },
            status: 'posted',
            voided: { $ne: true }
        };

        const foundPayments = await TransactionEntry.find(paymentQuery);
        console.log(`Found ${foundPayments.length} payment transactions up to July 31, 2025`);

        // Check if our specific transaction is included
        const ourTransaction = foundPayments.find(t => t.transactionId === transactionId);
        console.log('Our transaction included in July query:', !!ourTransaction);

        // Check what the balance sheet query would find for August 2025
        const augustEndDate = new Date('2025-08-31T23:59:59.999Z');
        console.log('\n🔍 Checking what balance sheet query finds for August 2025...');

        const augustPaymentQuery = {
            source: { $in: ['payment', 'vendor_payment', 'expense_payment'] },
            date: { $lte: augustEndDate },
            status: 'posted',
            voided: { $ne: true }
        };

        const augustPayments = await TransactionEntry.find(augustPaymentQuery);
        console.log(`Found ${augustPayments.length} payment transactions up to August 31, 2025`);

        // Check if our specific transaction is included
        const ourTransactionAugust = augustPayments.find(t => t.transactionId === transactionId);
        console.log('Our transaction included in August query:', !!ourTransactionAugust);

        // Check all expense_payment transactions for July 2025
        console.log('\n🔍 All expense_payment transactions for July 2025:');
        const julyExpensePayments = await TransactionEntry.find({
            source: 'expense_payment',
            date: { 
                $gte: new Date('2025-07-01T00:00:00.000Z'),
                $lte: new Date('2025-07-31T23:59:59.999Z')
            },
            status: 'posted'
        });

        console.log(`Found ${julyExpensePayments.length} expense_payment transactions in July 2025`);
        julyExpensePayments.forEach(t => {
            console.log(`- ${t.transactionId}: ${t.description} (${t.date.toISOString().split('T')[0]})`);
            const apEntry = t.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                console.log(`  AP Entry: Debit: ${apEntry.debit}, Credit: ${apEntry.credit}`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugAccountsPayable();










